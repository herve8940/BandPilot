import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';
import {channelLink,channelPrefix,channelReader} from './channel-operations.js';
import {busLinkAddress,busPairStart} from '../shared/monitor-pairs.js';
import {GEQ_KEYS,roomCorrections} from '../shared/room-eq.js';
import {descriptor,fromWire,toWire,type Value} from './parameters.js';

const sourceError='Le gain compensé exige une entrée dédiée et un trajet sans liaison stéréo, Automix ni effet inséré.';
const chainError='Ce canal utilise une clé externe ou sert de clé à un autre traitement. Vérifie le trajet avant de changer le gain.';
const formatBus=(n:number)=>String(n).padStart(2,'0');
function available(xr:XR18,model:unknown){
 if(xr.model().family!=='xair'||model!==xr.model().id)throw Error('Connexion modifiée');
 const status=xr.status();
 if(status.mode==='real'&&(!status.connected||!status.writesEnabled))throw Error('Connecte la console et active son contrôle avant de préparer un rappel.');
}
const isGain=(address:string)=>/^\/headamp\/\d{2}\/gain$/.test(address)||/^\/ch\/\d{2}\/preamp\/rtntrim$/.test(address);

function orderedGain(values:Record<string,Value>,before:Record<string,Value>){
 const entries=Object.entries(values),gain=entries.find(([a])=>isGain(a));
 if(!gain)return values;
 const others=entries.filter(([address])=>address!==gain[0]);
 return Object.fromEntries(Number(gain[1])<Number(before[gain[0]])?[gain,...others]:[...others,gain]);
}
export async function previewGainCompensation(xr:XR18,control:ConsoleControl,input:unknown){
 const {model,channel,delta}=input as {model:string;channel:number;delta:number};
 available(xr,model);
 if(!Number.isInteger(channel)||channel<1||channel>xr.model().channels||!Number.isFinite(delta)||delta===0||Math.abs(delta)>6||!Number.isInteger(delta*2))throw Error('Choisis une variation de gain de −6 à +6 dB par demi-décibel.');
 const reader=channelReader(xr,control),guards:Record<string,Value>={},before:Record<string,Value>={},values:Record<string,Value>={};
 const guard=async(a:string)=>guards[a]??(guards[a]=await reader.read(a));
 const shift=async(address:string,db:number,silence=false)=>{
  const current=await reader.read(address);
  if(silence&&current===0){guards[address]=current;return;}
  const desired=Number(fromWire(address,current))+db;
  const {min,max}=descriptor(address);
  if(desired<min!-1e-8||desired>max!+1e-8||silence&&desired<=-90)throw Error('Un réglage atteindrait sa limite. Réduis la variation de gain.');
  before[address]=current;
  values[address]=toWire(address,Math.max(min!,Math.min(max!,desired)));
 };
 const prefix=channelPrefix(channel);
 if(await guard(channelLink(channel))===1||await guard(prefix+'automix/group')!==0||
    await guard(prefix+'insert/on')===1&&await guard(prefix+'insert/sel')!==0)throw Error(sourceError);
 const usb=xr.supports(prefix+'preamp/rtnsw')&&await guard(prefix+'preamp/rtnsw')===1;
 const source=Number(await guard(prefix+'config/insrc'));
 const gain=usb?prefix+'preamp/rtntrim':`/headamp/${formatBus(source+1)}/gain`;
 if(!usb&&(source<0||source>=xr.model().micPreamps||!xr.supports(gain)))throw Error(sourceError);
 if(usb&&xr.supports(prefix+'config/rtnsrc'))await guard(prefix+'config/rtnsrc');
 for(let i=1;i<=xr.model().channels;i++){
  const input=channelPrefix(i);
  if(i!==channel&&!usb){
   const otherSource=await guard(input+'config/insrc');
   const otherUSB=xr.supports(input+'preamp/rtnsw')&&await guard(input+'preamp/rtnsw')===1;
   if(otherSource===source&&!otherUSB)throw Error(sourceError);
  }
  for(const processor of ['gate','dyn']){
   const on=await guard(input+processor+'/on'),key=input+processor+'/keysrc';
   if(!on)continue;
   const keyIndex=Number(await guard(key));
   if(i===channel&&keyIndex!==0||i!==channel&&descriptor(key).options?.[keyIndex]===`Ch${formatBus(channel)}`)throw Error(chainError);
   if(i===channel)await shift(input+processor+'/thr',delta);
  }
 }
 // Bus compressors can also take an input channel as their detector.
 for(const output of ['/lr',...Array.from({length:xr.model().buses},(_,i)=>'/bus/'+(i+1))]){
  const on=output+'/dyn/on',key=output+'/dyn/keysrc';
  if(xr.supports(on)&&xr.supports(key)&&await guard(on)&&descriptor(key).options?.[Number(await guard(key))]===`Ch${formatBus(channel)}`)throw Error(chainError);
 }
 await shift(prefix+'mix/fader',-delta,true);
 const taps=new Map<number,Value>();
 for(let bus=1;bus<=10;bus++){
  const send=prefix+`mix/${formatBus(bus)}/`;
  if(!xr.supports(send+'tap')||!xr.supports(send+'level'))continue;
  if(bus<=xr.model().buses)await guard(busLinkAddress(bus));
  const tap=await guard(send+'tap');
  taps.set(bus,tap);
  if(tap===5&&await guard(send+'grpon')===1)throw Error(sourceError);
  if(Number(tap)<4)await shift(send+'level',-delta,true);
 }
 for(let bus=1;bus<=xr.model().buses;bus+=2)if(guards[busLinkAddress(bus)]===1){
  const first=prefix+`mix/${formatBus(busPairStart(bus))}/level`;
  const second=prefix+`mix/${formatBus(busPairStart(bus)+1)}/level`;
  if(taps.get(bus)!==taps.get(bus+1)||values[first]!==values[second])throw Error(sourceError);
 }
 await shift(gain,delta);
 reader.check();
 return control.preview(orderedGain(values,before),true,guards,'mix-preparation-backup',before);
}

