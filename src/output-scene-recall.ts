import {randomUUID} from 'node:crypto';
import type {XR18} from './xr18.js';
import {PREVIEW_TTL_MS,type ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';
import {nativeSceneForRecall} from './native-scene-recall.js';
import {fromWire,readbackTolerance,validateWire,type Value} from './parameters.js';
import {validateFx,type Fx} from './show-control.js';
import {outputTargets,outputSection,OUTPUT_SECTIONS,type OutputScope} from '../shared/output-recall.js';
import {STEREO_LINK_GROUPS,stereoSettingShared,stereoConflict} from '../shared/stereo-link.js';
import {PROTECTION_CONFLICT} from '../shared/scene-protections.js';
const fxSame=(a:Fx,b:Fx)=>a.slot===b.slot&&a.algorithm===b.algorithm&&a.parameters.length===b.parameters.length&&a.parameters.every((p,i)=>p.type===b.parameters[i]!.type&&Math.abs(p.value-b.parameters[i]!.value)<=(p.type==='i'?0:.021));
const same=(a:string,x:Value,y:Value)=>typeof x==='number'&&typeof y==='number'?Math.abs(x-y)<=readbackTolerance(a):x===y;
type Backup={version:1;model:string;values:Record<string,Value>;fx:Fx[];guards:Record<string,Value>};
type Plan={id:string;identity:string;epoch:number;revision:number;expires:number;before:Backup;values:Record<string,Value>;fx:Fx[]};
export class OutputSceneRecall{
 private plans=new Map<string,Plan>();
 constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore){xr.on('reset',()=>this.plans.clear());}
 private available(){outputTargets(this.xr.model().id);const s=this.xr.status();if(s.mode==='real'&&(!s.connected||!s.writesEnabled))throw Error('Connecte la console et active son contrôle avant de préparer un rappel.');}
 private source(id:string){const e=this.library.get(id);if(e.kind==='native-scene')return nativeSceneForRecall(e.data,this.xr.model().id);if(e.kind!=='scene')throw Error('Choisis une scène complète BandPilot.');return this.control.validateScene(e.data);}
 options(id:string){const source=this.source(id);return {model:this.xr.model().id,targets:outputTargets(this.xr.model().id).filter(t=>Object.keys(source.values).some(a=>a.startsWith(t.id+'/'))),fx:source.fx.map(f=>({slot:f.slot,algorithm:f.algorithm}))};}
 private selection(id:string,input:unknown){
  const s=input as OutputScope,source=this.source(id),available=outputTargets(this.xr.model().id).map(t=>t.id);
  if(!s||!Array.isArray(s.targets)||!Array.isArray(s.sections)||!Array.isArray(s.fxSlots)||(!s.targets.length&&!s.fxSlots.length)||s.targets.length&&!s.sections.length||new Set(s.targets).size!==s.targets.length||new Set(s.sections).size!==s.sections.length||new Set(s.fxSlots).size!==s.fxSlots.length||s.targets.some(t=>!available.includes(t))||s.sections.some(t=>!OUTPUT_SECTIONS.includes(t))||s.fxSlots.some(n=>!Number.isInteger(n)||n<1||n>4))throw Error('Sélection des sorties ou des FX invalide.');
  let perTarget:OutputScope['perTarget'];
  if(s.perTarget!==undefined){
   if(!s.perTarget||typeof s.perTarget!=='object'||Array.isArray(s.perTarget))throw Error('Périmètre de scène invalide.');
   perTarget={};
   for(const [target,selected] of Object.entries(s.perTarget)){
    if(!s.targets.includes(target)||!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(k=>!s.sections.includes(k)))throw Error('Périmètre de scène invalide.');
    perTarget[target]=s.sections.filter(k=>selected.includes(k));
   }
  }
  const values:Record<string,Value>={};
  for(const target of s.targets)for(const a of this.xr.parameterAddresses()){
   const section=a.startsWith(target+'/')?outputSection(a.slice(target.length+1)):null;if(!section||!(perTarget?.[target]??s.sections).includes(section))continue;
   if(!Object.hasOwn(source.values,a))throw Error('La scène ne contient pas tous les réglages sélectionnés. Réduis la sélection ou utilise une capture plus récente.');values[a]=source.values[a]!;
  }
  const fx=s.fxSlots.map(slot=>{const f=source.fx.find(f=>f.slot===slot);if(!f)throw Error('Paramètres FX absents de la scène.');return validateFx(f);});
  const scope:OutputScope={targets:[...s.targets],sections:[...s.sections],fxSlots:[...s.fxSlots],...(perTarget&&Object.keys(perTarget).length?{perTarget}:{})};
  return {scope,values,fx,source};
 }
 validatedScope(id:string,input:unknown){return this.selection(id,input).scope;}
 async preview(id:string,input:unknown){
  this.available();
  const {values,fx,source}=this.selection(id,input);
  return this.prepare(id,values,fx,source.values);
 }
 async backup(id:string){const e=this.library.get(id),b=e.data as Backup;if(e.kind!=='output-recall-backup'||b?.version!==1||b.model!==this.xr.model().id||!b.values||!Array.isArray(b.fx)||!b.guards)throw Error('Sauvegarde incompatible avec cette console.');return this.prepare(id,b.values,b.fx,undefined,b.guards);}
 private async prepare(id:string,original:Record<string,Value>,originalFx:Fx[],source?:Record<string,Value>,expectedGuards?:Record<string,Value>){
  this.available();const values={...original},rules=this.library.outputProtections(this.xr.model().id),identity=this.control.identity(),epoch=this.xr.operationId();
  const guards:Record<string,Value>={},beforeValues:Record<string,Value>={},excluded:string[]=[];
  const check=()=>{if(identity!==this.control.identity()||epoch!==this.xr.operationId())throw Error('Connexion modifiée ou opération interrompue');if(rules.revision!==this.library.outputProtections(this.xr.model().id).revision)throw Error(PROTECTION_CONFLICT);};
  const read=async(a:string)=>{check();const v=await this.xr.readParameter(a);check();return v;};
  const targets=outputTargets(this.xr.model().id);
  for(const [a,v]of Object.entries(values)){const t=targets.find(t=>a.startsWith(t.id+'/'));if(!t||!outputSection(a.slice(t.id.length+1))||!this.xr.supports(a))throw Error('Sélection des sorties ou des FX invalide.');validateWire(a,v);}
  const selected=targets.filter(t=>Object.keys(values).some(a=>a.startsWith(t.id+'/'))).map(t=>t.id);
  for(const target of selected){
   let pair=[target];const bus=/^\/bus\/(\d+)$/.exec(target);
   if(bus){const n=Number(bus[1]),first=n%2?n:n-1,link=`/config/buslink/${first}-${first+1}`;guards[link]??=await read(link);
    if(source&&guards[link]!== (source[link]??0))throw Error('La liaison stéréo diffère de la scène. Le rappel sélectif ne change pas les liaisons.');
    if(guards[link]===1){pair=[`/bus/${first}`,`/bus/${first+1}`];if(pair.some(p=>!selected.includes(p)))throw Error('Sélectionne les deux bus de chaque paire stéréo liée.');for(const leaf of STEREO_LINK_GROUPS){const a=`/config/linkcfg/${leaf}`;guards[a]??=await read(a);}}
   }
   const protectedSections=new Set(rules.rules.filter(r=>pair.includes(r.target)).flatMap(r=>r.sections));
   for(const t of pair)for(const a of Object.keys(values))if(a.startsWith(t+'/')&&protectedSections.has(outputSection(a.slice(t.length+1))!)){delete values[a];if(!excluded.includes(t))excluded.push(t);}
  }
  let fx=originalFx.map(validateFx).filter(f=>{const protectedSlot=rules.rules.some(r=>r.target===`fx:${f.slot}`);if(protectedSlot)excluded.push(`FX ${f.slot}`);return !protectedSlot;});
  if(new Set(fx.map(f=>f.slot)).size!==fx.length)throw Error('Sélection des sorties ou des FX invalide.');
  if(expectedGuards)for(const [a,v]of Object.entries(expectedGuards))if(guards[a]!==v)throw Error('Les liaisons ou les sources ont changé. Prépare un nouvel aperçu.');
  for(const a of Object.keys(values))beforeValues[a]=await read(a);
  for(const target of selected){const bus=/^\/bus\/(\d+)$/.exec(target);if(!bus)continue;const n=Number(bus[1]),first=n%2?n:n-1;if(guards[`/config/buslink/${first}-${first+1}`]!==1)continue;
   for(const [a,v]of Object.entries(values))if(a.startsWith(target+'/')){const suffix=a.slice(target.length+1),other=`/bus/${n===first?first+1:first}/`+suffix;if(!Object.hasOwn(values,other))throw Error('Sélectionne les deux bus de chaque paire stéréo liée.');if(stereoSettingShared(suffix,guards)&&(!same(a,v,values[other]!)||!same(a,beforeValues[a]!,beforeValues[other]!)))throw Error(stereoConflict(suffix));}
  }
  const beforeFx:Fx[]=[];for(const f of fx){check();beforeFx.push(await this.xr.readFx(f.slot));check();}
  const changed=Object.entries(values).some(([a,v])=>!same(a,v,beforeValues[a]!))||fx.some((f,i)=>JSON.stringify(f)!==JSON.stringify(beforeFx[i]));
  if(!changed)return {token:null,changes:[],fx:[],excluded};
  const affected=selected.filter(t=>Object.keys(values).some(a=>a.startsWith(t+'/')));
  const activeGuards=Object.fromEntries(Object.entries(guards).filter(([a])=>{const pair=/^\/config\/buslink\/(\d+)-(\d+)$/.exec(a);return pair?affected.some(t=>t===`/bus/${pair[1]}`||t===`/bus/${pair[2]}`):affected.some(t=>{const n=Number(t.split('/')[2]);return t.startsWith('/bus/')&&guards[`/config/buslink/${n%2?n:n-1}-${n%2?n+1:n}`]===1;});}));
  const token=randomUUID();if(this.plans.size>=100)this.plans.clear();this.plans.set(token,{id,identity,epoch,revision:rules.revision,expires:Date.now()+PREVIEW_TTL_MS,before:{version:1,model:this.xr.model().id,values:beforeValues,fx:beforeFx,guards:activeGuards},values,fx});
  return {token,changes:Object.entries(values).filter(([a,v])=>!same(a,v,beforeValues[a]!)).map(([a,v])=>({address:a,before:fromWire(a,beforeValues[a]!),after:fromWire(a,v),sensitive:false})),fx:fx.map((f,i)=>({slot:f.slot,before:beforeFx[i]!,after:f})),excluded};
 }
 async apply(id:string,token:unknown,beforeWrite:()=>void=()=>{}){
  this.available();const p=typeof token==='string'?this.plans.get(token):undefined;if(!p||p.id!==id||p.expires<Date.now())throw Error('Aperçu expiré ou source modifiée : recommencer.');this.plans.delete(token as string);
  const check=()=>{if(p.identity!==this.control.identity()||p.epoch!==this.xr.operationId())throw Error('Connexion modifiée ou opération interrompue');if(p.revision!==this.library.outputProtections(this.xr.model().id).revision)throw Error(PROTECTION_CONFLICT);};check();
  for(const [a,v]of Object.entries({...p.before.guards,...p.before.values})){const now=await this.xr.readParameter(a);check();if(!same(a,v,now))throw Error('État modifié : prévisualiser à nouveau');}
  for(const f of p.before.fx){const now=await this.xr.readFx(f.slot);check();if(JSON.stringify(now)!==JSON.stringify(f))throw Error('État modifié : prévisualiser à nouveau');}
  beforeWrite();p.epoch=this.xr.operationId();check();
  const backup=this.library.save('output-recall-backup','Avant rappel des sorties et FX',p.before);
  try{
   for(const f of p.fx){check();await this.xr.applyFx(f);check();}
   for(const [a,v]of Object.entries(p.values)){check();await this.xr.applyParameters({[a]:v},false);check();}
   for(const [a,v]of Object.entries({...p.before.guards,...p.values})){const now=await this.xr.readParameter(a);check();if(!same(a,v,now))throw Error('La console n’a pas conservé les réglages demandés.');}
   for(const f of p.fx){const now=await this.xr.readFx(f.slot);check();if(!fxSame(now,f))throw Error('La console n’a pas conservé les réglages demandés.');}
   return {ok:true,backupId:backup.id};
  }catch(e){throw Object.assign(Error(`Modification potentiellement partielle ; sauvegarde ${backup.id} : ${(e as Error).message}`),{backupId:backup.id});}
 }
}
