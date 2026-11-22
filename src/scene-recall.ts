import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';
import {PREVIEW_TTL_MS} from './console-control.js';
import {fromWire,readbackTolerance,validateWire,type Value} from './parameters.js';
import {nativeSceneSettings} from './native-scene-recall.js';
import {SCENE_RECALL_SECTIONS,SCENE_MAPPING_INVALID,SCENE_MAPPING_STEREO,sceneRecallSection,type SceneRecallScope} from '../shared/scene-recall.js';
import {STEREO_LINK_GROUPS,stereoSettingShared,stereoConflict,stereoLinkSummary} from '../shared/stereo-link.js';

const prefix=(channel:number)=>`/ch/${String(channel).padStart(2,'0')}/`;
const same=(address:string,a:Value,b:Value)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=readbackTolerance(address):a===b;
export class SceneRecall {
  private plans=new Map<string,{sourceId:string;expires:number}>();
  constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore){xr.on('reset',()=>this.plans.clear());}
  private available(){
    if(this.xr.model().family!=='xair')throw Error('Rappel sélectif disponible pour X-Air / M-Air uniquement.');
    const status=this.xr.status();
    if(status.mode==='real'&&(!status.connected||!status.writesEnabled))throw Error('Connecte la console et active son contrôle avant de préparer un rappel.');
  }
  private scope(input:unknown):SceneRecallScope {
    const s=input as SceneRecallScope;
    if(!s||!Array.isArray(s.channels)||!s.channels.length||s.channels.length>this.xr.model().channels||new Set(s.channels).size!==s.channels.length||s.channels.some(n=>!Number.isInteger(n)||n<1||n>this.xr.model().channels))throw Error('Choisis au moins une entrée disponible sur cette console.');
    if(!Array.isArray(s.sections)||!s.sections.length||s.sections.length>SCENE_RECALL_SECTIONS.length||new Set(s.sections).size!==s.sections.length||s.sections.some(s=>!SCENE_RECALL_SECTIONS.includes(s)))throw Error('Choisis au moins une famille de réglages disponible.');
    const channels=[...s.channels].sort((a,b)=>a-b),sections=SCENE_RECALL_SECTIONS.filter(k=>s.sections.includes(k));
    let perChannel:SceneRecallScope['perChannel'];
    if(s.perChannel!==undefined){
      if(!s.perChannel||typeof s.perChannel!=='object'||Array.isArray(s.perChannel))throw Error('Périmètre de scène invalide.');
      perChannel={};
      for(const [key,selected] of Object.entries(s.perChannel)){
        const channel=Number(key);
        if(String(channel)!==key||!channels.includes(channel)||!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(k=>!sections.includes(k)))throw Error('Périmètre de scène invalide.');
        perChannel[channel]=sections.filter(k=>selected.includes(k));
      }
    }
    const scope={channels,sections,...(perChannel&&Object.keys(perChannel).length?{perChannel}:{})};
    if(s.mapping===undefined)return scope;
    if(!Array.isArray(s.mapping)||s.mapping.length!==channels.length||s.mapping.some(m=>!m||!Number.isInteger(m.source)||!channels.includes(m.source)||!Number.isInteger(m.target)||m.target<1||m.target>this.xr.model().channels)||new Set(s.mapping.map(m=>m.source)).size!==channels.length||new Set(s.mapping.map(m=>m.target)).size!==channels.length)throw Error(SCENE_MAPPING_INVALID);
    return {...scope,mapping:channels.map(source=>({source,target:s.mapping!.find(m=>m.source===source)!.target}))};
  }
  private source(sourceId:string){
    const entry=this.library.get(sourceId);
    if(entry.kind==='native-scene')return nativeSceneSettings(entry.data,this.xr.model().id).values;
    if(entry.kind!=='scene'||(entry.data as {version?:number})?.version!==2)throw Error('Le rappel sélectif nécessite une scène complète BandPilot.');
    return this.control.validateScene(entry.data).values;
  }
  options(sourceId:string){
    const values=this.source(sourceId),state=this.xr.parameterState();
    const destinations=Array.from({length:this.xr.model().channels},(_,i)=>({channel:i+1,name:String(state[prefix(i+1)+'config/name']?.value??'')}));
    return {model:this.xr.model().id,family:this.xr.model().family,destinations,channels:destinations.filter(c=>Object.keys(values).some(a=>a.startsWith(prefix(c.channel)))).map(c=>({...c,savedName:String(values[prefix(c.channel)+'config/name']??'')}))};
  }
  private selection(sourceId:string,input:unknown){
    const sceneValues=this.source(sourceId),scope=this.scope(input),values:Record<string,Value>={},links:Record<string,Value>={};
    const mapping=scope.mapping??scope.channels.map(source=>({source,target:source}));
    // Validate the source topology before reading/writing destinations. A saved
    // stereo pair cannot be split, reversed or merged with unrelated inputs.
    for(const {source,target} of mapping){
      const first=source%2?source:source-1,linked=sceneValues[`/config/chlink/${first}-${first+1}`]??0;
      if(linked===1){
        const left=mapping.find(m=>m.source===first),right=mapping.find(m=>m.source===first+1);
        if(!left||!right||left.target%2!==1||right.target!==left.target+1)throw Error(SCENE_MAPPING_STEREO);
      }
      const destinationFirst=target%2?target:target-1;
      links[`/config/chlink/${destinationFirst}-${destinationFirst+1}`]=linked;
    }
    for(const {source,target} of mapping)for(const address of this.xr.parameterAddresses()){
      const start=prefix(target),section=address.startsWith(start)?sceneRecallSection(address.slice(start.length)):null;
      if(!section||!(scope.perChannel?.[source]??scope.sections).includes(section))continue;
      const sourceAddress=prefix(source)+address.slice(start.length);
      if(!Object.hasOwn(sceneValues,sourceAddress))throw Error('La scène ne contient pas tous les réglages sélectionnés. Réduis la sélection ou utilise une capture plus récente.');
      values[address]=sceneValues[sourceAddress]!;
    }
    return {values,scope,mapping,links,destination:{channels:mapping.map(m=>m.target).sort((a,b)=>a-b),sections:scope.sections}};
  }
  validatedScope(sourceId:string,input:unknown){
    return this.selection(sourceId,input).scope;
  }
  async preview(sourceId:string,input:unknown){
    this.available();
    const {values,scope,mapping,links,destination}=this.selection(sourceId,input);
    const plan=await this.prepare(sourceId,values,destination,links);
    return {...plan,scope,mapping};
  }
  async reviewMidi(sourceId:string,input:unknown){
    this.available();
    const {values,scope,links,destination}=this.selection(sourceId,input);
    const snapshot=await this.inspect(values,destination,links);
    const targets=Object.entries(snapshot.values).map(([address,value])=>({address,before:fromWire(address,snapshot.current[address]!),after:fromWire(address,value)}));
    if(!targets.length)throw Error('La protection des scènes exclut tous les réglages choisis.');
    return {scope,targets,excluded:snapshot.excluded,guards:snapshot.guards,revision:snapshot.revision};
  }
  async previewMidi(sourceId:string,input:unknown,review:{guards:Record<string,Value>;revision:number},check:()=>void){
    this.available();
    this.control.checkRecallRevision(review.revision);
    const {values,links,destination}=this.selection(sourceId,input);
    const snapshot=await this.inspect(values,destination,links,review.guards,check);
    this.control.checkRecallRevision(review.revision);
    return this.makePlan(sourceId,destination,snapshot);
  }
  async previewBackup(sourceId:string){
    this.available();
    const entry=this.library.get(sourceId),b=entry.data as {version:number;model:string;values:Record<string,Value>;guards:Record<string,Value>};
    if(entry.kind!=='scene-recall-backup'||b?.version!==1||b.model!==this.xr.model().id||!b.values||!b.guards)throw Error('Sauvegarde incompatible avec cette console.');
    const channels:number[]=[],sections:SceneRecallScope['sections']=[];
    for(const [address,value] of Object.entries(b.values)){
      const match=/^\/ch\/(\d{2})\/(.+)$/.exec(address),section=match?sceneRecallSection(match[2]!):null;
      if(!match||!section||!this.xr.supports(address))throw Error('Sauvegarde de rappel sélectif invalide.');
      validateWire(address,value);channels.push(Number(match[1]));sections.push(section);
    }
    const scope=this.scope({channels:[...new Set(channels)],sections:[...new Set(sections)]});
    return this.prepare(sourceId,b.values,scope,undefined,b.guards);
  }
  private async prepare(sourceId:string,values:Record<string,Value>,scope:SceneRecallScope,sceneValues?:Record<string,Value>,expectedGuards?:Record<string,Value>){
    return this.makePlan(sourceId,scope,await this.inspect(values,scope,sceneValues,expectedGuards));
  }
  private async inspect(values:Record<string,Value>,scope:SceneRecallScope,sceneValues?:Record<string,Value>,expectedGuards?:Record<string,Value>,assertActive:()=>void=()=>{}){
    values={...values};
    const protections=this.library.protections(this.xr.model().id),excluded:{channel:number;section:SceneRecallScope['sections'][number]}[]=[];
    const identity=this.control.identity(),epoch=this.xr.operationId(),guards:Record<string,Value>={};
    const check=()=>{assertActive();this.control.checkRecallRevision(protections.revision);if(identity!==this.control.identity()||epoch!==this.xr.operationId())throw Error('Connexion modifiée ou opération interrompue');};
    const read=async(address:string)=>{check();const value=await this.xr.readParameter(address);check();return value;};
    for(const ch of scope.channels){
      const first=ch%2?ch:ch-1,link=`/config/chlink/${first}-${first+1}`;
      guards[link]??=await read(link);
      if(sceneValues&&guards[link]!== (sceneValues[link]??0))throw Error('La liaison stéréo diffère de la scène. Le rappel sélectif ne change pas les liaisons.');
      // Protect destination families. Linked pairs stay a unit even when their
      // DSP families are independent, so neither side can indirectly bypass it.
      const pair=guards[link]===1?[first,first+1]:[ch];
      const protectedSections=new Set(protections.rules.filter(r=>pair.includes(r.channel)).flatMap(r=>r.sections));
      for(const channel of pair)for(const address of Object.keys(values)){
        const section=address.startsWith(prefix(channel))?sceneRecallSection(address.slice(prefix(channel).length)):null;
        if(section&&protectedSections.has(section)){
          delete values[address];
          if(!excluded.some(e=>e.channel===channel&&e.section===section))excluded.push({channel,section});
        }
      }
      if(guards[link]===1){
        if(!scope.channels.includes(first)||!scope.channels.includes(first+1))throw Error('Sélectionne les deux entrées de chaque paire stéréo liée.');
        for(const suffix of STEREO_LINK_GROUPS){const address=`/config/linkcfg/${suffix}`;guards[address]??=await read(address);}
        for(const [address,value] of Object.entries(values))if(address.startsWith(prefix(first))){
          const other=address.replace(prefix(first),prefix(first+1));
          if(!Object.hasOwn(values,other))throw Error('Sélectionne les deux entrées de chaque paire stéréo liée.');
          if(stereoSettingShared(address.slice(prefix(first).length),guards)&&!same(address,value,values[other]!))throw Error(stereoConflict(address.slice(prefix(first).length)));
        }
      }
      for(const suffix of ['config/insrc','config/rtnsrc','preamp/rtnsw']){const address=prefix(ch)+suffix;if(this.xr.supports(address))guards[address]=await read(address);}
    }
    if(expectedGuards)for(const [address,value] of Object.entries(expectedGuards)){
      if(!Object.hasOwn(guards,address)||!same(address,guards[address]!,value))throw Error('Les liaisons ou les sources ont changé depuis la sauvegarde. Restauration sélective annulée.');
    }
    const changed:Record<string,Value>={},current:Record<string,Value>={};
    for(const [address,value] of Object.entries(values)){
      current[address]=await read(address);
      if(!same(address,current[address]!,value))changed[address]=value;
    }
    // Include both sides of a linked pair in the backup, even when one is already
    // at the target. Undo must check and restore the pair as a unit as well.
    for(const address of Object.keys({...changed})){
      const match=/^\/ch\/(\d{2})\/(.+)$/.exec(address)!;
      const ch=Number(match[1]),first=ch%2?ch:ch-1;
      if(guards[`/config/chlink/${first}-${first+1}`]===1){
        const other=prefix(ch===first?first+1:first)+match[2];
        if(!Object.hasOwn(current,other))throw Error('Sélectionne les deux entrées de chaque paire stéréo liée.');
        if(stereoSettingShared(match[2]!,guards)&&!same(address,current[address]!,current[other]!))throw Error(stereoConflict(match[2]!));
        changed[other]=values[other]!;
      }
    }
    check();
    return {values,changed,current,guards,excluded,revision:protections.revision,check};
  }
  private async makePlan(sourceId:string,scope:SceneRecallScope,snapshot:Awaited<ReturnType<SceneRecall['inspect']>>){
    const {values,changed,current,guards,excluded,revision,check}=snapshot;
    if(!Object.keys(changed).length)return {token:null,changes:[],scope,excluded,stereoLink:stereoLinkSummary(Object.keys(values),guards)};
    const affected=new Set(Object.keys(changed).map(a=>Number(a.split('/')[2])));
    const activeGuards=Object.fromEntries(Object.entries(guards).filter(([a])=>{
      const channel=/^\/ch\/(\d+)\//.exec(a),pair=/^\/config\/chlink\/(\d+)-(\d+)$/.exec(a);
      if(channel)return affected.has(Number(channel[1]));
      if(pair)return affected.has(Number(pair[1]))||affected.has(Number(pair[2]));
      return [...affected].some(ch=>{const first=ch%2?ch:ch-1;return guards[`/config/chlink/${first}-${first+1}`]===1;});
    }));
    const plan=await this.control.preview(changed,true,activeGuards,'scene-recall-backup',current,revision);check();
    for(const [token,p] of this.plans)if(p.expires<Date.now())this.plans.delete(token);
    if(this.plans.size>100)this.plans.clear();
    this.plans.set(plan.token,{sourceId,expires:Date.now()+PREVIEW_TTL_MS});
    return {...plan,scope,excluded,stereoLink:stereoLinkSummary(Object.keys(changed),activeGuards)};
  }
  async apply(sourceId:string,token:unknown,confirm:unknown,check:()=>void=()=>{}){
    this.available();
    if(confirm!==true)throw Error('Confirmation requise');
    const p=typeof token==='string'?this.plans.get(token):undefined;
    if(!p||p.sourceId!==sourceId||p.expires<Date.now())throw Error('Aperçu expiré ou source modifiée : recommencer.');
    this.plans.delete(token as string);
    return this.control.apply(token,false,false,check);
  }
}
