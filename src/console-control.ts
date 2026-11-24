import {diagnostic} from './diagnostics.js';
export const PREVIEW_TTL_MS=10*60_000;
type BackupKind='parameter-backup'|'scene-recall-backup'|'channel-operation-backup'|'mix-preparation-backup'|'portable-scene-backup';
import {randomUUID,createHash} from 'node:crypto';
import {PARAMETERS,descriptor,validateWire,toWire,fromWire,defaultWire,readbackTolerance,type Value} from './parameters.js';
import type {XR18} from './xr18.js';
import type {LibraryStore} from './library-store.js';
import {PROTECTION_CONFLICT,PROTECTION_FULL} from '../shared/scene-protections.js';
export type CompleteScene={model?:string;version:2;scope:'console';values:Record<string,Value>;fx:Awaited<ReturnType<XR18['readFx']>>[];missing?:string[]};
type PreviewCompletion={check:()=>void;commit:()=>void};
export class ConsoleControl {
 private previews=new Map<string,{values:Record<string,Value>;before:Record<string,Value>;guards:Record<string,Value>;identity:string;expires:number;completion?:PreviewCompletion;backupKind:BackupKind;recallRevision?:number}>();
 constructor(private xr:XR18,private library:LibraryStore){}
 recallRevision(){return this.xr.model().family==='xair'?this.library.protections(this.xr.model().id).revision:0;}
 checkRecallRevision(revision?:number){if(revision!==undefined&&revision!==this.recallRevision())throw Error(PROTECTION_CONFLICT);}
 assertFullRecall(){if(this.xr.model().family==='xair'&&(this.library.protections(this.xr.model().id).rules.length||this.library.outputProtections(this.xr.model().id).rules.length))throw Error(PROTECTION_FULL);}
 identity(){const s=this.xr.status();return JSON.stringify([s.model,s.mode,s.host,s.port,s.writesEnabled,this.xr.connectionId()]);}
 private async readStable(address:string,identity:string,operation:number){
  if(identity!==this.identity()||operation!==this.xr.operationId())throw Error('Connexion modifiée ou opération interrompue');
  let value:Value;
  try{value=await this.xr.readParameter(address);}
  catch(error){
   if(identity!==this.identity()||operation!==this.xr.operationId()||!(error instanceof Error)||!error.message.startsWith('Pas de réponse '))throw error;
   value=await this.xr.readParameter(address);
  }
  if(identity!==this.identity()||operation!==this.xr.operationId())throw Error('Connexion modifiée ou opération interrompue');
  return value;
 }
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
  // Pace UDP reads on hardware only; simulation reads local memory and needs no network delay.
  for(let i=0;i<addresses.length;i+=8){if(identity!==this.identity())throw Error('Connexion modifiée');await Promise.all(addresses.slice(i,i+8).map(read));if(this.xr.mode==='real')await new Promise(r=>setTimeout(r,5));}
  if(missing.length>addresses.length*.05)throw Error(`La console n’a pas répondu pour ${missing.length} réglages : vérifie la connexion (câble ou Wi-Fi) puis recommence.`);
  const fx=[];for(let slot=1;slot<=4;slot++)fx.push(await this.xr.readFx(slot));
  return missing.length?{model:this.xr.model().id,version:2,scope:'console',values,fx,missing}:{model:this.xr.model().id,version:2,scope:'console',values,fx};
 }
 async preview(input:unknown,wire=false,guards:Record<string,Value>={},backupKind:BackupKind='parameter-backup',expectedBefore?:Record<string,Value>,recallRevision?:number,expectedIdentity?:string){
  this.checkRecallRevision(recallRevision);
  if(expectedIdentity!==undefined&&expectedIdentity!==this.identity())throw Error('Connexion modifiée');
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length<1||Object.keys(input).length>1024)throw Error('1 à 1024 paramètres requis');
  const values:Record<string,Value>={},before:Record<string,Value>={};
  for(const [a,v] of Object.entries(input))values[a]=wire?validateWire(a,v):toWire(a,v);
  const identity=this.identity(),operation=this.xr.operationId();
  for(const [address,expected] of Object.entries(guards))if(await this.readStable(address,identity,operation)!==expected)throw Error('État modifié : prévisualiser à nouveau');
  // A lost UDP reply can be retried once, only on the same uninterrupted transport.
  for(const a of Object.keys(values))before[a]=await this.readStable(a,identity,operation);
  if(expectedBefore)for(const [a,v] of Object.entries(expectedBefore))if((before[a]??await this.readStable(a,identity,operation))!==v)throw Error('État modifié : prévisualiser à nouveau');
  if(this.previews.size>100)this.previews.clear();const token=randomUUID();
  // A preview stays valid 10 minutes: apply() re-reads every value first and refuses if anything moved
  // ("État modifié"), so the delay only has to cover a person reading the window.
  this.checkRecallRevision(recallRevision);
  this.previews.set(token,{values,before,guards:{...guards},identity,expires:Date.now()+PREVIEW_TTL_MS,backupKind,recallRevision});
  return {token,changes:Object.entries(values).map(([address,v])=>({address,before:fromWire(address,before[address]!),after:fromWire(address,v),sensitive:descriptor(address).sensitive})),phantom:Object.keys(values).some(a=>a.endsWith('/phantom'))};
 }
 /** Bind local changes to this exact confirmed plan. Cancellation and expiry discard both. */
 onApplied(token:string,completion:PreviewCompletion){
  const plan=this.previews.get(token);
  if(!plan)throw Error('Prévisualisation expirée ou connexion modifiée');
  plan.completion=completion;
 }
 async apply(token:unknown,allowPhantom=false,tolerant=false,assertActive:()=>void=()=>{}){
  const p=typeof token==='string'?this.previews.get(token):undefined;
  if(!p||p.expires<Date.now()||p.identity!==this.identity())throw Error('Prévisualisation expirée ou connexion modifiée');
  const operation=this.xr.operationId();
  this.previews.delete(token as string);
  this.checkRecallRevision(p.recallRevision);
  if(Object.keys(p.values).some(a=>a.endsWith('/phantom'))&&!allowPhantom)throw Error('Confirmation 48 V requise');
  for(const [address,expected] of Object.entries(p.guards))if(await this.readStable(address,p.identity,operation)!==expected)throw Error('État modifié : prévisualiser à nouveau');
  for(const [a,v] of Object.entries(p.before)){const current=await this.readStable(a,p.identity,operation);if(typeof v==='number'&&typeof current==='number'?Math.abs(v-current)>.003:current!==v)throw Error('État modifié : prévisualiser à nouveau');}
  if(p.identity!==this.identity()||operation!==this.xr.operationId())throw Error('Connexion modifiée ou opération interrompue');
  this.checkRecallRevision(p.recallRevision);
  assertActive();
  p.completion?.check();
  const backup=p.backupKind!=='parameter-backup'
   ?this.library.save(p.backupKind,p.backupKind==='scene-recall-backup'?'Avant rappel sélectif':p.backupKind==='portable-scene-backup'?'Avant rappel portable':'Avant réglage des entrées',{version:1,model:this.xr.model().id,values:p.before,guards:p.guards})
   :this.library.save('parameter-backup','Avant modification console',p.before);
  let failed:string[];
  try{
   failed=(await this.xr.applyParameters(p.values,allowPhantom,tolerant,assertActive)).failed;
   if(p.backupKind!=='parameter-backup'){
    // A later write to the right side could overwrite an earlier left-side write.
    // Verify the final pair, not just each write's immediate acknowledgement.
    for(const [address,value] of Object.entries(p.values)){
     const observed=await this.readStable(address,p.identity,operation);
     if(typeof observed==='number'&&typeof value==='number'?Math.abs(observed-value)>readbackTolerance(address):observed!==value)throw Error('La console n’a pas conservé les valeurs gauche/droite demandées. Vérifie les options de liaison avant de restaurer la sauvegarde.');
    }
    for(const [address,expected] of Object.entries(p.guards))if(await this.readStable(address,p.identity,operation)!==expected)throw Error('Les options de liaison ou les sources ont changé pendant l’application. Vérifie la console avant de restaurer la sauvegarde.');
   }
  }
  catch(e){throw Object.assign(Error(`Modification potentiellement partielle ; sauvegarde ${backup.id} : ${(e as Error).message}`),{backupId:backup.id});}
  if(!failed.length&&p.completion){
   try{p.completion.commit();}
   catch(error){throw Object.assign(Error('Retours appliqués. La mise à jour des QR a échoué. Utilise « Mettre à jour les QR du groupe ». '+(error as Error).message),{backupId:backup.id});}
  }
  return {ok:failed.length===0,backupId:backup.id,readbackCompared:this.xr.mode==='real',written:Object.keys(p.values).length-failed.length,failed};
 }
 async recall(input:unknown,allowPhantom=false,excludePhantom=false){
  this.assertFullRecall();
  const desired=this.validateScene(input);
  // By default a full recall leaves phantom power untouched, including in simulation.
  if(excludePhantom)for(const a of Object.keys(desired.values))if(a.endsWith("/phantom"))delete desired.values[a];
  if(Object.keys(desired.values).some(a=>a.endsWith('/phantom'))&&!allowPhantom)throw Error('Confirmation 48 V requise');
  const operation=this.xr.operationId();
  const before=await this.capture();this.assertFullRecall();
  const backup=this.library.save('scene','Sauvegarde complète avant rappel',before);
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
