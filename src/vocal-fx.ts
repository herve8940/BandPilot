import {randomUUID} from 'node:crypto';
import {VOCAL_AMBIENCES} from '../shared/vocal-ambiences.js';
import {fromWire,toWire,readbackTolerance,type Value} from './parameters.js';
import {source,type CoachProfile} from './sound-coach.js';
import type {XR18} from './xr18.js';
import type {LibraryStore} from './library-store.js';
type Values=Record<string,Value>;
type Fx=Awaited<ReturnType<XR18['readFx']>>;
type Snapshot={values:Values;fx:Fx};
type Choice={channel:number;ambience:string;doses:Record<string,number>};
type Session={identity:string;slot:number;choice:Choice;origin:Snapshot;current:Snapshot;trialBefore?:Snapshot;previousChoice?:Choice;phase:'trial'|'kept'|'recovery'|'finished';error?:string};
type Preview={id:string;identity:string;expires:number;choice:Choice;before:Snapshot;after:Snapshot;guards:Values};
const ch=(c:number)=>`/ch/${String(c).padStart(2,'0')}`;
const log=(value:number,lo:number,hi:number)=>Math.log(value/lo)/Math.log(hi/lo);
/** Parameter order/scales checked against XAir_fxparse1.c, HALL/PLAT/DLY (pmaillot).
 * Independent mapping of protocol facts; no X32 fallback. See docs/INGE_SON.md.
 */
