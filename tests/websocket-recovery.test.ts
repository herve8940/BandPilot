import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {WebSocket} from 'ws';

test('a failed mixer WebSocket does not stop the API or subsequent mixer connections',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bandpilot-ws-recovery-'));
 const probe=net.createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address() as net.AddressInfo).port;await new Promise<void>(r=>probe.close(()=>r()));
 const child=spawn(process.execPath,['--import','tsx','src/server.ts'],{env:{...process.env,HTTP_PORT:String(port),XR18_DB_PATH:join(dir,'test.db'),XR18_MODE:'simulation',REAPER_RESOURCE_PATH:join(dir,'reaper')},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const url=`http://127.0.0.1:${port}`;
 let socket:net.Socket|undefined,healthy:WebSocket|undefined;
 try{
  let ready=false;const deadline=Date.now()+20000;
  while(Date.now()<deadline&&child.exitCode===null){try{if((await fetch(url+'/api/auth',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}
  assert.ok(ready,'Server did not start.\n'+logs);
  socket=await new Promise<net.Socket>((resolve,reject)=>{
   const req=http.request(url+'/ws',{headers:{Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':'dGhlIHNhbXBsZSBub25jZQ=='}});
   req.on('upgrade',(_res,connection)=>resolve(connection));req.on('error',reject);req.on('response',res=>{res.resume();reject(Error('WebSocket upgrade refused: '+res.statusCode));});req.end();
  });
  const disconnected=new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Invalid WebSocket was not closed')),5000);
   socket!.on('error',()=>{});socket!.once('close',()=>{clearTimeout(timer);resolve();});socket!.resume();
  });
  // A reserved RSV1 bit without negotiated compression produces a real ws error.
  socket.write(Buffer.from([0xc1,0x80,0,0,0,0]));await disconnected;
  let status:Response|undefined;try{status=await fetch(url+'/api/status',{signal:AbortSignal.timeout(2000)});}catch{}
  assert.equal(status?.status,200,'A client WebSocket error stopped the API.\n'+logs);
  healthy=new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const snapshot=await new Promise<any>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('New mixer connection did not receive a snapshot')),3000);
   healthy!.once('message',data=>{clearTimeout(timer);resolve(JSON.parse(data.toString()));});healthy!.once('error',error=>{clearTimeout(timer);reject(error);});
  });
  assert.equal(snapshot.type,'snapshot');assert.equal(snapshot.status.mode,'simulation');
 }finally{
  socket?.destroy();healthy?.terminate();child.kill('SIGTERM');
  await new Promise<void>(r=>{if(child.exitCode!==null)r();else child.once('exit',()=>r());});
  await rm(dir,{recursive:true,force:true});
 }
});
