import {randomUUID} from 'node:crypto';
import {GUIDED_AMBIENCES,ambiencesForSource} from '../shared/vocal-ambiences.js';
import {FX_NAMES,FX_SCHEMAS} from '../shared/fx-parameters.js';
import {fromWire,toWire,readbackTolerance,type Value} from './parameters.js';
import {type CoachProfile} from './sound-coach.js';
import type {XR18} from './xr18.js';
import type {LibraryStore} from './library-store.js';
import {diagnostic} from './diagnostics.js';
type Values=Record<string,Value>;
type Fx=Awaited<ReturnType<XR18['readFx']>>;
type Snapshot={values:Values;fx:Fx};
type Choice={channel:number;ambience:string;mainDb?:number;fromMixer?:boolean;doses:Record<string,number>};
type Session={id?:string;simulationConnection?:number;identity:string;slot:number;choice:Choice;origin:Snapshot;current:Snapshot;trialBefore?:Snapshot;previousChoice?:Choice;phase:'trial'|'kept'|'recovery'|'finished';error?:string;conflict?:string};
type Preview={id:string;target:string|null;identity:string;expires:number;connection:number;choice:Choice;before:Snapshot;after:Snapshot;guards:Values};
const effectReturnName=(source:string|undefined)=>source==='lead-rock'||source==='backing-vocal'?'Voix FX':'Ambiance FX';
const ch=(c:number)=>c===0?'/rtn/aux':`/ch/${String(c).padStart(2,'0')}`;
const log=(value:number,lo:number,hi:number)=>Math.log(value/lo)/Math.log(hi/lo);
/** Parameter order/scales checked against XAir_fxparse1.c, HALL/PLAT/DLY (pmaillot).
 * Independent mapping of protocol facts; no X32 fallback. See docs/INGE_SON.md.
 */
export function vocalFxProgram(id:string,slot:number):Fx{
 const a=GUIDED_AMBIENCES.find(a=>a.id===id);if(!a)throw Error('Ambiance inconnue');
 if(a.algorithm===10)return {slot,algorithm:10,parameters:[{type:'f',value:1},{type:'f',value:(110-1)/2999},{type:'i',value:0},{type:'i',value:4},{type:'i',value:4},{type:'f',value:.5},...[log(200,10,500),log(6000,200,20000),log(200,10,500),.08,.08,log(6000,200,20000)].map(value=>({type:'f' as const,value}))]};
 const plate=a.algorithm===5;
 const values=[a.preDelayMs/200,log(a.decaySeconds,plate?.5:.2,plate?10:5),(a.size-2)/98,log(6000,1000,20000),(20-1)/29,.5,log(180,10,500),log(a.highCutHz,200,20000),log(.7,.5,2),plate?log(200,10,500):.4,plate?.1:.2,.1];
 return {slot,algorithm:a.algorithm,parameters:values.map(value=>({type:'f',value}))};
}
export class AmbienceConflict extends Error {
 constructor(message:string,readonly sessionId?:string){super(message);}
}

