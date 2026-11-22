import {createHash,randomUUID} from 'node:crypto';
import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';
import {commandStages,commandValues} from './console-commands.js';
import {previewChannelOperation,channelReader} from './channel-operations.js';
import type {MidiScenes} from './midi-scenes.js';
import {fromWire,type Value} from './parameters.js';
import {commandRules,type ConsoleCommand,type CommandCondition,type CommandControlMode} from '../shared/console-command.js';

const EXPIRED='Contrôle des commandes désactivé ou connexion modifiée. Prépare une nouvelle activation.';
const LEASE=15000;
type Stage=ReturnType<typeof commandStages>[number]&{guards:Record<string,Value>;before:Record<string,Value>};
type Rule={condition:CommandCondition;address:string;guards:Record<string,Value>};
type PreparedCommand={id:string;name:string;fingerprint:string;command:ConsoleCommand;on:Stage[];off:Stage[];rules:Rule[]};
type PreparedScene=Awaited<ReturnType<MidiScenes['review']>>;
type Preparation={owner:string;identity:string;epoch:number;expires:number;mode:CommandControlMode;commands:PreparedCommand[];scenes:PreparedScene[]};
type Pending={started:number;stages:Stage[];next:number};
type Session=Preparation&{token:string;sequence:number;matches:Map<string,boolean[]>;pending:Map<string,Pending>;lastFire:Map<string,number>};
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function conditionMatches(c:CommandCondition,value:number,previous:boolean){
 const h=previous?-c.hysteresis:c.hysteresis;
 return c.comparison==='above'?value>c.threshold+h:value<c.threshold-h;
}
function matching(command:ConsoleCommand,states:boolean[]){
 return command.conditionSet?.match==='any'?states.some(Boolean):states.every(Boolean);
}

