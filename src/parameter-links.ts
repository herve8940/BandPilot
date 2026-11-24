import {randomUUID} from 'node:crypto';
import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';
import {previewBatchEdit} from './channel-operations.js';
import {batchPath} from '../shared/batch-edit.js';
import {quickDefinition,type QuickSelection,LINKS_CONFLICT,LINKS_EXPIRED,type ParameterLinksDefinition} from '../shared/parameter-links.js';
import type {Value} from './parameters.js';
type Session={relative:boolean;token:string;owner:string;identity:string;epoch:number;expires:number;sequence:number;definition:ParameterLinksDefinition;guards:Record<string,Value>[]};
/** A short renewable lease prevents two browsers from fanning out the same controls. */
export class ParameterLinks {
 private session:Session|null=null;private busy=false;
 constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore,private now=Date.now){} // current() checks the transport generation on every command, including reconnects.
 private current(){const s=this.session;if(s&&(s.expires<=this.now()||s.identity!==this.control.identity()||s.epoch!==this.xr.operationId()||s.definition.revision!==this.library.parameterLinks(this.xr.model().id).revision))this.session=null;return this.session;}
 private check(owner:string,token:unknown){const s=this.current();if(!s||s.owner!==owner||s.token!==token)throw Error(LINKS_EXPIRED);return s;}
 async start(owner:string,input:unknown,beforeArm:()=>void=()=>{}){
  if(this.current()||this.busy)throw Error('Les liens sont déjà actifs sur un contrôleur. Désactive-les avant de les reprendre ici.');
  const d=input as {model:string;revision:number;quick?:QuickSelection};
  if(d?.model!==this.xr.model().id)throw Error(LINKS_EXPIRED);
  const saved=this.library.parameterLinks(d.model);
  const definition=d.quick===undefined?saved:quickDefinition(d.model,saved.revision,d.quick);
  if(d.revision!==definition.revision)throw Error(LINKS_CONFLICT);
  if(!definition.links.length)throw Error('Aucun lien de pistes enregistré.');
  const identity=this.control.identity(),epoch=this.xr.operationId(),guards:Record<string,Value>[]=[];
  this.busy=true;
  try{
   for(const link of definition.links){
    const address=`/ch/${String(link.channels[0]).padStart(2,'0')}/`+batchPath(link.setting,1,link.band);
    const value=await this.xr.readParameter(address);
    const plan=await previewBatchEdit(this.xr,this.control,{model:d.model,...link,value,wire:true},d.quick?link.channels[0]:undefined);
    guards.push(plan.snapshot.guards);
   }
   if(identity!==this.control.identity()||epoch!==this.xr.operationId())throw Error(LINKS_EXPIRED);
   if(definition.revision!==this.library.parameterLinks(d.model).revision)throw Error(LINKS_CONFLICT);
   beforeArm();
   const token=randomUUID();this.session={relative:d.quick!==undefined,token,owner,identity,epoch:this.xr.operationId(),expires:this.now()+15000,sequence:0,definition,guards};
   return {token,sequence:0};
  }finally{this.busy=false;}
 }
 pulse(owner:string,token:unknown){this.check(owner,token).expires=this.now()+15000;return {ok:true};}
 stop(owner:string,token:unknown){if(this.session?.owner===owner&&this.session.token===token)this.session=null;return {ok:true};}
 async move(owner:string,input:unknown,beforeWrite:()=>void=()=>{}){
  const d=input as {token:string;sequence:number;index:number;value:number;channel?:number},s=this.check(owner,d?.token);
  if(this.busy)throw Error('Une modification des liens est déjà en cours.');
  if(!Number.isSafeInteger(d.sequence)||d.sequence!==s.sequence+1||!Number.isInteger(d.index)||!s.definition.links[d.index])throw Error('Ordre de commande des liens invalide.');
  this.busy=true;
  try{
   const link=s.definition.links[d.index]!;
   if(s.relative&&!link.channels.includes(d.channel!))throw Error('Sélection de modification multiple invalide.');
   const plan=await previewBatchEdit(this.xr,this.control,{model:s.definition.model,...link,value:d.value,wire:true},s.relative?d.channel:undefined);
   this.check(owner,d.token);
   if(Object.entries(s.guards[d.index]!).some(([a,v])=>plan.snapshot.guards[a]!==v))throw Error(LINKS_EXPIRED);
   let backupId:string|undefined;
   if(plan.token){beforeWrite();this.check(owner,d.token);const result=await this.control.apply(plan.token,false,false,()=>{this.check(owner,d.token);});backupId=result.backupId;}
   s.sequence=d.sequence;s.expires=this.now()+15000;
   return {ok:true,sequence:s.sequence,backupId};
  }catch(e){if(this.session===s)this.session=null;throw e;}finally{this.busy=false;}
 }
}
