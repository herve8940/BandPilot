/**
 * Reaper recording session: builds a ready-to-record project from the console state and drives
 * Reaper over local OSC. Reaper does the audio; this file never touches the console or the takes.
 * Golden rule: « recording » is only ever reported after Reaper itself confirmed it.
 */
import dgram from 'node:dgram';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,statfs,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {isAbsolute,join} from 'node:path';
import {decodeOsc,encodeOsc,type OscMessage} from './osc.js';
import {PARAMETERS,fromWire,type Value} from './parameters.js';
import type {Instrument} from './analysis.js';
import {REAPER_FX} from './reaper-fx.js';
import {SOURCES} from './sound-coach.js';

export const REAPER_LISTEN_PORT=8765;
export const REAPER_FEEDBACK_PORT=8766;
/** Reaper action numbers. Stop must save: 40668 is the variant that deletes the take. */
export const ACTION={record:1013,stopAndSave:40667,marker:40157,refreshSurfaces:41743,goToEnd:40043,saveProject:40026} as const;

export type Wire=Record<string,Value|undefined>;
export type TrackPlan={id:string;usb:number;stereo:boolean;name:string;group:string;source:string;tap:string;selected:boolean;preset:string|null;presetLabel:string;volume:number;pan:number;mute:boolean;invert:boolean;color:[number,number,number];warning?:string};
export type SessionPlan={sampleRate:number;tracks:TrackPlan[];warnings:string[]};
export type PlanInput={values:Wire;instruments:Instrument[];sampleRate:number|null;usbMode:'18x18'|'2x2'|null;simulation:boolean};

