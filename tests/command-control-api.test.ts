import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
test('HTTP command control requires an administrator, reviewed activation, same session owner and explicit confirmation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bandpilot-command-api-')),probe=net.createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address() as net.AddressInfo).port;await new Promise<void>(r=>probe.close(()=>r()));
 const child=spawn(process.execPath,['--import','tsx','src/server.ts'],{env:{...process.env,HTTP_PORT:String(port),XR18_DB_PATH:join(dir,'test.db'),XR18_MODE:'simulation'},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);let cookie='';
 const call=(path:string,data?:unknown)=>fetch(`http://127.0.0.1:${port}`+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 try{
  let ready=false;for(let i=0;i<400;i++){try{if((await call('/api/auth')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,logs);
  await call('/api/auth/setup',{name:'Admin',password:'synthetic-long-password'});assert.equal((await call('/api/library/command-control/prepare',{model:'XR18',ids:[],mode:'midi'})).status,401);
  const login=await call('/api/auth/login',{name:'Admin',password:'synthetic-long-password'});cookie=login.headers.get('set-cookie')!.split(';')[0]!;
  const command=await (await call('/api/library/commands',{name:'Synthetic command',data:{version:1,model:'XR18',steps:[{channel:3,target:'mute',value:1}]}})).json() as {id:string};assert.ok(command.id);
  const prepared=await (await call('/api/library/command-control/prepare',{model:'XR18',ids:[command.id],mode:'midi'})).json() as {token:string};assert.ok(prepared.token);
  assert.equal((await call('/api/library/command-control/arm',{token:prepared.token,confirm:false})).status,400);
  const armed=await (await call('/api/library/command-control/arm',{token:prepared.token,confirm:true})).json() as {token:string};assert.ok(armed.token);
  const read=async()=>{const r=await (await call('/api/channels')).json() as any[];return r.find(c=>c.channel===3).on?1:0;};assert.equal(await read(),1);
  assert.equal((await call('/api/library/command-control/pulse',{token:armed.token,id:command.id,sequence:1})).status,200);assert.equal(await read(),0);
  const scene=await (await call('/api/library',{name:'Synthetic scene',kind:'scene',complete:true})).json() as {id:string};
  const cue={name:'Synthetic MIDI selection',model:'XR18',sourceId:scene.id,scope:{channels:[3],sections:['levels']}};
  const saved=await call('/api/library/midi-scenes',cue);
  assert.equal(saved.status,200);
  const savedId=(await saved.json() as {id:string}).id;
  assert.ok(savedId);
  assert.equal(await read(),0);
  await call('/api/users',{name:'Musician',password:'synthetic-other-password',role:'musician',buses:[1]});await call('/api/auth/logout',{});
  const other=await call('/api/auth/login',{name:'Musician',password:'synthetic-other-password'});cookie=other.headers.get('set-cookie')!.split(';')[0]!;
  assert.equal((await call('/api/library/midi-scenes')).status,403);
  assert.equal((await call('/api/library/midi-scenes',cue)).status,403);
  assert.equal((await call('/api/library/command-control/pulse',{token:armed.token,id:savedId,sequence:2})).status,403);
  for(const action of ['prepare','arm','pulse','stop'])assert.equal((await call('/api/library/command-control/'+action,{token:armed.token,model:'XR18',ids:[command.id],mode:'midi',confirm:true})).status,403,action);
 }finally{child.kill('SIGTERM');await new Promise<void>(r=>{if(child.exitCode!==null)r();else child.once('exit',()=>r());});await rm(dir,{recursive:true,force:true});}
});
