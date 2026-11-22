import {MARK_ID,PROJECT_ID,TAKE_ID,TRACK_ID,type ConfiguredInput,type RehearsalAction,type RehearsalCommand,type RehearsalStatus} from '../shared/rehearsal-desk.js';
import type {ReaperBridge} from './reaper-bridge.js';

import {SheetLibrary} from './bandstudio-sheet.js';
import type {SheetFrame} from '../shared/bandstudio-sheet.js';

type SheetClock=Pick<SheetFrame,'project'|'title'|'position'|'section'|'cue'|'playing'|'loop'|'loopStart'|'loopEnd'|'rate'|'sampledAt'>&{path:string};
const invalid='Commande de répétition invalide.';
const busy='Une commande de répétition est déjà en cours.';
const commands:Record<RehearsalAction,readonly string[]>={
 guideVolume:['track','volume'],leaveLoop:[],section:['a','b','leadIn'],select:[],play:['source','take','a','b','loop','leadIn','countBars'],record:['a','b'],pause:[],stop:[],marker:['name'],save:[],setup:['original','endMarker','autoSave'],
 configuredInput:['index','name','stereo'],arm:['track','on'],input:['index','name'],seek:['position'],track:['track','on','kind'],
};
function id(value:unknown,pattern:RegExp){return typeof value==='string'&&pattern.test(value);}
export function rehearsalCommand(input:Record<string,unknown>):RehearsalCommand{
 const action=input.action as RehearsalAction;
 if(!id(input.project,PROJECT_ID)||typeof action!=='string'||!Object.hasOwn(commands,action)||
  Object.keys(input).some(k=>!['project','action',...commands[action]].includes(k)))throw Error(invalid);
 if(action==='guideVolume'&&(!id(input.track,TRACK_ID)||typeof input.volume!=='number'||!Number.isFinite(input.volume)||input.volume<0||input.volume>4))throw Error(invalid);
 if(input.countBars!==undefined&&(!Number.isInteger(input.countBars)||Number(input.countBars)<0||Number(input.countBars)>8||input.loop!==true||!input.a))throw Error(invalid);
 if(input.leadIn!==undefined&&(typeof input.leadIn!=='boolean'||!input.a||action==='play'&&input.loop!==true))throw Error(invalid);
 if(action==='play'){
  if(!['original','backing','take'].includes(input.source as string)||input.source==='take'&&!id(input.take,TAKE_ID)||
   input.source!=='take'&&input.take!==undefined||input.loop!==undefined&&typeof input.loop!=='boolean')throw Error(invalid);
 }
 if((action==='section'||input.a!==undefined||input.b!==undefined)&&(!id(input.a,MARK_ID)||!id(input.b,MARK_ID)||input.a===input.b))throw Error(invalid);
 if(input.name!==undefined&&(typeof input.name!=='string'||input.name.trim().length>64||/[\x00-\x1f\x7f]/.test(input.name)))throw Error(invalid);
 if(input.original!==undefined&&input.original!==''&&!id(input.original,TRACK_ID)||
  input.endMarker!==undefined&&input.endMarker!==''&&!id(input.endMarker,MARK_ID)||
  input.autoSave!==undefined&&typeof input.autoSave!=='boolean')throw Error(invalid);
 if((action==='arm'||action==='track')&&(!id(input.track,TRACK_ID)||typeof input.on!=='boolean')||
  action==='track'&&!['mute','solo'].includes(input.kind as string)||
  action==='configuredInput'&&(typeof input.stereo!=='boolean'||typeof input.name!=='string'||!input.name.trim())||
  (action==='input'||action==='configuredInput')&&(typeof input.index!=='number'||!Number.isInteger(input.index)||input.index<1||input.index>128)||
  action==='seek'&&(typeof input.position!=='number'||!Number.isFinite(input.position)||input.position<0||input.position>86400))throw Error(invalid);
 return {...input,...(typeof input.name==='string'?{name:input.name.trim()||(action==='marker'?'À revoir':undefined)}:{})} as RehearsalCommand;
}

type Bridge=Pick<ReaperBridge,'alive'|'supportsRehearsal'|'call'>;
export class RehearsalDesk {
 private pending=false;
 private sheets=new SheetLibrary();
 private clock?:{at:number;read:Promise<SheetClock>};
 async sheet(known:string|null,preview:boolean,isApproved:(revision:string)=>boolean):Promise<SheetFrame|null>{
  if(!this.bridge.alive()||!this.bridge.supportsRehearsal())return null;
  if(!this.clock||Date.now()-this.clock.at>75)this.clock={at:Date.now(),read:this.bridge.call<SheetClock>('rehearsal_sheet_clock')};
  const {path,...frame}=await this.clock.read;
  if(!frame.project)return null;
  const data=await this.sheets.read(path);
  const approved=!!data.source&&isApproved(data.revision);
  const useSource=!!data.source&&(preview||approved);
  const revision=data.revision+(useSource?'.source':'.export');
  return {...frame,revision,canPreview:!!data.source&&!approved,sourceApproved:approved,preview:useSource&&!approved,
   ...(revision===known?{}:{sheet:useSource?data.source:data.sheet})};
 }
 constructor(private bridge:Bridge,private blocked:()=>boolean,readonly configuredInputs:()=>Promise<ConfiguredInput[]>=async()=>[]){}
 async state(project?:string,detail=false,known?:string):Promise<RehearsalStatus>{
  if(project&&!PROJECT_ID.test(project))throw Error(invalid);
  if(!this.bridge.alive())return {bridge:'offline',tabs:[],transport:'idle'};
  if(!this.bridge.supportsRehearsal())return {bridge:'update',tabs:[],transport:'idle'};
  const result=await this.bridge.call<Omit<RehearsalStatus,'bridge'>>('rehearsal_state',{...(known&&known.length<180?{known}:{}),...(project?{project}:{}),...(detail?{detail:true}:{})});
  return {...result,bridge:'ready'};
 }
 async command(input:Record<string,unknown>,detail=false):Promise<RehearsalStatus>{
  const action=rehearsalCommand(input);
  if(this.pending)throw Error(busy);
  if(this.blocked()&&action.action!=='stop')throw Error('Termine l’Atelier du son avant de piloter la répétition.');
  if(!this.bridge.alive()||!this.bridge.supportsRehearsal())throw Error('Mets à jour le pont BandPilot et redémarre REAPER.');
  this.pending=true;
  try{
   if(action.action==='configuredInput'){
    const inputs=await this.configuredInputs();
    if(!inputs.some(t=>t.usb===action.index&&t.name===action.name&&t.stereo===action.stereo&&t.available))throw Error('Cette entrée audio est indisponible.');
   }
   const result=await this.bridge.call<Omit<RehearsalStatus,'bridge'>>('rehearsal_command',{...action,...(detail?{detail:true}:{})});
   return {...result,bridge:'ready'};
  }finally{this.pending=false;}
 }
 async peaks(project:unknown,track:unknown,item:unknown,take:unknown){
  if(!id(project,PROJECT_ID)||!id(track,TRACK_ID)||!Number.isInteger(item)||!Number.isInteger(take)||
   Number(item)<0||Number(item)>100000||Number(take)<0||Number(take)>256)throw Error(invalid);
  if(!this.bridge.alive()||!this.bridge.supportsRehearsal())throw Error('Mets à jour le pont BandPilot et redémarre REAPER.');
  return this.bridge.call<{peaks:number[]}>('rehearsal_peaks',{project,track,item,take,buckets:480});
 }
}
