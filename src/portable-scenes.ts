import {stereoLinkGroup,stereoConflict,stereoLinkSummary} from '../shared/stereo-link.js';
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

async function preparePortable(xr:XR18,control:ConsoleControl,library:LibraryStore,input:Record<string,Value>,expectedLinks:Record<string,Value>,previousGuards?:Record<string,Value>){
 const model=portableModel(xr.model().id),identity=control.identity(),operation=xr.operationId();
 const check=()=>{if(identity!==control.identity()||operation!==xr.operationId())throw Error('Connexion modifiée');};
 const protections=library.protections(model.id),protectedChannels=new Map(protections.rules.map(rule=>[rule.channel,new Set(rule.sections)]));
 const values:Record<string,Value>={},guards:Record<string,Value>={},before:Record<string,Value>={},excluded:Record<number,Set<PortableSection>>={};
 const prepared=new Set<number>();
 // Read topology first, including protected members. Recall never creates a pair.
 for(const [address,value] of Object.entries(expectedLinks)){
  if(!/^\/config\/chlink\/\d+-\d+$/.test(address)||!xr.supports(address)||(value!==0&&value!==1))throw Error(PORTABLE_INVALID);
  check();guards[address]=await xr.readParameter(address);if(guards[address]!==value)throw Error(PORTABLE_LINKED);
 }
 for(const [address,value] of Object.entries(input)){
  const match=/^\/ch\/(\d{2})\/(.+)$/.exec(address);
  const ch=Number(match?.[1]),leaf=match?.[2]??'',group=allowedSection(leaf);
  if(!group||!Number.isInteger(ch)||ch<1||ch>model.channels||!xr.supports(address)||guards[stereoLink(ch)]===undefined)throw Error(PORTABLE_INVALID);
  const linked=guards[stereoLink(ch)]===1,partner=ch%2?ch+1:ch-1,family=stereoLinkGroup(leaf);
  if(linked&&family){const option='/config/linkcfg/'+family;guards[option]??=await xr.readParameter(option);}
  const shared=linked&&family!==null&&guards['/config/linkcfg/'+family]!==0;
  if(protectedChannels.get(ch)?.has(group)||shared&&protectedChannels.get(partner)?.has(group)){
   (excluded[ch]??=new Set()).add(group);continue;
  }
  if(shared&&(!Object.hasOwn(input,prefix(partner)+leaf)||input[prefix(partner)+leaf]!==value))throw Error(stereoConflict(leaf));
  if(!prepared.has(ch)){
   check();
   for(const source of sourceLeaves){const guard=prefix(ch)+source;if(xr.supports(guard))guards[guard]=await xr.readParameter(guard);}
   prepared.add(ch);
  }
  check();before[address]=await xr.readParameter(address);values[address]=validateWire(address,value);
 }
 // Keep both shared sides in the preview and backup, even if one was unchanged.
 for(const [address,value] of Object.entries(values)){
  const [,number,leaf]=/^\/ch\/(\d{2})\/(.+)$/.exec(address)!;
  const ch=Number(number),family=stereoLinkGroup(leaf!);
  if(guards[stereoLink(ch)]===1&&family&&guards['/config/linkcfg/'+family]!==0){
   const other=prefix(ch%2?ch+1:ch-1)+leaf;
   if(values[other]!==value||before[other]!==before[address])throw Error(stereoConflict(leaf!));
  }
 }
 if(previousGuards)for(const [address,value] of Object.entries(previousGuards)){
  check();if((guards[address]??await xr.readParameter(address))!==value)throw Error(PORTABLE_CHANGED);
 }
 check();control.checkRecallRevision(protections.revision);
 const skipped=Object.entries(excluded).map(([channel,sections])=>({channel:Number(channel),sections:[...sections]}));
 if(!Object.entries(values).some(([a,v])=>typeof v==='number'&&typeof before[a]==='number'?Math.abs(v-Number(before[a]))>1e-10:v!==before[a]))return {token:null,changes:[],excluded:skipped};
 const result=await control.preview(values,true,guards,'portable-scene-backup',before,protections.revision,identity);
 return {...result,excluded:skipped,stereoLink:stereoLinkSummary(Object.keys(values),guards)};
}

export async function previewPortable(xr:XR18,control:ConsoleControl,library:LibraryStore,entry:Entry,body:Record<string,unknown>){
 const model=portableModel(body.model);
 if(model.id!==xr.model().id)throw Error('Connexion modifiée');
 if(entry.kind!=='portable-scene')throw Error(PORTABLE_INVALID);
 const scene=validatePortableScene(entry.data),sections=body.sections as PortableSection[],mapping=body.mapping as {source:number;target:number}[];
 if(!Array.isArray(sections)||!sections.length||sections.some(s=>!PORTABLE_SECTIONS.includes(s))||new Set(sections).size!==sections.length||
  !Array.isArray(mapping)||!mapping.length||mapping.length>model.channels||mapping.some(m=>!m||!Number.isInteger(m.source)||!Number.isInteger(m.target)||m.target<1||m.target>model.channels)||
  new Set(mapping.map(m=>m.source)).size!==mapping.length||new Set(mapping.map(m=>m.target)).size!==mapping.length)throw Error(PORTABLE_SCOPE);
 const values:Record<string,Value>={},topology:Record<string,Value>={};
 for(const {source,target} of mapping){
  const track=scene.tracks.find(t=>t.channel===source);
  if(!track)throw Error(PORTABLE_SCOPE);
  if(track.linked){
   const partner=source%2?source+1:source-1,other=mapping.find(m=>m.source===partner);
   if(!scene.tracks.find(t=>t.channel===partner)?.linked||!other||source%2!==target%2||other.target!==(target%2?target+1:target-1))throw Error(PORTABLE_LINKED);
  }
  const link=stereoLink(target),value=Number(track.linked);
  if(topology[link]!==undefined&&topology[link]!==value)throw Error(PORTABLE_LINKED);
  topology[link]=value;
  Object.assign(values,wireValues(track,target,sections));
 }
 return preparePortable(xr,control,library,values,topology);
}

export async function previewPortableBackup(xr:XR18,control:ConsoleControl,library:LibraryStore,entry:Entry){
 const saved=entry.data as {version:number;model:string;values:Record<string,Value>;guards:Record<string,Value>};
 if(saved?.version!==1||saved.model!==xr.model().id||!saved.values||!saved.guards)throw Error(PORTABLE_INVALID);
 return preparePortable(xr,control,library,saved.values,Object.fromEntries(Object.entries(saved.guards).filter(([a])=>a.startsWith('/config/chlink/'))),saved.guards);
}
