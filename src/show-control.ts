import {PREVIEW_TTL_MS} from './console-control.js';
import {ConsoleControl} from "./console-control.js";
import {compileNativeScene} from "./native-scene.js";
import {SCENE_NODES} from "./scene-nodes.js";
import {createHash,randomUUID} from 'node:crypto';
import type {XR18,ChannelState} from './xr18.js';
import {ProcessingStore,validateProcessing,type ProcessingState} from './processing.js';
import {LibraryStore} from './library-store.js';
import {PARAMETERS,readbackTolerance} from "./parameters.js";
export type Fx={slot:number;algorithm:number;parameters:{type:'f'|'i';value:number}[]};
export function validateFx(input:unknown):Fx{
 const f=input as Fx;if(!f||!Number.isInteger(f.slot)||f.slot<1||f.slot>4||!Number.isInteger(f.algorithm)||f.algorithm<0||f.algorithm>60||!Array.isArray(f.parameters)||f.parameters.length>64||f.parameters.some(p=>!p||!['i','f'].includes(p.type)||!Number.isFinite(p.value)||(p.type==='f'&&(p.value<0||p.value>1))||(p.type==='i'&&(!Number.isInteger(p.value)||p.value<0||p.value>127))))throw Error('Preset FX invalide : slot 1..4, algorithme entier et paramètres OSC typés requis');return structuredClone(f);
}
export type Scene={version:1;scope:'application';channels:ChannelState[];main:ChannelState;processing:ProcessingState[];fx:Fx[];advanced:Record<string,{value:number|string;updatedAt:string}>};
export class ShowControl {
 private fx=new Map<number,Fx>();private previewTokens=new Map<string,{id:string;fingerprint:string;expires:number;excludePhantom:boolean}>();
 private armed=false;private seen=new Set<string>();
 readonly console:ConsoleControl;
 constructor(private xr:XR18,private processing:ProcessingStore,private library:LibraryStore){this.console=new ConsoleControl(xr,library);}
 capture():Scene{return {version:1,scope:'application',channels:structuredClone(this.xr.listChannels()),main:this.xr.mainState(),advanced:structuredClone(Object.fromEntries(Object.entries(this.xr.advancedState()).filter(([a])=>/^\/ch\/\d{2}\/mix\/0[1-6]\/level$/.test(a)))),processing:structuredClone(this.processing.list()),fx:[...this.fx.values()].map(f=>structuredClone(f))};}
 validateScene(input:unknown):Scene{if((input as {version?:number})?.version===2)return this.console.validateScene(input) as unknown as Scene;const s=input as Scene;if(!s||s.version!==1||s.scope!=='application'||!Array.isArray(s.channels)||s.channels.length!==16||s.channels.some((c,i)=>c.channel!==i+1||!Number.isFinite(c.fader)||c.fader<0||c.fader>1||typeof c.on!=='boolean')||!s.main||!Number.isFinite(s.main.fader)||s.main.fader<0||s.main.fader>1||typeof s.main.on!=='boolean'||!Array.isArray(s.processing)||!Array.isArray(s.fx))throw Error('Scène applicative invalide');if(new Set(s.processing.map(p=>p.channel)).size!==s.processing.length||s.processing.some(p=>!Number.isInteger(p.channel)||p.channel<1||p.channel>16)||new Set(s.fx.map(f=>f.slot)).size!==s.fx.length)throw Error('Canaux ou slots dupliqués / invalides');if(!s.advanced||typeof s.advanced!=='object'||Array.isArray(s.advanced)||Object.entries(s.advanced).some(([a,v])=>!/^\/ch\/(0[1-9]|1[0-6])\/mix\/0[1-6]\/level$/.test(a)||!v||typeof v.value!=='number'||!Number.isFinite(v.value)||v.value<0||v.value>1))throw Error('Envois de scène invalides');s.processing.forEach(p=>validateProcessing({hpfHz:p.hpfHz,eq:p.eq,compressor:p.compressor,gate:p.gate}));s.fx.forEach(validateFx);return structuredClone(s);}
 private fingerprint(){const s=this.capture();return createHash('sha256').update(JSON.stringify([this.xr.status().mode,this.xr.status().host,s.channels.map(c=>[c.fader,c.on]),[s.main.fader,s.main.on],s.processing,s.fx,Object.fromEntries(Object.entries(this.xr.parameterState()).map(([a,v])=>[a,v.value]))])).digest('hex');}
 preview(id:string,excludePhantom=false){const e=this.library.get(id);const desired=e.kind==='scene'?this.validateScene(e.data):e.kind==='fx'?validateFx(e.data):e.kind==='native-scene'?compileNativeScene(e.data):null;if(!desired)throw Error('Type non rappelable');if(this.previewTokens.size>100)this.previewTokens.clear();const token=randomUUID();this.previewTokens.set(token,{id,fingerprint:this.fingerprint(),expires:Date.now()+PREVIEW_TTL_MS,excludePhantom});return {token,current:this.capture(),desired,hardwareSupported:['scene','fx','native-scene'].includes(e.kind),verifiedOnHardware:false};}
 async apply(id:string,token:unknown,confirm:unknown,allowPhantom:unknown=false){const p=typeof token==='string'?this.previewTokens.get(token):undefined;if(!p||p.id!==id||p.expires<Date.now()||p.fingerprint!==this.fingerprint()||confirm!==true)throw Error('Prévisualisation expirée ou état modifié : prévisualiser à nouveau');this.previewTokens.delete(token as string);return this.perform(id,allowPhantom===true,p.excludePhantom);}
 private async perform(id:string,allowPhantom=false,excludePhantom=false){const e=this.library.get(id);
  if(e.kind==='native-scene'){
   const plan=compileNativeScene(e.data);
   if(plan.opaqueFx.length)throw Error('Scène conservée intégralement ; rappel refusé avant toute écriture : correspondances des paramètres FX natifs non validées. Utiliser X Air Edit.');
   if(this.xr.mode!=='real'||process.env.XR18_EXPERIMENTAL_SCENES!=='true'||!this.xr.status().writesEnabled)throw Error('Rappel natif expérimental désactivé ; connexion réelle et activation explicite requises');
   if(plan.phantom.length&&!allowPhantom)throw Error('Cette scène contient le 48 V : confirmation spécifique obligatoire');
   const lines:string[]=[];for(const node of SCENE_NODES)lines.push(await this.xr.node(node));
   const backup=this.library.save('native-scene','Sauvegarde avant rappel matériel',lines.join('\n')+'\n');
   try{
    await this.xr.applyNative(plan.commands);
    const readback:string[]=[];for(const node of plan.nodes)readback.push(await this.xr.node(node));
    const observed=new Map(compileNativeScene(readback.join('\n')).commands.map(c=>[c.address,c]));
    const differences=plan.commands.filter(c=>{const o=observed.get(c.address);return !o||o.type!==c.type||(typeof c.value==='number'&&typeof o.value==='number'?Math.abs(c.value-o.value)>(c.type==='f'?(PARAMETERS[c.address]?readbackTolerance(c.address):.003):0):o.value!==c.value);});
    return {ok:differences.length===0,backupId:backup.id,readbackCompared:true,verifiedOnHardware:false,differences};
   }catch(error){throw Error(`Rappel matériel potentiellement partiel ; sauvegarde ${backup.id} : ${(error as Error).message}`);}
  }
  if(e.kind==='scene'){
   if((e.data as {version?:number}).version===2)return this.console.recall(e.data,allowPhantom,excludePhantom);
   const s=this.validateScene(e.data);if(this.xr.mode!=='simulation')throw Error('Rappel de scène applicative disponible uniquement en simulation ; utiliser X Air Edit pour les scènes matérielles');
   const backup=this.library.save('scene','Sauvegarde avant rappel',this.capture());
   for(const c of s.channels){this.xr.setFader(c.channel,c.fader);this.xr.setOn(c.channel,c.on);}this.xr.setMainFader(s.main.fader);this.xr.setMainOn(s.main.on);
   this.processing.restore(s.processing);this.xr.restoreAdvanced(s.advanced);this.fx=new Map(s.fx.map(f=>[f.slot,f]));return {ok:true,backupId:backup.id,simulationOnly:true};
  }
  if(e.kind==='fx'){const f=validateFx(e.data);if(this.xr.mode==='real'){
   const before=await this.xr.readFx(f.slot);this.library.save('fx-backup',`Sauvegarde FX ${f.slot}`,before);await this.xr.applyFx(f);
  }else await this.xr.applyFx(f);this.fx.set(f.slot,f);return {ok:true,simulationOnly:this.xr.mode==='simulation',hardwareAcknowledged:false};}
  throw Error('Type non rappelable');
 }
 state(){return {armed:this.armed,events:this.seen.size};}
 arm(value:boolean){if(!value)this.xr.cancelOperations();this.armed=value;if(!value)this.seen.clear();return this.state();}
 async event(input:Record<string,unknown>){if(!this.armed)throw Error('ReaCue désarmé');const {eventId,songId,section}=input;if(typeof eventId!=='string'||!eventId||eventId.length>120||typeof songId!=='string'||typeof section!=='string')throw Error('eventId, songId et section requis');if(this.seen.has(eventId))return {ok:true,duplicate:true};const cue=this.library.list('cue').find(e=>{const d=e.data as Record<string,unknown>;return d.songId===songId&&d.section===section;});if(!cue)throw Error('Aucune association ReaCue pour ce morceau / cette section');const d=cue.data as {targetId:string};const target=this.library.get(d.targetId);if(this.xr.mode==='real'&&(target.kind!=='scene'||(target.data as {version?:number}).version!==2))throw Error('ReaCue matériel : scène complète version 2 requise');if(this.xr.mode==='real'&&Object.keys((target.data as {values:Record<string,unknown>}).values).some(a=>a.endsWith('/phantom')))throw Error('ReaCue ne change jamais le 48 V : retirer ces paramètres de la scène dédiée');if(this.seen.size>=10000)throw Error('Limite événements atteinte : désarmer puis réarmer');this.seen.add(eventId);try{return await this.perform(target.id);}catch(e){this.armed=false;throw e;}}
 manualOverride(){if(this.armed)this.xr.cancelOperations();this.armed=false;}
}

