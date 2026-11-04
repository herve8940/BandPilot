import {PREVIEW_TTL_MS} from './console-control.js';
import {createHash,randomUUID} from 'node:crypto';
import {PARAMETERS,fromWire,readbackTolerance,type Value} from './parameters.js';
import {ConsoleControl,type CompleteScene} from './console-control.js';
import type {XR18} from './xr18.js';
import type {LibraryStore} from './library-store.js';
import {diagnostic} from './diagnostics.js';
const same=(a:Value|undefined,b:Value,address?:string)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=(address&&PARAMETERS[address]?readbackTolerance(address):.003):a===b;
const digest=(s:CompleteScene)=>createHash('sha256').update(JSON.stringify([Object.entries(s.values).sort(([a],[b])=>a.localeCompare(b)),s.fx])).digest('hex');
type Plan={identity:string;before:string;expires:number;values:Record<string,Value>;fx:CompleteScene['fx'];sourceId:string;phantom:boolean};
export class MixerSync {
 private plans=new Map<string,Plan>();
 constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore){xr.on('reset',()=>this.plans.clear());}
 status(){return {sources:[...this.library.list('mixer-workspace'),...this.library.list('scene').filter(e=>(e.data as {version?:number})?.version===2)].map(({id,name,createdAt,kind})=>({id,name,createdAt,kind}))};}
 private live(write=false){const s=this.xr.status();if(s.mode!=='real'||!s.connected)throw Error('Connecter la table réelle avant de synchroniser');if(write&&!s.writesEnabled)throw Error('Activer le contrôle avant de préparer PC → Table');}
 async savePc(){if(this.xr.mode!=='simulation')throw Error('En mode réel, utiliser Table → PC pour conserver un état reçu de la console');if(this.xr.model().family==='x32'){const e=this.library.save('mixer-draft','Brouillon X32 (paramètres partiels)',{version:1,scope:'partial',model:this.xr.model().id,parameters:this.xr.parameterState()});return {id:e.id,partial:true,...this.status()};}const scene=await this.control.capture();const e=this.library.save('mixer-workspace','Préparation PC (simulation)',scene);diagnostic('sync.pc_saved',{id:e.id});return {id:e.id,...this.status()};}
 async pull(){this.live();const scene=await this.control.capture();const e=this.library.save('mixer-workspace','État reçu de la table',scene);diagnostic('sync.table_to_pc',{id:e.id,count:Object.keys(scene.values).length});return {id:e.id,count:Object.keys(scene.values).length,missing:scene.missing??[],...this.status()};}
 async preview(sourceId:unknown,includePhantom=false){
  this.live(true);if(typeof sourceId!=='string')throw Error('Choisir un état PC sauvegardé');const e=this.library.get(sourceId);if(!['scene','mixer-workspace'].includes(e.kind))throw Error('Source non synchronisable');
  const desired=this.control.validateScene(e.data);if(Object.keys(desired.values).length+(desired.missing?.length??0)<this.xr.parameterAddresses().length)throw Error('État PC incomplet : choisir une capture complète récente');
  for(const f of desired.fx)if(desired.values[`/fx/${f.slot}/type`]!==f.algorithm)throw Error('État PC incohérent : algorithme FX différent de son vecteur');
  const identity=this.control.identity(),before=await this.control.capture();if(identity!==this.control.identity())throw Error('Connexion modifiée');
  const values=Object.fromEntries(Object.entries(desired.values).filter(([a,v])=>(includePhantom||!a.endsWith('/phantom'))&&!same(before.values[a],v,a)));
  const fx=desired.fx.filter((f,i)=>JSON.stringify(f)!==JSON.stringify(before.fx[i]));
  const token=randomUUID(),phantom=Object.keys(values).some(a=>a.endsWith('/phantom'));
  if(this.plans.size>20)this.plans.clear();this.plans.set(token,{identity,before:digest(before),expires:Date.now()+PREVIEW_TTL_MS,values,fx,sourceId,phantom});
  diagnostic('sync.preview',{sourceId,changes:Object.keys(values).length,fx:fx.map(f=>f.slot),phantom});
  return {token,sourceName:e.name,changes:Object.entries(values).map(([address,after])=>({address,before:fromWire(address,before.values[address]!),after:fromWire(address,after)})),fxSlots:fx.map(f=>f.slot),phantom,expiresSeconds:PREVIEW_TTL_MS/1000};
 }
 async apply(token:unknown,confirm:unknown,allowPhantom:unknown=false){
  this.live(true);const plan=typeof token==='string'?this.plans.get(token):undefined;
  if(!plan||confirm!==true||plan.expires<Date.now()||plan.identity!==this.control.identity())throw Error('Aperçu expiré ou connexion modifiée : recommencer');
  this.plans.delete(token as string);if(plan.phantom&&allowPhantom!==true)throw Error('Confirmation distincte du 48 V requise');
  const before=await this.control.capture();if(digest(before)!==plan.before)throw Error('La table a changé depuis l’aperçu (autre application possible). Prévisualiser à nouveau.');
  const backup=this.library.save('scene','Avant synchronisation PC → Table',before),operation=this.xr.operationId(),identity=this.control.identity();
  const check=()=>{if(operation!==this.xr.operationId()||identity!==this.control.identity())throw Error('Synchronisation interrompue');};
  const settings=Object.fromEntries(Object.entries(plan.values).filter(([a])=>!/(fader|level|on)$/.test(a))),levels=Object.fromEntries(Object.entries(plan.values).filter(([a])=>/(fader|level|on)$/.test(a)));
  // FX algorithms are restored with their typed parameter vectors, never separately.
  for(let slot=1;slot<=4;slot++){delete settings[`/fx/${slot}/type`];delete levels[`/fx/${slot}/type`];}
  try{check();await this.xr.applyParameters(settings,allowPhantom===true);for(const f of plan.fx){check();await this.xr.applyFx(f);}check();await this.xr.applyParameters(levels,allowPhantom===true);diagnostic('sync.pc_to_table',{sourceId:plan.sourceId,backupId:backup.id});return {ok:true,backupId:backup.id,changes:Object.keys(plan.values).length,fxSlots:plan.fx.map(f=>f.slot)};}
  catch(error){diagnostic('sync.failed',{backupId:backup.id,message:String(error)});throw Error(`Synchronisation potentiellement partielle ; sauvegarde ${backup.id} : ${String(error)}`);}
 }
}
