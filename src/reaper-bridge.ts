/** Client of XR18_Studio_Bridge.lua, the script that runs inside Reaper (same file exchange as ReaCue's bridge). */
import {randomUUID} from 'node:crypto';
import {existsSync,statSync} from 'node:fs';
import {appendFile,copyFile,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Transport} from './reaper.js';

export type Take={valid?:boolean;index:number;name:string;file:string;active:boolean};
export type Item={pos:number;length:number;takes:Take[]};
export type ShowTrack={index:number;name:string;rec:boolean;role:string|null;mute:boolean;solo:boolean;armed:boolean;items:Item[]};
export type Song={title:string;start:number;countin:number;stop:number};
export const BRIDGE_VERSION='1.2.3';
export type ShowState={version:string;original?:boolean;project:string;setlist?:string;concert:string|null;songs:Song[];regions:{start:number;stop:number;name:string}[];tracks:ShowTrack[];pos:number;playing:boolean;recording:boolean;loop:{on:boolean;start:number;stop:number};length:number;audio?:{inputs:number;rate:number;device:string}};

export function reaperResources(env=process.env,platform=process.platform,home=homedir()){
 if(env.REAPER_RESOURCE_PATH)return env.REAPER_RESOURCE_PATH;
 if(platform==='darwin')return join(home,'Library','Application Support','REAPER');
 if(platform==='win32')return join(env.APPDATA??home,'REAPER');
 return join(home,'.config','REAPER');
}
export function toLua(v:unknown):string{
 if(v===null||v===undefined)return 'nil';
 if(typeof v==='boolean')return String(v);
 if(typeof v==='number')return Number.isFinite(v)?String(v):'0';
 if(typeof v==='string')return '"'+[...v].map(c=>c==='\\'?'\\\\':c==='"'?'\\"':c.charCodeAt(0)<32||c.charCodeAt(0)===127?'\\'+String(c.charCodeAt(0)).padStart(3,'0'):c).join('')+'"';
 if(Array.isArray(v))return '{'+v.map(toLua).join(',')+'}';
 return '{'+Object.entries(v as object).filter(([,x])=>x!==undefined&&x!==null).map(([k,x])=>`[${toLua(k)}]=${toLua(x)}`).join(',')+'}';
}
/** Windows briefly locks a file that the other side is reading. */
async function retry(task:()=>Promise<unknown>,tries=8){
 for(let i=0;;i++){
  try{return await task();}catch(e){
   if(i>=tries||!['EBUSY','EPERM','EACCES'].includes((e as NodeJS.ErrnoException).code??''))throw e;
   await new Promise(r=>setTimeout(r,25));
  }
 }
}
export class ReaperBridge{
 private queue:{priority:number;run:()=>Promise<void>}[]=[];
 private running=false;
 private reads=new Map<string,Promise<unknown>>();
 constructor(private resources=reaperResources(),private timeoutMs=3000){}
 private get dir(){return join(this.resources,'XR18Studio');}
 installed(){return existsSync(join(this.resources,'Scripts','XR18 Studio','XR18_Studio_Bridge.lua'));}
 alive(){
  try{return Date.now()-statSync(join(this.dir,'heartbeat.txt')).mtimeMs<8000;}catch{return false;}
 }
 async call<T=unknown>(cmd:string,args:object={}):Promise<T>{
  // Polling and waveform requests must never build an unbounded queue ahead of Rec/Stop.
  const read=(cmd==='state'||cmd==='transport')&&Object.keys(args).length===0;
  if(read&&this.reads.has(cmd))return this.reads.get(cmd) as Promise<T>;
  const next=new Promise<T>((resolve,reject)=>{
   this.queue.push({priority:cmd==='peaks'?2:cmd==='state'?1:0,run:async()=>{
    try{resolve(await this.exchange<T>(cmd,args));}catch(e){reject(e);}
   }});
  });
  if(read){this.reads.set(cmd,next);void next.finally(()=>this.reads.delete(cmd)).catch(()=>undefined);}
  void this.drain();return next;
 }
 private async drain(){
  if(this.running)return;this.running=true;
  try{while(this.queue.length){this.queue.sort((a,b)=>a.priority-b.priority);await this.queue.shift()!.run();}}
  finally{this.running=false;}
 }
 private async exchange<T>(cmd:string,args:object):Promise<T>{
  if(!this.alive())throw Error('Le pont XR18 Studio ne répond pas dans Reaper : installe-le dans Répéter, puis redémarre Reaper.');
  const id=randomUUID();
  // Versioned heartbeat negotiates isolated mailboxes. Older bridges remain readable for updating.
  const isolated=/^BandPilotBridge\/2\r?\n/.test(await readFile(join(this.dir,'heartbeat.txt'),'utf8'));
  const req=join(this.dir,isolated?`request-${id}.lua`:'request.lua'),res=join(this.dir,isolated?`response-${id}.json`:'response.json');
  await retry(()=>rm(res,{force:true}));await writeFile(req+'.tmp',toLua({id,cmd,args}));await retry(()=>rename(req+'.tmp',req));
  const end=Date.now()+this.timeoutMs;
  while(Date.now()<end){
   try{
    const data=JSON.parse(await readFile(res,'utf8'));
    if(data.id!==id&&data.id!==undefined){/* Never delete a response owned by another legacy client. */}
    else{await retry(()=>rm(res,{force:true}));if(!data.ok)throw Object.assign(Error(data.error??'Erreur du pont'),{bridge:true});return data.result as T;}
   }catch(e){if((e as {bridge?:boolean}).bridge)throw e;}
   await new Promise(r=>setTimeout(r,30));
  }
  await rm(req,{force:true}).catch(()=>undefined);
  if(isolated)await rm(res,{force:true}).catch(()=>undefined);
  throw Error('Reaper ne répond pas. Regarde s’il affiche un message.');
 }
 state(){return this.call<ShowState>('state');}
 transport(){return this.call<Transport>('transport');}
 actions(ids:number[]){return this.call('action',{ids});}
 peaks(track:number,item:number,take:number,buckets:number){return this.call<{peaks:number[]}>('peaks',{track,item,take,buckets});}
 /** Copies the script next to the others and starts it with Reaper. Nothing of ReaCue is changed. */
 async install(source=defaultScript()){
  const scripts=join(this.resources,'Scripts'),target=join(scripts,'XR18 Studio','XR18_Studio_Bridge.lua'),startup=join(scripts,'__startup.lua');
  if(!existsSync(this.resources))throw Error('Dossier de Reaper introuvable : ouvre Reaper une première fois.');
  await mkdir(dirname(target),{recursive:true});await copyFile(source,target);
  const line='dofile(reaper.GetResourcePath() .. "/Scripts/XR18 Studio/XR18_Studio_Bridge.lua") -- XR18 Studio';
  const current=existsSync(startup)?await readFile(startup,'utf8'):'';
  if(!current.includes('XR18_Studio_Bridge.lua'))await appendFile(startup,(current&&!current.endsWith('\n')?'\n':'')+line+'\n');
  return {installed:true,restartNeeded:!this.alive()};
 }
}
export function defaultScript(){
 for(const up of ['../integrations','../../integrations']){const p=fileURLToPath(new URL(up+'/XR18_Studio_Bridge.lua',import.meta.url));if(existsSync(p))return p;}
 throw Error('Script du pont introuvable dans l’application.');
}

/** ReaCue keeps « joué en live » in its setlist file and reapplies it itself: writing there keeps one truth. */
export async function saveLiveRoles(setlist:string,roles:string[]){
 const data=JSON.parse(await readFile(setlist,'utf8'));
 data.live=roles;
 const tmp=setlist+'.xr18tmp';await writeFile(tmp,JSON.stringify(data,null,2));await retry(()=>rename(tmp,setlist));
}
