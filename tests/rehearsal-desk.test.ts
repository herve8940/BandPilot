import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RehearsalDesk,rehearsalCommand} from '../src/rehearsal-desk.js';
import type {ReaperBridge} from '../src/reaper-bridge.js';
import {rehearsalInputs} from '../shared/rehearsal-inputs.js';
import type {RehearsalProject} from '../shared/rehearsal-desk.js';
import {planSession} from '../src/reaper.js';
import {XR18} from '../src/xr18.js';
import {EarsShare} from '../src/ears.js';

const project='749ca10929964f299170435498204f79-1';
const require=createRequire(import.meta.url);

test('REAPER bridge targets the right tab and finalizes isolated takes using its own clock',()=>{
 const r=spawnSync(process.execPath,[require.resolve('fengari-node-cli/src/lua-cli.js'),'tests/rehearsal-tabs.lua'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/rehearsal-tabs: .* passed/);
 assert.equal(r.stderr,'');
});

test('validated rehearsal commands allow only the named project, source, markers and capability',()=>{
 assert.deepEqual(rehearsalCommand({project,action:'play',source:'original',a:'m12',b:'r5',loop:true}),{project,action:'play',source:'original',a:'m12',b:'r5',loop:true});
 for(const d of [{action:'play',source:'take'},{action:'play',source:'original',a:'m1'},{action:'record',stopAt:12},{action:'stop',commandId:1013},{action:'marker',name:'\0bad'}]){
  assert.throws(()=>rehearsalCommand({project,...d}),/invalide/);
 }
 const guide={project,action:'guideVolume',track:'{00000000-0000-0000-0000-000000000001}'};
 for(const volume of [0,0.42,1,3.98])assert.equal(rehearsalCommand({...guide,volume}).volume,volume);
 for(const volume of [-1,4.1,Infinity,null,'1'])assert.throws(()=>rehearsalCommand({...guide,volume}),/invalide/);
 const loop={project,action:'play',source:'backing',a:'r1',b:'e1',loop:true};
 for(const bars of [0,1,2,8])assert.equal(rehearsalCommand({...loop,countBars:bars}).countBars,bars);
 for(const bars of [-1,9,1.5,'2'])assert.throws(()=>rehearsalCommand({...loop,countBars:bars}),/invalide/);
 assert.throws(()=>rehearsalCommand({...loop,loop:false,countBars:2}),/invalide/);
 assert.equal(rehearsalCommand({project,action:'setup',autoSave:true}).autoSave,true);
 assert.throws(()=>rehearsalCommand({project,action:'arm',track:'wrong',on:true}),/invalide/);
 assert.throws(()=>rehearsalCommand({project,action:'input',index:129}),/invalide/);
});

test('all eleven configured tracks stay visible when REAPER exposes two inputs',()=>{
 const instruments=Array.from({length:11},(_,i)=>({channel:i+1,name:'Fixture '+(i+1),family:null}));
 const plan=planSession({values:{},instruments,sampleRate:48000,usbMode:'18x18',simulation:true});
 const configured=plan.tracks.filter(t=>t.selected).map(t=>({...t,available:true}));
 const existing={id:'existing',name:'REC A',armed:true,channels:[2],available:true};
 const project={inputs:2,recordTracks:[existing]} as RehearsalProject;
 const rows=rehearsalInputs(configured,project);
 assert.deepEqual(rows.map(t=>t.name),instruments.map(i=>i.name));
 assert.equal(rows.filter(t=>t.available).length,2);
 assert.equal(rows[1]?.track?.id,existing.id);
 assert.equal(rehearsalInputs(configured,{...project,inputs:18}).filter(t=>t.available).length,11);
 const stereo={usb:2,name:'Stereo',stereo:true,available:true};
 const split=rehearsalInputs([stereo],project);
 assert.equal(split.length,2);
 assert.equal(split[0]?.available,false);
 assert.equal(split[1]?.track?.id,existing.id);
});

test('the designated musician uses the existing monitor QR and role changes take effect live',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bp-phone-')),dist=join(dir,'web');
 await mkdir(dist);await writeFile(join(dist,'ears.html'),'<title>Mon retour</title>');
 const folder=join(dir,'Test.bandstudio','Exports','one'),file=join(folder,'Demo.rpp');
 await mkdir(folder,{recursive:true});await writeFile(file,'fixture');
 await writeFile(join(folder,'bandstudio-project.json'),JSON.stringify({exportPreroll:1,chords:[{start:1,end:2,text:'C'}]}));
 await writeFile(join(dir,'Test.bandstudio','project.json'),JSON.stringify({lyrics:[{start:1,end:2,text:'fixture'}]}));
 const calls:unknown[]=[];
 const bridge={alive:()=>true,supportsRehearsal:()=>true,call:async(command:string,args:object)=>{
  if(command==='rehearsal_sheet_clock')return {project,title:'Fixture',position:2,playing:true,loop:false,rate:1,sampledAt:Date.now(),path:file};
  calls.push({command,args});return {tabs:[{id:project,title:'Fixture',number:1,saved:true,current:true}],transport:'idle'};
 }} as Pick<ReaperBridge,'alive'|'supportsRehearsal'|'call'>;
 const inputs=[{name:"Keys",usb:3,stereo:true,available:true}];
 const desk=new RehearsalDesk(bridge,()=>false,async()=>inputs);
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});
 const db=join(dir,'db.sqlite'),ears=new EarsShare(db,xr,()=>dist,()=>null,()=>{},undefined,desk);
 let ws:WebSocket|undefined;
 try{
  const {port}=await ears.start(0),root='http://127.0.0.1:'+port;
  const first=ears.create('Manager',1),other=ears.create('Other musician',2);
  const api=(token:string,route='state')=>root+'/ears-api/'+token+'/rehearsal/'+route;
  const run=(token:string,body:unknown,origin?:string)=>fetch(api(token,'command'),{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
  assert.match(await (await fetch(root+'/ears/'+first.token)).text(),/Mon retour/);
  assert.equal((await fetch(root+'/repetition')).status,404);
  assert.equal((await fetch(api(first.token))).status,403);
  ws=new WebSocket('ws://127.0.0.1:'+port+'/ears-ws?token='+first.token);
  const receive=(type:string)=>new Promise<any>((resolve,reject)=>{
   const timer=setTimeout(()=>{ws?.off('message',read);reject(Error('Socket event missing: '+type));},2000);
   const read=(raw:Buffer)=>{const value=JSON.parse(raw.toString());if(value.type===type){clearTimeout(timer);ws?.off('message',read);resolve(value);}};
   ws!.on('message',read);
  });
  assert.equal((await receive('snapshot')).rehearsal,false);
  const granted=receive('rehearsal-role');ears.assignManager(first.id);
  assert.equal((await granted).enabled,true);
  assert.equal(ears.list().find(s=>s.id===first.id)?.token,first.token);
  assert.equal((await fetch(api(first.token)+'?project='+project)).status,200);
  assert.equal((await run(first.token,{project,action:'record',a:'m1',b:'m2'})).status,200);
  assert.equal((await run(first.token,{project,action:'setup',autoSave:true})).status,200);
  assert.equal((await run(other.token,{project,action:'stop'})).status,403);
  assert.equal((await run(first.token,{project,action:'stop'},'http://another.test')).status,403);
  assert.equal((await fetch(root+'/api/connection')).status,404);
  assert.equal((await fetch(root+'/ears-api/'+first.token+'/profiles')).status,200);
  assert.deepEqual(await (await fetch(api(first.token,'configured-inputs'))).json(),inputs);
  assert.equal((await fetch(api(other.token,'configured-inputs'))).status,403);
  assert.equal(calls.length,3);
  assert.equal((await run(first.token,{project,action:'configuredInput',index:4,name:'Keys',stereo:true})).status,400);
  assert.equal(calls.length,3);
  const sheet=(token:string)=>root+'/ears-api/'+token+'/sheet';
  const readSheet=async(token:string,query='')=>(await fetch(sheet(token)+query)).json();
  const postSheet=(token:string,body:unknown)=>fetch(sheet(token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const initial=await readSheet(other.token,'?preview=1'),candidate=await readSheet(first.token,'?preview=1');
  assert.equal(initial.sheet.chords[0].start,2);assert.equal(initial.sheet.lyrics.length,0);assert.equal(initial.path,undefined);
  assert.equal((await readSheet(other.token,'?known='+initial.revision)).sheet,undefined);
  assert.equal(candidate.preview,true);assert.equal(candidate.sheet.lyrics.length,1);
  const confirmation={project,revision:candidate.revision};
  assert.equal((await postSheet(other.token,confirmation)).status,403);
  assert.equal((await postSheet(first.token,confirmation)).status,200);
  assert.equal((await readSheet(other.token)).sheet.lyrics.length,1);
  assert.equal((await postSheet(first.token,{...confirmation,reset:true})).status,200);
  assert.equal((await readSheet(other.token)).sheet.lyrics.length,0);
  const removed=receive('rehearsal-role');ears.assignManager(other.id);
  assert.equal((await removed).enabled,false);
  assert.equal((await run(first.token,{project,action:'stop'})).status,403);
  assert.equal((await fetch(root+'/ears-api/'+first.token+'/profiles')).status,200);
  ws.close();
  const newQr=ears.regenerate(other.id);
  assert.equal((await fetch(api(other.token))).status,403);
  assert.equal((await fetch(sheet(other.token))).status,403);
  assert.equal((await fetch(api(newQr.token))).status,200);
  await ears.stop();
  const reopened=new EarsShare(db,xr,()=>dist,()=>null,()=>{},undefined,desk);
  try{assert.equal(reopened.status().managerId,other.id);reopened.remove(other.id);assert.equal(reopened.status().managerId,null);}
  finally{reopened.close();}
 }finally{ws?.terminate();ears.close();xr.close();await rm(dir,{recursive:true,force:true});}
});
