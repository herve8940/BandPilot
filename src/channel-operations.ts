import {BATCH_SETTINGS,batchPath,batchUsesBand,type BatchSetting} from '../shared/batch-edit.js';
import {groupSelection} from '../shared/adjustment-group.js';
import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';
import {presetSection} from '../shared/channel-preset.js';
import {busLinkAddress,busPairStart} from '../shared/monitor-pairs.js';
import {descriptor,fromWire,toWire,validateWire,type Value} from './parameters.js';
import {STEREO_LINK_GROUPS,stereoSettingShared,stereoConflict,stereoLinkSummary} from '../shared/stereo-link.js';

export const channelPrefix=(n:number)=>`/ch/${String(n).padStart(2,'0')}/`;
export const channelLink=(n:number)=>`/config/chlink/${n%2?n:n-1}-${n%2?n+1:n}`;
const same=(a:Value,b:Value)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<.000001:a===b;
export function channelReader(xr:XR18,control:ConsoleControl){
  const identity=control.identity(),epoch=xr.operationId();
  const check=()=>{if(identity!==control.identity()||epoch!==xr.operationId())throw Error('Connexion modifiée ou opération interrompue');};
  return {check,read:async(address:string)=>{check();const value=await xr.readParameter(address);check();return value;}};
}
function available(xr:XR18){
  if(xr.model().family!=='xair')throw Error('Cette opération nécessite une console X-Air / M-Air.');
  const s=xr.status();if(s.mode==='real'&&(!s.connected||!s.writesEnabled))throw Error('Connecte la console et active son contrôle avant de préparer un rappel.');
}
function allowed(address:string){
  const m=/^\/ch\/(\d{2})\/(.+)$/.exec(address);
  return m&&(presetSection(m[2]!)||/^mix\/(fader|on|pan|\d{2}\/(?:level|tap))$/.test(m[2]!));
}
/** Keep linked inputs together for preview/undo, while respecting each family's
 * global link preference. Never toggle a preference to accommodate a preset. */