export function vocalFxProgram(id:string,slot:number):Fx{
 const a=VOCAL_AMBIENCES.find(a=>a.id===id);if(!a)throw Error('Ambiance inconnue');
 if(a.algorithm===10)return {slot,algorithm:10,parameters:[{type:'f',value:1},{type:'f',value:(110-1)/2999},{type:'i',value:0},{type:'i',value:4},{type:'i',value:4},{type:'f',value:.5},...[log(200,10,500),log(6000,200,20000),log(200,10,500),.08,.08,log(6000,200,20000)].map(value=>({type:'f' as const,value}))]};
 const plate=a.algorithm===5;
 const values=[a.preDelayMs/200,log(a.decaySeconds,plate?.5:.2,plate?10:5),(a.size-2)/98,log(6000,1000,20000),(20-1)/29,.5,log(180,10,500),log(a.highCutHz,200,20000),log(.7,.5,2),plate?log(200,10,500):.4,plate?.1:.2,.1];
 return {slot,algorithm:a.algorithm,parameters:values.map(value=>({type:'f',value}))};
}
export class VocalFx {
 private session:Session|null=null;
 private entry:string|null=null;
 private previewed:Preview|null=null;
 private busy=false;
 constructor(private xr:XR18,private library:LibraryStore,private profile:()=>CoachProfile){
  const saved=library.list('vocal-fx').find(e=>(e.data as Session).phase!=='finished');
  if(saved){this.session=saved.data as Session;this.entry=saved.id;}
 }
 private identity(){const s=this.xr.status();return JSON.stringify([s.mode,s.model,s.host??'',s.port]);}
 private guard(write=false){if(this.xr.model().family!=='xair')throw Error('Ambiances vocales disponibles sur X-Air / M-Air');const s=this.xr.status();if(s.mode==='real'&&(!s.connected||write&&!s.writesEnabled))throw Error('Connecte la console et active le contrôle pour essayer');if(this.session&&this.session.identity!==this.identity())throw Error('Retrouve la console de cette ambiance avant de la modifier');}
 private persist(){if(this.session){if(this.entry)this.library.update(this.entry,this.session);else this.entry=this.library.save('vocal-fx','Ambiance vocale',this.session).id;}}
 status(){const s=this.session;return {supported:this.xr.model().family==='xair',voices:this.profile().inputs.filter(i=>['voice','backing'].includes(source(i.source).family)),monitors:this.profile().musicians??[],session:s?{slot:s.slot,choice:s.choice,phase:s.phase,error:s.error,sameConsole:s.identity===this.identity()}:null};}
 private async serial<T>(fn:()=>Promise<T>){if(this.busy)throw Error('Une opération d’ambiance est en cours');this.busy=true;try{return await fn();}finally{this.busy=false;}}
 private async read(keys:string[]){const values:Values={};for(let i=0;i<keys.length;i+=8)await Promise.all(keys.slice(i,i+8).map(async key=>{values[key]=await this.xr.readParameter(key);}));return values;}
 private equal(a:Values,b:Values){return Object.entries(a).every(([key,v])=>typeof v==='number'&&typeof b[key]==='number'?Math.abs(v-Number(b[key]))<=readbackTolerance(key):v===b[key]);}
 private sameFx(a:Fx,b:Fx){return a.algorithm===b.algorithm&&a.parameters.length===b.parameters.length&&a.parameters.every((p,i)=>p.type===b.parameters[i]!.type&&Math.abs(p.value-b.parameters[i]!.value)<=(p.type==='i'?0:.00001));}
 private guardKeys(slot:number){const send=String(slot+6).padStart(2,'0');return this.xr.parameterAddresses().filter(a=>a===`/fx/${slot}/insert`||/\/insert\/(on|sel)$/.test(a)||a.endsWith(`/mix/${send}/level`)||a.startsWith(`/rtn/${slot}/mix/`)||a.startsWith('/config/buslink/'));}
 private unused(slot:number,v:Values,ownedChannel?:number,previousChannel?:number){
  if(Number(v[`/fx/${slot}/insert`])!==0)return false;
  for(const [a,value] of Object.entries(v)){
   if(a.endsWith('/insert/on')&&Number(value)===1){const selected=Number(v[a.replace('/on','/sel')]);if(selected===slot*2-1||selected===slot*2)return false;}
   if(a.endsWith(`/mix/${String(slot+6).padStart(2,'0')}/level`)&&![ownedChannel,previousChannel].filter(Boolean).some(c=>a===`${ch(c!)}/mix/${String(slot+6).padStart(2,'0')}/level`)&&Number(value)>.0001)return false;
   if(a.startsWith(`/rtn/${slot}/mix/`)&&/\/mix\/(07|08|09|10)\/level$/.test(a)&&Number(value)>.0001)return false;
  }
  // Factory return faders may be open even when nobody feeds the processor.
  // Existing return destinations are captured, shown in the preview and restored on undo.
  return true;
 }
 private async assertCurrent(s:Session){
  const current=await this.read(Object.keys(s.current.values));
  const dose=(key:string)=>new RegExp(`^/rtn/${s.slot}/mix/0[1-6]/level$`).test(key)&&Object.hasOwn(s.choice.doses,String(Number(key.split('/')[4])));
  if(!this.equal(Object.fromEntries(Object.entries(s.current.values).filter(([key])=>!dose(key))),current)||!this.sameFx(s.current.fx,await this.xr.readFx(s.slot)))throw Error('Cette ambiance a été modifiée dans la console : aucun réglage remplacé. Vérifie le slot dans Effets.');
  // Ear levels belong to the musicians. Accept their phone adjustments, and preserve
  // them when undoing a style change; removing the whole ambience restores its origin.
  for(const [key,value] of Object.entries(current))if(dose(key)&&value!==s.current.values[key]){
   if(s.previousChoice&&s.trialBefore)s.trialBefore.values[key]=value;
   s.current.values[key]=value;s.choice.doses[String(Number(key.split('/')[4]))]=Number(fromWire(key,value));
  }
  this.persist();
 }
 async readDoses(){return this.serial(async()=>{this.guard();if(this.session&&this.session.phase!=='recovery')await this.assertCurrent(this.session);return this.status();});}
 async preview(input:unknown){return this.serial(async()=>{
  this.guard();const identity=this.identity();if(this.session?.phase==='trial'||this.session?.phase==='recovery')throw Error('Garde ou annule d’abord l’essai en cours');
  const choice=input as Choice;if(!choice||!Number.isInteger(choice.channel)||!this.status().voices.some(i=>i.channel===choice.channel)||!VOCAL_AMBIENCES.some(a=>a.id===choice.ambience)||!choice.doses||typeof choice.doses!=='object'||Array.isArray(choice.doses))throw Error('Choisis une voix, une ambiance et les retours');
  const monitors=this.profile().musicians??[],buses=new Set(monitors.map(m=>m.bus));
  if(!buses.size||[...buses].some(b=>b<1||b>this.xr.model().monitorOutputs)||!Object.keys(choice.doses).length||Object.entries(choice.doses).some(([bus,db])=>!/^\d+$/.test(bus)||!buses.has(Number(bus))||typeof db!=='number'||!Number.isFinite(db)||db< -90||db>0))throw Error('Prépare les musiciens et choisis leur dosage');
  const odd=choice.channel%2?choice.channel:choice.channel-1;if(Number(await this.xr.readParameter(`/config/chlink/${odd}-${odd+1}`))===1)throw Error('Cette voix appartient à une paire liée : configure son effet dans la console');
  let slot=this.session?.slot??0,guards:Values={};
  if(this.session){await this.assertCurrent(this.session);guards=await this.read(this.guardKeys(slot));if(!this.unused(slot,guards,this.session.choice.channel))throw Error('Un autre instrument utilise maintenant cet effet : conserve son réglage dans la console');}
  else for(let candidate=1;candidate<=4;candidate++){const v=await this.read(this.guardKeys(candidate));if(this.unused(candidate,v)){slot=candidate;guards=v;break;}}
  if(!slot)throw Error('Les quatre effets sont utilisés. Libère un emplacement dans Effets ; aucun effet existant n’a été remplacé.');
  const doses:Record<string,number>={};for(const bus of buses)doses[String(bus)]=choice.doses[String(bus)]??-90;
  for(let b=1;b<=this.xr.model().buses;b+=2)if(b+1<=this.xr.model().buses&&Number(guards[`/config/buslink/${b}-${b+1}`])===1){const a=doses[String(b)],c=doses[String(b+1)];if(a!==undefined&&c!==undefined&&a!==c)throw Error(`Les retours ${b} et ${b+1} sont une paire stéréo : choisis le même dosage pour les deux`);if(a!==undefined||c!==undefined)doses[String(b)]=doses[String(b+1)]=a??c!;}
  const send=String(slot+6).padStart(2,'0'),wanted:Values={};
  if(this.session)wanted[`${ch(this.session.choice.channel)}/mix/${send}/level`]=-90;
  Object.assign(wanted,{[`${ch(choice.channel)}/mix/${send}/level`]:0,[`${ch(choice.channel)}/mix/${send}/tap`]:3,[`/fxsend/${slot}/mix/on`]:1,[`/fxsend/${slot}/mix/fader`]:-6,[`/rtn/${slot}/mix/on`]:1,[`/rtn/${slot}/mix/lr`]:0,[`/rtn/${slot}/config/name`]:'Voix FX'});
  // PRE return sends keep ear ambience independent of the return's FOH fader.
  for(let b=1;b<=this.xr.model().buses;b++){const p=`/rtn/${slot}/mix/${String(b).padStart(2,'0')}`;wanted[p+'/level']=doses[String(b)]??-90;wanted[p+'/tap']=3;}
  const after={values:Object.fromEntries(Object.entries(wanted).map(([a,v])=>[a,toWire(a,v)])),fx:vocalFxProgram(choice.ambience,slot)};
  const before={values:await this.read(Object.keys(after.values)),fx:await this.xr.readFx(slot)};
  if(this.session)for(const [key,value] of Object.entries(this.session.current.values))if(!(key in after.values)){after.values[key]=value;before.values[key]=await this.xr.readParameter(key);}
  if(identity!==this.identity())throw Error('Console changée pendant la préparation');
  const p:Preview={id:randomUUID(),identity,expires:Date.now()+600000,choice:{channel:choice.channel,ambience:choice.ambience,doses},before,after,guards};this.previewed=p;
  return {token:p.id,slot,voice:this.status().voices.find(i=>i.channel===choice.channel)!.name,ambience:VOCAL_AMBIENCES.find(a=>a.id===choice.ambience),monitors:monitors.map(m=>({...m,db:doses[String(m.bus)]??-90})),changes:Object.entries(after.values).map(([address,value])=>({address,before:fromWire(address,before.values[address]!),after:fromWire(address,value)})),message:'Même ambiance, dosage individuel. La voix sèche et les volumes des ears sont conservés ; cet effet est envoyé uniquement aux retours préparés.'};
 });}
 private async write(snapshot:Snapshot){
  this.guard(true);const slot=snapshot.fx.slot,off=`/fxsend/${slot}/mix/on`;
  await this.xr.applyParameters({[off]:0});this.guard(true);await this.xr.applyFx(snapshot.fx);this.guard(true);
  await this.xr.applyParameters(Object.fromEntries(Object.entries(snapshot.values).filter(([a])=>a!==off)));
  this.guard(true);await this.xr.applyParameters({[off]:snapshot.values[off]??0});this.guard(true);
  if(!this.equal(snapshot.values,await this.read(Object.keys(snapshot.values))))throw Error('Réglages non confirmés après l’essai');
 }
 async apply(token:unknown,confirm:unknown){return this.serial(async()=>{
  this.guard(true);const p=this.previewed;
  if(confirm!==true||!p||token!==p.id||p.identity!==this.identity()||p.expires<Date.now())throw Error('Relis la proposition avant de l’appliquer');
  this.previewed=null;
  if(!this.equal(p.guards,await this.read(Object.keys(p.guards)))||!this.equal(p.before.values,await this.read(Object.keys(p.before.values)))||!this.sameFx(p.before.fx,await this.xr.readFx(p.before.fx.slot)))throw Error('La console a changé : prépare une nouvelle proposition');
  const old=this.session,origin=old?{fx:old.origin.fx,values:{...p.before.values,...old.origin.values}}:structuredClone(p.before);
  this.session={identity:p.identity,slot:p.after.fx.slot,choice:p.choice,origin,current:p.after,trialBefore:p.before,previousChoice:old?.choice,phase:'recovery'};this.persist();
  try{await this.write(p.after);this.session.current={fx:await this.xr.readFx(p.after.fx.slot),values:await this.read(Object.keys(p.after.values))};this.session.phase='trial';this.persist();}
  catch(e){this.session.error=(e as Error).message;this.persist();throw Error('Essai incomplet : '+this.session.error+'. La sauvegarde est conservée ; utilise Revenir avant l’essai.');}
  return this.status();
 });}
 async keep(){return this.serial(async()=>{this.guard(true);const s=this.session;if(!s||s.phase!=='trial')throw Error('Aucun essai à garder');await this.assertCurrent(s);s.phase='kept';delete s.trialBefore;delete s.previousChoice;delete s.error;this.persist();return this.status();});}
 async undo(all=false,confirmed=false){return this.serial(async()=>{
  this.guard(true);const s=this.session;if(!s||!confirmed)throw Error('Confirme le retour aux réglages précédents');
  if(s.phase!=='recovery')await this.assertCurrent(s);
  const guard=await this.read(this.guardKeys(s.slot));if(!this.unused(s.slot,guard,s.choice.channel,s.previousChoice?.channel))throw Error('Un autre instrument utilise ce slot : vérifie-le dans Effets avant de le restaurer');
  const desired=all?s.origin:s.trialBefore;if(!desired)throw Error('Aucun essai à annuler');s.phase='recovery';this.persist();
  try{await this.write(desired);delete s.error;if(!all&&s.previousChoice){s.choice=s.previousChoice;s.current={fx:await this.xr.readFx(s.slot),values:await this.read(Object.keys(desired.values))};s.phase='kept';for(const bus of Object.keys(s.choice.doses)){const key=`/rtn/${s.slot}/mix/${bus.padStart(2,'0')}/level`;if(s.current.values[key]!==undefined)s.choice.doses[bus]=Number(fromWire(key,s.current.values[key]!));}delete s.trialBefore;delete s.previousChoice;this.persist();}else{s.phase='finished';this.persist();this.session=null;this.entry=null;}}
  catch(e){s.error=(e as Error).message;this.persist();throw e;}
  return this.status();
 });}
}
