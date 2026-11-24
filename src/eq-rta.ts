import {trackResonance,sustainedResonance,type Resonance} from '../shared/resonance-tracker.js';
import {randomUUID} from 'node:crypto';
import type {XR18} from './xr18.js';

export type RtaTarget={kind:'ch'|'bus'|'lr'|'aux'|'fxrtn';n:number};
type Frame={bands:number[];at:number};
type RingPass={id:string;owner:string;bus:number;linked:boolean;until:number;candidate:Resonance|null;applying:boolean};
type Session={ring?:RingPass;token:string;generation:number;source:number;post:boolean;previous:{source:number;post:boolean};expires:number;ready:number;frame:Frame|null};
export const RTA_LEASE_MS=6000;
/** One console analyser, shared across all clients. Monitoring changes display selection only. A separate
 * one-shot correction requires an explicitly armed pass on the monitored bus. */
export class EqRta {
 private session:Session|null=null;
 private tail:Promise<unknown>=Promise.resolve();
 private timer:NodeJS.Timeout;
 private starting=false;
 private releasing=false;
 constructor(private xr:XR18,private analyzerBusy:()=>boolean,private clock:()=>number=Date.now){
  xr.on('rta',(f:Frame)=>{
   const s=this.session,now=this.clock();
   if(!s||!Number.isFinite(f.at)||now<s.ready||f.at<s.ready||f.at>now+1000||f.bands.length!==100||!f.bands.every(Number.isFinite))return;
   s.frame={bands:[...f.bands],at:f.at};
   if(s.ring)s.ring.candidate=trackResonance(s.ring.candidate,f,now);
  });
  xr.on('reset',()=>{this.session=null;});
  xr.on('osc-reply',(m:{address:string;args:unknown[]})=>{const s=this.session;if(s&&((m.address==='/-stat/rta/source'&&m.args[0]!==s.source)||(m.address==='/-stat/rta/pos'&&m.args[0]!==Number(s.post)))){s.frame=null;delete s.ring;s.ready=this.clock()+350;}});
  this.timer=setInterval(()=>{if(this.session&&this.session.expires<this.clock())void this.serial(async()=>{if(this.session&&this.session.expires<this.clock())await this.release();}).catch(()=>{});},1000);this.timer.unref();
 }
 private serial<T>(fn:()=>Promise<T>):Promise<T>{const next=this.tail.then(fn,fn);this.tail=next.catch(()=>{});return next;}
 busy(){return this.starting||this.releasing||this.session!==null;}
 info(){const s=this.xr.status();return {model:s.model,mode:s.mode,connected:s.connected,supported:this.xr.model().family==='xair',busy:this.busy()||this.analyzerBusy(),connectionId:this.xr.connectionId()};}
 private async selection(){
  const source=(await this.xr.query('/-stat/rta/source')).args[0],pos=(await this.xr.query('/-stat/rta/pos')).args[0];
  if(typeof source!=='number'||!Number.isInteger(source)||source<0||source>32||(pos!==0&&pos!==1))throw Error('Source RTA non vérifiable sur cette console.');
  return {source,post:pos===1};
 }
 private async verifySelection(expected:{source:number;post:boolean},generation:number){
  // Hardware can reply with a queued pre-change value. Re-read, never replay
  // the selection command, just as for audio parameter readback.
  for(const delay of [0,50,100]){
   if(delay)await new Promise(r=>setTimeout(r,delay));
   if(generation!==this.xr.connectionId())throw Error('Connexion modifiée');
   const observed=await this.selection();
   if(generation!==this.xr.connectionId())throw Error('Connexion modifiée');
   if(observed.source===expected.source&&observed.post===expected.post)return true;
  }
  return false;
 }
 private source(t:RtaTarget){
  if(!t||!Number.isInteger(t.n))throw Error('Source d’analyse invalide');
  if(t.kind==='ch'&&t.n>=1&&t.n<=this.xr.model().channels)return t.n-1;
  if(t.kind==='bus'&&t.n>=1&&t.n<=this.xr.model().monitorOutputs)return 20+t.n;
  if(t.kind==='lr'&&t.n===0)return 31;
  if(t.kind==='aux'&&t.n===0)return 16;
  if(t.kind==='fxrtn'&&t.n>=1&&t.n<=4)return 16+t.n;
  throw Error('Source d’analyse invalide');
 }
 start(target:RtaTarget,post:unknown){return this.serial(async()=>{
  if(this.xr.model().family!=='xair'||this.xr.mode!=='real'||!this.xr.status().connected)throw Error('Le RTA nécessite une console X-Air / M-Air réelle connectée.');
  if(this.busy()||this.analyzerBusy())throw Error('L’analyseur est déjà utilisé. Arrête l’autre analyse avant de lancer ce spectre.');
  if(typeof post!=='boolean')throw Error('Position RTA invalide.');
  const source=this.source(target);this.starting=true;try{const generation=this.xr.connectionId(),previous=await this.selection();
  if(generation!==this.xr.connectionId())throw Error('Connexion modifiée');
  const s:Session={token:randomUUID(),generation,source,post,previous,expires:this.clock()+RTA_LEASE_MS,ready:this.clock()+350,frame:null};
  this.session=s;
  try{this.xr.setRtaSource(source,post);if(!await this.verifySelection({source,post},generation))throw Error('Source RTA non vérifiable sur cette console.');this.xr.subscribeAnalysis();return {token:s.token,...this.info()};}
  catch(e){await this.release().catch(()=>{});throw e;}
  }finally{this.starting=false;}
 });}
 read(token:unknown){return this.serial(async()=>{
  const s=this.session;
  if(!s||s.token!==token)throw Error('Session RTA terminée. Relance le spectre.');
  if(s.expires<this.clock()){await this.release();throw Error('Session RTA terminée. Relance le spectre.');}
  if(s.generation!==this.xr.connectionId()||!this.xr.status().connected){this.session=null;throw Error('Connexion modifiée');}
  const observed=await this.selection();
  if(this.session!==s||s.generation!==this.xr.connectionId())throw Error('Connexion modifiée');
  if(observed.source!==s.source||observed.post!==s.post){this.session=null;throw Error('La source RTA a changé ailleurs. Relance le spectre pour cette tranche.');}
  s.expires=this.clock()+RTA_LEASE_MS;this.xr.subscribeAnalysis();
  return {...this.info(),ringReadyId:s.ring&&s.ring.until>this.clock()&&sustainedResonance(s.ring.candidate)?s.ring.id:null,frame:s.frame&&this.clock()-s.frame.at<1500?s.frame:null};
 });}
 armRing(token:unknown,owner:string,bus:unknown,linked:unknown,id:unknown){
  const s=this.session;
  if(!s||s.token!==token||this.xr.mode!=='real'||!this.xr.status().writesEnabled||!this.xr.status().connected||s.generation!==this.xr.connectionId()||
    typeof bus!=='number'||!Number.isInteger(bus)||bus<1||bus>this.xr.model().monitorOutputs||s.source!==20+bus||s.expires<=this.clock()||!s.frame||this.clock()-s.frame.at>1000||
    typeof linked!=='boolean'||typeof id!=='string'||!/^[-a-f0-9]{36}$/.test(id))throw Error('Vérifie le RTA et le GEQ du retour.');
  if(s.ring&&s.ring.until>this.clock())throw Error('Une correction est déjà armée.');
  s.ring={id,owner,bus,linked,until:this.clock()+30000,candidate:null,applying:false};
 }
 stopRing(token:unknown,owner:string,id:unknown){const s=this.session;if(s&&s.token===token&&s.ring&&s.ring.id===id&&s.ring.owner===owner)delete s.ring;}
 async correctRing(token:unknown,owner:string,id:unknown,correct:(bus:number,linked:boolean,hz:number,assertPeak:()=>void,assertSession:()=>void)=>Promise<unknown>){
  const s=this.session,pass=s?.ring;
  if(!s||s.token!==token||!pass||pass.id!==id||pass.owner!==owner||pass.applying)throw Error('Correction arrêtée.');
  pass.applying=true;
  try{
   await this.read(token);
   const peak=pass.candidate;
   if(!peak||!sustainedResonance(peak)||peak.hz<40||peak.hz>12500)throw Error('Aucun pic persistant repéré.');
   const assertSession=()=>{
    const now=this.clock();
    if(this.session!==s||s.ring!==pass||s.generation!==this.xr.connectionId()||!this.xr.status().writesEnabled||!this.xr.status().connected||
       now>=pass.until||s.expires<=now)throw Error('Correction arrêtée.');
   };
   const assertPeak=()=>{
    assertSession();
    const r=pass.candidate;
    if(!r||r.since!==peak.since||Math.abs(r.bin-peak.bin)>1||this.clock()-r.at>=1500)throw Error('Correction arrêtée.');
   };
   assertPeak();return await correct(pass.bus,pass.linked,peak.hz,assertPeak,assertSession);
  }finally{if(s.ring===pass)delete s.ring;}
 }
 stop(token:unknown){return this.serial(async()=>{if(this.session?.token===token)await this.release();return {ok:true};});}
 private async release(){
  this.releasing=true;try{
  const s=this.session;this.session=null;
  if(!s||s.generation!==this.xr.connectionId()||!this.xr.status().connected)return;
  const observed=await this.selection();
  // An external change belongs to its author. Never replace it during cleanup.
  if(s.generation===this.xr.connectionId()&&observed.source===s.source&&observed.post===s.post){
   this.xr.setRtaSource(s.previous.source,s.previous.post);
   if(!await this.verifySelection(s.previous,s.generation))throw Error('La restauration de la source RTA n’a pas pu être confirmée. Vérifie la source dans la console.');
  }
  }finally{this.releasing=false;}
 }
 releaseCurrent(){return this.serial(()=>this.release());}
 async close(){clearInterval(this.timer);await this.serial(()=>this.release());}
}
