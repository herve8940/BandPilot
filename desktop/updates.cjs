const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {execFile,spawn}=require('node:child_process');
const {promisify}=require('node:util');
const {checkUpdate}=require('./github-support.cjs');
const exec=promisify(execFile);
const MAX_SIZE=1024*1024*1024;

function downloadHost(url){
 const u=new URL(url);
 return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname);
}
async function download(asset,destination,{fetcher=fetch,signal,onProgress=()=>{}}={}){
 if(!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>MAX_SIZE||! /^[a-f0-9]{64}$/.test(asset.sha256)||!asset.url.startsWith('https://github.com/herve8940/BandPilot/releases/download/'))throw Error('Invalid update asset');
 let url=asset.url,response;
 const timeout=AbortSignal.timeout(15*60*1000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 for(let redirects=0;redirects<=5;redirects++){
  if(!downloadHost(url))throw Error('Untrusted update host');
  response=await fetcher(url,{redirect:'manual',signal:combined});
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get('location');await response.body?.cancel();
   if(!location)throw Error('Invalid update redirect');url=new URL(location,url).href;continue;
  }
  break;
 }
 if(!response?.ok||!response.body)throw Error('Update download failed');
 const partial=destination+'.part',hash=createHash('sha256');let size=0;
 const file=await fsp.open(partial,'wx',0o600);
 try{
  for await(const chunk of response.body){
   combined.throwIfAborted();size+=chunk.length;if(size>asset.size)throw Error('Update exceeds declared size');
   hash.update(chunk);await file.writeFile(chunk);onProgress(Math.floor(size*100/asset.size));
  }
  if(size!==asset.size||hash.digest('hex')!==asset.sha256)throw Error('Update checksum mismatch');
  await file.sync();await file.close();await fsp.rename(partial,destination);
 }catch(error){await file.close().catch(()=>{});await fsp.rm(partial,{force:true});throw error;}
}
async function digest(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
function targetFor(app,platform,env){
 if(!app.isPackaged)return null;
 if(platform==='darwin'){
  const target=path.resolve(app.getAppPath(),'../../..');
  // Updates must never target a mounted installer, App Translocation or a symlink.
  if(!target.endsWith('.app')||target.startsWith('/Volumes/')||target.includes('/AppTranslocation/'))return null;
  return target;
 }
 if(platform==='linux')return env.APPIMAGE?path.resolve(env.APPIMAGE):null;
 if(platform==='win32')return path.dirname(app.getPath('exe'));
 return null;
}
async function prepareInstall({app,platform,env=process.env,downloaded,version,directory}){
 const target=targetFor(app,platform,env);if(!target)throw Error('Manual installation required');
 const stat=await fsp.lstat(target);if(stat.isSymbolicLink())throw Error('Manual installation required');
 await fsp.access(platform==='win32'?target:path.dirname(target),fs.constants.W_OK);
 if(platform==='win32')return {kind:'nsis',target,downloaded,sha256:await digest(downloaded)};
 const staged=path.join(path.dirname(target),`.bandpilot-update-${randomUUID()}${platform==='darwin'?'.app':'.AppImage'}`);
 try{
  if(platform==='darwin'){
   const unpack=await fsp.mkdtemp(path.join(directory,'unpack-'));
   try{
    // Validate entry paths before ditto expands the trusted, hash-checked ZIP.
    const entries=(await exec('/usr/bin/unzip',['-Z1',downloaded],{maxBuffer:16*1024*1024})).stdout.split('\n').filter(Boolean);
    if(entries.some(entry=>entry.startsWith('/')||entry.split('/').includes('..')||(!entry.startsWith('BandPilot.app/')&&!entry.startsWith('__MACOSX/'))))throw Error('Invalid application archive');
    await exec('/usr/bin/ditto',['-x','-k',downloaded,unpack]);
    const bundle=path.join(unpack,'BandPilot.app'),plist=path.join(bundle,'Contents/Info.plist');
    const read=async key=>(await exec('/usr/libexec/PlistBuddy',['-c',`Print :${key}`,plist])).stdout.trim();
    if(await read('CFBundleIdentifier')!=='be.xr18.studio'||await read('CFBundleShortVersionString')!==version||await read('CFBundleExecutable')!=='BandPilot')throw Error('Unexpected application identity');
    await exec('/usr/bin/codesign',['--verify','--deep','--strict',bundle]);
    await exec('/usr/bin/ditto',[bundle,staged]);
    await exec('/usr/bin/codesign',['--verify','--deep','--strict',staged]);
   }finally{await fsp.rm(unpack,{recursive:true,force:true});}
  }else{
   await fsp.copyFile(downloaded,staged,fs.constants.COPYFILE_EXCL);await fsp.chmod(staged,0o755);
  }
  return {kind:platform,target,staged,identity:String(stat.ino),backup:target+`.previous-${randomUUID()}`,marker:path.join(directory,'installed'),downloaded,sha256:await digest(downloaded)};
 }catch(error){await fsp.rm(staged,{recursive:true,force:true});throw error;}
}
async function launchInstall(plan,directory){
 if(await digest(plan.downloaded)!==plan.sha256)throw Error('Cached update checksum mismatch');
 if(plan.kind==='nsis'){
  // /D must be last; spawn passes the path as an argument, never through cmd.exe.
  return detached(plan.downloaded,['/S','--updated',`/D=${plan.target}`]);
 }
 const helper=path.join(directory,'install-update.sh');
 // readFile also works when this script lives inside Electron's app.asar.
 await fsp.writeFile(helper,await fsp.readFile(path.join(__dirname,'install-update.sh')),{mode:0o700});
 return detached('/bin/sh',[helper,String(process.pid),plan.staged,plan.target,plan.backup,plan.identity,plan.marker]);
}
function detached(command,args){return new Promise((resolve,reject)=>{const child=spawn(command,args,{detached:true,stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});}

function createUpdates({app,dataPath,smoke=false,platform=process.platform,arch=process.arch,env=process.env,notify=()=>{},diagnostic=()=>{},fetcher=fetch,prepare=prepareInstall,install=launchInstall,downloadFile=download}){
 const directory=path.join(dataPath,'updates'),preference=path.join(dataPath,'updates.json'),receipt=path.join(directory,'install.json');
 let automatic=true;try{const saved=JSON.parse(fs.readFileSync(preference,'utf8'));if(typeof saved.automatic==='boolean')automatic=saved.automatic;}catch{}
 let state={available:false,current:app.getVersion(),automaticEnabled:automatic,phase:'idle'},checking,downloading,controller,plan,quitting=false,lastCheck=0;
 const enabled=!smoke&&!!app.isPackaged;
 const markSuccessfulStart=async()=>{
  if(!enabled)return;
  try{
   const previous=JSON.parse(await fsp.readFile(receipt,'utf8'));
   const target=targetFor(app,platform,env);
   if(previous.version===app.getVersion()&&previous.target===target){
    if(typeof previous.backup==='string'&&previous.backup.startsWith(target+'.previous-')&&/^[a-f0-9-]{36}$/.test(previous.backup.slice((target+'.previous-').length)))await fsp.rm(previous.backup,{recursive:true,force:true});
    await fsp.rm(receipt,{force:true});
   }
  }catch(error){if(error.code!=='ENOENT')diagnostic('desktop.update_cleanup_error',{message:String(error)});}
  // Partial or old downloads are never executed after restarting the application.
  try{for(const name of await fsp.readdir(directory)){
   if(!/^[a-f0-9-]{36}-BandPilot-/.test(name))continue;
   const file=path.join(directory,name);
   if(Date.now()-(await fsp.stat(file)).mtimeMs>7*24*60*60*1000)await fsp.rm(file,{force:true});
  }}catch(error){if(error.code!=='ENOENT')diagnostic('desktop.update_cleanup_error',{message:String(error)});}
 };
 const snapshot=()=>({...state,automaticEnabled:automatic});
 const emit=patch=>{state={...state,...patch};notify(snapshot());return snapshot();};
 const discard=async()=>{if(plan?.staged)await fsp.rm(plan.staged,{recursive:true,force:true});plan=null;};
 const stage=()=>{
  if(downloading)return downloading;
  if(!state.available||!state.automatic||!enabled)return Promise.resolve(snapshot());
  controller=new AbortController();
  downloading=(async()=>{
   await fsp.mkdir(directory,{recursive:true,mode:0o700});
   const downloaded=path.join(directory,`${randomUUID()}-${state.automatic.name}`);
   try{
    emit({phase:'downloading',progress:0,updateError:false});
    await downloadFile(state.automatic,downloaded,{fetcher,signal:controller.signal,onProgress:progress=>{if(progress!==state.progress)emit({progress});}});
    controller.signal.throwIfAborted();
    const prepared=await prepare({app,platform,env,downloaded,version:state.version,directory});
    plan=prepared;
    if(controller.signal.aborted){await discard();return emit({phase:'available'});}
    return emit({phase:'ready',progress:100});
   }catch(error){
    if(controller.signal.aborted)return emit({phase:'available'});
    diagnostic('desktop.update_error',{message:String(error)});return emit({phase:'error',updateError:true});
   }finally{if(!plan)await fsp.rm(downloaded,{force:true});downloading=null;}
  })();return downloading;
 };
 const check=async(force=false)=>{
  if(!enabled)return snapshot();
  if(checking)return checking;
  if(downloading||state.phase==='ready')return snapshot();
  if(!force&&Date.now()-lastCheck<60*60*1000)return snapshot();
  checking=(async()=>{
   try{
    const result=await checkUpdate(fetcher,app.getVersion(),platform,arch,{appImage:!!env.APPIMAGE});
    lastCheck=Date.now();emit({...result,phase:result.available?'available':'idle',updateError:false});
    if(automatic&&result.automatic)void stage();
    return snapshot();
   }catch(error){diagnostic('desktop.update_check_error',{message:String(error)});return emit({updateError:true});}
   finally{checking=null;}
  })();return checking;
 };
 const setAutomatic=async value=>{
  if(typeof value!=='boolean')throw Error('Invalid update preference');
  await fsp.mkdir(dataPath,{recursive:true});await fsp.writeFile(preference+'.tmp',JSON.stringify({automatic:value}),{mode:0o600});await fsp.rename(preference+'.tmp',preference);
  automatic=value;
  if(!value){controller?.abort();if(downloading)await downloading;await discard();emit({phase:state.available?'available':'idle'});}
  else{emit({});await check(true);if(state.available&&state.phase!=='ready')void stage();}
  return snapshot();
 };
 // Installation runs only on an ordinary application quit, never on download.
 const onQuit=event=>{
  if(quitting||!automatic||!plan)return;
  event.preventDefault();quitting=true;
  void (async()=>{
   await fsp.writeFile(receipt,JSON.stringify({version:state.version,target:plan.target,backup:plan.backup}),{mode:0o600});
   await install(plan,directory);
  })().catch(error=>diagnostic('desktop.update_install_error',{message:String(error)})).finally(()=>app.quit());
 };
 if(enabled)app.on('before-quit',onQuit);
 const timer=enabled?setInterval(()=>void check(),60*60*1000):null;timer?.unref();
 return {check,snapshot,setAutomatic,markSuccessfulStart,download:stage,dispose(){if(timer)clearInterval(timer);controller?.abort();if(enabled)app.off('before-quit',onQuit);}};
}
module.exports={createUpdates,download,downloadHost,prepareInstall,targetFor,launchInstall};
