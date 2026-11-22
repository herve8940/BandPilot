import {PORTABLE_CHANGED,PORTABLE_FILTERS,PORTABLE_FORMAT,PORTABLE_INVALID,PORTABLE_LINKED,PORTABLE_SCOPE,PORTABLE_SECTIONS,portableModel,validatePortableScene,type PortableScene,type PortableSection,type PortableTrack} from '../shared/portable-scene.js';
import {sceneRecallSection} from '../shared/scene-recall.js';
import {nativeSceneSettings} from './native-scene-recall.js';
import {fromWire,toWire,validateWire,type Value} from './parameters.js';
import type {ConsoleControl,CompleteScene} from './console-control.js';
import type {Entry,LibraryStore} from './library-store.js';
import type {XR18} from './xr18.js';

const bandNumbers=[1,2,3,4];
const bandLeaves=['type','f','g','q'];
const simple={
 name:'config/name',color:'config/color',levelDb:'mix/fader',muted:'mix/on',pan:'mix/pan',
} as const;
const sourceLeaves=['config/insrc','config/rtnsrc','preamp/rtnsw'];
const portableLeaves=[...Object.values(simple),'preamp/hpon','preamp/hpf','eq/on',...bandNumbers.flatMap(i=>bandLeaves.map(leaf=>`eq/${i}/${leaf}`))];
const prefix=(ch:number)=>`/ch/${String(ch).padStart(2,'0')}/`;
const stereoLink=(ch:number)=>{const first=ch%2?ch:ch-1;return `/config/chlink/${first}-${first+1}`;};
const section=(leaf:string)=>leaf==='mix/pan'?'levels':sceneRecallSection(leaf);
const allowedSection=(leaf:string):PortableSection|null=>{
 const group=portableLeaves.includes(leaf)?section(leaf):null;
 return group==='labels'||group==='levels'||group==='eq'?group:null;
};

export function portableFromValues(source:unknown,values:Record<string,unknown>,channels?:number[]):PortableScene{
 const model=portableModel(source);
 const tracks=(channels??Array.from({length:model.channels},(_,i)=>i+1)).flatMap((channel):PortableTrack[]=>{
  const read=(leaf:string)=>{
   const address=prefix(channel)+leaf;
   return Object.hasOwn(values,address)?fromWire(address,validateWire(address,values[address])):undefined;
  };
  // A missing link entry leaves the channel's stereo status unknown.
  const link=values[stereoLink(channel)];
  if(link!==0&&link!==1)return [];
  const track:PortableTrack={channel,linked:link===1};
  const name=read(simple.name),color=read(simple.color),level=read(simple.levelDb),on=read(simple.muted),pan=read(simple.pan);
  if(typeof name==='string')track.name=name;
  if(typeof color==='number')track.color=color;
  if(typeof level==='number')track.levelDb=level;
  if(typeof on==='number')track.muted=on===0;
  if(typeof pan==='number')track.pan=pan;
  const hp=read('preamp/hpon'),hz=read('preamp/hpf');
  if(typeof hp==='number'&&typeof hz==='number')track.highPass={enabled:hp===1,hz:Math.min(400,hz)};
  const eqOn=read('eq/on');
  const bands=bandNumbers.flatMap(i=>{
   const type=PORTABLE_FILTERS[Number(read(`eq/${i}/type`))];
   const hz=read(`eq/${i}/f`),db=read(`eq/${i}/g`),q=read(`eq/${i}/q`);
   return type&&typeof hz==='number'&&typeof db==='number'&&typeof q==='number'?[{type,hz:Math.min(20000,hz),db,q:Math.min(10,q)}]:[];
  });
  if(typeof eqOn==='number'&&bands.length===4)track.eq={enabled:eqOn===1,bands};
  return Object.keys(track).length>2?[track]:[];
 });
 return validatePortableScene({format:PORTABLE_FORMAT,version:1,source:model.id,tracks});
}

function wireValues(track:PortableTrack,target:number,sections:PortableSection[]){
 const {name,color,levelDb,muted,pan,highPass,eq}=track;
 const settings:Record<string,Value|undefined>={
  'config/name':name,'config/color':color,'mix/fader':levelDb,'mix/on':muted===undefined?undefined:Number(!muted),'mix/pan':pan,
  'preamp/hpon':highPass===undefined?undefined:Number(highPass.enabled),'preamp/hpf':highPass?.hz,
  'eq/on':eq===undefined?undefined:Number(eq.enabled),
 };
 eq?.bands.forEach(({type,hz,db,q},i)=>Object.assign(settings,{
  [`eq/${i+1}/type`]:PORTABLE_FILTERS.indexOf(type),[`eq/${i+1}/f`]:hz,[`eq/${i+1}/g`]:db,[`eq/${i+1}/q`]:q,
 }));
 const values:Record<string,Value>={};
 for(const [leaf,value] of Object.entries(settings)){
  if(value!==undefined&&sections.includes(allowedSection(leaf) as PortableSection)){
   const address=prefix(target)+leaf;
   values[address]=toWire(address,value);
  }
 }
 return values;
}

export function portableFromEntry(entry:Entry,source:unknown){
 if(entry.kind==='native-scene'){
  const {id}=portableModel(source);
  const {values}=nativeSceneSettings(entry.data,id);
  return portableFromValues(id,values);
 }
 const scene=entry.data as CompleteScene;
 if(entry.kind!=='scene'||scene?.version!==2||scene.scope!=='console'||!scene.values||typeof scene.values!=='object'||Array.isArray(scene.values))throw Error(PORTABLE_INVALID);
 return portableFromValues(scene.model??source,scene.values);
}

