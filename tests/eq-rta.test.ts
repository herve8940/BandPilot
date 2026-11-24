import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import dgram from 'node:dgram';
import {EqRta,RTA_LEASE_MS} from '../src/eq-rta.js';
import {XR18} from '../src/xr18.js';
import {MIXER_MODELS} from '../shared/mixer-models.js';
import {encodeOsc,decodeOsc} from '../src/osc.js';
class Mixer extends EventEmitter{
 writesEnabled=false;mode='real';generation=0;connected=true;source=32;post=false;modelId:keyof typeof MIXER_MODELS='XR18';writes:Array<[number,boolean]>=[];reads:string[]=[];
 model(){return MIXER_MODELS[this.modelId];}status(){return {model:this.modelId,mode:this.mode,connected:this.connected,writesEnabled:this.writesEnabled};}connectionId(){return this.generation;}
 async query(a:string){this.reads.push(a);return {args:[a.endsWith('source')?this.source:this.post?1:0]};}
 setRtaSource(n:number,p=false){this.source=n;this.post=p;this.writes.push([n,p]);}subscribeAnalysis(){}
}
function setup(){const mixer=new Mixer();let now=10000,busy=false;const rta=new EqRta(mixer as unknown as XR18,()=>busy,()=>now);return {mixer,rta,advance:(n:number)=>now+=n,block:(v:boolean)=>busy=v,frame:(bands=Array(100).fill(-42))=>mixer.emit('rta',{bands,at:now})};}
test('RTA is explicit, verifies source, rejects settling/stale frames and restores previous selection',async()=>{
 const f=setup();try{assert.equal(f.mixer.reads.length,0);const s=await f.rta.start({kind:'ch',n:13},true);assert.deepEqual(f.mixer.writes,[[12,true]]);f.frame();assert.equal((await f.rta.read(s.token)).frame,null);
 f.advance(400);f.frame();assert.equal((await f.rta.read(s.token)).frame?.bands[0],-42);f.advance(1600);assert.equal((await f.rta.read(s.token)).frame,null);
 await f.rta.stop(s.token);assert.deepEqual(f.mixer.writes,[[12,true],[32,false]]);assert.equal(f.rta.busy(),false);
 }finally{await f.rta.close();}
});
test('RTA rejects competing clients, active legacy analysis, invalid models and unavailable channels',async()=>{
 const f=setup();try{f.block(true);await assert.rejects(f.rta.start({kind:'lr',n:0},false),/déjà utilisé/);assert.equal(f.mixer.writes.length,0);f.block(false);
 for(const model of ['XR12','MR12'] as const){f.mixer.modelId=model;await assert.rejects(f.rta.start({kind:'ch',n:13},false),/invalide/);await assert.rejects(f.rta.start({kind:'bus',n:3},false),/invalide/);}
 f.mixer.modelId='X32';await assert.rejects(f.rta.start({kind:'lr',n:0},false),/réelle connectée/);f.mixer.modelId='MR18';
 const s=await f.rta.start({kind:'bus',n:6},false);assert.equal(f.mixer.source,26);await assert.rejects(f.rta.start({kind:'ch',n:1},false),/déjà utilisé/);await f.rta.stop('other');assert.ok(f.rta.busy());await f.rta.stop(s.token);
 f.mixer.mode='simulation';await assert.rejects(f.rta.start({kind:'lr',n:0},false),/réelle connectée/);
 }finally{await f.rta.close();}
});
test('RTA external source changes are never overwritten and connection reset discards captures',async()=>{
 const f=setup();try{let s=await f.rta.start({kind:'aux',n:0},false);f.advance(400);f.frame();f.mixer.source=5;await assert.rejects(f.rta.read(s.token),/changé ailleurs/);await f.rta.stop(s.token);assert.equal(f.mixer.source,5);
 s=await f.rta.start({kind:'fxrtn',n:4},false);f.mixer.source=9;await f.rta.stop(s.token);assert.equal(f.mixer.source,9);
 s=await f.rta.start({kind:'lr',n:0},false);f.mixer.generation++;f.mixer.emit('reset');await assert.rejects(f.rta.read(s.token),/terminée/);assert.equal(f.mixer.source,31,'no restoration sent to a new connection');
 }finally{await f.rta.close();}
});
test('RTA expired lease restores selection and concurrent legacy start sees reservation',async()=>{
 const f=setup();try{const original=f.mixer.query.bind(f.mixer);let release!:()=>void;const wait=new Promise<void>(r=>release=r);f.mixer.query=async a=>{await wait;return original(a);};const pending=f.rta.start({kind:'ch',n:1},false);await Promise.resolve();assert.equal(f.rta.busy(),true);release();const s=await pending;f.advance(RTA_LEASE_MS+1);await assert.rejects(f.rta.read(s.token),/terminée/);assert.equal(f.mixer.source,32);assert.equal(f.rta.busy(),false);
 }finally{await f.rta.close();}
});
test('RTA keeps analyser ownership until restoration is confirmed',async()=>{
 const f=setup();try{const s=await f.rta.start({kind:'ch',n:1},false);const original=f.mixer.query.bind(f.mixer);let release!:()=>void;const wait=new Promise<void>(r=>release=r);f.mixer.query=async a=>{await wait;return original(a);};const stopping=f.rta.stop(s.token);await Promise.resolve();assert.equal(f.rta.busy(),true);release();await stopping;assert.equal(f.rta.busy(),false);assert.equal(f.mixer.source,32);
 }finally{await f.rta.close();}
});
test('RTA failed readback and transport change cannot expose a valid session',async()=>{
 const f=setup();try{f.mixer.query=async()=>({args:[99]});await assert.rejects(f.rta.start({kind:'ch',n:1},false),/non vérifiable/);assert.equal(f.rta.busy(),false);assert.equal(f.mixer.writes.length,0);
 f.mixer.query=async a=>{f.mixer.generation++;return {args:[a.endsWith('source')?32:0]};};await assert.rejects(f.rta.start({kind:'ch',n:1},false),/Connexion modifiée/);assert.equal(f.mixer.writes.length,0);
 }finally{await f.rta.close();}
});
test('RTA re-reads delayed hardware selection without replaying commands',async()=>{
 const f=setup();try{let stale=0,oldSource=32,oldPost=false;const set=f.mixer.setRtaSource.bind(f.mixer),query=f.mixer.query.bind(f.mixer);
 f.mixer.setRtaSource=(n,p=false)=>{oldSource=f.mixer.source;oldPost=f.mixer.post;set(n,p);stale=2;};
 f.mixer.query=async a=>stale-->0?{args:[a.endsWith('source')?oldSource:oldPost?1:0]}:query(a);
 const s=await f.rta.start({kind:'ch',n:13},true);await f.rta.stop(s.token);assert.deepEqual(f.mixer.writes,[[12,true],[32,false]]);assert.equal(f.mixer.source,32);assert.equal(f.mixer.post,false);
 }finally{await f.rta.close();}
});
test('RTA uses the real OSC transport in read-only mode and writes only analyser selection',async()=>{
 const peer=dgram.createSocket('udp4');await new Promise<void>(r=>peer.bind(0,'127.0.0.1',r));let source=32,pos=0;const mutations:string[]=[];
 peer.on('message',(packet,from)=>{const m=decodeOsc(packet);const reply=(args:any[])=>peer.send(encodeOsc(m.address,args),from.port,from.address);
  if(m.address==='/-stat/rta/source'||m.address==='/-stat/rta/pos'){if(m.args.length){mutations.push(m.address);if(m.address.endsWith('source'))source=Number(m.args[0]);else pos=Number(m.args[0]);}reply([m.address.endsWith('source')?source:pos]);}
  else if(m.address==='/lr/mix/fader')reply([{oscType:'f',value:0}]);
  else if(m.address==='/meters'&&m.args[0]==='/meters/4'){const b=Buffer.alloc(204);b.writeInt32LE(100);for(let i=0;i<100;i++)b.writeInt16LE(-40*256,4+2*i);peer.send(encodeOsc('/meters/4',[b]),from.port,from.address);}
  else if(m.args.length&&!['/meters','/xremote'].includes(m.address))mutations.push(m.address);
 });
 const xr=new XR18({mode:'real',host:'127.0.0.1',port:(peer.address() as {port:number}).port,enableWrites:false}),rta=new EqRta(xr,()=>false);
 try{const connected=new Promise<void>(r=>xr.once('connection',()=>r()));await xr.start();await connected;await xr.query('/lr/mix/fader');const s=await rta.start({kind:'bus',n:1},true);await new Promise(r=>setTimeout(r,400));await rta.read(s.token);await new Promise(r=>setTimeout(r,40));assert.equal((await rta.read(s.token)).frame?.bands[0],-40);await rta.stop(s.token);await new Promise(r=>setTimeout(r,20));assert.equal(source,32);assert.equal(pos,0);assert.ok(mutations.every(a=>a==='/-stat/rta/source'||a==='/-stat/rta/pos'));assert.equal(xr.status().writesEnabled,false);
 }finally{await rta.close();xr.close();peer.close();}
});