const GROUPS:Record<string,string>={kick:'Batterie',snare:'Batterie',toms:'Batterie',cymbals:'Batterie',edrums:'Batterie',voice:'Voix',backing:'Voix',bass:'Instruments',guitar:'Instruments',keys:'Instruments'};
/** Without a coach instrument, the name decides: « E-drums » is an electronic kit, never an acoustic one. */
const FAMILY_PRESET:Record<string,string>={voice:'lead-rock',backing:'backing-vocal',guitar:'electric-rhythm',bass:'bass-di',kick:'kick',snare:'snare',toms:'toms',cymbals:'overheads',keys:'keys',edrums:'drum-module'};
function presetFor(known?:Instrument){
 const id=known?.source??FAMILY_PRESET[known?.family??'']??null,source=SOURCES.find(s=>s.id===id);
 return {preset:id&&REAPER_FX[id]?id:null,presetLabel:source?.label??'Sans traitement'};
}
const GROUP_COLOR:Record<string,[number,number,number]>={Batterie:[214,84,72],Voix:[62,190,120],Instruments:[70,130,220],Autres:[140,150,165]};
/** Scribble strip colors of the X-Air family, 1-7 (8-15 are the inverted versions). */
const CONSOLE_COLOR:Record<number,[number,number,number]>={1:[220,60,60],2:[60,200,90],3:[230,200,60],4:[70,120,230],5:[210,80,210],6:[60,210,220],7:[225,225,225]};
const USB_SOURCES=PARAMETERS['/routing/usb/01/src']?.options??[];
const USB_TAPS=PARAMETERS['/routing/usb/01/pos']?.options??[];
const RAW_TAPS=new Set(['AIN','IN']);
const pad=(n:number)=>String(n).padStart(2,'0');
const num=(v:Value|undefined,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;

function pre(values:Wire,prefix:string){
 const fader=values[`${prefix}/mix/fader`];
 const db=typeof fader==='number'?Number(fromWire(`${prefix}/mix/fader`,fader)):0;
 return {
  // A fader left at -inf (blank scene, line check) must not give a session that plays back silent.
  volume:db<=-89.9?1:Math.pow(10,db/20),
  pan:Math.max(-1,Math.min(1,num(values[`${prefix}/mix/pan`],.5)*2-1)),
  mute:num(values[`${prefix}/mix/on`],1)===0,
 };
}
function tapWarning(tap:string){
 if(tap.endsWith('+M'))return `Prélèvement ${tap} : cette piste devient muette si tu coupes le canal sur la console.`;
 if(!RAW_TAPS.has(tap))return `Prélèvement ${tap} : le signal passe déjà par des traitements de la console. Choisis AIN dans Routage pour une prise brute.`;
 return undefined;
}

/** What each USB input really carries: the console's routing decides, not the channel number. */
export function planSession(input:PlanInput):SessionPlan{
 const {values,instruments,simulation}=input,warnings:string[]=[],tracks:TrackPlan[]=[];
 if(simulation)warnings.push('Mode simulation : routage USB supposé 1 pour 1, à vérifier sur la vraie console.');
 if(input.usbMode==='2x2')warnings.push('La console est en USB 2×2 : seules 2 pistes arrivent à l’ordinateur. Passe-la en 18×18 avant d’enregistrer.');
 if(input.usbMode===null&&!simulation)warnings.push('Mode USB de la console non lu : vérifie qu’elle est bien en 18×18.');
 if(input.sampleRate===null)warnings.push('Fréquence de la console non lue : session créée en 48 kHz, vérifie qu’elle correspond.');
 const sampleRate=input.sampleRate??48000;
 const sourceOf=(usb:number)=>USB_SOURCES[num(values[`/routing/usb/${pad(usb)}/src`],usb-1)]??'';
 const tapOf=(usb:number)=>USB_TAPS[num(values[`/routing/usb/${pad(usb)}/pos`],0)]??'AIN';
 for(let usb=1;usb<=18;usb++){
  const source=sourceOf(usb),tap=tapOf(usb),next=usb<18?sourceOf(usb+1):'',channel=/^Ch(\d\d)$/.exec(source);
  let track:TrackPlan;
  if(channel){
   const n=Number(channel[1]),odd=n%2===1?n:n-1,linked=num(values[`/config/chlink/${odd}-${odd+1}`],0)===1;
   const stereo=linked&&n===odd&&next===`Ch${pad(n+1)}`,known=instruments.find(i=>i.channel===n);
   const prefix=`/ch/${pad(n)}`,name=String(values[`${prefix}/config/name`]??'').trim()||known?.name||`Canal ${n}`;
   // A channel set to USB plays a source from the computer (backing track): it is no instrument family.
   const fromComputer=num(values[`${prefix}/preamp/rtnsw`],0)===1,group=fromComputer?'Autres':GROUPS[known?.family??'']??'Autres';
   const color=CONSOLE_COLOR[num(values[`${prefix}/config/color`],0)&7]??GROUP_COLOR[group]!;
   // AIN is the physical socket, before the channel's source switch: it stays silent for a computer source.
   const warnings=[fromComputer?(tap==='AIN'?`Ce canal joue le son de l’ordinateur. En AIN, la piste sera vide : dans Routage, passe USB ${usb} sur IN.`:tap==='IN'?undefined:tapWarning(tap)):tapWarning(tap)];
   if(linked&&!stereo&&n===odd)warnings.push(`Canaux ${n}-${n+1} couplés mais pas sur deux entrées USB voisines : piste mono.`);
   track={id:`usb${usb}`,usb,stereo,name,group,source,tap,selected:!!known,...presetFor(known),...pre(values,prefix),invert:num(values[`${prefix}/preamp/invert`],0)===1,color,warning:warnings.filter(Boolean).join(' ')||undefined};
  }else{
   const aux=source==='AuxL',stereo=(aux&&next==='AuxR')||(source==='L'&&next==='R');
   const custom=String(values['/rtn/aux/config/name']??'').trim();
   const name=aux?custom||'Aux':source==='L'?'Mix L/R':source||`USB ${usb}`;
   const mix=aux?pre(values,'/rtn/aux'):{volume:1,pan:0,mute:false};
   track={id:`usb${usb}`,usb,stereo,name,group:'Autres',source,tap,selected:aux&&!!custom&&custom.toLowerCase()!=='aux',preset:null,presetLabel:'Sans traitement',...mix,invert:false,color:GROUP_COLOR.Autres!};
  }
  tracks.push(track);if(track.stereo)usb++;
 }
 return {sampleRate,tracks,warnings};
}

function quoted(text:string){
 const clean=text.replace(/[\x00-\x1f\x7f]/g,' ');
 if(!clean.includes('"'))return `"${clean}"`;
 if(!clean.includes("'"))return `'${clean}'`;
 return clean.includes('`')?`\`${clean.replaceAll('`',"'")}\``:`\`${clean}\``;
}
/** PEAKCOL is r | g<<8 | b<<16 plus a « custom color » flag; checked in Reaper 7.83 on macOS. */
function nativeColor([r,g,b]:[number,number,number]){
 return ((b<<16)|(g<<8)|r|0x1000000)>>>0;
}
const figure=(v:number)=>String(Number(v.toFixed(6)));
function fxChain(preset:string|null,platform:string){
 const chain=preset?REAPER_FX[preset]:undefined;if(!chain)return [];
 const library=platform==='win32'?'.dll':platform==='linux'?'.vst.so':'.vst.dylib';
 return chain.replaceAll('.vst.dylib',library).replace(/FXID \{[^}]*\}/g,()=>`FXID {${randomUUID().toUpperCase()}}`).split('\n').map(line=>'    '+line);
}
function trackLines(t:TrackPlan,platform:string){
 return [`  <TRACK {${randomUUID().toUpperCase()}}`,`    NAME ${quoted(t.name)}`,`    PEAKCOL ${nativeColor(t.color)}`,`    VOLPAN ${figure(t.volume)} ${figure(t.pan)} -1 -1 1`,`    MUTESOLO ${t.mute?1:0} 0 0`,`    IPHASE ${t.invert?1:0}`,'    ISBUS 0 0','    NCHAN 2',`    REC 1 ${(t.usb-1)+(t.stereo?1024:0)} 0 0 0 0 0`,...fxChain(t.preset,platform),'  >'];
}
/** Flat track list in USB order, 24-bit WAV takes, monitoring off (the band hears the console), takes in Audio/. FX only act on playback. */
export function renderRpp(plan:SessionPlan,now=Date.now(),platform:string=process.platform){
 const lines=[`<REAPER_PROJECT 0.1 "7.0" ${Math.floor(now/1000)} 0`,`  SAMPLERATE ${plan.sampleRate} 1 0`,'  RECORD_PATH "Audio" ""','  <RECORD_CFG','    ZXZhdxgAAQ==','  >'];
 for(const t of plan.tracks)if(t.selected)lines.push(...trackLines(t,platform));
 lines.push('>','');
 return lines.join('\n');
}

