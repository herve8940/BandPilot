import {PREVIEW_TTL_MS} from './console-control.js';
import {createHash,randomUUID} from 'node:crypto';
import {PARAMETERS,fromWire,readbackTolerance,type Value} from './parameters.js';
import {ConsoleControl,type CompleteScene} from './console-control.js';
import type {XR18} from './xr18.js';
import type {LibraryStore} from './library-store.js';
import {diagnostic} from './diagnostics.js';
import {nativeSceneForRecall} from './native-scene-recall.js';
const same=(a:Value|undefined,b:Value,address?:string)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=(address&&PARAMETERS[address]?readbackTolerance(address):.003):a===b;
const digest=(s:CompleteScene)=>createHash('sha256').update(JSON.stringify([Object.entries(s.values).sort(([a],[b])=>a.localeCompare(b)),s.fx])).digest('hex');
type Plan={identity:string;before:string;expires:number;values:Record<string,Value>;fx:CompleteScene['fx'];sourceId:string;phantom:boolean;native:boolean;expected?:{values:Record<string,Value>;fx:CompleteScene['fx']}};
export class MixerSync {
 private plans=new Map<string,Plan>();
 constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore){xr.on('reset',()=>this.plans.clear());}
 status(){return {sources:[...this.library.list('mixer-workspace'),...this.library.list('scene').filter(e=>(e.data as {version?:number})?.version===2)].map(({id,name,createdAt,kind})=>({id,name,createdAt,kind}))};}
 private live(write=false){const s=this.xr.status();if(s.mode!=='real'||!s.connected)throw Error('Connecter la table réelle avant de synchroniser');if(write&&!s.writesEnabled)throw Error('Activer le contrôle avant de préparer PC → Table');}
 async savePc(){if(this.xr.mode!=='simulation')throw Error('En mode réel, utiliser Table → PC pour conserver un état reçu de la console');if(this.xr.model().family==='x32'){const e=this.library.save('mixer-draft','Brouillon X32 (paramètres partiels)',{version:1,scope:'partial',model:this.xr.model().id,parameters:this.xr.parameterState()});return {id:e.id,partial:true,...this.status()};}const scene=await this.control.capture();const e=this.library.save('mixer-workspace','Préparation PC (simulation)',scene);diagnostic('sync.pc_saved',{id:e.id});return {id:e.id,...this.status()};}
 async pull(){this.live();const scene=await this.control.capture();const e=this.library.save('mixer-workspace','État reçu de la table',scene);diagnostic('sync.table_to_pc',{id:e.id,count:Object.keys(scene.values).length});return {id:e.id,count:Object.keys(scene.values).length,missing:scene.missing??[],...this.status()};}
 async preview(sourceId:unknown,includePhantom=false){
  if(typeof sourceId!=='string')throw Error('Choisir un état PC sauvegardé');const e=this.library.get(sourceId);if(!['scene','mixer-workspace','native-scene'].includes(e.kind))throw Error('Source non synchronisable');
  const native=e.kind==='native-scene';if(!native||this.xr.mode==='real')this.live(true);
  const desired=native?nativeSceneForRecall(e.data,this.xr.model().id):this.control.validateScene(e.data);
  if(!native&&Object.keys(desired.values).length+('missing' in desired?(desired.missing?.length??0):0)<this.xr.parameterAddresses().length)throw Error('État PC incomplet : choisir une capture complète récente');
  for(const f of desired.fx)if(desired.values[`/fx/${f.slot}/type`]!==f.algorithm)throw Error('État PC incohérent : algorithme FX différent de son vecteur');
  const identity=this.control.identity(),operation=this.xr.operationId(),before=await this.control.capture();if(identity!==this.control.identity()||operation!==this.xr.operationId())throw Error('Connexion modifiée ou opération interrompue');
  if(Object.keys(desired.values).some(a=>!Object.hasOwn(before.values,a)))throw Error('Certains réglages du fichier ne peuvent pas être lus sur cette console. Aucun rappel préparé.');
  const values=Object.fromEntries(Object.entries(desired.values).filter(([a,v])=>(includePhantom||!a.endsWith('/phantom'))&&!same(before.values[a],v,a)));
  const fx=desired.fx.filter(f=>JSON.stringify(f)!==JSON.stringify(before.fx.find(b=>b.slot===f.slot)));
  const token=randomUUID(),phantom=Object.keys(values).some(a=>a.endsWith('/phantom'));
  const expected=native?{values:Object.fromEntries(Object.entries(desired.values).filter(([a])=>includePhantom||!a.endsWith('/phantom'))),fx:desired.fx}:undefined;
  if(this.plans.size>20)this.plans.clear();this.plans.set(token,{identity,before:digest(before),expires:Date.now()+PREVIEW_TTL_MS,values,fx,sourceId,phantom,native,expected});
  diagnostic('sync.preview',{sourceId,changes:Object.keys(values).length,fx:fx.map(f=>f.slot),phantom});
  return {token,sourceName:e.name,changes:Object.entries(values).map(([address,after])=>({address,before:fromWire(address,before.values[address]!),after:fromWire(address,after)})),fxSlots:fx.map(f=>f.slot),omitted:'omitted' in desired?desired.omitted:[],phantom,expiresSeconds:PREVIEW_TTL_MS/1000};
 }
 async apply(token:unknown,confirm:unknown,allowPhantom:unknown=false,sourceId?:string){
  const plan=typeof token==='string'?this.plans.get(token):undefined;
  if(!plan||confirm!==true||plan.expires<Date.now()||plan.identity!==this.control.identity()||(sourceId!==undefined&&sourceId!==plan.sourceId))throw Error('Aperçu expiré ou connexion modifiée : recommencer');
  if(!plan.native||this.xr.mode==='real')this.live(true);
  this.plans.delete(token as string);if(plan.phantom&&allowPhantom!==true)throw Error('Confirmation distincte du 48 V requise');
  const operation=this.xr.operationId(),identity=this.control.identity(),before=await this.control.capture();
  if(operation!==this.xr.operationId()||identity!==this.control.identity())throw Error('Connexion modifiée ou opération interrompue');
  if(digest(before)!==plan.before)throw Error('La table a changé depuis l’aperçu (autre application possible). Prévisualiser à nouveau.');
  const backup=this.library.save('scene','Avant synchronisation PC → Table',before);
  const check=()=>{if(operation!==this.xr.operationId()||identity!==this.control.identity())throw Error('Synchronisation interrompue');};
  const settings=Object.fromEntries(Object.entries(plan.values).filter(([a])=>!/(fader|level|on)$/.test(a))),levels=Object.fromEntries(Object.entries(plan.values).filter(([a])=>/(fader|level|on)$/.test(a)));
  // FX algorithms are restored with their typed parameter vectors, never separately.
  for(let slot=1;slot<=4;slot++){delete settings[`/fx/${slot}/type`];delete levels[`/fx/${slot}/type`];}
  try{
   check();await this.xr.applyParameters(settings,allowPhantom===true);for(const f of plan.fx){check();await this.xr.applyFx(f);}check();await this.xr.applyParameters(levels,allowPhantom===true);
   if(plan.expected){
    const after=await this.control.capture();check();
    const differences=Object.entries(plan.expected.values).filter(([a,v])=>!(this.xr.isRehearsal()&&a==='/lr/mix/on')&&!same(after.values[a],v,a)).map(([a])=>a);
    for(const f of plan.expected.fx){const observed=after.fx.find(o=>o.slot===f.slot);if(!observed||observed.algorithm!==f.algorithm||f.parameters.some((p,i)=>{const q=observed.parameters[i];return !q||p.type!==q.type||Math.abs(p.value-q.value)>(p.type==='i'?0:.021);}))differences.push(`/fx/${f.slot}/par`);}
    if(differences.length)throw Error('Lecture différente après rappel : '+differences.slice(0,8).join(', '));
   }
   check();diagnostic('sync.pc_to_table',{sourceId:plan.sourceId,backupId:backup.id});return {ok:true,backupId:backup.id,changes:Object.keys(plan.values).length,fxSlots:plan.fx.map(f=>f.slot)};
  }
  catch(error){diagnostic('sync.failed',{backupId:backup.id,message:String(error)});throw Error(`Synchronisation potentiellement partielle ; sauvegarde ${backup.id} : ${String(error)}`);}
 }
}