export async function previewRoomEq(xr:XR18,control:ConsoleControl,input:unknown){
 const {model,target,curve,peak,maxCut}=input as {model:string;target:string;curve:unknown;peak:unknown;maxCut:number};
 available(xr,model);
 const bus=/^\/bus\/(\d)$/.exec(target);
 if(target!=='/lr'&&(!bus||Number(bus[1])<1||Number(bus[1])>xr.model().monitorOutputs))throw Error('Sortie de mesure invalide.');
 const cuts=roomCorrections(curve,peak,maxCut);
 const reader=channelReader(xr,control),guards:Record<string,Value>={},before:Record<string,Value>={},values:Record<string,Value>={};
 const targets=[target];
 if(bus){
  const number=Number(bus[1]),link=busLinkAddress(number);
  guards[link]=await reader.read(link);
  if(guards[link]===1)targets.splice(0,1,`/bus/${busPairStart(number)}`,`/bus/${busPairStart(number)+1}`);
 }
 for(const output of targets){
  const mode=output+'/eq/mode',enabled=output+'/eq/on';
  guards[mode]=await reader.read(mode);
  guards[enabled]=await reader.read(enabled);
  if(![1,2].includes(Number(guards[mode]))||guards[enabled]!==1)throw Error('Active un GEQ ou True EQ sur cette sortie avant de préparer une correction.');
  for(const {index,db} of cuts){
   const address=output+'/geq/'+GEQ_KEYS[index];
   const previous=before[address]=await reader.read(address);
   const desired=Math.max(-15,Math.ceil((Number(fromWire(address,previous))+db-1e-8)*2)/2);
   if(Number(fromWire(address,previous))>desired+1e-6)values[address]=toWire(address,desired);
  }
 }
 if(targets.length===2){
  const [left,right]=targets;
  if(guards[left+'/eq/mode']!==guards[right+'/eq/mode'])throw Error('Les deux côtés du retour stéréo ont des égaliseurs différents.');
  for(const key of GEQ_KEYS)if(before[left+'/geq/'+key]!==before[right+'/geq/'+key])throw Error('Les deux côtés du retour stéréo ont des égaliseurs différents.');
 }
 reader.check();
 if(!Object.keys(values).length)return {token:null,changes:[]};
 return control.preview(values,true,guards,'mix-preparation-backup',before);
}
export async function previewMixPreparationBackup(xr:XR18,control:ConsoleControl,library:LibraryStore,id:string){
 const entry=library.get(id);
 const backup=entry.data as {version:number;model:string;values:Record<string,Value>;guards:Record<string,Value>};
 if(entry.kind!=='mix-preparation-backup'||backup.version!==1||!backup.values||!backup.guards)throw Error('Sauvegarde incompatible avec cette console.');
 available(xr,backup.model);
 const reader=channelReader(xr,control),before:Record<string,Value>={};
 for(const address of Object.keys(backup.values))before[address]=await reader.read(address);
 return control.preview(orderedGain(backup.values,before),true,backup.guards,'mix-preparation-backup',before);
}
