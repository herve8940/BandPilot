import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';

/**
 * Anonymous usage counter, limited to audience measurement:
 * at most one message per day with a random installation number, the version,
 * the platform and the mixer model. Nothing else ever leaves the device.
 * It is on by default but sends nothing until the user has seen the notice,
 * and it can be switched off at any time (the random number is then erased).
 */
export interface UsagePrefs {enabled:boolean;noticeSeen:boolean;id?:string;lastSent?:string}
export interface UsageReport {schema:1;id:string;day:string;version:string;platform:string;channel:'release'|'source';model:string}
export interface UsageSnapshot {available:boolean;enabled:boolean;noticeSeen:boolean}
export interface UsageOptions {
 endpoint?:string;version:string;build:string;platform:string;disabled?:boolean;
 fetch?:typeof fetch;now?:()=>Date;
}

const DEFAULTS:UsagePrefs={enabled:true,noticeSeen:false};

export function usagePlatform(env:NodeJS.ProcessEnv=process.env,platform:NodeJS.Platform=process.platform){
 if(env.BANDPILOT_ANDROID==='1')return 'android';
 return platform==='win32'?'windows':platform==='darwin'?'macos':platform==='linux'?'linux':'other';
}
/** Only a plain HTTPS address without credentials is accepted. */
export function usageEndpoint(value:unknown):string|undefined{
 if(typeof value!=='string'||!value.trim())return undefined;
 try{const url=new URL(value.trim());return url.protocol==='https:'&&!url.username&&!url.password?url.toString():undefined;}catch{return undefined;}
}
/** Automated runs (CI, tests) and an explicit BANDPILOT_USAGE_STATS=0 never count. */
export function usageDisabledByEnvironment(env:NodeJS.ProcessEnv=process.env){
 return env.BANDPILOT_USAGE_STATS==='0'||env.CI==='true'||env.NODE_ENV==='test';
}
function prefs(value:unknown):UsagePrefs{
 if(!value||typeof value!=='object')return {...DEFAULTS};
 const d=value as Record<string,unknown>;
 return {
  enabled:typeof d.enabled==='boolean'?d.enabled:true,
  noticeSeen:d.noticeSeen===true,
  ...(typeof d.id==='string'&&/^[0-9a-f-]{36}$/.test(d.id)?{id:d.id}:{}),
  ...(typeof d.lastSent==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.lastSent)?{lastSent:d.lastSent}:{}),
 };
}
const MODEL=/^[A-Za-z0-9 _.-]{1,24}$/;

export class UsageStats {
 private state:UsagePrefs={...DEFAULTS};
 private loaded=false;
 private sending:Promise<string>|undefined;
 private timers:NodeJS.Timeout[]=[];
 private readonly endpoint:string|undefined;
 constructor(private path:string,private options:UsageOptions){this.endpoint=options.disabled?undefined:usageEndpoint(options.endpoint);}
 get available(){return !!this.endpoint;}
 async load(){
  if(this.loaded)return this.state;
  try{this.state=prefs(JSON.parse(await readFile(this.path,'utf8')));}catch{this.state={...DEFAULTS};}
  this.loaded=true;return this.state;
 }
 async snapshot():Promise<UsageSnapshot>{
  const s=await this.load();
  return {available:this.available,enabled:s.enabled,noticeSeen:s.noticeSeen};
 }
 async update(value:unknown):Promise<UsageSnapshot>{
  if(!value||typeof value!=='object')throw Error('Préférence invalide');
  const d=value as Record<string,unknown>;
  if(d.enabled!==undefined&&typeof d.enabled!=='boolean')throw Error('Préférence invalide');
  if(d.noticeSeen!==undefined&&d.noticeSeen!==true)throw Error('Préférence invalide');
  const s=await this.load();
  if(d.noticeSeen===true)s.noticeSeen=true;
  if(d.enabled===false){s.enabled=false;delete s.id;delete s.lastSent;}
  else if(d.enabled===true)s.enabled=true;
  await this.save();
  return this.snapshot();
 }
 /** Sends today's message once; never throws and never blocks the application. */
 send(model:string):Promise<string>{
  this.sending??=this.sendOnce(model).finally(()=>{this.sending=undefined;});
  return this.sending;
 }
 private async sendOnce(model:string){
  const s=await this.load();
  if(!this.endpoint)return 'unavailable';
  if(!s.enabled)return 'disabled';
  if(!s.noticeSeen)return 'waiting-notice';
  const day=(this.options.now?.()??new Date()).toISOString().slice(0,10);
  if(s.lastSent===day)return 'already-sent';
  if(!s.id){s.id=randomUUID();await this.save();}
  const report:UsageReport={schema:1,id:s.id,day,version:this.options.version.slice(0,32),platform:this.options.platform,
   channel:this.options.build==='source'?'source':'release',model:MODEL.test(model)?model:'other'};
  try{
   const response=await (this.options.fetch??fetch)(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report),signal:AbortSignal.timeout(5000)});
   if(!response.ok)return 'failed';
  }catch{return 'failed';}
  if(!s.enabled)return 'disabled';
  s.lastSent=day;await this.save();
  return 'sent';
 }
 /** First attempt after a minute (to know the mixer model), then a check every six hours. */
 start(model:()=>string){
  if(!this.endpoint)return;
  const run=()=>{void this.send(model());};
  const first=setTimeout(run,60_000);first.unref();
  const repeat=setInterval(run,6*60*60_000);repeat.unref();
  this.timers.push(first,repeat);
 }
 close(){for(const timer of this.timers)clearTimeout(timer);this.timers=[];}
 private async save(){
  await mkdir(dirname(this.path),{recursive:true});
  await writeFile(this.path+'.tmp',JSON.stringify(this.state,null,2),{mode:0o600});await rename(this.path+'.tmp',this.path);
 }
}