export async function previewChannelOperation(xr:XR18,control:ConsoleControl,values:Record<string,Value>,expectedGuards:Record<string,Value>={},expectedBefore?:Record<string,Value>){
  available(xr);
  if(!values||typeof values!=='object'||Array.isArray(values)||!Object.keys(values).length||Object.keys(values).length>1000)throw Error('Réglages des entrées invalides.');
  const reader=channelReader(xr,control),guards:Record<string,Value>={},before:Record<string,Value>={};
  const guard=async(a:string)=>guards[a]??(guards[a]=await reader.read(a));
  for(const [address,value] of Object.entries(values)){
    if(!allowed(address)||!xr.supports(address))throw Error('Réglages des entrées invalides.');
    validateWire(address,value);
    const ch=Number(address.split('/')[2]),start=channelPrefix(ch);
    await guard(channelLink(ch));
    for(const leaf of ['config/insrc','config/rtnsrc','preamp/rtnsw'])if(xr.supports(start+leaf))await guard(start+leaf);
    const send=/\/mix\/(\d{2})\/(level|tap)$/.exec(address);
    if(send){
      const bus=Number(send[1]);
      if(bus>xr.model().monitorOutputs)throw Error('Sortie de retour absente sur ce modèle');
      await guard(busLinkAddress(bus));
      for(const leaf of ['tap','grpon','type','on'])if(leaf!==send[2]&&xr.supports(start+`mix/${send[1]}/${leaf}`))await guard(start+`mix/${send[1]}/${leaf}`);
    }
    if(guards[channelLink(ch)]===1)for(const leaf of STEREO_LINK_GROUPS)await guard(`/config/linkcfg/${leaf}`);
    before[address]=await reader.read(address);
  }
  for(const [a,v] of Object.entries(expectedGuards))if(!Object.hasOwn(guards,a)||guards[a]!==v)throw Error('Les liaisons ou les sources ont changé. Prépare un nouvel aperçu.');
  if(expectedBefore)for(const [a,v] of Object.entries(expectedBefore))if(!Object.hasOwn(before,a)||before[a]!==v)throw Error('État modifié : prévisualiser à nouveau');
  const companions=(address:string)=>{
    const ch=Number(address.split('/')[2]),others:string[]=[];
    if(guards[channelLink(ch)]===1)others.push(address.replace(channelPrefix(ch),channelPrefix(ch%2?ch+1:ch-1)));
    const send=/\/mix\/(\d{2})\/(level|tap)$/.exec(address);
    if(send&&guards[busLinkAddress(Number(send[1]))]===1){const bus=Number(send[1]);others.push(address.replace(`/mix/${send[1]}/`,`/mix/${String(bus%2?bus+1:bus-1).padStart(2,'0')}/`));}
    return others;
  };
  for(const [address,value] of Object.entries(values))for(const other of companions(address)){
    if(!Object.hasOwn(values,other))throw Error('Sélectionne les deux entrées de chaque paire stéréo liée.');
    const path=address.split('/').slice(3).join('/');
    // Sends to a linked bus are still one stereo send. The input link options
    // govern links between input channels, not between destination buses.
    const sameInput=address.split('/')[2]===other.split('/')[2];
    if((sameInput||stereoSettingShared(path,guards))&&(!same(value,values[other]!)||!same(before[address]!,before[other]!)))throw Error(sameInput?'Les niveaux des deux bus du retour stéréo lié diffèrent. Cette opération exige un niveau commun pour cet envoi.':stereoConflict(path));
  }
  const changed=Object.fromEntries(Object.entries(values).filter(([a,v])=>!same(v,before[a]!)));
  if(!Object.keys(changed).length)return {token:null,changes:[],snapshot:{values:before,guards},stereoLink:stereoLinkSummary(Object.keys(values),guards)};
  // A matching partner is included even if it already has the requested value.
  const queue=Object.keys(changed);
  for(const a of queue)for(const other of companions(a))if(!Object.hasOwn(changed,other)){changed[other]=values[other]!;queue.push(other);}
  const affected=new Set(Object.keys(changed).map(a=>Number(a.split('/')[2])));
  const activeGuards=Object.fromEntries(Object.entries(guards).filter(([a])=>{
    const ch=/^\/ch\/(\d+)\//.exec(a),pair=/^\/config\/chlink\/(\d+)-(\d+)$/.exec(a),bus=/^\/config\/buslink\/(\d+)-(\d+)$/.exec(a);
    if(ch)return affected.has(Number(ch[1]));
    if(pair)return affected.has(Number(pair[1]))||affected.has(Number(pair[2]));
    if(bus)return Object.keys(changed).some(k=>[bus[1],bus[2]].some(b=>['level','tap'].some(leaf=>k.endsWith(`/mix/${b!.padStart(2,'0')}/${leaf}`))));
    return [...affected].some(n=>guards[channelLink(n)]===1);
  }));
  const plan=await control.preview(changed,true,activeGuards,'channel-operation-backup',before);reader.check();return {...plan,snapshot:{values:before,guards},stereoLink:stereoLinkSummary(Object.keys(changed),activeGuards)};
}

export async function previewChannelBackup(xr:XR18,control:ConsoleControl,library:LibraryStore,id:string){
  const entry=library.get(id),b=entry.data as {version:number;model:string;values:Record<string,Value>;guards:Record<string,Value>};
  if(entry.kind!=='channel-operation-backup'||b?.version!==1||b.model!==xr.model().id||!b.guards||typeof b.guards!=='object'||Array.isArray(b.guards))throw Error('Sauvegarde incompatible avec cette console.');
  return previewChannelOperation(xr,control,b.values,b.guards);
}