export const defaultSessionsFolder=()=>join(homedir(),'Documents','XR18 Studio','Sessions Reaper');
export function safeName(name:unknown){
 const clean=String(name??'').replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g,' ').replace(/\s+/g,' ').replace(/^[.\s]+/,'').slice(0,60).trim();
 return clean||'Répétition';
}
const bytesPerSecond=(plan:SessionPlan)=>plan.sampleRate*3*plan.tracks.filter(t=>t.selected).reduce((n,t)=>n+(t.stereo?2:1),0);
export async function freeHours(folder:string,plan:SessionPlan){
 try{const s=await statfs(folder),rate=bytesPerSecond(plan);return rate?Math.round(Number(s.bavail)*Number(s.bsize)/rate/360)/10:null;}catch{return null;}
}
/** Never overwrites: an existing session keeps its takes, a new folder is made beside it. */
export async function createSession(plan:SessionPlan,options:{name?:unknown;folder?:unknown}={}){
 if(!plan.tracks.some(t=>t.selected))throw Error('Choisis au moins une piste à enregistrer.');
 const parent=String(options.folder??'').trim()||defaultSessionsFolder();
 if(!isAbsolute(parent))throw Error('Dossier de session invalide : indique un chemin complet.');
 const name=`${safeName(options.name)} ${new Date().toISOString().slice(0,10)}`;
 await mkdir(parent,{recursive:true});
 for(let attempt=1;attempt<100;attempt++){
  const title=attempt===1?name:`${name} (${attempt})`,folder=join(parent,title);
  try{await mkdir(folder);}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')continue;throw e;}
  await mkdir(join(folder,'Audio'));
  const file=join(folder,`${title}.rpp`);
  await writeFile(file,renderRpp(plan),{flag:'wx'});
  return {title,folder,file,hoursFree:await freeHours(folder,plan)};
 }
 throw Error('Trop de sessions portent ce nom aujourd’hui.');
}
export function openInReaper(file:string,platform:string=process.platform,run:typeof execFile=execFile){
 return new Promise<void>((resolve,reject)=>{
  const fail=()=>reject(Error('Impossible d’ouvrir Reaper automatiquement : ouvre le fichier de session à la main.'));
  const done=(fallback?:()=>void)=>(error:Error|null)=>error?(fallback?fallback():fail()):resolve();
  if(platform==='darwin')run('open',['-a','REAPER',file],done(()=>run('open',[file],done())));
  else if(platform==='win32')run('rundll32',['url.dll,FileProtocolHandler',file],done());
  else run('xdg-open',[file],done());
 });
}

