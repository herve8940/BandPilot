import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
import {LibraryStore} from '../src/library-store.js';

test('interrupted workshop blocks competing recording, routing and scene routes before handlers run',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bandpilot-workshop-api-')),db=join(dir,'test.db');
 const library=new LibraryStore(db);library.save('workshop','Interrupted',{id:'w',name:'Interrupted',phase:'active',mapping:[],route:{},virtual:{},a:{},b:{},side:'A',source:'/original.rpp',project:'/workshop.rpp',identity:'simulation',model:'XR18',start:0,stop:10,note:'',createdAt:new Date().toISOString()});library.close();
 const probe=net.createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address() as net.AddressInfo).port;await new Promise<void>(r=>probe.close(()=>r()));
 const child=spawn(process.execPath,['--import','tsx','src/server.ts'],{env:{...process.env,HTTP_PORT:String(port),XR18_DB_PATH:db,XR18_MODE:'simulation',REAPER_RESOURCE_PATH:join(dir,'reaper')},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const url=`http://127.0.0.1:${port}`,post=(path:string)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(url+'/api/auth')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,logs);
  const state=await (await fetch(url+'/api/workshop')).json() as any;assert.equal(state.active.phase,'recovery');assert.equal(state.active.a,undefined);
  for(const path of ['/api/reaper/rec','/api/reaper/session','/api/show/rec','/api/mixer-sync/apply','/api/console/apply','/api/reacue/event','/api/library/abc/apply']){
   const res=await post(path);assert.equal(res.status,409);assert.match((await res.json() as any).error,/Atelier du son/);
  }
  const stop=await post('/api/reaper/stop');assert.doesNotMatch((await stop.json() as any).error??'',/Atelier du son/,'Stop still reaches REAPER, even when its bridge is offline');
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}
});