export class VocalFx {
 private readonly realSessions=new Map<string, Session>();
 private readonly simulationSessions=new Map<string, Session>();
 private simulationConnection=-1;
 private previewed:Preview|null=null;
 private busy=false;
 constructor(private xr:XR18,private library:LibraryStore,private profile:()=>CoachProfile){
  for(const record of library.list('vocal-fx')){
   const saved=record.data as Session;
   if(saved && typeof saved.identity==='string' && saved.identity.startsWith('["real",') && saved.phase!=='finished'){
    this.realSessions.set(record.id,{...saved,id:record.id});
   }
  }
 }
 private sessions(){
  if(this.xr.status().mode==='real')return this.realSessions;
  if(this.simulationConnection!==this.xr.connectionId()){
   this.simulationSessions.clear();
   this.simulationConnection=this.xr.connectionId();
  }
  return this.simulationSessions;
 }
 private target(id:unknown){
  const sessions=this.sessions();
  if(id===undefined && sessions.size<=1)return sessions.values().next().value??null;
  const selected=typeof id==='string'?sessions.get(id):undefined;
  if(!selected)throw Error('Sélectionne à nouveau l’effet à modifier.');
  return selected;
 }
 private identity(){const s=this.xr.status();return JSON.stringify([s.mode,s.model,s.host??'',s.port]);}
 private guard(write=false,session?:Session|null){if(this.xr.model().family!=='xair')throw Error('Ambiances vocales disponibles sur X-Air / M-Air');const s=this.xr.status();if(s.mode==='real'&&(!s.connected||write&&!s.writesEnabled))throw Error('Connecte la console et active le contrôle pour essayer');if(session&&session.identity!==this.identity())throw Error('Retrouve la console de cette ambiance avant de la modifier');}
 private persist(s:Session){
  const real=s.identity.startsWith('["real",');
  if(!real && (this.xr.status().mode!=='simulation'||this.xr.connectionId()!==s.simulationConnection))return;
  const sessions=real?this.realSessions:this.simulationSessions;
  if(real){
   if(s.id)this.library.update(s.id,s);
   else s.id=this.library.save('vocal-fx','Ambiance vocale',s).id;
  }else s.id??=randomUUID();
  if(s.phase==='finished')sessions.delete(s.id);
  else sessions.set(s.id,s);
 }
 status(selectedId?:string){
  const model=this.xr.model(),profile=this.profile();
  const voices=profile.inputs.filter(i=>i.channel<=model.channels && ambiencesForSource(i.source).length);
  const sessions=Array.from(this.sessions().values(),s=>({
   id:s.id!,slot:s.slot,choice:s.choice,phase:s.phase,error:s.error,conflict:s.conflict,sameConsole:s.identity===this.identity(),
   sourceMissing:!s.choice.fromMixer&&!voices.some(v=>v.channel===s.choice.channel),
   savedHost:this.savedIdentity(s)?.[2]??'',currentHost:this.xr.status().host??''
  })).sort((a,b)=>Number(b.sameConsole)-Number(a.sameConsole)||a.slot-b.slot);
  return {supported:model.family==='xair',capacity:model.family==='xair'?model.fxSlots:0,voices,monitors:(profile.musicians??[]).filter(m=>m.bus<=model.monitorOutputs),
   sessions,session:sessions.find(s=>s.id===selectedId)??sessions[0]??null};
 }
 private savedIdentity(s:Session){try{const identity=JSON.parse(s.identity);return Array.isArray(identity)&&identity.length===4?identity:null;}catch{return null;}}
 /** Forget only the application's ownership. Never restore a foreign console's snapshot. */
 async archive(confirmed=false,target?:unknown){return this.serial(async()=>{
  const s=this.target(target);
  if(!confirmed||!s)throw Error('Confirme l’archivage du suivi de cette ambiance');
  s.phase='finished';this.persist(s);this.previewed=null;
  diagnostic('ambience.archived',{slot:s.slot});return this.status();
 });}
 /** An IP change is accepted only after reading the entire owned state on the new
  * connection. No write is sent; musicians' independent dose changes are retained. */
 async reconnect(confirmed=false,target?:unknown){return this.serial(async()=>{
  const s=this.target(target),status=this.xr.status(),identity=this.identity(),connection=this.xr.connectionId();
  if(!confirmed||!s||status.mode!=='real'||!status.connected||this.xr.model().family!=='xair')throw Error('Connecte la console puis confirme la vérification de l’ambiance');
  if([...this.sessions().values()].some(other=>other!==s && other.identity===identity && other.slot===s.slot))throw Error('Cet emplacement est déjà suivi sur cette console.');
  const saved=this.savedIdentity(s);
  if(saved?.[0]!=='real'||saved[1]!==status.model||s.phase==='recovery')throw Error('Récupération automatique impossible : vérifie les effets ou archive l’ancien suivi');
  const values=await this.read(Object.keys(s.current.values)),fx=await this.xr.readFx(s.slot);
  const isDose=(key:string)=>new RegExp(`^/rtn/${s.slot}/mix/0[1-6]/level$`).test(key)&&Object.hasOwn(s.choice.doses,String(Number(key.split('/')[4])));
  if(!this.equal(Object.fromEntries(Object.entries(s.current.values).filter(([key])=>!isDose(key))),values)||!this.sameFx(s.current.fx,fx))throw Error('Les réglages de cette console ne correspondent pas à l’ambiance sauvegardée. Aucun réglage modifié.');
  const guards=await this.read(this.guardKeys(s.slot));
  if(!this.unused(s.slot,guards,s.choice.channel))throw Error('Un autre instrument utilise cet effet : vérifie-le dans Effets');
  if(connection!==this.xr.connectionId()||identity!==this.identity())throw Error('Console changée pendant la vérification');
  for(const [key,value] of Object.entries(values))if(isDose(key)){
   s.choice.doses[String(Number(key.split('/')[4]))]=Number(fromWire(key,value));
   if(s.previousChoice&&s.trialBefore)s.trialBefore.values[key]=value;
  }
  delete s.conflict;s.identity=identity;s.current={values,fx};this.previewed=null;this.persist(s);diagnostic('ambience.reconnected',{slot:s.slot});return this.status(s.id);
 });}
 private async serial<T>(fn:()=>Promise<T>){if(this.busy)throw Error('Une opération d’ambiance est en cours');this.busy=true;try{return await fn();}finally{this.busy=false;}}
 private async read(keys:string[]){const values:Values={};for(let i=0;i<keys.length;i+=8)await Promise.all(keys.slice(i,i+8).map(async key=>{values[key]=await this.xr.readParameter(key);}));return values;}
 private equal(a:Values,b:Values){return Object.entries(a).every(([key,v])=>typeof v==='number'&&typeof b[key]==='number'?Math.abs(v-Number(b[key]))<=readbackTolerance(key):v===b[key]);}
 private sameFx(a:Fx,b:Fx){return a.algorithm===b.algorithm&&a.parameters.length===b.parameters.length&&a.parameters.every((p,i)=>p.type===b.parameters[i]!.type&&Math.abs(p.value-b.parameters[i]!.value)<=(p.type==='i'?0:.00001));}
 private guardKeys(slot:number){const send=String(slot+6).padStart(2,'0');return this.xr.parameterAddresses().filter(a=>a===`/fx/${slot}/insert`||/\/insert\/(on|sel)$/.test(a)||a.endsWith(`/mix/${send}/level`)||a.startsWith(`/rtn/${slot}/mix/`)||a.startsWith('/config/buslink/'));}
 private unused(slot:number,v:Values,ownedChannel?:number,previousChannel?:number){
  if(Number(v[`/fx/${slot}/insert`])!==0)return false;
  for(const [a,value] of Object.entries(v)){
   if(a.endsWith('/insert/on')&&Number(value)===1){const selected=Number(v[a.replace('/on','/sel')]);if(selected===slot*2-1||selected===slot*2)return false;}
   if(a.endsWith(`/mix/${String(slot+6).padStart(2,'0')}/level`)&&![ownedChannel,previousChannel].some(c=>c!==undefined&&a===`${ch(c)}/mix/${String(slot+6).padStart(2,'0')}/level`)&&Number(value)>.0001)return false;
   if(a.startsWith(`/rtn/${slot}/mix/`)&&/\/mix\/(07|08|09|10)\/level$/.test(a)&&Number(value)>.0001)return false;
  }
  // Factory return faders may be open even when nobody feeds the processor.
  // Existing return destinations are captured, shown in the preview and restored on undo.
  return true;
 }
 private async inspectCurrent(s:Session){
  const connection=this.xr.connectionId();
  const current=await this.read(Object.keys(s.current.values));
  const fx=await this.xr.readFx(s.slot);
  if(connection!==this.xr.connectionId()||this.sessions().get(s.id!)!==s||s.identity!==this.identity())throw Error('Console changée pendant la vérification');

  const levels=new Map(Object.keys(s.choice.doses).map(bus=>[`/rtn/${s.slot}/mix/${bus.padStart(2,'0')}/level`,bus]));
  const readings:Record<string,number>={};
  for(const [key,bus] of levels)readings[bus]=Number(fromWire(key,current[key]!));

  let conflict:string|undefined;
  if(s.current.fx.algorithm!==fx.algorithm){
   const name=(id:number)=>FX_SCHEMAS[id]?.name??FX_NAMES[id]??String(id);
   conflict=`L’ambiance utilisait ${name(s.current.fx.algorithm)}. La console utilise actuellement ${name(fx.algorithm)}.`;
  }else if(!this.sameFx(s.current.fx,fx)){
   conflict='Les paramètres de l’effet diffèrent de ceux de l’ambiance enregistrée.';
  }else{
   const changed=Object.entries(s.current.values).find(([key,value])=>!levels.has(key)&&!this.equal({[key]:value},current));
   if(changed)conflict=`Le réglage ${changed[0]} diffère de celui de l’ambiance enregistrée.`;
  }

  let dirty=conflict!==s.conflict;
  s.conflict=conflict;
  // An unrelated effect can occupy the same slot. Its readings must never
  // replace the saved trial or the snapshot used to undo a style change.
  if(!conflict)for(const [key,bus] of levels){
   const value=current[key]!;
   if(value===s.current.values[key])continue;
   if(s.previousChoice&&s.trialBefore)s.trialBefore.values[key]=value;
   s.current.values[key]=value;s.choice.doses[bus]=readings[bus]!;dirty=true;
  }
  if(dirty)this.persist(s);
  return readings;
 }
 private async assertCurrent(s:Session){
  await this.inspectCurrent(s);
  if(s.conflict)throw new AmbienceConflict(s.conflict,s.id);
 }
 async readDoses(target?:unknown){return this.serial(async()=>{
  const s=this.target(target);
  this.guard(false,s);
  const readings=s&&s.phase!=='recovery'?await this.inspectCurrent(s):undefined;
  return {...this.status(s?.id),readings};
 });}
 async preview(input:unknown,mixerProfile?:CoachProfile,target?:unknown){return this.serial(async()=>{
  const choice=input as Choice;
  this.guard();const identity=this.identity(),connection=this.xr.connectionId();
  const profile=mixerProfile??this.profile(),voice=profile.inputs.find(i=>i.channel===choice?.channel);
  if(!voice||!Number.isInteger(voice.channel)||voice.channel<(mixerProfile?0:1)||voice.channel>this.xr.model().channels||!ambiencesForSource(voice.source).some(a=>a.id===choice.ambience)||!choice.doses||typeof choice.doses!=='object'||Array.isArray(choice.doses))throw Error('Choisis une source, une ambiance adaptée et les retours');
  let session:Session|null=null;
  if(target===undefined){
   // Older clients can identify an effect only by its input.
   const matches=[...this.sessions().values()].filter(s=>s.identity===identity&&s.choice.channel===voice.channel);
   if(matches.length>1)throw Error('Sélectionne à nouveau l’effet à modifier.');
   session=matches[0]??null;
  }else if(target!==null){
   session=this.target(target);
   this.guard(false,session);
   if(session?.choice.channel!==voice.channel)throw Error('Cet effet appartient à une autre entrée. Prépare un nouvel effet.');
  }
  if(session?.phase==='trial'||session?.phase==='recovery')throw Error('Garde ou annule d’abord l’essai en cours');
  const monitors=(profile.musicians??[]).filter(m=>m.bus<=this.xr.model().monitorOutputs),buses=new Set(monitors.map(m=>m.bus));
  const main=choice.mainDb===undefined?-90:choice.mainDb;
  if(!Number.isFinite(main)||main< -90||main>0)throw Error('Dosage de façade invalide');
  if([...buses].some(b=>b<1||b>this.xr.model().monitorOutputs)||(!Object.keys(choice.doses).length&&main===-90)||Object.entries(choice.doses).some(([bus,db])=>!/^[1-6]$/.test(bus)||!buses.has(Number(bus))||typeof db!=='number'||!Number.isFinite(db)||db< -90||db>0))throw Error('Prépare les musiciens et choisis leur dosage');
  const sourceGuards:Values={};
  if(choice.channel>0){
   const odd=choice.channel%2?choice.channel:choice.channel-1,link='/config/chlink/'+odd+'-'+(odd+1);
   sourceGuards[link]=await this.xr.readParameter(link);
   if(Number(sourceGuards[link])===1)throw Error('Cette source appartient à une paire liée : configure son effet dans la console');
  }
  let slot=session?.slot??0,guards:Values={};
  if(session){
   await this.assertCurrent(session);guards=await this.read(this.guardKeys(slot));
   if(!this.unused(slot,guards,session.choice.channel))throw Error('Un autre instrument utilise maintenant cet effet : conserve son réglage dans la console');
  }else{
   const reserved=new Set([...this.sessions().values()].filter(s=>s.identity===identity).map(s=>s.slot));
   for(let candidate=1;candidate<=this.xr.model().fxSlots;candidate++){
    if(reserved.has(candidate))continue;
    const actual=await this.read(this.guardKeys(candidate));
    if(this.unused(candidate,actual)){slot=candidate;guards=actual;break;}
   }
  }
  if(!slot)throw Error('Les quatre effets sont utilisés. Libère un emplacement dans Effets ; aucun effet existant n’a été remplacé.');
  Object.assign(guards,sourceGuards);
  const doses:Record<string,number>={};for(const bus of buses)doses[String(bus)]=choice.doses[String(bus)]??-90;
  for(let b=1;b<=this.xr.model().buses;b+=2)if(b+1<=this.xr.model().buses&&Number(guards[`/config/buslink/${b}-${b+1}`])===1){const a=doses[String(b)],c=doses[String(b+1)];if(a!==undefined&&c!==undefined&&a!==c)throw Error(`Les retours ${b} et ${b+1} sont une paire stéréo : choisis le même dosage pour les deux`);if(a!==undefined||c!==undefined)doses[String(b)]=doses[String(b+1)]=a??c!;}
  const afterPreset=GUIDED_AMBIENCES.find(a=>a.id===choice.ambience)!;
  const send=String(slot+6).padStart(2,'0');
  const wanted:Values={[`${ch(choice.channel)}/mix/${send}/level`]:0,[`${ch(choice.channel)}/mix/${send}/tap`]:main>-90?4:3,[`/fxsend/${slot}/mix/on`]:1,[`/fxsend/${slot}/mix/fader`]:-6,[`/rtn/${slot}/mix/on`]:1,[`/rtn/${slot}/mix/lr`]:main>-90?1:0,[`/rtn/${slot}/config/name`]:target===undefined?effectReturnName(voice.source):'FX'+slot+' '+(afterPreset.algorithm===10?'Delay':'Reverb')};
  if(main>-90)wanted[`/rtn/${slot}/mix/fader`]=main;
  // PRE return sends keep ear ambience independent of the return's FOH fader.
  for(let b=1;b<=this.xr.model().buses;b++){const p=`/rtn/${slot}/mix/${String(b).padStart(2,'0')}`;wanted[p+'/level']=doses[String(b)]??-90;wanted[p+'/tap']=3;}
  const after={values:Object.fromEntries(Object.entries(wanted).map(([a,v])=>[a,toWire(a,v)])),fx:vocalFxProgram(choice.ambience,slot)};
  const before={values:await this.read(Object.keys(after.values)),fx:await this.xr.readFx(slot)};
  if(session)for(const [key,value] of Object.entries(session.current.values))if(!(key in after.values)){after.values[key]=value;before.values[key]=await this.xr.readParameter(key);}
  if(connection!==this.xr.connectionId()||identity!==this.identity())throw Error('Console changée pendant la préparation');
  const p:Preview={id:randomUUID(),target:session?.id??null,identity,connection,expires:Date.now()+600000,choice:{channel:choice.channel,ambience:choice.ambience,doses,...(main>-90&&{mainDb:main}),...(mixerProfile&&{fromMixer:true})},before,after,guards};this.previewed=p;
  return {token:p.id,slot,voice:voice.name,mainDb:main,ambience:GUIDED_AMBIENCES.find(a=>a.id===choice.ambience),monitors:monitors.map(m=>({...m,db:doses[String(m.bus)]??-90})),changes:Object.entries(after.values).map(([address,value])=>({address,before:fromWire(address,before.values[address]!),after:fromWire(address,value)})),message:main>-90?'L’effet suit le fader de l’entrée. Le dosage de façade et ceux des retours sont indépendants.':'Même ambiance, dosage individuel. Le son direct et les volumes des ears sont conservés ; cet effet est envoyé uniquement aux retours préparés.'};
 });}
 private async write(snapshot:Snapshot,connection:number){
  const verifyConnection=()=>{if(connection!==this.xr.connectionId())throw Error('Console changée pendant l’opération');this.guard(true);};
  verifyConnection();const slot=snapshot.fx.slot,off=`/fxsend/${slot}/mix/on`;
  await this.xr.applyParameters({[off]:0});verifyConnection();await this.xr.applyFx(snapshot.fx);verifyConnection();
  await this.xr.applyParameters(Object.fromEntries(Object.entries(snapshot.values).filter(([a])=>a!==off)));
  verifyConnection();await this.xr.applyParameters({[off]:snapshot.values[off]??0});verifyConnection();
  if(!this.equal(snapshot.values,await this.read(Object.keys(snapshot.values))))throw Error('Réglages non confirmés après l’essai');
 }
 async apply(token:unknown,confirm:unknown){return this.serial(async()=>{
  this.guard(true);const p=this.previewed;
  if(confirm!==true||!p||token!==p.id||p.identity!==this.identity()||p.connection!==this.xr.connectionId()||p.expires<Date.now())throw Error('Relis la proposition avant de l’appliquer');
  this.previewed=null;
  if(!this.equal(p.guards,await this.read(Object.keys(p.guards)))||!this.equal(p.before.values,await this.read(Object.keys(p.before.values)))||!this.sameFx(p.before.fx,await this.xr.readFx(p.before.fx.slot)))throw Error('La console a changé : prépare une nouvelle proposition');
  if(p.connection!==this.xr.connectionId())throw Error('Console changée pendant la vérification');
  const old=p.target===null?null:this.target(p.target),origin=old?{fx:old.origin.fx,values:{...p.before.values,...old.origin.values}}:structuredClone(p.before);
  const trial:Session={id:old?.id,...(this.xr.status().mode==='simulation'&&{simulationConnection:p.connection}),identity:p.identity,slot:p.after.fx.slot,choice:p.choice,origin,current:p.after,trialBefore:p.before,previousChoice:old?.choice,phase:'recovery'};this.persist(trial);
  try{await this.write(p.after,p.connection);trial.current={fx:await this.xr.readFx(p.after.fx.slot),values:await this.read(Object.keys(p.after.values))};if(p.connection!==this.xr.connectionId())throw Error('Console changée pendant l’essai');trial.phase='trial';this.persist(trial);}
  catch(e){trial.error=(e as Error).message;this.persist(trial);throw Error('Essai incomplet : '+trial.error+'. La sauvegarde est conservée ; utilise Revenir avant l’essai.');}
  return this.status(trial.id);
 });}
 async keep(target?:unknown){return this.serial(async()=>{const s=this.target(target);this.guard(true,s);if(!s||s.phase!=='trial')throw Error('Aucun essai à garder');await this.assertCurrent(s);s.phase='kept';delete s.trialBefore;delete s.previousChoice;delete s.error;this.persist(s);return this.status(s.id);});}
 async undo(all=false,confirmed=false,target?:unknown){return this.serial(async()=>{
  const s=this.target(target),connection=this.xr.connectionId();this.guard(true,s);if(!s||!confirmed)throw Error('Confirme le retour aux réglages précédents');
  if(s.phase!=='recovery')await this.assertCurrent(s);
  const guard=await this.read(this.guardKeys(s.slot));if(!this.unused(s.slot,guard,s.choice.channel,s.previousChoice?.channel))throw Error('Un autre instrument utilise ce slot : vérifie-le dans Effets avant de le restaurer');
  const desired=all?s.origin:s.trialBefore;if(!desired)throw Error('Aucun essai à annuler');s.phase='recovery';this.persist(s);
  try{await this.write(desired,connection);delete s.error;if(!all&&s.previousChoice){s.choice=s.previousChoice;s.current={fx:await this.xr.readFx(s.slot),values:await this.read(Object.keys(desired.values))};s.phase='kept';for(const bus of Object.keys(s.choice.doses)){const key=`/rtn/${s.slot}/mix/${bus.padStart(2,'0')}/level`;if(s.current.values[key]!==undefined)s.choice.doses[bus]=Number(fromWire(key,s.current.values[key]!));}delete s.trialBefore;delete s.previousChoice;this.persist(s);}else{s.phase='finished';this.persist(s);}}
  catch(e){s.error=(e as Error).message;this.persist(s);throw e;}
  return this.status(s.id);
 });}
}