export class CommandControl {
 private preparations=new Map<string,Preparation>();
 private session:Session|null=null;
 private busy=false;
 constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore,private now:()=>number=Date.now,private midiScenes?:MidiScenes){
  xr.on('reset',()=>{this.session=null;this.preparations.clear();});
 }
 private load(id:string){
  const entry=this.library.get(id);
  if(entry.kind!=='console-command')throw Error('Commande enregistrée invalide.');
  const {command}=commandValues(entry.data);
  if(command.model!==this.xr.model().id)throw Error(EXPIRED);
  return {command,name:entry.name,fingerprint:fingerprint(entry.data)};
 }
 private checkPrepared(p:Preparation){
  const status=this.xr.status();
  if(p.identity!==this.control.identity()||p.epoch!==this.xr.operationId()||p.expires<this.now()||status.mode==='real'&&(!status.connected||!status.writesEnabled))throw Error(EXPIRED);
  for(const scene of p.scenes)this.control.checkRecallRevision(scene.revision);
  for(const command of p.commands)if(this.load(command.id).fingerprint!==command.fingerprint)throw Error('Une commande a changé. Prépare une nouvelle activation.');
 }
 private check(owner:string,token:unknown){
  const session=this.session;
  if(!session||session.owner!==owner||session.token!==token)throw Error(EXPIRED);
  this.checkPrepared(session);
  return session;
 }
 private async prepareStages(command:ConsoleCommand,off:boolean){
  const stages:Stage[]=[];
  for(const stage of commandStages(command,off)){
   const {snapshot}=await previewChannelOperation(this.xr,this.control,stage.values);
   stages.push({...stage,guards:snapshot.guards,before:snapshot.values});
  }
  return stages;
 }
 private async prepareRules(command:ConsoleCommand){
  const reader=channelReader(this.xr,this.control),rules:Rule[]=[];
  for(const condition of commandRules(command)){
   const {channel,target,bus,threshold}=condition;
   const address=Object.keys(commandValues({version:1,model:command.model,steps:[{...condition,value:threshold}]}).values)[0]!;
   const prefix=`/ch/${String(channel).padStart(2,'0')}/`;
   const pair=(n:number)=>`${n%2?n:n-1}-${n%2?n+1:n}`;
   const addresses=[`/config/chlink/${pair(channel)}`,prefix+'config/insrc',prefix+'config/rtnsrc',prefix+'preamp/rtnsw'];
   if(target==='send'){
    const send=prefix+`mix/${String(bus).padStart(2,'0')}/`;
    addresses.push(`/config/buslink/${pair(bus!)}`,...['tap','grpon','type','on'].map(leaf=>send+leaf));
   }
   const guards:Record<string,Value>={};
   for(const address of addresses)if(this.xr.supports(address))guards[address]=await reader.read(address);
   rules.push({condition,address,guards});
  }
  return rules;
 }
 private async states(command:PreparedCommand,previous:boolean[]){
  const reader=channelReader(this.xr,this.control),states:boolean[]=[];
  for(const [index,rule] of command.rules.entries()){
   for(const [address,value] of Object.entries(rule.guards))if(await reader.read(address)!==value)throw Error('La source de la condition a changé. Prépare une nouvelle activation.');
   const value=Number(fromWire(rule.address,await reader.read(rule.address)));
   if(!Number.isFinite(value))throw Error('Condition de commande invalide.');
   states.push(conditionMatches(rule.condition,rule.condition.target==='mute'?1-value:value,previous[index]??false));
  }
  return states;
 }
 async prepare(owner:string,input:unknown){
  const data=input as {model:string;mode:CommandControlMode;ids:string[]};
  if(data?.model!==this.xr.model().id||!['midi','automatic','once'].includes(data.mode)||!Array.isArray(data.ids)||!data.ids.length||data.ids.length>16||new Set(data.ids).size!==data.ids.length||data.ids.some(id=>typeof id!=='string')||data.mode==='once'&&data.ids.length!==1)throw Error('Sélection de commandes invalide (1 à 16).');
  const preparation:Preparation={owner,identity:this.control.identity(),epoch:this.xr.operationId(),expires:this.now()+120000,mode:data.mode,commands:[],scenes:[]};
  for(const id of data.ids){
   if(this.midiScenes&&this.library.get(id).kind==='midi-scene'){
    if(data.mode!=='midi')throw Error('Cette sélection de scène est réservée au contrôle MIDI.');
    preparation.scenes.push(await this.midiScenes.review(id));
    continue;
   }
   const command=this.load(id);
   const automatic=data.mode==='automatic';
   if(automatic&&!commandRules(command.command).length)throw Error('Ajoute une condition à chaque commande automatique.');
   const on=await this.prepareStages(command.command,false);
   const off=automatic?await this.prepareStages(command.command,true):[];
   const rules=automatic?await this.prepareRules(command.command):[];
   preparation.commands.push({...command,id,on,off,rules});
  }
  if(data.mode==='automatic'){
   // Include potential stereo partners and both phases in the cycle check.
   const family=(address:string)=>address.replace(/\/ch\/(\d{2})\//,(_,n)=>`/pair/${Math.ceil(Number(n)/2)}/`);
   const destinations=new Set(preparation.commands.flatMap(c=>[...c.on,...c.off].flatMap(stage=>Object.keys(stage.values).map(family))));
   if(preparation.commands.some(c=>c.rules.some(rule=>destinations.has(family(rule.address)))))throw Error('Une condition ne peut pas dépendre des réglages modifiés par les commandes actives.');
  }
  this.checkPrepared(preparation);
  if(this.preparations.size>=32)this.preparations.clear();
  const token=randomUUID();
  this.preparations.set(token,preparation);
  const changes=(stages:Stage[])=>stages.flatMap(stage=>Object.entries(stage.values).map(([address,value])=>({
   address,before:fromWire(address,stage.before[address]!),after:fromWire(address,value),at:stage.at,
  })));
  return {
   token,mode:data.mode,
   scenes:preparation.scenes.map(({id,name,sceneName,scope,targets,excluded})=>({id,name,sceneName,scope,targets,excluded})),
   commands:preparation.commands.map(c=>({id:c.id,name:c.name,data:c.command,changes:changes(c.on),offChanges:changes(c.off)})),
  };
 }
 async arm(owner:string,token:unknown,beforeArm:()=>void){
  if(this.busy||this.session&&this.session.expires>=this.now())throw Error('Une session de commandes est déjà active. Désactive-la avant de changer.');
  const p=typeof token==='string'?this.preparations.get(token):undefined;
  if(!p||p.owner!==owner)throw Error(EXPIRED);
  this.preparations.delete(token as string);
  this.checkPrepared(p);
  this.busy=true;
  try{
   const matches=new Map<string,boolean[]>();
   for(const c of p.commands){
    for(const stage of [...c.on,...c.off])await previewChannelOperation(this.xr,this.control,stage.values,stage.guards,stage.before);
    if(p.mode==='automatic')matches.set(c.id,await this.states(c,[]));
   }
   for(const scene of p.scenes){
    const fresh=await this.midiScenes!.review(scene.id);
    if(fresh.fingerprint!==scene.fingerprint||fresh.revision!==scene.revision||JSON.stringify(fresh.guards)!==JSON.stringify(scene.guards))throw Error('La scène MIDI a changé. Prépare une nouvelle activation.');
   }
   this.checkPrepared(p);
   beforeArm();
   const session:Session={...p,epoch:this.xr.operationId(),token:randomUUID(),expires:this.now()+LEASE,sequence:0,matches,pending:new Map(),lastFire:new Map()};
   if(p.mode==='once')session.pending.set(p.commands[0]!.id,{started:this.now(),stages:p.commands[0]!.on,next:0});
   this.session=session;
   return {token:session.token,sequence:0,leaseMs:LEASE};
  }finally{this.busy=false;}
 }
 stop(owner:string,token:unknown){
  if(this.session?.owner===owner&&this.session.token===token)this.session=null;
  return {ok:true};
 }
 async pulse(owner:string,input:unknown,beforeWrite:()=>void){
  const data=input as {token:string;sequence?:number;id?:string};
  const session=this.check(owner,data?.token);
  if(this.busy)throw Error('Une exécution de commande est déjà en cours.');
  this.busy=true;
  const check=()=>{this.check(owner,data.token);};
  try{
   if(data.id!==undefined){
    const command=session.commands.find(c=>c.id===data.id),scene=session.scenes.find(c=>c.id===data.id);
    if(session.mode!=='midi'||(!command&&!scene)||!Number.isSafeInteger(data.sequence)||data.sequence!==session.sequence+1)throw Error('Déclenchement de commande invalide.');
    session.sequence=data.sequence!;
    if(!session.pending.has(data.id)&&this.now()-(session.lastFire.get(data.id)??-Infinity)>=300){
     session.pending.set(data.id,{started:this.now(),stages:command?.on??[],next:0});
     session.lastFire.set(data.id,this.now());
    }
   }
   if(session.mode==='automatic')for(const c of session.commands){
    const previous=session.matches.get(c.id)!;
    const current=await this.states(c,previous);
    check();
    session.matches.set(c.id,current);
    const before=matching(c.command,previous),after=matching(c.command,current);
    if(before===after)continue;
    session.pending.delete(c.id);
    const stages=after?c.on:c.off;
    if(stages.length)session.pending.set(c.id,{started:this.now(),stages,next:0});
   }
   const results:{id:string;backupId?:string;written:number}[]=[];
   for(const [id,pending] of session.pending){
    const scene=session.scenes.find(c=>c.id===id);
    if(scene){
     session.pending.delete(id);
     session.expires=this.now()+LEASE;
     results.push(await this.midiScenes!.fire(scene,beforeWrite,check));
     continue;
    }
    const stage=pending.stages[pending.next]!;
    if(pending.started+stage.at>this.now())continue;
    const plan=await previewChannelOperation(this.xr,this.control,stage.values,stage.guards);
    check();
    if(session.mode==='automatic'){
     const c=session.commands.find(command=>command.id===id)!;
     const old=session.matches.get(id)!;
     const fresh=await this.states(c,old);
     check();
     if(matching(c.command,fresh)!==matching(c.command,old))continue;
     session.matches.set(id,fresh);
    }
    pending.next++;
    if(pending.next===pending.stages.length)session.pending.delete(id);
    if(plan.token){
     beforeWrite();
     check();
     const result=await this.control.apply(plan.token,false,false,check);
     results.push({id,backupId:result.backupId,written:result.written});
    }else results.push({id,written:0});
   }
   check();
   session.expires=this.now()+LEASE;
   const finished=session.mode==='once'&&!session.pending.size;
   if(finished)this.session=null;
   return {active:!finished,sequence:session.sequence,pending:[...session.pending].map(([id,p])=>({id,remainingMs:Math.max(0,p.started+p.stages[p.next]!.at-this.now())})),results};
  }catch(error){
   if(this.session===session)this.session=null;
   throw error;
  }finally{this.busy=false;}
 }
}
