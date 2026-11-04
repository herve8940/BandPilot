import {diagnostic} from './diagnostics.js';
export const PREVIEW_TTL_MS=10*60_000;
import {randomUUID,createHash} from 'node:crypto';
import {PARAMETERS,descriptor,validateWire,toWire,fromWire,defaultWire,type Value} from './parameters.js';
import type {XR18} from './xr18.js';
import type {LibraryStore} from './library-store.js';
export type CompleteScene={model?:string;version:2;scope:'console';values:Record<string,Value>;fx:Awaited<ReturnType<XR18['readFx']>>[];missing?:string[]};
export class ConsoleControl {
 private previews=new Map<string,{values:Record<string,Value>;before:Record<string,Value>;identity:string;expires:number}>();
 constructor(private xr:XR18,private library:LibraryStore){}
 identity(){const s=this.xr.status();return JSON.stringify([s.model,s.mode,s.host,s.port,s.writesEnabled]);}
 catalog(prefix:string){const state=this.xr.parameterState();return Object.values(PARAMETERS).filter(p=>this.xr.supports(p.address)&&p.address.startsWith(prefix)).map(p=>({...p,...(state[p.address]?{state:{...state[p.address]!,display:fromWire(p.address,state[p.address]!.value)}}:{})}));}
 validateScene(input:unknown):CompleteScene {
  const s=input as CompleteScene;
  if(!s||s.version!==2||s.scope!=='console'||!s.values||typeof s.values!=='object'||Array.isArray(s.values)||!Object.keys(s.values).length||!Array.isArray(s.fx)||s.fx.length!==4||s.fx.some((f,i)=>f.slot!==i+1))throw Error('Scène complète invalide');
  if(s.model?s.model!==this.xr.model().id:!['XR18','MR18','X18'].includes(this.xr.model().id))throw Error('Scène créée pour un autre modèle : conversion explicite nécessaire');
  for(const [a,v] of Object.entries(s.values)){if(!this.xr.supports(a))throw Error('Paramètre absent sur ce modèle : '+a);validateWire(a,v);}
  for(const f of s.fx)if(!Number.isInteger(f.algorithm)||f.algorithm<0||f.algorithm>60||!Array.isArray(f.parameters)||f.parameters.length>64||f.parameters.some(p=>!['i','f'].includes(p.type)||!Number.isFinite(p.value)||(p.type==='f'&&(p.value<0||p.value>1))||(p.type==='i'&&(!Number.isInteger(p.value)||p.value<0||p.value>127))))throw Error('Vecteur FX invalide');
  return structuredClone(s);
 }
 async capture():Promise<CompleteScene>{
  if(this.xr.model().family==='x32')throw Error('Capture complète X32 : routage et FX nécessitent leur adaptateur dédié. Aucun rappel X-Air ne sera envoyé.');
  const identity=this.identity(),values:Record<string,Value>={};const addresses=this.xr.parameterAddresses();
  // A value the console does not answer is asked once more, then listed as missing: one silent
  // address (firmware difference, lost UDP packet) must not make the whole capture fail.
  const missing:string[]=[];
  // A value outside the range we know (another firmware or an option we do not list) is skipped the same
  // way: the scene simply leaves that setting alone on recall.
  const skippable=(e:unknown)=>/Pas de réponse|hors plage/.test((e as Error).message);
  const read=async(a:string)=>{try{values[a]=await this.xr.readParameter(a);}catch(e){if(identity!==this.identity()||!skippable(e))throw e;if(/hors plage/.test((e as Error).message)){missing.push(a);diagnostic('capture.out_of_range',{address:a,error:(e as Error).message});return;}try{values[a]=await this.xr.readParameter(a);}catch(e2){if(!skippable(e2))throw e2;missing.push(a);}}};
  for(let i=0;i<addresses.length;i+=8){if(identity!==this.identity())throw Error('Connexion modifiée');await Promise.all(addresses.slice(i,i+8).map(read));await new Promise(r=>setTimeout(r,5));}
  if(missing.length>addresses.length*.05)throw Error(`La console n’a pas répondu pour ${missing.length} réglages : vérifie la connexion (câble ou Wi-Fi) puis recommence.`);
  const fx=[];for(let slot=1;slot<=4;slot++)fx.push(await this.xr.readFx(slot));
  return missing.length?{model:this.xr.model().id,version:2,scope:'console',values,fx,missing}:{model:this.xr.model().id,version:2,scope:'console',values,fx};
 }
 async preview(input:unknown,wire=false){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length<1||Object.keys(input).length>1000)throw Error('1 à 1000 paramètres requis');
  const values:Record<string,Value>={},before:Record<string,Value>={};
  for(const [a,v] of Object.entries(input))values[a]=wire?validateWire(a,v):toWire(a,v);
  const identity=this.identity();
  for(const a of Object.keys(values))before[a]=await this.xr.readParameter(a);
  if(this.previews.size>100)this.previews.clear();const token=randomUUID();
  // A preview stays valid 10 minutes: apply() re-reads every value first and refuses if anything moved
  // ("État modifié"), so the delay only has to cover a person reading the window.
  this.previews.set(token,{values,before,identity,expires:Date.now()+PREVIEW_TTL_MS});
  return {token,changes:Object.entries(values).map(([address,v])=>({address,before:fromWire(address,before[address]!),after:fromWire(address,v),sensitive:descriptor(address).sensitive})),phantom:Object.keys(values).some(a=>a.endsWith('/phantom'))};
 }
 async apply(token:unknown,allowPhantom=false,tolerant=false){
  const p=typeof token==='string'?this.previews.get(token):undefined;
  if(!p||p.expires<Date.now()||p.identity!==this.identity())throw Error('Prévisualisation expirée ou connexion modifiée');
  this.previews.delete(token as string);
  if(Object.keys(p.values).some(a=>a.endsWith('/phantom'))&&!allowPhantom)throw Error('Confirmation 48 V requise');
  for(const [a,v] of Object.entries(p.before)){const current=await this.xr.readParameter(a);if(typeof v==='number'&&typeof current==='number'?Math.abs(v-current)>.003:current!==v)throw Error('État modifié : prévisualiser à nouveau');}
  const backup=this.library.save('parameter-backup','Avant modification console',p.before);
  try{const {failed}=await this.xr.applyParameters(p.values,allowPhantom,tolerant);return {ok:failed.length===0,backupId:backup.id,readbackCompared:this.xr.mode==='real',written:Object.keys(p.values).length-failed.length,failed};}
  catch(e){throw Error(`Modification potentiellement partielle ; sauvegarde ${backup.id} : ${(e as Error).message}`);}
 }
 async recall(input:unknown,allowPhantom=false){
  const desired=this.validateScene(input);
  if(Object.keys(desired.values).some(a=>a.endsWith('/phantom'))&&!allowPhantom)throw Error('Confirmation 48 V requise');
  const operation=this.xr.operationId();
  const backup=this.library.save('scene','Sauvegarde complète avant rappel',await this.capture());
  try{
   const values={...desired.values};for(let slot=1;slot<=4;slot++)delete values[`/fx/${slot}/type`];
   // Restore processors before levels, without restoring a transport or credentials.
   const levels=Object.fromEntries(Object.entries(values).filter(([a])=>/\/(fader|level|on)$/.test(a)));
   const settings=Object.fromEntries(Object.entries(values).filter(([a])=>!Object.hasOwn(levels,a)));
   const check=()=>{if(operation!==this.xr.operationId())throw Error('Rappel interrompu');};check();await this.xr.applyParameters(settings,allowPhantom);for(const f of desired.fx){check();await this.xr.applyFx(f);}check();await this.xr.applyParameters(levels,allowPhantom);
   return {ok:true,backupId:backup.id,readbackCompared:this.xr.mode==='real'};
  }catch(e){throw Error(`Rappel potentiellement partiel ; sauvegarde ${backup.id} : ${(e as Error).message}`);}
 }
 fingerprint(){return createHash('sha256').update(JSON.stringify([this.identity(),this.xr.parameterState()])).digest('hex');}
}