export async function previewGroupedAdjustment(xr:XR18,control:ConsoleControl,input:unknown,allowZero=false){
  available(xr);
  const p=input as {model?:string;channels:number[];target:string;delta:number;bus?:number;band?:number};
  if(p?.model!==undefined&&p.model!==xr.model().id)throw Error('Connexion modifiée');
  if(!p||!Array.isArray(p.channels)||p.channels.length<2||p.channels.length>xr.model().channels||new Set(p.channels).size!==p.channels.length||p.channels.some(n=>!Number.isInteger(n)||n<1||n>xr.model().channels))throw Error('Choisis au moins deux entrées disponibles.');
  if(!['fader','send','eq','compressor','gate'].includes(p.target)||typeof p.delta!=='number'||!Number.isFinite(p.delta)||(!allowZero&&p.delta===0)||Math.abs(p.delta)>12)throw Error('Choisis un réglage et un décalage entre −12 et +12 dB, différent de zéro.');
  if(p.target==='eq'&&(!Number.isInteger(p.band)||p.band!<1||p.band!>4))throw Error('Choisis une bande EQ de 1 à 4.');
  const reader=channelReader(xr,control),guards:Record<string,Value>={},before:Record<string,Value>={},values:Record<string,Value>={};
  let buses:number[]=[],skippedSilent=0;
  if(p.target==='send'){
    if(!Number.isInteger(p.bus)||p.bus!<1||p.bus!>xr.model().monitorOutputs)throw Error('Sortie de retour absente sur ce modèle');
    const link=busLinkAddress(p.bus!);guards[link]=await reader.read(link);
    buses=guards[link]===1?[busPairStart(p.bus!),busPairStart(p.bus!)+1]:[p.bus!];
    if(buses.some(b=>b>xr.model().monitorOutputs))throw Error('Sortie de retour absente sur ce modèle');
  }
  const paths=p.target==='send'?buses.map(b=>`mix/${String(b).padStart(2,'0')}/level`):[p.target==='fader'?'mix/fader':p.target==='eq'?`eq/${p.band}/g`:p.target==='compressor'?'dyn/thr':'gate/thr'];
  for(const ch of p.channels)for(const path of paths){
    const a=channelPrefix(ch)+path,v=await reader.read(a);before[a]=v;
    if(typeof v!=='number')throw Error('Réglages des entrées invalides.');
    if((p.target==='send'||p.target==='fader')&&v===0){values[a]=v;skippedSilent++;continue;}
    const after=Number(fromWire(a,v))+p.delta,parameter=descriptor(a);
    if(after<parameter.min!||after>parameter.max!)throw Error('Le décalage dépasse la plage d’au moins une entrée. Réduis-le : aucun réglage envoyé.');
    values[a]=toWire(a,after);
  }
  reader.check();
  const plan=await previewChannelOperation(xr,control,values,guards,before);reader.check();
  if(p.target==='send')assertGroupSendLevels(plan.snapshot.guards);
  return {...plan,skippedSilent,buses};
}

/** Channel mute affects that input wherever the console applies its mute.
 * X-Air sends have no independent on/off switch in this adapter: silence their
 * levels and back them up for explicit restoration, never toggle the input mute. */
export async function previewGroupMute(xr:XR18,control:ConsoleControl,input:unknown){
  available(xr);
  const p=input as {model:string;selection:unknown};
  if(p?.model!==xr.model().id)throw Error('Connexion modifiée');
  const selection=groupSelection(p.model,p.selection);
  if(!['fader','send'].includes(selection.target))throw Error('Choisis un groupe de volumes ou d’envois pour les mutes.');
  const reader=channelReader(xr,control),guards:Record<string,Value>={};
  let buses:number[]=[];
  if(selection.target==='send'){
    const bus=selection.bus!,link=busLinkAddress(bus);guards[link]=await reader.read(link);
    buses=guards[link]===1?[busPairStart(bus),busPairStart(bus)+1]:[bus];
    if(buses.some(b=>b>xr.model().monitorOutputs))throw Error('Sortie de retour absente sur ce modèle');
  }
  const paths=selection.target==='send'?buses.map(b=>`mix/${String(b).padStart(2,'0')}/level`):['mix/on'];
  const values=Object.fromEntries(selection.channels.flatMap(ch=>paths.map(path=>[channelPrefix(ch)+path,0])));
  const plan=await previewChannelOperation(xr,control,values,guards);reader.check();
  if(selection.target==='send')assertGroupSendLevels(plan.snapshot.guards);
  return {...plan,buses};
}

