import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,rm,stat,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const require=createRequire(import.meta.url);
const {newer,parseVersion}=require('../desktop/versions.cjs');
const {planRelease}=require('../scripts/release-version.cjs');
const {download,downloadHost,createUpdates,targetFor}=require('../desktop/updates.cjs');
const {checkUpdate}=require('../desktop/github-support.cjs');
const web='https://github.com/herve8940/BandPilot';
const bytes=Buffer.from('verified installer fixture');
const sha256=createHash('sha256').update(bytes).digest('hex');
const name='BandPilot-macOS-2.3.4-arm64.zip';
const asset={name,size:bytes.length,sha256,url:`${web}/releases/download/v2.3.4/${name}`};
const release={tag_name:'v2.3.4',html_url:web+'/releases/tag/v2.3.4',assets:[{...asset,state:'uploaded',digest:'sha256:'+sha256,browser_download_url:asset.url},{name:name.replace('.zip','.dmg'),size:1,state:'uploaded',browser_download_url:asset.url.replace('.zip','.dmg')}]};
const exec=promisify(execFile);
test('stable updates compare development builds, metadata and malformed versions correctly',()=>{
 for(const [candidate,current,expected] of [['2.3.4','2.3.4-dev.3',true],['2.3.5','2.3.4-dev.3',true],['2.3.3','2.3.4-dev.3',false],['2.3.4','2.3.4+build',false],['2.3.4-dev.4','2.3.4-dev.3',false],['2.3.5','invalid',false]])assert.equal(newer(candidate,current),expected,`${candidate} / ${current}`);
 for(const value of ['2.03.4','2.3.4-dev.01','2.3.4-','999999999999999999999.1.0'])assert.equal(parseVersion(value),null);
});
test('every main commit gets a monotonically increasing unused stable version without rebuilding a published commit',()=>{
 const releases=[{tag_name:'v2.3.4',target_commitish:'one'},{tag_name:'v2.3.7',target_commitish:'two'},{tag_name:'v2.4.0-android.1',prerelease:true},{tag_name:'v2.3.8',draft:true}];
 assert.deepEqual(planRelease('2.3.4',releases,'new'),{needed:true,version:'2.3.9'});
 assert.deepEqual(planRelease('2.3.4',releases,'one'),{needed:false,version:'2.3.4'});
 assert.deepEqual(planRelease('3.0.0',releases,'new'),{needed:true,version:'3.0.0'});
 assert.deepEqual(planRelease('2.3.4',releases.slice().reverse(),'new'),{needed:true,version:'2.3.9'});
 assert.throws(()=>planRelease('2.4.0-dev.1',[],'new'));
});
test('automatic payloads require an exact GitHub asset URL, size, architecture and API digest',async()=>{
 const fetcher=async()=>new Response(JSON.stringify(release));
 assert.equal((await checkUpdate(fetcher,'2.3.4-dev.3','darwin','arm64')).automatic.sha256,sha256);
 assert.equal((await checkUpdate(fetcher,'2.3.3','darwin','x64')).available,false);
 const bad=structuredClone(release);(bad.assets[0] as any).digest='';
 assert.equal((await checkUpdate(async()=>new Response(JSON.stringify(bad)),'2.3.3','darwin','arm64')).automatic,null);
 assert.equal(downloadHost('https://release-assets.githubusercontent.com/test'),true);
 for(const url of ['http://github.com/a','https://github.com.evil.test/a','https://user@github.com/a','https://github.com:444/a'])assert.equal(downloadHost(url),false);
});
test('downloads verify content and length, reject foreign redirects and remove partial failures',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'bandpilot-download-'));
 try{
  const target=join(directory,'update.zip');let requests=0;
  await download(asset,target,{fetcher:async()=>++requests===1?new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/fixture'}}):new Response(bytes)});
  assert.deepEqual(await readFile(target),bytes);assert.equal(requests,2);
  await assert.rejects(download({...asset,sha256:'0'.repeat(64)},join(directory,'bad'),{fetcher:async()=>new Response(bytes)}),/checksum/);
  await assert.rejects(download(asset,join(directory,'big'),{fetcher:async()=>new Response(Buffer.concat([bytes,bytes]))}),/size/);
  await assert.rejects(download(asset,join(directory,'redirect'),{fetcher:async()=>new Response(null,{status:302,headers:{location:'https://evil.test/file'}})}),/host/);
  assert.deepEqual(await readdir(directory),['update.zip']);
 }finally{await rm(directory,{recursive:true,force:true});}
});
async function fixture(){
 const directory=await mkdtemp(join(tmpdir(),'bandpilot-auto-'));
 const app=Object.assign(new EventEmitter(),{isPackaged:true,getVersion:()=> '2.3.4-dev.3',quit:()=>{quits++;},getAppPath:()=>'/Applications/BandPilot.app/Contents/Resources/app.asar'});
 let downloads=0,installs=0,quits=0,checks=0;
 const options={app,dataPath:directory,platform:'darwin',arch:'arm64',fetcher:async()=>{checks++;return new Response(JSON.stringify(release));},downloadFile:async(_a:any,target:string)=>{downloads++;await writeFile(target,bytes);},prepare:async({downloaded}:any)=>({target:'/Applications/BandPilot.app',downloaded}),install:async()=>{installs++;}};
 const updates=createUpdates(options);
 const ready=async()=>{for(let i=0;i<100&&updates.snapshot().phase!=='ready';i++)await new Promise(r=>setTimeout(r,5));assert.equal(updates.snapshot().phase,'ready');};
 return {app,updates,options,ready,counts:()=>({downloads,installs,quits,checks}),async close(){updates.dispose();await rm(directory,{recursive:true,force:true});}};
}
test('startup checks deduplicate, downloads automatically and installs only on normal quit',async()=>{
 const f=await fixture();try{
  await Promise.all([f.updates.check(),f.updates.check()]);await f.ready();
  assert.deepEqual(f.counts(),{downloads:1,installs:0,quits:0,checks:1});
  await f.updates.check(true);assert.equal(f.counts().downloads,1);
  let prevented=0;f.app.emit('before-quit',{preventDefault:()=>prevented++});
  for(let i=0;i<100&&!f.counts().quits;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(prevented,1);assert.equal(f.counts().installs,1);assert.equal(f.counts().quits,1);
  f.app.emit('before-quit',{preventDefault:()=>prevented++});assert.equal(prevented,1);
 }finally{await f.close();}
});
test('turning automatic updates off cancels a prepared install and persists outside mixer profiles',async()=>{
 const f=await fixture();try{
  await f.updates.check();await f.ready();await f.updates.setAutomatic(false);
  f.app.emit('before-quit',{preventDefault:()=>assert.fail('disabled update cannot stop quitting')});
  assert.equal(f.counts().installs,0);
  const restarted=createUpdates(f.options);try{await restarted.check();assert.equal(restarted.snapshot().automaticEnabled,false);assert.equal(f.counts().downloads,1);}finally{restarted.dispose();}
 }finally{await f.close();}
});
test('offline checks report an error, and smoke/source runs never contact GitHub',async()=>{
 const f=await fixture();try{
  const offline=createUpdates({...f.options,fetcher:async()=>{throw Error('offline');}});try{assert.equal((await offline.check()).updateError,true);}finally{offline.dispose();}
  const smoke=createUpdates({...f.options,smoke:true});try{await smoke.check();assert.equal(f.counts().checks,0);}finally{smoke.dispose();}
  f.app.isPackaged=false;const source=createUpdates(f.options);try{await source.check();assert.equal(f.counts().checks,0);}finally{source.dispose();}
 }finally{await f.close();}
});
test('opting out during a download aborts it and cannot leave an install armed',async()=>{
 const f=await fixture();let started:any;const waiting=new Promise(resolve=>{started=resolve;});
 const updates=createUpdates({...f.options,downloadFile:async(_asset:any,_file:string,{signal}:any)=>{started();await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});
 try{
  await updates.check();await waiting;await updates.setAutomatic(false);
  assert.equal(updates.snapshot().phase,'available');assert.equal(updates.snapshot().automaticEnabled,false);
  f.app.emit('before-quit',{preventDefault:()=>assert.fail('aborted download cannot install')});assert.equal(f.counts().installs,0);
 }finally{updates.dispose();await f.close();}
});
test('managed Debian packages and mounted macOS installers never become automatic targets',()=>{
 assert.equal(targetFor({isPackaged:true},'linux',{}),null);
 assert.equal(targetFor({isPackaged:true},'linux',{APPIMAGE:'/home/user/BandPilot.AppImage'}),resolve('/home/user/BandPilot.AppImage'));
 assert.equal(targetFor({isPackaged:true,getAppPath:()=>'/Volumes/install/BandPilot.app/Contents/Resources/app.asar'},'darwin',{}),null);
});
test('POSIX installation preserves a rollback copy and treats paths as data', {skip:process.platform==='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),"bandpilot update ' $()-"));
 try{
  const target=join(directory,'BandPilot.AppImage'),staged=join(directory,'staged'),backup=join(directory,'previous'),marker=join(directory,'marker');
  await writeFile(target,'old');await writeFile(staged,'new');const inode=String((await stat(target)).ino);
  const helper=resolve('desktop/install-update.sh');
  await assert.rejects(exec('/bin/sh',[helper,'999999999',staged,target,backup,'wrong',marker]));
  assert.equal(await readFile(target,'utf8'),'old');
  await exec('/bin/sh',[helper,'999999999',staged,target,backup,inode,marker]);
  assert.equal(await readFile(target,'utf8'),'new');assert.equal(await readFile(backup,'utf8'),'old');assert.equal((await readFile(marker,'utf8')).trim(),'installed');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('POSIX installation restores the old application if the final move fails', {skip:process.platform==='win32'},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'bandpilot-rollback-'));
 try{
  const target=join(directory,'target'),staged=join(directory,'staged'),backup=join(directory,'backup'),marker=join(directory,'marker');
  await writeFile(target,'old');await writeFile(staged,'new');await mkdir(join(directory,'bin'));
  await writeFile(join(directory,'bin','mv'),'#!/bin/sh\ncase "$1" in */staged) exit 1 ;; esac\nexec /bin/mv "$@"\n',{mode:0o700});
  await assert.rejects(exec('/bin/sh',[resolve('desktop/install-update.sh'),'999999999',staged,target,backup,String((await stat(target)).ino),marker],{env:{...process.env,PATH:join(directory,'bin')+':/usr/bin:/bin'}}));
  assert.equal(await readFile(target,'utf8'),'old');assert.equal(await readFile(staged,'utf8'),'new');
  await assert.rejects(stat(marker));
 }finally{await rm(directory,{recursive:true,force:true});}
});
