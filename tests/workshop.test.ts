import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workshop,evidence,measuredAdvice,validateMapping} from '../src/workshop.js';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {BRIDGE_VERSION,type ReaperBridge} from '../src/reaper-bridge.js';
import {toWire} from '../src/parameters.js';
import {permitted} from '../src/access.js';

const mapping=[{index:0,guid:'{bass}',name:'Basse',channel:2,channels:1}];
async function fixture(){
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false});
 const original=xr.status.bind(xr);xr.status=()=>({...original(),mode:'real',connected:true,writesEnabled:true,host:'192.0.2.1'});
 xr.query=async()=>({address:'test',args:[0]}) as never;
 const state={version:BRIDGE_VERSION,project:'/source.rpp',playing:false,recording:false};
 const catalog={project:'/source.rpp',outputs:18,rate:48000,device:'XR18',tracks:[{index:0,guid:'{bass}',name:'Basse',channels:1,items:[{pos:0,length:60,file:'/audio.wav',take:'Take 1'}]}]};
 const calls:{cmd:string;args:any}[]=[];
 const bridge={state:async()=>({...state}),call:async(cmd:string,args:any={})=>{
  calls.push({cmd,args});if(cmd==='workshop_catalog')return structuredClone(catalog);
  if(cmd==='workshop_create'){state.project=args.file;return {project:args.file};}
  if(cmd==='workshop_leave'){state.project='/source.rpp';return {};}
  if(cmd==='workshop_transport'){state.playing=args.action==='play';return {};}
  if(cmd==='workshop_revision')return {revision:5};
  if(cmd==='workshop_measure_batch')return {windows:Array.from({length:Math.ceil(args.duration)},(_,i)=>({start:args.start+i,duration:Math.min(1,args.duration-i),peak:.5,sumSquares:10,samples:48000,clipped:0,rate:48000}))};
  if(cmd==='workshop_measure')return {start:args.start,duration:args.duration,peak:.5,sumSquares:10,samples:48000,clipped:0,rate:48000};
  return {};
 }};
 const library=new LibraryStore(':memory:'),folder=await mkdtemp(join(tmpdir(),'bandpilot-workshop-'));
 const workshop=new Workshop(xr,bridge as unknown as ReaperBridge,library,folder);
 const create=async()=>{const c=await workshop.catalog();return workshop.create({name:'Balance',source:c.project,start:0,stop:2,mapping,confirm:true,rawConfirmed:true,deviceConfirmed:true,token:c.token});};
 return {xr,bridge,state,catalog,calls,library,workshop,folder,create,close(){xr.close();library.close();}};
}
test('mapping rejects overlap, duplicate tracks, fractional and out of bounds channels',()=>{
 assert.equal(validateMapping(mapping)[0]!.channel,2);
 for(const bad of [[],[{...mapping[0],channel:1.5}],[{...mapping[0],channel:16,channels:2}],[...mapping,{...mapping[0],guid:'x'}],[...mapping,{...mapping[0],channel:4}]])assert.throws(()=>validateMapping(bad));
});
test('raw measurements use RMS over all samples and never invent a compressor measurement',()=>{
 const e=evidence(2,'Bass',[{start:10,duration:1,peak:.5,sumSquares:250,samples:1000,clipped:0,rate:48000}]);
 assert.equal(e.peakDb,-6);assert.equal(e.rmsDb,-6);assert.equal(e.crestDb,0);assert.deepEqual(measuredAdvice([e],{}),[]);
 assert.throws(()=>evidence(1,'silent',[]));assert.throws(()=>evidence(1,'missing',[{start:0,duration:1,peak:0,sumSquares:0,samples:0,clipped:0,rate:48000}]));
});
test('clipping advice does not pretend to repair recorded clipping; every finding remains available beyond the first three priorities',()=>{
 const rows=Array.from({length:5},(_,i)=>evidence(i+1,'Track',[{start:0,duration:1,peak:1,sumSquares:1,samples:100,clipped:3,rate:48000}]));
 const advice=measuredAdvice(rows,{});assert.equal(advice.length,5);assert.deepEqual(advice[0]!.changes,{});assert.match(advice[0]!.hypothesis,/pas une preuve/);
});
test('only inactive compressors receive a bounded crest-factor proposal; no gain, route or phantom change',()=>{
 const e=evidence(2,'Basse',[{start:1,duration:1,peak:.8,sumSquares:1,samples:10000,clipped:0,rate:48000}]);
 const advice=measuredAdvice([e],{'/ch/02/dyn/on':0});assert.equal(advice.length,1);assert.equal(advice[0]!.kind,'dynamics');assert.equal(advice[0]!.changes['/ch/02/dyn/ratio'],3);assert.equal(advice[0]!.changes['/ch/02/dyn/mgain'],0);
 assert.ok(Object.keys(advice[0]!.changes).every(k=>k.startsWith('/ch/02/dyn/')));assert.equal(measuredAdvice([e],{'/ch/02/dyn/on':1}).length,0);
});
test('workshop preserves a USB backing source and trim, keeps chosen B processing, never changes source project',async()=>{
 const f=await fixture();try{
 await f.xr.writeParameter('/ch/02/preamp/rtnsw',1);await f.xr.writeParameter('/ch/02/config/rtnsrc',7);await f.xr.writeParameter('/ch/02/preamp/rtntrim',.25);
 await f.create();assert.equal(await f.xr.readParameter('/ch/02/config/rtnsrc'),1);assert.equal(f.workshop.blocksRecording(),true);
 await f.xr.writeParameter('/ch/02/eq/2/g',toWire('/ch/02/eq/2/g',-3));
 const edited=await f.xr.readParameter('/ch/02/eq/2/g');await f.workshop.finish('B',true);
 assert.equal(await f.xr.readParameter('/ch/02/preamp/rtnsw'),1);assert.equal(await f.xr.readParameter('/ch/02/config/rtnsrc'),7);assert.equal(await f.xr.readParameter('/ch/02/preamp/rtntrim'),.25);assert.equal(await f.xr.readParameter('/ch/02/eq/2/g'),edited);
 assert.equal(f.state.project,'/source.rpp');assert.equal(f.workshop.status().active,null);assert.equal(f.workshop.status().history[0]!.phase,'finished');assert.equal(f.calls.some(c=>c.cmd==='action'),false);
 }finally{f.close();}
});
test('A remains the initial processing while manual B changes survive A/B',async()=>{
 const f=await fixture();try{await f.create();const initial=await f.xr.readParameter('/ch/02/eq/2/g');await f.xr.writeParameter('/ch/02/eq/2/g',.3);await f.workshop.compare('A');assert.equal(await f.xr.readParameter('/ch/02/eq/2/g'),initial);await f.workshop.compare('B');assert.equal(await f.xr.readParameter('/ch/02/eq/2/g'),.3);await f.workshop.finish('A',true);assert.equal(await f.xr.readParameter('/ch/02/eq/2/g'),initial);}finally{f.close();}
});
test('restart retains recovery journal and rejects a different console',async()=>{
 const f=await fixture();try{await f.create();const resumed=new Workshop(f.xr,f.bridge as never,f.library,f.folder);assert.equal(resumed.status().active!.phase,'recovery');const status=f.xr.status;f.xr.status=()=>({...status(),host:'192.0.2.99'});await assert.rejects(resumed.finish('A',true),/Console changée/);f.xr.status=status;await resumed.finish('A',true);assert.equal(resumed.status().active,null);}finally{f.close();}
});
test('partial routing failure retains enough data for explicit recovery',async()=>{
 const f=await fixture();try{const apply=f.xr.applyParameters.bind(f.xr);let fail=true;f.xr.applyParameters=async values=>{if(fail){await f.xr.writeParameter('/ch/02/config/rtnsrc',1);throw Error('Network timeout');}return apply(values);};await assert.rejects(f.create(),/interrompu/);assert.equal(f.workshop.status().active!.phase,'recovery');fail=false;await f.workshop.finish('A',true);assert.equal(await f.xr.readParameter('/ch/02/preamp/rtnsw'),0);}finally{f.close();}
});
test('stale catalog and linked channels fail before console writes',async()=>{
 const f=await fixture();try{const c=await f.workshop.catalog();f.catalog.tracks[0]!.items[0]!.take='Take 2';await assert.rejects(f.workshop.create({source:c.project,start:0,stop:2,mapping,confirm:true,rawConfirmed:true,deviceConfirmed:true,token:c.token}),/modifiées/);assert.equal(f.calls.some(c=>c.cmd==='workshop_create'),false);
 await f.xr.writeParameter('/config/chlink/1-2',1);await assert.rejects(f.create(),/paire stéréo/);assert.equal(f.workshop.status().active,null);
 }finally{f.close();}
});
test('analysis is asynchronous, bounded and persisted; stale trial rejected; trials undo just their parameters',async()=>{
 const f=await fixture();try{await f.xr.writeParameter('/ch/02/dyn/on',0);await f.create();await f.workshop.analyze();for(let i=0;i<200&&f.workshop.status().job?.running;i++)await new Promise(r=>setTimeout(r,5));assert.equal(f.workshop.status().job!.error,'');assert.equal(f.workshop.status().active!.report!.length,1);const advice=f.workshop.status().active!.advice![0]!;assert.ok(advice);
 const before=await f.xr.readParameter('/ch/02/dyn/thr');await f.workshop.trial(advice.id,'try');assert.equal(await f.xr.readParameter('/ch/02/dyn/on'),1);await f.workshop.trial(advice.id,'undo');assert.equal(await f.xr.readParameter('/ch/02/dyn/on'),0);assert.equal(await f.xr.readParameter('/ch/02/dyn/thr'),before);
 await f.xr.writeParameter('/ch/02/dyn/on',1);await assert.rejects(f.workshop.trial(advice.id,'try'),/modifiés/);
 f.state.playing=true;await assert.rejects(f.workshop.compare('A'),/arrête/);
 }finally{f.close();}
});
test('workshop history and actions are restricted to the administrator',()=>{
 for(const role of ['guest','musician'] as const)for(const method of ['GET','POST'])assert.equal(permitted({id:'x',name:'x',role,buses:[1]},method,'/api/workshop'),false);
});
test('gate reference is explicit, bounded and reversible with the existing A/B workflow',async()=>{
 const f=await fixture();try{
  const original=f.bridge.call;f.bridge.call=async(cmd,args={})=>cmd==='workshop_measure_batch'?{windows:[0,1].map(i=>({start:i,duration:1,rate:48000,samples:48000,peak:i?.2:.002,sumSquares:i?100:1,clipped:0,envelope:{step:.02,peak:Array(50).fill(i?-20:-55),rms:Array(50).fill(i?-23:-58)}}))}:original(cmd,args);
  await f.xr.writeParameter('/ch/02/gate/keysrc',0);await f.xr.writeParameter('/ch/02/gate/filter/on',0);
  await f.create();await f.workshop.analyze();while(f.workshop.status().job?.running)await new Promise(r=>setTimeout(r,5));
  const ref={quietStart:0,quietStop:.5,softStart:1,softStop:1.5};
  await assert.rejects(f.workshop.gateReference(2,ref,false),/identifie/);await assert.rejects(f.workshop.gateReference(2,{...ref,softStart:0},true),/distincts/);
  await f.workshop.gateReference(2,ref,true);const advice=f.workshop.status().active!.advice!.find(a=>a.kind==='gate')!;assert.ok(Object.keys(advice.changes).length);
  const before=await f.xr.readParameter('/ch/02/gate/thr');await f.workshop.trial(advice.id,'try');assert.notEqual(await f.xr.readParameter('/ch/02/gate/thr'),before);await f.workshop.trial(advice.id,'undo');assert.equal(await f.xr.readParameter('/ch/02/gate/thr'),before);
  await f.xr.writeParameter('/ch/02/gate/keysrc',1);await assert.rejects(f.workshop.trial(advice.id,'try'),/modifiés/);
 }finally{f.close();}
});

