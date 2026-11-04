import {createHash,randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import type {XR18} from './xr18.js';
import type {ReaperBridge} from './reaper-bridge.js';
import {BRIDGE_VERSION} from './reaper-bridge.js';
import type {LibraryStore} from './library-store.js';
import {spectralEvidence,inferWorkshopFamily,WORKSHOP_FAMILIES,type SpectralWindow,type SpectralEvidence,type WorkshopFamily} from '../shared/workshop-spectrum.js';
import {spectralAdvice,advicePriority} from './workshop-spectral-advice.js';
import {PARAMETERS,toWire,fromWire,readbackTolerance,type Value} from './parameters.js';

export type Mapping={index:number;guid:string;name:string;channel:number;channels:number;family?:WorkshopFamily};
export type AudioWindow=SpectralWindow & {start:number;duration:number;peak:number;sumSquares:number;samples:number;clipped:number;rate:number};
export type Evidence={channel:number;name:string;windows:AudioWindow[];peakDb:number;rmsDb:number;crestDb:number;clipped:number;spectral?:SpectralEvidence};
export type Advice={kind?:'level'|'eq'|'phase'|'dynamics';unavailableReason?:string;id:string;channel:number;title:string;fact:string;hypothesis:string;start:number;stop:number;changes:Record<string,Value>;impact:string;baseline?:Values};
type Values=Record<string,Value>;
export type WorkshopSession={id:string;name:string;identity:string;model:string;source:string;project:string;start:number;stop:number;mapping:Mapping[];phase:'preparing'|'active'|'recovery'|'finished';route:Values;virtual:Values;a:Values;b:Values;side:'A'|'B';note:string;createdAt:string;report?:Evidence[];dynamics?:{channel:number;name:string;maxReduction:number;strongPercent:number;start:number;stop:number;samples:number}[];advice?:Advice[];preference?:'A'|'B';error?:string;trial?:{id:string;before:Values;after:Values};};
export type Catalog={project:string;outputs:number;device:string;rate:number;tracks:{index:number;guid:string;name:string;channels:number;family?:WorkshopFamily;items:{pos:number;length:number;file:string;take:string}[]}[]};
const prefix=(c:number)=>`/ch/${String(c).padStart(2,'0')}`;
const db=(v:number)=>v>0?Math.max(-120,20*Math.log10(v)):-120;
const round=(v:number)=>Math.round(v*10)/10;
export function validateMapping(input:unknown):Mapping[]{
 if(!Array.isArray(input)||!input.length||input.length>16)throw Error('Choisis de 1 à 16 pistes');
 const occupied=new Set<number>(),tracks=new Set<string>();
 return input.map(m=>{
  if(!m||!Number.isInteger(m.index)||m.index<0||typeof m.guid!=='string'||!m.guid||typeof m.name!=='string'||!Number.isInteger(m.channel)||![1,2].includes(m.channels)||m.channel<1||m.channel+m.channels-1>16||tracks.has(m.guid))throw Error('Affectation de piste invalide');
  if(m.family!==undefined&&!WORKSHOP_FAMILIES.includes(m.family))throw Error('Famille instrument invalide');
  tracks.add(m.guid);for(let c=m.channel;c<m.channel+m.channels;c++){if(occupied.has(c))throw Error('Deux pistes utilisent le même canal');occupied.add(c);}
  return {index:m.index,guid:m.guid,name:m.name.slice(0,120),channel:m.channel,channels:m.channels,...(m.family?{family:m.family}:{})};
 });
}
export function evidence(channel:number,name:string,windows:AudioWindow[]):Evidence{
 if(!windows.length||windows.some(w=>![w.peak,w.sumSquares,w.samples,w.clipped,w.start,w.duration,w.rate].every(Number.isFinite)||w.samples<0||w.sumSquares<0||w.peak<0||w.clipped<0))throw Error('Mesure audio invalide');
 const samples=windows.reduce((n,w)=>n+w.samples,0);if(!samples)throw Error('Aucun audio mesurable pour '+name);
 const peakDb=db(Math.max(...windows.map(w=>w.peak))),rmsDb=db(Math.sqrt(windows.reduce((n,w)=>n+w.sumSquares,0)/samples));
 return {channel,name,windows,peakDb:round(peakDb),rmsDb:round(rmsDb),crestDb:round(peakDb-rmsDb),clipped:windows.reduce((n,w)=>n+w.clipped,0),spectral:spectralEvidence(windows)};
}
export function measuredAdvice(report:Evidence[],values:Values):Advice[]{
 const result:Advice[]=[];
 for(const e of report){
  const loud=e.windows.reduce((a,b)=>b.peak>a.peak?b:a),p=prefix(e.channel);
  const base={channel:e.channel,start:loud.start,stop:loud.start+loud.duration,kind:'level' as const,impact:'Traitement du canal : façade et retours prélevés après ce traitement. Les autres canaux ne changent pas.'};
  if(e.clipped>0)result.push({...base,id:`clip-${e.channel}`,title:`${e.name} : vérifier la prise`,fact:`${e.clipped} échantillons atteignent au moins −0,01 dBFS ; crête ${e.peakDb} dBFS.`,hypothesis:'Proximité du plafond numérique, pas une preuve suffisante de saturation. Écoute le passage. Un EQ ou un compresseur ne répare pas une prise déjà écrêtée ; vérifie le niveau à la source pour la suivante.',changes:{}});
  else if(e.peakDb< -42)result.push({...base,id:`quiet-${e.channel}`,title:`${e.name} : signal faible`,fact:`Crête ${e.peakDb} dBFS sur le passage analysé.`,hypothesis:'Vérifie que le musicien joue dans cet extrait et que la bonne piste est affectée, avant toute hausse de gain.',changes:{}});
  else if(e.crestDb>16 && Number(values[`${p}/dyn/on`])===0){
   const units:Values={[`${p}/dyn/on`]:1,[`${p}/dyn/mode`]:0,[`${p}/dyn/thr`]:Math.max(-40,Math.min(-6,e.peakDb-8)),[`${p}/dyn/ratio`]:4,[`${p}/dyn/attack`]:20,[`${p}/dyn/release`]:150,[`${p}/dyn/mgain`]:0};
   // Ratio index is resolved from the console catalog, never guessed from a display ratio.
   const ratio=PARAMETERS[`${p}/dyn/ratio`]?.options?.findIndex(x=>Number.parseFloat(x)===2);if(ratio===undefined||ratio<0)continue;units[`${p}/dyn/ratio`]=ratio;
   result.push({...base,id:`crest-${e.channel}`,title:`${e.name} : essayer une compression légère`,fact:`Crête ${e.peakDb} dBFS ; niveau RMS ${e.rmsDb} dBFS ; écart ${e.crestDb} dB sur la prise avant les traitements de console.`,hypothesis:'Cet écart peut être musical, notamment pour une batterie. Un essai à 2:1 peut rapprocher les niveaux ; garde-le uniquement si le résultat te plaît. Le gain de compensation reste à zéro.',changes:units});
  }
 }
 return result.map(a=>({...a,baseline:Object.fromEntries(Object.keys(a.changes).map(k=>[k,values[k]!]))})).sort((a,b)=>(a.id.startsWith('clip')?0:a.id.startsWith('quiet')?1:2)-(b.id.startsWith('clip')?0:b.id.startsWith('quiet')?1:2));
}
export class Workshop{
 private active:WorkshopSession|null=null;
 private entryId:string|null=null;
 private job:{running:boolean;progress:number;error:string}|null=null;
 private busy=false;
 private cancelled=false;
 private catalogPreview:{token:string;fingerprint:string;expires:number}|null=null;
 constructor(private xr:XR18,private bridge:ReaperBridge,private library:LibraryStore,private folder:string){
  const latest=library.list('workshop').find(e=>(e.data as WorkshopSession).phase!=='finished');
  if(latest){this.entryId=latest.id;this.active=latest.data as WorkshopSession;this.active.phase='recovery';this.active.error='Atelier interrompu : arrête REAPER puis restaure les sources avant de commencer une autre séance.';this.persist();}
 }
 private persist(){if(this.active&&this.entryId)this.library.update(this.entryId,this.active);}
 status(){
  const view=(s:WorkshopSession)=>{const {route,virtual,a,b,identity,...visible}=s;return {...visible,report:s.report?.map(({windows,...e})=>e),advice:s.advice?.map(({baseline,...advice})=>advice)};};
  return {active:this.active?view(this.active):null,job:this.job,history:this.library.list('workshop').slice(0,20).map(e=>{const s=e.data as WorkshopSession;return {id:s.id,name:s.name,model:s.model,source:s.source,project:s.project,start:s.start,stop:s.stop,phase:s.phase,side:s.side,note:s.note,createdAt:s.createdAt,preference:s.preference,findings:s.advice?.map(({title,fact,start,kind})=>({title,fact,start,kind}))};}),supported:this.xr.model().usbRecorder==='interface'&&this.xr.model().family!=='x32'};
 }
 blocksRecording(){return !!this.active;}
 private identity(){const s=this.xr.status();return JSON.stringify([s.mode,s.model,s.host??'',s.port]);}
 private guard(s?:WorkshopSession){
  if(this.xr.model().usbRecorder!=='interface'||this.xr.model().family==='x32')throw Error('Atelier USB disponible sur XR18, X18 et MR18 ; adaptation X32 restante');
  const status=this.xr.status();if(status.mode!=='real'||!status.connected||!status.writesEnabled)throw Error('Connecte la console réelle et active son contrôle pour cet atelier');
  if(s&&s.identity!==this.identity())throw Error('Console changée : reconnecte la console de cet atelier pour restaurer ses réglages');
 }
 private async read(addresses:string[]){const v:Values={};for(let i=0;i<addresses.length;i+=8)await Promise.all(addresses.slice(i,i+8).map(async a=>{v[a]=await this.xr.readParameter(a);}));return v;}
 private async apply(values:Values,s:WorkshopSession){this.guard(s);await this.xr.applyParameters(values);this.guard(s);if(!this.equal(await this.read(Object.keys(values)),values))throw Error('Réglages non confirmés après application');}
 private channels(mapping:Mapping[]){return mapping.flatMap(m=>Array.from({length:m.channels},(_,i)=>m.channel+i));}
 private async settings(mapping:Mapping[]){const channels=this.channels(mapping);return this.read(Object.keys(PARAMETERS).filter(a=>channels.some(c=>a.startsWith(prefix(c)+'/'))&&/\/(eq|dyn|gate)\/|\/preamp\/(hpon|hpf|invert)$/.test(a)));}
 private async adviceFor(s:WorkshopSession,report:Evidence[],settings:Values){
  const links:Values={};for(const m of s.mapping.filter(m=>m.channels===2)){for(const c of [m.channel,m.channel+1]){const odd=c%2?c:c-1,key=`/config/chlink/${odd}-${odd+1}`;if(!(key in links))links[key]=await this.xr.readParameter(key);}}
  return [...measuredAdvice(report,settings).filter(a=>!Object.keys(a.changes).length||s.mapping.find(m=>m.channel===a.channel)?.channels===1),...spectralAdvice(report,s.mapping,{...settings,...links})].sort((a,b)=>advicePriority(a)-advicePriority(b));
 }
 private async stopped(s:WorkshopSession){const state=await this.bridge.state();if(state.project!==s.project||state.playing||state.recording)throw Error('Reviens au projet atelier et arrête la lecture avant de modifier ou analyser');}
 private async serial<T>(fn:()=>Promise<T>){if(this.busy||this.job?.running)throw Error('Une opération atelier est en cours');this.busy=true;try{return await fn();}finally{this.busy=false;}}
 private async currentCatalog(){const s=await this.bridge.state();if(s.version!==BRIDGE_VERSION)throw Error('Installe le pont REAPER '+BRIDGE_VERSION+' puis redémarre REAPER');const c=await this.bridge.call<Catalog>('workshop_catalog');return {...c,tracks:c.tracks.map(t=>({...t,family:inferWorkshopFamily(t.name)}))};}
 private fingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
 async catalog(){const c=await this.currentCatalog();this.catalogPreview={token:randomUUID(),fingerprint:this.fingerprint(c),expires:Date.now()+600000};return {...c,token:this.catalogPreview.token};}
 async create(input:{name?:string;source:string;start:number;stop:number;mapping:unknown;confirm:boolean;rawConfirmed:boolean;deviceConfirmed:boolean;token:string}){return this.serial(async()=>{
  this.guard();if(this.active)throw Error('Termine ou restaure l’atelier en cours');
  if(input.confirm!==true||input.rawConfirmed!==true||input.deviceConfirmed!==true)throw Error('Confirme les pistes brutes, le périphérique USB et le routage avant de commencer');
  if(!Number.isFinite(input.start)||!Number.isFinite(input.stop)||input.start<0||input.stop-input.start<1||input.stop-input.start>120)throw Error('Choisis un passage de 1 à 120 secondes');
  const mapping=validateMapping(input.mapping),catalog=await this.currentCatalog();
  const preview=this.catalogPreview;this.catalogPreview=null;if(!preview||preview.token!==input.token||preview.expires<Date.now()||preview.fingerprint!==this.fingerprint(catalog))throw Error('Préparation expirée ou prises modifiées : relis le projet');
  if(catalog.project!==input.source||catalog.outputs<16||![44100,48000].includes(catalog.rate))throw Error('Projet ou périphérique audio incompatible : vérifie les sorties USB et la fréquence');
  for(const m of mapping){const t=catalog.tracks.find(t=>t.guid===m.guid&&t.index===m.index);if(!t||t.channels!==m.channels)throw Error('Piste modifiée : actualise la préparation');m.name=t.name;m.family=m.family??inferWorkshopFamily(t.name);}
  const rate=(await this.xr.query('/-prefs/clockrate')).args[0],usb=(await this.xr.query('/-prefs/usbifcmode')).args[0];
  if(!((usb===0||usb==='18x18')&&(catalog.rate===(rate===0||String(rate).startsWith('48')?48000:rate===1||String(rate).startsWith('44')?44100:0))))throw Error('Vérifie le mode USB 18×18 et la fréquence commune REAPER/console');
  const channels=this.channels(mapping),addresses:string[]=[],virtual:Values={};
  for(const c of channels){const p=prefix(c);addresses.push(`${p}/config/rtnsrc`,`${p}/preamp/rtnsw`,`${p}/preamp/rtntrim`);virtual[`${p}/config/rtnsrc`]=c-1;virtual[`${p}/preamp/rtntrim`]=toWire(`${p}/preamp/rtntrim`,0);virtual[`${p}/preamp/rtnsw`]=1;const odd=c%2?c:c-1;if(Number(await this.xr.readParameter(`/config/chlink/${odd}-${odd+1}`))===1&&!channels.includes(c%2?c+1:c-1))throw Error('Inclure les deux canaux de chaque paire stéréo liée');}
  const route=await this.read(addresses),a=await this.settings(mapping),id=randomUUID();await mkdir(this.folder,{recursive:true});
  const session:WorkshopSession={id,name:input.name?.trim().slice(0,120)||'Atelier du son',identity:this.identity(),model:this.xr.model().id,source:input.source,project:join(this.folder,id+'.rpp'),start:input.start,stop:input.stop,mapping,phase:'preparing',route,virtual,a,b:{...a},side:'B',note:'',createdAt:new Date().toISOString()};
  const entry=this.library.save('workshop',session.name,session);this.active=session;this.entryId=entry.id;
  try{
   await this.bridge.call('workshop_create',{id,source:session.source,file:session.project,start:session.start,stop:session.stop,mapping,rate:catalog.rate});
   await this.apply(virtual,session);session.phase='active';this.persist();return this.status();
  }catch(e){session.phase='recovery';session.error=(e as Error).message;this.persist();throw Error('Atelier interrompu : '+session.error+' — la sauvegarde des sources est conservée.');}
 });}
 private requireActive(){const s=this.active;if(!s)throw Error('Aucun atelier ouvert');this.guard(s);return s;}
 async transport(action:string,start?:number){const s=this.active;if(!s)throw Error('Aucun atelier ouvert');if(action==='play')this.guard(s);if(this.busy)throw Error('Opération atelier en cours');if(action==='play'&&(s.phase!=='active'||this.job?.running))throw Error('Atelier non prêt pour la lecture');
  if(action!=='play'&&this.job?.running)this.cancelled=true;
  if(action==='play'){const state=await this.bridge.state();if(state.recording)throw Error('Enregistrement en cours');const route=await this.read(Object.keys(s.virtual));if(!this.equal(route,s.virtual))throw Error('Routage modifié depuis la préparation : restaure les sources puis recommence');}
  const pos=Number.isFinite(start)?Number(start):s.start;if(pos<s.start||pos>=s.stop)throw Error('Position hors du passage');
  return this.bridge.call('workshop_transport',{id:s.id,project:s.project,action:action==='play'?'play':'stop',start:pos});
 }
 private equal(a:Values,b:Values){return Object.entries(a).every(([k,v])=>typeof v==='number'&&typeof b[k]==='number'?Math.abs(v-Number(b[k]))<=readbackTolerance(k):v===b[k]);}
 async compare(side:'A'|'B'){return this.serial(async()=>{const s=this.requireActive();await this.stopped(s);if(s.trial)throw Error('Garde ou annule d’abord le conseil en essai');if(!['A','B'].includes(side))throw Error('Version invalide');if(s.side===side)return this.status();const before=await this.settings(s.mapping);if(s.side==='B')s.b=before;s.phase='recovery';this.persist();try{await this.apply(side==='A'?s.a:s.b,s);s.side=side;s.phase='active';if(s.report)s.advice=await this.adviceFor(s,s.report,await this.settings(s.mapping));else delete s.advice;delete s.dynamics;this.persist();}catch(e){s.error=(e as Error).message;this.persist();throw e;}return this.status();});}
 async save(note:string,preference?:'A'|'B'){return this.serial(async()=>{const s=this.requireActive();await this.stopped(s);if(s.phase!=='active'||s.trial)throw Error('Termine la récupération ou l’essai avant de sauvegarder');if(typeof note!=='string'||note.length>2000)throw Error('Note de 2 000 caractères maximum');const current=await this.settings(s.mapping);if(s.side==='B')s.b=current;s.note=note;if(preference==='A'||preference==='B')s.preference=preference;this.persist();return this.status();});}
 async finish(keep:'A'|'B',confirmed:boolean){return this.serial(async()=>{
  const s=this.requireActive();if(confirmed!==true||!['A','B'].includes(keep))throw Error('Confirme le retour aux sources');
  // A disconnected/restarted REAPER must never be assumed silent. Explicit stop is verified first.
  const state=await this.bridge.state();if(state.recording)throw Error('Arrête l’enregistrement dans REAPER');
  if(state.project!==s.project){if(state.playing)throw Error('Arrête REAPER avant de restaurer');}else await this.bridge.call('workshop_transport',{id:s.id,project:s.project,action:'stop',start:s.start});
  if(s.phase==='active'&&!s.trial&&s.side==='B')s.b=await this.settings(s.mapping);
  s.phase='recovery';this.persist();
  if(s.trial){await this.apply(s.trial.before,s);delete s.trial;}
  await this.apply(keep==='A'?s.a:s.b,s);
  await this.apply(s.route,s); // restore only sources/USB trim; retain selected processing and original USB backing tracks
  if(state.project===s.project)await this.bridge.call('workshop_leave',{id:s.id,project:s.project,source:s.source});
  s.phase='finished';s.side=keep;s.preference=keep;delete s.error;this.persist();this.active=null;this.entryId=null;return this.status();
 });}
 async analyze(){return this.serial(async()=>{const s=this.requireActive();await this.stopped(s);if(s.phase!=='active'||s.trial)throw Error('Termine la récupération ou l’essai');
  this.cancelled=false;this.job={running:true,progress:0,error:''};delete s.report;delete s.advice;delete s.dynamics;this.persist();void this.runAnalysis(s);return this.status();});}
 private async runAnalysis(s:WorkshopSession){
  try{
   const revision=await this.bridge.call<{revision:number}>('workshop_revision',{id:s.id,project:s.project});
   const report:Evidence[]=[];const duration=Math.min(30,s.stop-s.start),total=Math.ceil(duration)*s.mapping.length;let done=0;
   for(const [index,m] of s.mapping.entries()){
    const windows:AudioWindow[]=[];
    for(let offset=0;offset<duration;offset+=3){
     if(this.cancelled||!this.job?.running||this.active?.id!==s.id)throw Error('Analyse annulée');
     const length=Math.min(3,duration-offset);
     const batch=await this.bridge.call<{windows:AudioWindow[]}>('workshop_measure_batch',{id:s.id,project:s.project,revision:revision.revision,track:index,channels:m.channels,start:s.start+offset,duration:length});
     if(!Array.isArray(batch.windows)||batch.windows.length!==Math.ceil(length))throw Error('Mesure audio incomplète : actualise le pont REAPER');
     windows.push(...batch.windows);done+=batch.windows.length;this.job.progress=Math.round(done/total*100);
    }
    report.push(evidence(m.channel,m.name,windows));
   }
   const settings=await this.settings(s.mapping);s.report=report;s.advice=await this.adviceFor(s,report,settings);this.persist();
  }catch(e){if(this.job)this.job.error=(e as Error).message;}
  finally{if(this.job)this.job.running=false;}
 }
 async listenAnalyze(){return this.serial(async()=>{const s=this.requireActive();await this.stopped(s);if(s.phase!=='active'||s.trial)throw Error('Termine la récupération ou l’essai');
  const route=await this.read(Object.keys(s.virtual));if(!this.equal(route,s.virtual))throw Error('Routage modifié : restaure puis recommence');
  const settings=await this.settings(s.mapping);this.cancelled=false;this.job={running:true,progress:0,error:''};delete s.dynamics;this.persist();void this.runLiveAnalysis(s,settings);return this.status();
 });}
 private async runLiveAnalysis(s:WorkshopSession,settings:Values){
  let frame:{comp:number[];at:number}|null=null,lastFrame=0;
  const listener=(f:{comp:number[];at:number})=>{frame=f;};const samples=new Map<number,{value:number;pos:number}[]>();
  this.xr.on('dynamics',listener);
  try{
   await this.bridge.call('workshop_transport',{id:s.id,project:s.project,action:'play',start:s.start});
   const end=Math.min(s.stop,s.start+30),deadline=Date.now()+35000;let subscribed=0,furthest=s.start,advancedAt=Date.now(),complete=false;
   while(Date.now()<deadline){
    if(this.cancelled)throw Error('Mesure à l’écoute interrompue');this.guard(s);
    if(Date.now()-subscribed>4000){this.xr.subscribeAnalysis();subscribed=Date.now();}
    const state=await this.bridge.state();if(state.project!==s.project||state.recording||!state.playing)throw Error('Lecture interrompue ou projet changé : mesures non conservées');
    if(!Number.isFinite(state.pos)||state.pos<s.start-.05)throw Error('Position REAPER invalide : mesures non conservées');
    if(state.pos>furthest+.02){furthest=state.pos;advancedAt=Date.now();}
    // Polling can miss both the last frame and the first 100 ms after a loop.
    // Accept the observed wrap only at the end of the exact workshop loop.
    const edge=Math.min(1.5,(end-s.start)/4),loop=state.loop;
    const wrapped=loop?.on&&Math.abs(loop.start-s.start)<.05&&Math.abs(loop.stop-end)<.05
      &&furthest>=end-edge&&state.pos<=s.start+edge&&furthest-state.pos>(end-s.start)/2;
    if(state.pos>=end-.15||wrapped){complete=true;break;}
    if(Date.now()-advancedAt>3000)throw Error('Le compteur REAPER n’avance plus : mesures non conservées');
    const f=frame as {comp:number[];at:number}|null;
    if(f&&f.at!==lastFrame&&Date.now()-f.at<1000){lastFrame=f.at;for(const c of this.channels(s.mapping)){const value=f.comp[c-1];if(value!==undefined&&Number.isFinite(value)&&value<=0&&value>=-100){const list=samples.get(c)??[];list.push({value,pos:state.pos});samples.set(c,list);}}}
    if(this.job)this.job.progress=Math.min(99,Math.round((state.pos-s.start)/(end-s.start)*100));await new Promise(r=>setTimeout(r,200));
   }
   if(!complete)throw Error('Passage incomplet : mesures non conservées');
   if(!this.equal(await this.read(Object.keys(s.virtual)),s.virtual))throw Error('Sources modifiées pendant la lecture : mesures non conservées');
   if(!this.equal(await this.settings(s.mapping),settings))throw Error('Traitements modifiés pendant la lecture : relance la mesure');
   const measured:NonNullable<WorkshopSession['dynamics']>=[];const advice:Advice[]=[];
   for(const [channel,points] of samples){if(points.length<5)continue;const strongest=points.reduce((a,b)=>b.value<a.value?b:a),p=prefix(channel),name=s.mapping.find(m=>channel>=m.channel&&channel<m.channel+m.channels)?.name??`Canal ${channel}`;
    const strongPercent=Math.round(points.filter(p=>p.value < -8).length/points.length*100);
    measured.push({channel,name,maxReduction:round(-strongest.value),strongPercent,start:strongest.pos,stop:Math.min(end,strongest.pos+1),samples:points.length});
    if(strongPercent>=20&&Number(settings[`${p}/dyn/on`])===1&&Number(settings[`${p}/dyn/mode`])===0){const address=`${p}/dyn/thr`,threshold=Number(fromWire(address,settings[address]!));
     advice.push({id:`gr-${channel}`,channel,title:`${name} : compression à comparer`,fact:`La console retire jusqu’à ${round(-strongest.value)} dB ; plus de 8 dB sur ${strongPercent} % des relevés du passage.`,hypothesis:'Cela peut être voulu. Essaie un seuil 3 dB plus haut pour conserver davantage de dynamique, puis compare à l’oreille.',start:strongest.pos,stop:Math.min(end,strongest.pos+1),impact:'Compresseur du canal : agit aussi sur les retours prélevés après ce traitement.',changes:{[address]:Math.min(0,threshold+3)},baseline:Object.fromEntries(Object.entries(settings).filter(([k])=>k.startsWith(p+'/dyn/')))});
    }
   }
   if(!measured.length)throw Error('Aucune réduction de gain récente reçue de la console ; aucune valeur inventée');
   s.dynamics=measured;s.advice=[...advice,...(s.advice??[]).filter(a=>!a.id.startsWith('gr-'))].sort((a,b)=>advicePriority(a)-advicePriority(b));this.persist();if(this.job)this.job.progress=100;
  }catch(e){if(this.job)this.job.error=(e as Error).message;}
  finally{this.xr.off('dynamics',listener);try{await this.bridge.call('workshop_transport',{id:s.id,project:s.project,action:'stop',start:s.start});}catch(e){if(this.job)this.job.error+=' · Arrête REAPER manuellement : '+(e as Error).message;}if(this.job)this.job.running=false;}
 }
 cancelAnalysis(){this.cancelled=true;return this.status();}
 async trial(id:string,action:'try'|'keep'|'undo'){return this.serial(async()=>{
  const s=this.requireActive();await this.stopped(s);if(s.phase!=='active')throw Error('Restaure d’abord cet atelier');
  if(action==='try'){
   if(s.trial)throw Error('Un conseil est déjà en comparaison');
   const advice=s.advice?.find(a=>a.id===id);if(!advice||!Object.keys(advice.changes).length)throw Error('Conseil sans correction automatique');
   const pairs=new Set(Object.keys(advice.changes).map(a=>{const c=Number(a.split('/')[2]);return c%2?c:c-1;}));
   for(const odd of pairs)if(Number(await this.xr.readParameter(`/config/chlink/${odd}-${odd+1}`))===1){const stereo=s.mapping.find(m=>m.channel===odd&&m.channels===2);const mirrored=stereo&&advice.kind==='eq'&&Object.entries(advice.changes).every(([key,value])=>advice.changes[key.replace(prefix(odd)+'/',prefix(odd+1)+'/')]===value&&advice.changes[key.replace(prefix(odd+1)+'/',prefix(odd)+'/')]===value);if(!mirrored)throw Error('Canaux liés : ajuste cette paire dans la Console, puis compare A/B dans l’atelier');}
   if(s.side!=='B')throw Error('Passe sur B pour essayer un conseil');
   const after=Object.fromEntries(Object.entries(advice.changes).map(([a,v])=>[a,toWire(a,v)])),current=await this.read([...new Set([...Object.keys(after),...Object.keys(advice.baseline??{})])]),before=Object.fromEntries(Object.keys(after).map(k=>[k,current[k]!]));
   // Proposals about an inactive compressor cease to apply as soon as another controller enables it.
   if(advice.baseline&&!this.equal(advice.baseline,current))throw Error('Réglages modifiés depuis la mesure : relance l’analyse');
   if(id.startsWith('crest-')&&Number(before[`${prefix(advice.channel)}/dyn/on`])!==0)throw Error('Compresseur modifié : relance l’analyse');
   s.trial={id,before,after};this.persist();try{await this.apply(after,s);s.trial.after=await this.read(Object.keys(after));this.persist();}catch(e){s.phase='recovery';s.error=(e as Error).message;this.persist();throw e;}
  }else{
   if(!s.trial||s.trial.id!==id)throw Error('Essai introuvable');
   const now=await this.read(Object.keys(s.trial.after));if(!this.equal(now,s.trial.after))throw Error('Ces réglages ont changé depuis l’essai : restaure depuis l’atelier pour éviter d’effacer une autre correction');
   if(action==='undo')await this.apply(s.trial.before,s);else if(action!=='keep')throw Error('Action invalide');
   delete s.trial;s.b=await this.settings(s.mapping);if(s.report)s.advice=await this.adviceFor(s,s.report,s.b);else if(action==='keep')delete s.advice;if(action==='keep')delete s.dynamics;this.persist();
  }
  return this.status();
 });}
}
