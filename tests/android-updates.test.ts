import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {AndroidUpdates} from '../src/android-update-manager.js';
import {androidUpdate,androidDownloadURL} from '../src/android-updates.js';
import {diagnosticEvents,sanitizeDiagnostic} from '../shared/diagnostic-report.js';
import {permitted} from '../src/access.js';
const current='2.4.0-android.1',version='2.4.0-android.2',bytes=Buffer.from('verified APK fixture');
const asset={name:`BandPilot-Android-${version}-universal.apk`,state:'uploaded',size:bytes.length,browser_download_url:androidDownloadURL(version),digest:'sha256:'+createHash('sha256').update(bytes).digest('hex')};
const release={tag_name:'android-v'+version,draft:false,prerelease:false,assets:[asset]};
const fixture=async(fn:(directory:string)=>Promise<void>)=>{const directory=await mkdtemp(join(tmpdir(),'bandpilot-update-'));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}};
test('Android ignores prereleases, malformed releases and older versions; pages past desktop releases',async()=>{
 let pages=0;const fetcher=async()=>new Response(JSON.stringify(++pages===1?Array.from({length:100},()=>({tag_name:'v2.3.4'})):[null,{...release,prerelease:true},release]));
 const result=await androidUpdate(current,fetcher as typeof fetch);assert.equal(pages,2);assert.equal(result.version,version);assert.equal(result.automatic?.sha256,asset.digest.slice(7));
 assert.equal((await androidUpdate(version,async()=>new Response(JSON.stringify([release])))).available,false);
 assert.equal((await androidUpdate(current,async()=>new Response(JSON.stringify([{...release,assets:[{...asset,digest:null}]}])))).automatic,undefined);
});
test('Android defaults to optional downloads, stages verified bytes and preserves preference across restarts',async()=>fixture(async directory=>{
 let checks=0,downloads=0;
 const fetcher=async(url:any)=>{if(String(url).includes('api.github.com')){checks++;return new Response(JSON.stringify([release]));}downloads++;return new Response(bytes);};
 const manager=new AndroidUpdates(directory,current,fetcher as typeof fetch);
 assert.equal((await manager.check()).automaticEnabled,false);assert.equal(downloads,0);await manager.check();assert.equal(checks,1);
 assert.equal((await manager.stage()).phase,'ready');assert.deepEqual(await readFile(join(directory,'update.apk')),bytes);
 assert.equal(JSON.parse(await readFile(join(directory,'ready.json'),'utf8')).version,version);
 await manager.setAutomatic(true);const restarted=new AndroidUpdates(directory,current,fetcher as typeof fetch);assert.equal(restarted.snapshot().automaticEnabled,true);assert.equal((await restarted.check()).phase,'ready');assert.equal(downloads,1);
 await manager.setAutomatic(false);assert.equal((await stat(join(directory,'update.apk'))).size,bytes.length);
}));
test('Android refuses corrupted, truncated and oversized downloads and foreign redirects',async()=>{
 for(const response of [()=>new Response(Buffer.alloc(bytes.length,1)),()=>new Response(bytes.subarray(1)),()=>new Response(Buffer.concat([bytes,bytes])),()=>new Response(null,{status:302,headers:{Location:'https://evil.example/app.apk'}})])await fixture(async directory=>{
  const urls:string[]=[];const manager=new AndroidUpdates(directory,current,(async(url:any)=>{urls.push(String(url));return String(url).includes('api.github.com')?new Response(JSON.stringify([release])):response();}) as typeof fetch);
  await manager.check();assert.equal((await manager.stage()).phase,'error');await assert.rejects(stat(join(directory,'update.apk')));await assert.rejects(stat(join(directory,'update.part')));assert.ok(!urls.some(u=>u.includes('evil.example')));
 });
});
test('Android reports offline checks without losing a verified update and supports cancellation',async()=>fixture(async directory=>{
 let offline=false,hold=false;let started!:()=>void;const ready=new Promise<void>(r=>started=r);
 const fetcher=async(url:any,options:any)=>{if(String(url).includes('api.github.com')){if(offline)throw Error('offline');return new Response(JSON.stringify([release]));}if(hold){started();await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))));}return new Response(bytes);};
 const manager=new AndroidUpdates(directory,current,fetcher as typeof fetch);await manager.check();hold=true;const pending=manager.stage();await ready;await manager.setAutomatic(false);assert.equal((await pending).phase,'available');await assert.rejects(stat(join(directory,'update.part')));
 hold=false;await manager.stage();offline=true;const state=await manager.check(true);assert.equal(state.phase,'ready');assert.equal(state.updateError,true);
}));
test('Android diagnostics hide private storage paths and restrict update administration',()=>{
 assert.equal(sanitizeDiagnostic('/data/user/0/be.bandpilot.android/files/private.json'),'[path]');assert.equal(sanitizeDiagnostic('/storage/emulated/0/Music/private.wav'),'[path]');
 assert.equal(diagnosticEvents(JSON.stringify({event:'android.engine_start',time:'now'})).length,1);
 for(const role of ['musician','guest'] as const)for(const method of ['GET','POST'])assert.equal(permitted({id:'x',name:'x',role,buses:[1]},method,'/api/android/update/preferences'),false);
});
