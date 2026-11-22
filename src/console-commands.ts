import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';
import {MIXER_MODELS,type MixerModelId} from '../shared/mixer-models.js';
import {COMMAND_TARGETS,commandIsTimed,type ConsoleCommand,type CommandStep,type CommandCondition} from '../shared/console-command.js';
import {toWire,type Value} from './parameters.js';
import {previewChannelOperation} from './channel-operations.js';
export function commandValues(input:unknown):{command:ConsoleCommand;values:Record<string,Value>}{
 const v=input as ConsoleCommand,m=typeof v?.model==='string'&&Object.hasOwn(MIXER_MODELS,v.model)?MIXER_MODELS[v.model as MixerModelId]:undefined;
 if(!m||m.family!=='xair'||v.version!==1||!Array.isArray(v.steps)||!v.steps.length||v.steps.length>64)throw Error('Commande enregistrée invalide.');
 if(v.delayMs!==undefined&&!validDelay(v.delayMs))throw Error('Délai de commande invalide (0 à 30 secondes).');
 const {values,steps}=settings(v.model,v.steps,v.delayMs??0);
 if(v.condition!==undefined&&v.conditionSet!==undefined)throw Error('Condition de commande invalide.');
 const condition=v.condition===undefined?undefined:conditionRule(v.model,v.condition);
 let conditionSet:ConsoleCommand['conditionSet'];
 if(v.conditionSet!==undefined){
  const set=v.conditionSet;
  if(!set||!['all','any'].includes(set.match)||!Array.isArray(set.rules)||!set.rules.length||set.rules.length>8||
     set.offSteps!==undefined&&(!Array.isArray(set.offSteps)||!set.offSteps.length||set.offSteps.length>64))throw Error('Condition de commande invalide.');
  const rules=set.rules.map(rule=>conditionRule(v.model,rule));
  conditionSet={match:set.match,rules,...(set.offSteps?{offSteps:settings(v.model,set.offSteps,v.delayMs??0).steps}:{})};
 }
 return {command:{version:1,model:m.id,steps,...(v.delayMs!==undefined?{delayMs:v.delayMs}:{}),...(condition?{condition}:{}),...(conditionSet?{conditionSet}:{})},values};
}
const validDelay=(value:number)=>Number.isInteger(value)&&value>=0&&value<=30000;

function conditionRule(model:string,rule:CommandCondition):CommandCondition{
 if(!rule||!['above','below'].includes(rule.comparison)||!Number.isFinite(rule.hysteresis)||rule.hysteresis<0||rule.hysteresis>12||rule.target==='mute'&&rule.hysteresis!==0)throw Error('Condition de commande invalide.');
 const {value,delayMs:_,...setting}=settings(model,[{...rule,value:rule.threshold}],0).steps[0]!;
 return {...setting,comparison:rule.comparison,threshold:value,hysteresis:rule.hysteresis};
}

function settings(model:string,input:CommandStep[],delay:number){
 const m=MIXER_MODELS[model as MixerModelId];
 const values:Record<string,Value>={},steps:CommandStep[]=[];
 for(const s of input){
  if(!s||!Object.hasOwn(COMMAND_TARGETS,s.target)||!Number.isInteger(s.channel)||s.channel<1||s.channel>m.channels||typeof s.value!=='number'||!Number.isFinite(s.value))throw Error('Commande enregistrée invalide.');
  if(s.target==='send'&&(!Number.isInteger(s.bus)||s.bus!<1||s.bus!>m.monitorOutputs)||s.target==='eq'&&(!Number.isInteger(s.band)||s.band!<1||s.band!>4))throw Error('Commande enregistrée invalide.');
  if(s.delayMs!==undefined&&(!validDelay(s.delayMs)||s.delayMs+delay>30000))throw Error('Délai de commande invalide (0 à 30 secondes).');
  const path=s.target==='fader'?'mix/fader':s.target==='send'?`mix/${String(s.bus).padStart(2,'0')}/level`:s.target==='eq'?`eq/${s.band}/g`:s.target==='compressor'?'dyn/thr':s.target==='gate'?'gate/thr':'mix/on',a=`/ch/${String(s.channel).padStart(2,'0')}/${path}`;
  if(Object.hasOwn(values,a))throw Error('Un réglage ne peut apparaître qu’une fois dans la commande.');
  values[a]=toWire(a,s.target==='mute'?1-s.value:s.value);
  steps.push({channel:s.channel,target:s.target,value:s.value,...(s.target==='send'?{bus:s.bus}:{}),...(s.target==='eq'?{band:s.band}:{}),...(s.delayMs!==undefined?{delayMs:s.delayMs}:{})});
 }
 return {values,steps};
}
export function commandStages(command:ConsoleCommand,off=false){
 const steps=off?command.conditionSet?.offSteps??[]:command.steps;
 const delay=command.delayMs??0;
 const values=settings(command.model,steps,delay).values,keys=Object.keys(values);
 const delays=new Map<number,Record<string,Value>>();
 steps.forEach((step,index)=>{
  const at=delay+(step.delayMs??0),address=keys[index]!;
  const stage=delays.get(at)??{};
  stage[address]=values[address]!;
  delays.set(at,stage);
 });
 return [...delays.entries()].sort(([a],[b])=>a-b).map(([at,values])=>({at,values}));
}
export class ConsoleCommands{
 private previews=new Map<string,string>();
 constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore){}
 list(){return this.library.list('console-command').filter(e=>(e.data as ConsoleCommand).model===this.xr.model().id);}
 save(input:unknown){const v=input as {name:string;data:ConsoleCommand};const {command}=commandValues(v?.data);if(command.model!==this.xr.model().id)throw Error('Connexion modifiée');if(this.list().length>=64)throw Error('64 commandes maximum par modèle.');return this.library.save('console-command',v.name,command);}
 remove(id:string){const e=this.library.get(id);if(e.kind!=='console-command'||(e.data as ConsoleCommand).model!==this.xr.model().id)throw Error('Commande enregistrée invalide.');return this.library.delete(id);}
 async preview(id:string){const e=this.library.get(id);if(e.kind!=='console-command')throw Error('Commande enregistrée invalide.');const {command,values}=commandValues(e.data);if(command.model!==this.xr.model().id)throw Error('Connexion modifiée');if(commandIsTimed(command))throw Error('Prépare la séquence avant de lancer cette commande.');const plan=await previewChannelOperation(this.xr,this.control,values);if(plan.token){if(this.previews.size>=100)this.previews.clear();this.previews.set(plan.token,id);}return plan;}
 async apply(id:string,token:unknown,beforeWrite:()=>void){if(typeof token!=='string'||this.previews.get(token)!==id)throw Error('Prévisualisation expirée ou connexion modifiée');const e=this.library.get(id);if(e.kind!=='console-command')throw Error('Commande enregistrée invalide.');this.previews.delete(token);beforeWrite();return this.control.apply(token);}
}
