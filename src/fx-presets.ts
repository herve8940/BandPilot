import {randomUUID} from 'node:crypto';
import {PREVIEW_TTL_MS, type ConsoleControl} from './console-control.js';
import {validateFx, type Fx} from './show-control.js';
import type {XR18} from './xr18.js';
import type {LibraryStore} from './library-store.js';

/** Library FX recalls also compare the live parameter vector, not only the algorithm. */
export class FxPresets {
  private plans=new Map<string,{id:string;desired:Fx;before:Fx;identity:string;expires:number}>();
  constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore,private remember?:(fx:Fx)=>void){}
  async preview(id:string,input:unknown,slot?:unknown,expected?:unknown){
    if(this.xr.model().family!=='xair')throw Error('Presets FX disponibles uniquement pour X-Air / M-Air.');
    const desired=validateFx(input);
    if(slot!==undefined)desired.slot=slot as number;
    validateFx(desired);
    const identity=this.control.identity(),operation=this.xr.operationId(),before=await this.xr.readFx(desired.slot);
    if(identity!==this.control.identity()||operation!==this.xr.operationId())throw Error('Connexion modifiée');
    if(expected!==undefined&&JSON.stringify(validateFx(expected))!==JSON.stringify(before))throw Error('État modifié : relire le slot avant de préparer les changements');
    if(this.plans.size>=100)this.plans.clear();
    const token=randomUUID();this.plans.set(token,{id,desired,before,identity,expires:Date.now()+PREVIEW_TTL_MS});
    return {token,slot:desired.slot,before,desired};
  }
  async apply(id:string,token:unknown){
    const p=typeof token==='string'?this.plans.get(token):undefined;
    if(!p||p.id!==id||p.expires<Date.now()||p.identity!==this.control.identity())throw Error('Prévisualisation expirée ou connexion modifiée');
    this.plans.delete(token as string);
    const operation=this.xr.operationId(),current=await this.xr.readFx(p.desired.slot);
    if(p.identity!==this.control.identity()||operation!==this.xr.operationId())throw Error('Connexion modifiée');
    if(JSON.stringify(current)!==JSON.stringify(p.before))throw Error('État modifié : prévisualiser à nouveau');
    const backup=this.library.save('fx-backup',`Sauvegarde FX ${p.desired.slot}`,p.before);
    try{await this.xr.applyFx(p.desired);this.remember?.(p.desired);return {ok:true,backupId:backup.id};}
    catch(error){throw Error(`Modification potentiellement partielle ; sauvegarde ${backup.id} : ${(error as Error).message}`);}
  }
}