test('live compressor evidence is tied to actual playback and measured frames',async()=>{
 const f=await fixture();let timer:ReturnType<typeof setInterval>|undefined;try{
 await f.xr.writeParameter('/ch/02/dyn/on',1);await f.xr.writeParameter('/ch/02/dyn/mode',0);await f.create();f.xr.subscribeAnalysis=()=>{};
 let started=0;const call=f.bridge.call;f.bridge.call=async(cmd,args)=>{if(cmd==='workshop_transport'&&args.action==='play')started=Date.now();return call(cmd,args);};
 f.bridge.state=async()=>({...f.state,pos:f.state.playing?(Date.now()-started)/1000:0});
 timer=setInterval(()=>f.xr.emit('dynamics',{comp:Array(16).fill(-12),at:Date.now()}),40);
 await f.workshop.listenAnalyze();for(let i=0;i<1000&&f.workshop.status().job?.running;i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(f.workshop.status().job!.error,'');assert.equal(f.workshop.status().active!.dynamics![0]!.maxReduction,12);assert.match(f.workshop.status().active!.advice![0]!.fact,/console retire/);assert.equal(f.workshop.status().active!.advice![0]!.kind,'dynamics');assert.equal(f.state.playing,false);
 }finally{clearInterval(timer);f.close();}
});

test('a stalled REAPER counter invalidates live evidence and stops the workshop',async()=>{
 const f=await fixture();let timer:ReturnType<typeof setInterval>|undefined;try{
 await f.create();f.xr.subscribeAnalysis=()=>{};
 f.bridge.state=async()=>({...f.state,pos:.4});
 timer=setInterval(()=>f.xr.emit('dynamics',{comp:Array(16).fill(-12),at:Date.now()}),40);
 await f.workshop.listenAnalyze();for(let i=0;i<1000&&f.workshop.status().job?.running;i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(f.workshop.status().job!.running,false);assert.match(f.workshop.status().job!.error,/compteur REAPER/);
 assert.equal(f.workshop.status().active!.dynamics,undefined);assert.equal(f.state.playing,false);
 }finally{clearInterval(timer);f.close();}
});

test('live analysis completes when polling skips the exact loop boundary',async()=>{
 const f=await fixture();let timer:ReturnType<typeof setInterval>|undefined;try{
 const catalog=await f.workshop.catalog();await f.workshop.create({source:catalog.project,start:0,stop:30,mapping,confirm:true,rawConfirmed:true,deviceConfirmed:true,token:catalog.token});
 f.xr.subscribeAnalysis=()=>{};
 // Native REAPER trace: 29.36 s then 0.38 s, with neither boundary sampled.
 const positions=[0,5,10,15,20,25,28.3,29.362,.376];let index=0;
 f.bridge.state=async()=>({...f.state,pos:f.state.playing?positions[Math.min(index++,positions.length-1)]!:0,loop:{on:true,start:0,stop:30}});
 timer=setInterval(()=>f.xr.emit('dynamics',{comp:Array(16).fill(-12),at:Date.now()}),40);
 await f.workshop.listenAnalyze();for(let i=0;i<1000&&f.workshop.status().job?.running;i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(f.workshop.status().job!.error,'');assert.equal(f.workshop.status().job!.progress,100);
 assert.equal(f.workshop.status().active!.dynamics![0]!.maxReduction,12);assert.equal(f.state.playing,false);
 }finally{clearInterval(timer);f.close();}
});

test('a stereo polarity trial changes only the right channel and A/B/finish restore both polarities',async()=>{
 const f=await fixture();try{
 f.catalog.tracks[0]!.channels=2;const c=await f.workshop.catalog();
 await f.workshop.create({source:c.project,start:0,stop:2,mapping:[{...mapping[0],channel:1,channels:2,family:'backing'}],confirm:true,rawConfirmed:true,deviceConfirmed:true,token:c.token});
 const call=f.bridge.call;f.bridge.call=async(cmd,args)=>{const result=await call(cmd,args);if(cmd==='workshop_measure_batch')return {windows:Array.from({length:Math.ceil(args.duration)},(_,i)=>({start:args.start+i,duration:1,peak:.2,sumSquares:100,samples:96000,clipped:0,rate:48000,spectrum:Array(28).fill(1),stereo:{left:50,right:50,cross:-50,frames:48000}}))};return result;};
 await f.workshop.analyze();while(f.workshop.status().job?.running)await new Promise(r=>setTimeout(r,5));
 assert.equal(f.workshop.status().job!.error,'');const advice=f.workshop.status().active!.advice!.find(a=>a.id==='phase-1')!;assert.ok(advice);
 await f.workshop.trial(advice.id,'try');assert.equal(await f.xr.readParameter('/ch/01/preamp/invert'),0);assert.equal(await f.xr.readParameter('/ch/02/preamp/invert'),1);
 await f.workshop.trial(advice.id,'keep');await f.workshop.compare('A');assert.equal(await f.xr.readParameter('/ch/02/preamp/invert'),0);
 await f.workshop.compare('B');assert.equal(await f.xr.readParameter('/ch/02/preamp/invert'),1);await f.workshop.finish('A',true);assert.equal(await f.xr.readParameter('/ch/02/preamp/invert'),0);
 }finally{f.close();}
});

test('a stereo source across two console pairs refuses a newly linked right channel before writing polarity',async()=>{
 const f=await fixture();try{
 f.catalog.tracks[0]!.channels=2;const c=await f.workshop.catalog();
 await f.workshop.create({source:c.project,start:0,stop:2,mapping:[{...mapping[0],channel:2,channels:2,family:'backing'}],confirm:true,rawConfirmed:true,deviceConfirmed:true,token:c.token});
 const call=f.bridge.call;f.bridge.call=async(cmd,args)=>cmd==='workshop_measure_batch'?{windows:[0,1].map(i=>({start:i,duration:1,peak:.2,sumSquares:100,samples:96000,clipped:0,rate:48000,spectrum:Array(28).fill(1),stereo:{left:50,right:50,cross:-50,frames:48000}}))}:call(cmd,args);
 await f.workshop.analyze();while(f.workshop.status().job?.running)await new Promise(r=>setTimeout(r,5));
 assert.ok(f.workshop.status().active!.advice!.find(a=>a.id==='phase-2')!.changes['/ch/03/preamp/invert']);
 await f.xr.writeParameter('/config/chlink/3-4',1);await assert.rejects(()=>f.workshop.trial('phase-2','try'),/Canaux liés/);
 assert.equal(await f.xr.readParameter('/ch/03/preamp/invert'),0);assert.equal(await f.xr.readParameter('/ch/04/preamp/invert'),0);
 await f.workshop.analyze();while(f.workshop.status().job?.running)await new Promise(r=>setTimeout(r,5));
 assert.deepEqual(f.workshop.status().active!.advice!.find(a=>a.id==='phase-2')!.changes,{});
 }finally{f.close();}
});