export function readOsc(packet:Buffer):OscMessage[]{
 if(packet.subarray(0,8).toString('latin1')!=='#bundle\0')return [decodeOsc(packet)];
 const out:OscMessage[]=[];
 for(let pos=16;pos+4<=packet.length;){
  const size=packet.readInt32BE(pos);pos+=4;
  if(size<=0||pos+size>packet.length)throw Error('Paquet OSC invalide');
  out.push(...readOsc(packet.subarray(pos,pos+size)));pos+=size;
 }
 return out;
}

export type ReaperState='offline'|'ready'|'starting'|'recording'|'stopping'|'lost';
export type ReaperTimings={pollMs:number;silenceMs:number;confirmMs:number;stoppedClockMs:number};
const TIMINGS:ReaperTimings={pollMs:1000,silenceMs:4000,confirmMs:6000,stoppedClockMs:3000};
/** Everything shown to the user comes from what Reaper sends back, never from what was asked. */
export class ReaperLink{
 private socket?:dgram.Socket;
 private timer?:NodeJS.Timeout;
 private listening?:Promise<void>;
 private lastSeen=0;private recordFlag=false;private clock=0;private clockMovedAt=0;
 private recordingSince=0;private wasRecording=false;private stopRequested=false;private markers=0;
 private alert='';
 session:{title:string;file:string;folder:string;hoursFree:number|null;tracks:number}|null=null;
 constructor(private ports={listen:REAPER_LISTEN_PORT,feedback:REAPER_FEEDBACK_PORT},private timing:ReaperTimings=TIMINGS){}
 async watch(){
  this.listening??=new Promise<void>((resolve,reject)=>{
   const socket=dgram.createSocket('udp4');
   socket.once('error',e=>{this.listening=undefined;reject(Error(`Port ${this.ports.feedback} indisponible pour écouter Reaper : ${e.message}`));});
   socket.on('message',packet=>this.receive(packet));
   socket.bind(this.ports.feedback,'127.0.0.1',()=>{socket.removeAllListeners('error');socket.on('error',()=>undefined);this.socket=socket;
    this.timer=setInterval(()=>this.tick(),this.timing.pollMs);this.timer.unref();this.action(ACTION.refreshSurfaces);resolve();});
  });
  return this.listening;
 }
 close(){clearInterval(this.timer);this.socket?.close();this.socket=undefined;this.listening=undefined;}
 private action(id:number){this.socket?.send(encodeOsc(`/action/${id}`),this.ports.listen,'127.0.0.1');}
 private silent(now=Date.now()){return now-this.lastSeen>=this.timing.silenceMs;}
 private clockRunning(now=Date.now()){return this.clockMovedAt>0&&now-this.clockMovedAt<this.timing.stoppedClockMs;}
 private tick(){
  const now=Date.now();
  if(now-this.lastSeen>=this.timing.pollMs)this.action(ACTION.refreshSurfaces);
  const state=this.state(now);
  if(state==='lost'&&!this.alert)this.alert='Reaper ne répond plus pendant la prise. Regarde dans Reaper si l’enregistrement continue.';
  if(state==='recording'){this.wasRecording=true;if(this.alert.startsWith('Reaper ne répond plus'))this.alert='';}
 }
 private receive(packet:Buffer){
  this.lastSeen=Date.now();
  let messages:OscMessage[];try{messages=readOsc(packet);}catch{return;}
  for(const m of messages){
   const value=Number(m.args[0]);
   if(m.address==='/record'){
    const on=value>=.5;
    if(!on&&this.recordFlag){
     if(this.wasRecording&&!this.stopRequested){this.alert='Enregistrement arrêté depuis Reaper. Enregistre le projet dans Reaper pour garder la prise.';}
     this.recordFlag=false;this.wasRecording=false;this.recordingSince=0;this.clockMovedAt=0;
    }else if(on&&!this.recordFlag){this.recordFlag=true;this.clockMovedAt=0;this.stopRequested=false;this.alert='';this.markers=0;}
   }else if(m.address==='/time'&&Number.isFinite(value)){
    if(this.recordFlag&&value!==this.clock){this.clockMovedAt=Date.now();this.recordingSince||=Date.now();this.wasRecording=true;}
    this.clock=value;
   }
  }
 }
 state(now=Date.now()):ReaperState{
  if(!this.socket||this.lastSeen===0)return 'offline';
  if(this.silent(now))return this.recordFlag?'lost':'offline';
  if(!this.recordFlag)return 'ready';
  if(this.stopRequested)return 'stopping';
  return this.clockRunning(now)?'recording':'starting';
 }
 status(){
  const state=this.state();
  return {state,recording:state==='recording',elapsed:state==='recording'&&this.recordingSince?Math.floor((Date.now()-this.recordingSince)/1000):0,markers:this.markers,alert:this.alert,session:this.session,ports:this.ports};
 }
 private async until(ok:()=>boolean){
  const end=Date.now()+this.timing.confirmMs;
  while(Date.now()<end){if(ok())return true;await new Promise(r=>setTimeout(r,25));}
  return ok();
 }
 async record(){
  await this.watch();
  if(this.state()==='recording')return this.status();
  this.action(ACTION.refreshSurfaces);
  if(!await this.until(()=>this.state()!=='offline'))throw Error('Reaper ne répond pas : ouvre-le et vérifie le réglage OSC. Rien n’est enregistré.');
  // After the last take: from the cursor, Reaper would stack the new take on the previous one.
  this.alert='';this.action(ACTION.goToEnd);this.action(ACTION.record);
  if(!await this.until(()=>this.state()==='recording')){
   const claimed=this.recordFlag;
   this.alert=claimed?'Reaper annonce Rec mais son compteur n’avance pas. Regarde dans Reaper.':'Reaper n’a pas lancé l’enregistrement. Rien n’est enregistré.';
   throw Error(this.alert);
  }
  return this.status();
 }
 async stop(){
  await this.watch();
  if(!this.recordFlag)return this.status();
  this.stopRequested=true;this.action(ACTION.stopAndSave);
  if(!await this.until(()=>!this.recordFlag)){this.stopRequested=false;throw Error('Reaper n’a pas confirmé l’arrêt : arrête-le directement dans Reaper.');}
  // Without this the takes are only in Reaper's memory: a crash would leave WAV files outside the project.
  this.stopRequested=false;this.alert='';this.action(ACTION.saveProject);
  return this.status();
 }
 dismissAlert(){this.alert='';return this.status();}
 marker(){
  if(this.state()!=='recording')throw Error('Marqueur disponible seulement pendant un enregistrement confirmé.');
  this.action(ACTION.marker);this.markers++;
  return this.status();
 }
}
