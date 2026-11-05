import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {VocalFx,vocalFxProgram} from '../src/vocal-fx.js';
import {toWire} from '../src/parameters.js';
import type {CoachProfile} from '../src/sound-coach.js';
import {VOCAL_AMBIENCES} from '../shared/vocal-ambiences.js';
const profile:CoachProfile={version:1,completed:[],inputs:[{channel:1,name:'Chant',source:'lead-rock'},{channel:2,name:'Chœurs',source:'backing-vocal'}],musicians:[{name:'Voix',bus:1,role:'chant',channels:[1]},{name:'Guitare',bus:2,role:'guitare',channels:[3]}]};
function fixture(){const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false}),db=new LibraryStore(':memory:');return {xr,db,fx:new VocalFx(xr,db,()=>profile),close(){xr.close();db.close();}};}
const choice={channel:1,ambience:'pop',doses:{'1':-18,'2':-24}};
test('vocal ambience maps only known X-Air effect vectors, including wet-only delay',()=>{
 for(const a of VOCAL_AMBIENCES){const f=vocalFxProgram(a.id,1);assert.equal(f.parameters.length,12);assert.ok(f.parameters.every(p=>Number.isFinite(p.value)&&p.value>=0&&p.value<=(p.type==='i'?4:1)));}
 const delay=vocalFxProgram('slap',1);assert.deepEqual(delay.parameters.map(p=>p.type).join(''),'ffiiifffffff');assert.equal(delay.parameters[0]!.value,1);assert.equal(delay.parameters[9]!.value,.08);
 assert.throws(()=>vocalFxProgram('unknown',1));
});
test('preview does not write; independent monitor amounts preserve dry signal, masters and FOH',async()=>{
 const f=fixture();try{
  const unchanged:Record<string,number|string>={};for(const a of ['/ch/01/mix/fader','/ch/01/mix/01/level','/bus/1/mix/fader','/lr/mix/on','/headamp/01/phantom','/rtn/1/mix/01/level'])unchanged[a]=await f.xr.readParameter(a);
  const before=f.xr.parameterState(),p=await f.fx.preview(choice);assert.deepEqual(f.xr.parameterState(),before);assert.equal(p.slot,1);
  await f.fx.apply(p.token,true);assert.equal(f.fx.status().session!.phase,'trial');
  assert.equal(await f.xr.readParameter('/rtn/1/mix/01/level'),toWire('/rtn/1/mix/01/level',-18));assert.equal(await f.xr.readParameter('/rtn/1/mix/02/level'),toWire('/rtn/1/mix/02/level',-24));
  assert.equal(await f.xr.readParameter('/rtn/1/mix/lr'),0);assert.equal(await f.xr.readParameter('/rtn/1/mix/01/tap'),3);assert.equal(await f.xr.readParameter('/rtn/1/config/name'),'Voix FX');
  for(const a of ['/ch/01/mix/fader','/ch/01/mix/01/level','/bus/1/mix/fader','/lr/mix/on','/headamp/01/phantom'])assert.equal(await f.xr.readParameter(a),unchanged[a],a);
  await f.fx.undo(false,true);assert.equal(f.fx.status().session,null);assert.equal(await f.xr.readParameter('/rtn/1/mix/01/level'),unchanged['/rtn/1/mix/01/level']);
 }finally{f.close();}
});
test('used slots, inserted effects and stale previews are never overwritten',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/ch/03/mix/07/level',.5);await f.xr.writeParameter('/fx/2/insert',1);
  const p=await f.fx.preview(choice);assert.equal(p.slot,3);
  await f.xr.writeParameter('/ch/04/mix/09/level',.4);await assert.rejects(f.fx.apply(p.token,true),/console a changé/);assert.equal(f.fx.status().session,null);
  await f.xr.writeParameter('/ch/03/mix/10/level',.5);await assert.rejects(f.fx.preview(choice),/quatre effets/);
 }finally{f.close();}
});
test('factory return levels do not falsely occupy an unfed effect; FX-to-FX sends do',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/rtn/1/mix/fader',.75);await f.xr.writeParameter('/rtn/1/mix/lr',1);assert.equal((await f.fx.preview(choice)).slot,1);
  await f.xr.writeParameter('/rtn/1/mix/08/level',.4);assert.equal((await f.fx.preview(choice)).slot,3,'both the sending effect and its fed destination are occupied');
 }finally{f.close();}
});
test('kept ambience survives restart; undo of a second style restores the first, removal restores original',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview(choice);await f.fx.apply(p.token,true);await f.fx.keep();const first=await f.xr.readFx(1);
  const resumed=new VocalFx(f.xr,f.db,()=>profile);assert.equal(resumed.status().session!.phase,'kept');
  const second=await resumed.preview({...choice,channel:2,ambience:'rock'});await resumed.apply(second.token,true);await resumed.undo(false,true);
  assert.equal(resumed.status().session!.choice.channel,1);assert.deepEqual(await f.xr.readFx(1),first);assert.equal(await f.xr.readParameter('/ch/02/mix/07/level'),0);
  await resumed.undo(true,true);assert.equal(resumed.status().session,null);assert.equal(await f.xr.readParameter('/ch/01/mix/07/level'),0);
 }finally{f.close();}
});
test('partial effect write retains an explicit recovery snapshot and blocks more trials',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview(choice),write=f.xr.applyFx.bind(f.xr);let fail=true;
  f.xr.applyFx=async fx=>{if(fail)throw Error('test disconnect');return write(fx);};
  await assert.rejects(f.fx.apply(p.token,true),/Essai incomplet/);assert.equal(f.fx.status().session!.phase,'recovery');await assert.rejects(f.fx.preview(choice),/annule/);
  fail=false;const resumed=new VocalFx(f.xr,f.db,()=>profile);await resumed.undo(false,true);assert.equal(resumed.status().session,null);
 }finally{f.close();}
});
test('stereo monitors need equal doses; invalid or unassigned destinations are rejected',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/config/buslink/1-2',1);await assert.rejects(f.fx.preview(choice),/paire stéréo/);
  const p=await f.fx.preview({...choice,doses:{'1':-18,'2':-18}});assert.equal(p.monitors[0]!.db,p.monitors[1]!.db);
  for(const bad of [{...choice,channel:3},{...choice,doses:{'6':-18}},{...choice,doses:{'1':4}}])await assert.rejects(f.fx.preview(bad));
 }finally{f.close();}
});
test('musicians can dose the shared effect from their phones without breaking style undo',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview(choice);await f.fx.apply(p.token,true);await f.fx.keep();
  const second=await f.fx.preview({...choice,ambience:'slap'});await f.fx.apply(second.token,true);
  const amount=toWire('/rtn/1/mix/02/level',-15);await f.xr.writeParameter('/rtn/1/mix/02/level',amount);
  await f.fx.undo(false,true);assert.equal(await f.xr.readParameter('/rtn/1/mix/02/level'),amount);assert.equal(f.fx.status().session!.choice.ambience,'pop');
  await f.xr.writeParameter('/rtn/1/mix/03/level',.5);await assert.rejects(f.fx.readDoses(),/modifiée/,'a new recipient is not silently adopted');
 }finally{f.close();}
});

test('small manual FX changes invalidate a preview and a kept session',async()=>{
 const f=fixture();try{
  await f.xr.applyFx(vocalFxProgram('natural',1));const p=await f.fx.preview(choice);
  const manual=await f.xr.readFx(1);manual.parameters[0]!.value+=.01;await f.xr.applyFx(manual);
  await assert.rejects(f.fx.apply(p.token,true),/console a changé/);assert.equal(f.fx.status().session,null);
  const next=await f.fx.preview(choice);await f.fx.apply(next.token,true);await f.fx.keep();
  const changed=await f.xr.readFx(1);changed.parameters[0]!.value+=.01;await f.xr.applyFx(changed);
  await assert.rejects(f.fx.undo(true,true),/modifiée/);assert.deepEqual(await f.xr.readFx(1),changed);
 }finally{f.close();}
});

test('an obsolete browser proposal cannot consume the latest proposal',async()=>{
 const f=fixture();try{
  const first=await f.fx.preview(choice),latest=await f.fx.preview({...choice,ambience:'rock'});
  await assert.rejects(f.fx.apply(first.token,true),/Relis la proposition/);
  await f.fx.apply(latest.token,true);assert.equal(f.fx.status().session!.choice.ambience,'rock');
 }finally{f.close();}
});