test('a monitor correction requires explicit control, fresh sustained data from the armed bus, and can fire only once',async()=>{
 const f=setup(),id='cad6f4c2-f56b-41f9-b3ff-ab07b73321ef';
 try{
  const {token}=await f.rta.start({kind:'bus',n:1},true);f.advance(400);f.frame();
  assert.throws(()=>f.rta.armRing(token,'admin',1,false,id));f.mixer.writesEnabled=true;
  assert.throws(()=>f.rta.armRing(token,'admin',2,false,id));
  f.rta.armRing(token,'admin',1,false,id);
  const bands=Array(100).fill(-70);bands[50]=-32;
  for(let i=0;i<7;i++){f.advance(360);f.frame(bands);}
  assert.equal((await f.rta.read(token)).ringReadyId,id);
  let called=0;
  const correct=async(bus:number,linked:boolean,hz:number,check:()=>void,checkSession:()=>void)=>{check();f.advance(10);f.frame(Array(100).fill(-80));assert.throws(check);checkSession();assert.equal(bus,1);assert.equal(linked,false);assert.ok(hz>500&&hz<1000);called++;};
  await assert.rejects(f.rta.correctRing(token,'guest',id,correct));
  await f.rta.correctRing(token,'admin',id,correct);await assert.rejects(f.rta.correctRing(token,'admin',id,correct));assert.equal(called,1);
  f.rta.armRing(token,'admin',1,false,id);
  assert.equal((await f.rta.read(token)).ringReadyId,null);
  for(let i=0;i<7;i++){f.advance(360);f.frame(bands);}
  await assert.rejects(f.rta.correctRing(token,'admin',id,async(_bus,_link,_hz,check)=>{f.rta.stopRing(token,'admin',id);check();called++;}));
  assert.equal(called,1);
 }finally{await f.rta.close();}
});
