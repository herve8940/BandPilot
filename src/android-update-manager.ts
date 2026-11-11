import {createHash} from 'node:crypto';
import {createReadStream,readFileSync} from 'node:fs';
import {mkdir,open,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {androidUpdate,type AndroidRelease} from './android-updates.js';
import {diagnostic} from './diagnostics.js';
type State=AndroidRelease&{automaticEnabled:boolean;phase:'idle'|'available'|'downloading'|'ready'|'error';progress?:number;updateError?:boolean};
const trustedDownload=(url:string)=>{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname);};
async function digest(file:string){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
/** Private APK staging only. Installation is always an explicit native Android action. */
export class AndroidUpdates {
 private state:State;private checking?:Promise<State>;private downloading?:Promise<State>;private controller?:AbortController;private checkedAt=0;
 constructor(private directory:string,private current:string,private fetcher=fetch){
  let automatic=false;try{automatic=JSON.parse(readFileSync(join(directory,'preferences.json'),'utf8')).automatic===true;}catch{}
  this.state={current,available:false,automaticEnabled:automatic,phase:'idle'};
 }
 snapshot():State{return structuredClone(this.state);}
 async check(force=false):Promise<State>{
  if(this.checking)return this.checking;
  if(this.downloading||(!force&&this.checkedAt&&Date.now()-this.checkedAt<6*3600000))return this.snapshot();
  this.checking=(async()=>{
   try{
    const release=await androidUpdate(this.current,this.fetcher);this.checkedAt=Date.now();
    this.state={...release,automaticEnabled:this.state.automaticEnabled,phase:release.available?'available':'idle'};
    if(release.automatic){
     const apk=join(this.directory,'update.apk');
     try{if((await stat(apk)).size===release.automatic.size&&await digest(apk)===release.automatic.sha256){await this.saveMetadata();this.state.phase='ready';}}catch{}
     if(this.state.automaticEnabled&&this.state.phase!=='ready')void this.stage();
    }else if(!release.available){await rm(join(this.directory,'update.apk'),{force:true});await rm(join(this.directory,'ready.json'),{force:true});}
    diagnostic('android.update_check',{available:release.available,version:release.version});
   }catch{this.checkedAt=Date.now();this.state.updateError=true;diagnostic('android.update_check_error');}
   return this.snapshot();
  })().finally(()=>{this.checking=undefined;});return this.checking;
 }
 async setAutomatic(value:unknown){
  if(typeof value!=='boolean')throw Error('Préférence de mise à jour invalide.');
  await mkdir(this.directory,{recursive:true,mode:0o700});
  await writeFile(join(this.directory,'preferences.tmp'),JSON.stringify({automatic:value}),{mode:0o600});await rename(join(this.directory,'preferences.tmp'),join(this.directory,'preferences.json'));
  this.state.automaticEnabled=value;
  if(!value)this.controller?.abort();
  else if(this.state.available&&this.state.automatic&&this.state.phase!=='ready')void this.stage();
  diagnostic('android.update_preference',{enabled:value});return this.snapshot();
 }
 private async saveMetadata(){await mkdir(this.directory,{recursive:true,mode:0o700});await writeFile(join(this.directory,'ready.tmp'),JSON.stringify({version:this.state.version,...this.state.automatic}),{mode:0o600});await rename(join(this.directory,'ready.tmp'),join(this.directory,'ready.json'));}
 stage():Promise<State>{
  if(this.downloading)return this.downloading;
  const asset=this.state.automatic;if(!this.state.available||!asset)throw Error('Téléchargement vérifié indisponible.');
  if(this.state.phase==='ready')return Promise.resolve(this.snapshot());
  this.controller=new AbortController();const controller=this.controller;
  const timeout=setTimeout(()=>controller.abort(),10*60_000);timeout.unref();
  this.state={...this.state,phase:'downloading',progress:0,updateError:false};
  this.downloading=(async()=>{
   const temporary=join(this.directory,'update.part');let file:Awaited<ReturnType<typeof open>>|undefined;
   try{
    await mkdir(this.directory,{recursive:true,mode:0o700});let url=asset.url,response:Response|undefined;
    for(let redirects=0;redirects<=5;redirects++){
     if(!trustedDownload(url))throw Error('Source APK refusée.');
     response=await this.fetcher(url,{redirect:'manual',signal:controller.signal});
     if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Redirection invalide.');url=new URL(location,url).href;continue;}break;
    }
    if(!response?.ok||!response.body)throw Error('Téléchargement indisponible.');
    file=await open(temporary,'w',0o600);const hash=createHash('sha256');let bytes=0;
    for await(const chunk of response.body as unknown as AsyncIterable<Uint8Array>){
     if(controller.signal.aborted)throw Error('Téléchargement annulé.');bytes+=chunk.length;if(bytes>asset.size)throw Error('Taille APK invalide.');hash.update(chunk);await file.writeFile(chunk);this.state.progress=Math.floor(bytes*100/asset.size);
    }
    if(controller.signal.aborted||bytes!==asset.size||hash.digest('hex')!==asset.sha256)throw Error('Vérification APK échouée.');
    await file.sync();await file.close();file=undefined;
    await rename(temporary,join(this.directory,'update.apk'));await this.saveMetadata();this.state.phase='ready';diagnostic('android.update_ready',{version:this.state.version});
   }catch{this.state.phase=controller.signal.aborted&&!this.state.automaticEnabled?'available':'error';this.state.updateError=this.state.phase==='error';diagnostic('android.update_download_end',{phase:this.state.phase});}
   finally{clearTimeout(timeout);await file?.close();await rm(temporary,{force:true}).catch(()=>{});this.controller=undefined;this.downloading=undefined;}
   return this.snapshot();
  })();return this.downloading;
 }
}
