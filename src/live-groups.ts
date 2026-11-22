import {randomUUID} from 'node:crypto';
import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';
import {previewChannelOperation,previewGroupedAdjustment,channelReader} from './channel-operations.js';
import {groupSelection,type GroupSelection} from '../shared/adjustment-group.js';
import {descriptor,fromWire,toWire,type Value} from './parameters.js';
const EXPIRED='Groupe continu désactivé ou connexion modifiée. Réactive-le explicitement.';
type Session={token:string;owner:string;identity:string;epoch:number;expires:number;sequence:number;selection:GroupSelection;initial:Record<string,Value>;expected:Record<string,Value>;guards:Record<string,Value>;backupId?:string;followMembers:boolean;offset:number;base:Record<string,number|null>};
/** One controller owns this local mixer session. Definitions never arm on load. */
export class LiveGroups {
 private session:Session|null=null;private busy=false;
 constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore){xr.on('reset',()=>{this.session=null;});}
 async start(owner:string,input:unknown,beforeArm:()=>void=()=>{}){
  if(this.busy||this.session&&this.session.expires>Date.now())throw Error('Un groupe continu est déjà actif. Arrête-le avant de changer de groupe.');
  const data=input as {model:string;selection:unknown;followMembers?:boolean};if(data?.model!==this.xr.model().id)throw Error(EXPIRED);
  if(data.followMembers!==undefined&&typeof data.followMembers!=='boolean')throw Error('Option de suivi du groupe invalide.');
  const selection=groupSelection(data.model,data.selection);
  if(!['fader','send'].includes(selection.target))throw Error('Le fader de groupe contrôle la façade ou un retour.');
  this.busy=true;
  try{
   const identity=this.control.identity(),epoch=this.xr.operationId();
   const plan=await previewGroupedAdjustment(this.xr,this.control,{model:data.model,...selection,delta:0},true);
   if(identity!==this.control.identity()||epoch!==this.xr.operationId())throw Error(EXPIRED);
   beforeArm();const token=randomUUID();this.session={token,owner,identity,epoch:this.xr.operationId(),expires:Date.now()+120000,sequence:0,selection,initial:plan.snapshot.values,expected:plan.snapshot.values,guards:plan.snapshot.guards,followMembers:data.followMembers===true,offset:0,base:Object.fromEntries(Object.entries(plan.snapshot.values).map(([a,v])=>[a,v===0?null:Number(fromWire(a,v))]))};
   return {token,offset:0,sequence:0,selection};
  }finally{this.busy=false;}
 }
 stop(owner:string,token:unknown){if(this.session?.owner===owner&&this.session.token===token)this.session=null;return {ok:true};}
 private check(owner:string,token:unknown){const s=this.session;if(!s||s.owner!==owner||s.token!==token||s.expires<Date.now()||s.identity!==this.control.identity()||s.epoch!==this.xr.operationId())throw Error(EXPIRED);return s;}
 async move(owner:string,input:unknown,beforeWrite:()=>void){
  const data=input as {token:string;offset:number;sequence:number};const s=this.check(owner,data?.token);
  if(this.busy)throw Error('Une modification du groupe est déjà en cours.');
  if(!Number.isSafeInteger(data.sequence)||data.sequence!==s.sequence+1||typeof data.offset!=='number'||!Number.isFinite(data.offset)||Math.abs(data.offset)>12)throw Error('Position ou ordre de commande du groupe invalide.');
  this.busy=true;
  try{
   let expected=s.expected;
   if(s.followMembers){
    const current=await previewGroupedAdjustment(this.xr,this.control,{model:this.xr.model().id,...s.selection,delta:0},true);
    this.check(owner,data.token);
    // The latest readbacks, not mathematical requests, detect individual edits.
    // Retain the old baseline for untouched members to avoid quantization drift.
    expected=current.snapshot.values;
    for(const [a,v] of Object.entries(expected))if(v!==s.expected[a])s.base[a]=v===0?null:Number(fromWire(a,v))-s.offset;
   }
   const values:Record<string,Value>={};
   for(const [a,base] of Object.entries(s.base)){
    if(base===null){values[a]=0;continue;}
    const d=base+data.offset,p=descriptor(a);
    if(d<p.min!||d>p.max!)throw Error('Le décalage dépasse la plage d’au moins une entrée. Réduis-le : aucun réglage envoyé.');
    values[a]=toWire(a,d);
   }
   const plan=await previewChannelOperation(this.xr,this.control,values,s.guards,expected);
   this.check(owner,data.token);
   if(plan.token){
    // Follow mode undoes only the latest movement, preserving earlier member edits.
    if(s.followMembers||!s.backupId)s.backupId=this.library.save('channel-operation-backup',s.followMembers?'Avant le dernier mouvement du groupe':'Avant fader de groupe continu',{version:1,model:this.xr.model().id,values:s.followMembers?plan.snapshot.values:s.initial,guards:s.guards}).id;
    beforeWrite();this.check(owner,data.token);await this.control.apply(plan.token,false,false,()=>{this.check(owner,data.token);});
   }
   const reader=channelReader(this.xr,this.control),readbacks:Record<string,Value>={};
   for(const a of Object.keys(s.initial))readbacks[a]=await reader.read(a);
   s.expected=readbacks;s.sequence=data.sequence;s.offset=data.offset;s.expires=Date.now()+120000;
   return {ok:true,offset:data.offset,sequence:s.sequence,backupId:s.backupId};
  }catch(e){this.session=null;throw Object.assign(e as Error,{backupId:s.backupId});}finally{this.busy=false;}
 }
}