function assertGroupSendLevels(guards:Record<string,Value>){
  if(Object.entries(guards).some(([a,v])=>/\/mix\/\d{2}\/tap$/.test(a)&&v===5))throw Error('Cet envoi utilise le mode sous-groupe. Choisis un retour avec un niveau d’envoi réglable.');
}

export async function previewBatchEdit(xr:XR18,control:ConsoleControl,input:unknown,relativeTo?:number){
  available(xr);
  const request=input as {model:string;channels:number[];setting:BatchSetting;bus?:number;band?:number;value:number;wire?:boolean};
  if(request?.model!==xr.model().id||!Object.hasOwn(BATCH_SETTINGS,request.setting))throw Error('Sélection de modification multiple invalide.');
  const {channels}=groupSelection(request.model,{channels:request.channels,target:'fader'});
  const setting=BATCH_SETTINGS[request.setting];
  if(!Number.isFinite(request.value)||request.wire!==undefined&&typeof request.wire!=='boolean'||!request.wire&&(request.value<setting.min||request.value>setting.max))throw Error('Sélection de modification multiple invalide.');
  const reader=channelReader(xr,control),guards:Record<string,Value>={},before:Record<string,Value>={};
  let buses=[1];
  if(request.setting==='tap'){
    const bus=request.bus!;
    if(!Number.isInteger(bus)||bus<1||bus>xr.model().monitorOutputs)throw Error('Sortie de retour absente sur ce modèle');
    const link=busLinkAddress(bus);guards[link]=await reader.read(link);
    buses=guards[link]===1?[busPairStart(bus),busPairStart(bus)+1]:[bus];
  }
  const band=request.band??1;
  if(batchUsesBand(request.setting)&&(!Number.isInteger(band)||band<1||band>4))throw Error('Choisis une bande EQ de 1 à 4.');
  const values:Record<string,Value>={};
  for(const channel of channels)for(const bus of buses){
    const address=channelPrefix(channel)+batchPath(request.setting,bus,band);
    before[address]=await reader.read(address);
    if(request.setting==='tap'&&before[address]===5)throw Error('Cet envoi utilise le mode sous-groupe. Choisis un retour avec un niveau d’envoi réglable.');
    const display=request.wire?Number(fromWire(address,validateWire(address,request.value))):request.value;
    if(display<setting.min||display>setting.max)throw Error('Sélection de modification multiple invalide.');
    values[address]=request.wire?request.value:toWire(address,display);
  }
  if(relativeTo!==undefined){
    if(!request.wire||!channels.includes(relativeTo)||!['eqGain','eqFrequency','eqQ','gateThreshold','compressorThreshold','hpf','pan'].includes(request.setting))throw Error('Sélection de modification multiple invalide.');
    const origin=channelPrefix(relativeTo)+batchPath(request.setting,1,band);
    // A common normalized displacement preserves dB differences and frequency ratios.
    // Stop the whole group at the first limit so individual offsets survive the gesture.
    const initial=Object.values(before).map(Number);
    const delta=Math.max(-Math.min(...initial),Math.min(1-Math.max(...initial),request.value-Number(before[origin])));
    for(const address of Object.keys(values))values[address]=Math.min(1,Math.max(0,Number(before[address])+delta));
  }
  const plan=await previewChannelOperation(xr,control,values,guards,before);
  reader.check();
  return plan;
}