export async function capturePortable(xr:XR18,control:ConsoleControl,model:unknown){
 const source=portableModel(model);
 if(source.id!==xr.model().id)throw Error('Connexion modifiée');
 const identity=control.identity(),operation=xr.operationId(),values:Record<string,Value>={};
 const check=()=>{if(identity!==control.identity()||operation!==xr.operationId())throw Error('Connexion modifiée');};
 const channels=Array.from({length:source.channels},(_,i)=>i+1);
 const links=[...new Set(channels.map(stereoLink))];
 const leaves=channels.flatMap(ch=>portableLeaves.map(leaf=>prefix(ch)+leaf));
 const addresses=[...links,...leaves];
 for(let i=0;i<addresses.length;i+=8){
  check();
  await Promise.all(addresses.slice(i,i+8).map(async a=>{values[a]=await xr.readParameter(a);}));
 }
 for(const address of links)if(await xr.readParameter(address)!==values[address])throw Error(PORTABLE_CHANGED);
 check();
 return portableFromValues(source.id,values,channels);
}

async function preparePortable(xr:XR18,control:ConsoleControl,library:LibraryStore,input:Record<string,Value>,previousGuards?:Record<string,Value>){
 const model=portableModel(xr.model().id),identity=control.identity(),operation=xr.operationId();
 const check=()=>{if(identity!==control.identity()||operation!==xr.operationId())throw Error('Connexion modifiée');};
 const protections=library.protections(model.id),protectedChannels=new Map(protections.rules.map(rule=>[rule.channel,new Set(rule.sections)]));
 const values:Record<string,Value>={},guards:Record<string,Value>={},before:Record<string,Value>={},excluded:Record<number,Set<PortableSection>>={};
 const prepared=new Set<number>();
 for(const [address,value] of Object.entries(input)){
  const match=/^\/ch\/(\d{2})\/(.+)$/.exec(address);
  const ch=Number(match?.[1]),group=match&&allowedSection(match[2]!);
  if(!group||!Number.isInteger(ch)||ch<1||ch>model.channels||!xr.supports(address))throw Error(PORTABLE_INVALID);
  if(protectedChannels.get(ch)?.has(group)){(excluded[ch]??=new Set()).add(group);continue;}
  if(!prepared.has(ch)){
   check();
   const link=stereoLink(ch);
   guards[link]??=await xr.readParameter(link);
   if(guards[link]!==0)throw Error(PORTABLE_LINKED);
   for(const leaf of sourceLeaves){
    const guard=prefix(ch)+leaf;
    if(xr.supports(guard))guards[guard]=await xr.readParameter(guard);
   }
   prepared.add(ch);
  }
  check();
  const current=await xr.readParameter(address);
  if(typeof current==='number'&&typeof value==='number'?Math.abs(current-value)<=1e-10:current===value)continue;
  values[address]=validateWire(address,value);before[address]=current;
 }
 for(const [address,value] of Object.entries(guards))if(previousGuards&&previousGuards[address]!==value)throw Error(PORTABLE_CHANGED);
 check();
 control.checkRecallRevision(protections.revision);
 const skipped=Object.entries(excluded).map(([channel,sections])=>({channel:Number(channel),sections:[...sections]}));
 if(!Object.keys(values).length)return {token:null,changes:[],excluded:skipped};
 const result=await control.preview(values,true,guards,'portable-scene-backup',before,protections.revision,identity);
 return {...result,excluded:skipped};
}

export async function previewPortable(xr:XR18,control:ConsoleControl,library:LibraryStore,entry:Entry,body:Record<string,unknown>){
 const model=portableModel(body.model);
 if(model.id!==xr.model().id)throw Error('Connexion modifiée');
 if(entry.kind!=='portable-scene')throw Error(PORTABLE_INVALID);
 const scene=validatePortableScene(entry.data),sections=body.sections as PortableSection[],mapping=body.mapping as {source:number;target:number}[];
 if(!Array.isArray(sections)||!sections.length||sections.some(s=>!PORTABLE_SECTIONS.includes(s))||new Set(sections).size!==sections.length||
  !Array.isArray(mapping)||!mapping.length||mapping.length>model.channels||mapping.some(m=>!m||!Number.isInteger(m.source)||!Number.isInteger(m.target)||m.target<1||m.target>model.channels)||
  new Set(mapping.map(m=>m.source)).size!==mapping.length||new Set(mapping.map(m=>m.target)).size!==mapping.length)throw Error(PORTABLE_SCOPE);
 const values:Record<string,Value>={};
 for(const {source,target} of mapping){
  const track=scene.tracks.find(t=>t.channel===source);
  if(!track)throw Error(PORTABLE_SCOPE);
  if(track.linked)throw Error(PORTABLE_LINKED);
  Object.assign(values,wireValues(track,target,sections));
 }
 return preparePortable(xr,control,library,values);
}

export async function previewPortableBackup(xr:XR18,control:ConsoleControl,library:LibraryStore,entry:Entry){
 const saved=entry.data as {version:number;model:string;values:Record<string,Value>;guards:Record<string,Value>};
 if(saved?.version!==1||saved.model!==xr.model().id||!saved.values||!saved.guards)throw Error(PORTABLE_INVALID);
 return preparePortable(xr,control,library,saved.values,saved.guards);
}
