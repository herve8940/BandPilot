import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {LiveGroups} from '../src/live-groups.js';
import {previewGroupMute,previewChannelBackup} from '../src/channel-operations.js';
import {fromWire,toWire} from '../src/parameters.js';
import type {MixerModelId} from '../shared/mixer-models.js';
function fixture(model:MixerModelId='XR18'){
 const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
 return {xr,library,control,live:new LiveGroups(xr,control,library),db:(a:string,v:number)=>xr.writeParameter(a,toWire(a,v)),read:async(a:string)=>Number(fromWire(a,await xr.readParameter(a))),close(){xr.close();library.close();}};
}
test('following members keeps individual edits, handles silence and undo restores the last step, not the original activation',async()=>{
 const f=fixture();try{
  const a='/ch/01/mix/fader',b='/ch/02/mix/fader',c='/ch/03/mix/fader';await f.db(a,-15);await f.db(b,-6);await f.xr.writeParameter(c,0);
  const s=await f.live.start('one',{model:'XR18',selection:{channels:[1,2,3],target:'fader'},followMembers:true});
  await f.live.move('one',{token:s.token,sequence:1,offset:3},()=>{});
  await f.db(a,-20);await f.db(c,-30);const before=await f.control.capture();
  const r=await f.live.move('one',{token:s.token,sequence:2,offset:5},()=>{});
  assert.equal(await f.read(a),-18);assert.equal(await f.read(b),-1);assert.equal(await f.read(c),-28);
  f.live.stop('one',s.token);const undo=await previewChannelBackup(f.xr,f.control,f.library,r.backupId!);await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
  const next=await f.live.start('one',{model:'XR18',selection:{channels:[1,2],target:'fader'},followMembers:true});await f.xr.writeParameter(a,0);await f.live.move('one',{token:next.token,sequence:1,offset:1},()=>{});assert.equal(await f.xr.readParameter(a),0);
 }finally{f.close();}
});
test('following members refuses source changes and out-of-range gestures without partial writes',async()=>{
 for(const unsafe of ['source','range']){const f=fixture();try{
  const a='/ch/01/mix/fader';await f.db(a,-12);await f.db('/ch/02/mix/fader',-20);
  const s=await f.live.start('one',{model:'XR18',selection:{channels:[1,2],target:'fader'},followMembers:true});
  if(unsafe==='source')await f.xr.writeParameter('/ch/01/config/insrc',3);else await f.db(a,9);
  const before=await f.control.capture();await assert.rejects(f.live.move('one',{token:s.token,sequence:1,offset:3},()=>{}),unsafe==='source'?/sources/:/plage/);assert.deepEqual(await f.control.capture(),before);
  await assert.rejects(f.live.move('one',{token:s.token,sequence:1,offset:1},()=>{}),/désactivé/);
 }finally{f.close();}}
});
test('following a monitor group stays on its bus and rejects malformed options',async()=>{
 const f=fixture('MR12');try{
  const input={model:'MR12',selection:{channels:[1,2],target:'send',bus:2}};
  await assert.rejects(f.live.start('one',{...input,followMembers:'yes'}),/Option/);
  const a='/ch/01/mix/02/level',b='/ch/02/mix/02/level';await f.db(a,-20);await f.db(b,-10);
  const s=await f.live.start('one',{...input,followMembers:true});await f.live.move('one',{token:s.token,sequence:1,offset:2},()=>{});await f.db(a,-30);
  const before=await f.control.capture();await f.live.move('one',{token:s.token,sequence:2,offset:1},()=>{});assert.equal(await f.read(a),-31);assert.equal(await f.read(b),-9);
  const after=await f.control.capture();for(const [address,value]of Object.entries(before.values))if(![a,b].includes(address))assert.equal(after.values[address],value,address);
 }finally{f.close();}
});
test('stopping during a group write prevents remaining writes and exposes a restorable backup',async()=>{
 const f=fixture();try{
  for(const ch of [1,2,3])await f.db(`/ch/0${ch}/mix/fader`,-20);
  const before=await f.control.capture(),s=await f.live.start('one',{model:'XR18',selection:{channels:[1,2,3],target:'fader'},followMembers:true});
  const original=f.xr.writeParameter.bind(f.xr);let count=0;
  f.xr.writeParameter=async(...args)=>{const r=await original(...args);count++;f.live.stop('one',s.token);return r;};
  let backup='';try{await f.live.move('one',{token:s.token,sequence:1,offset:3},()=>{});assert.fail('must cancel');}catch(e){backup=(e as Error&{backupId:string}).backupId;assert.ok(backup);}
  assert.equal(count,1);f.xr.writeParameter=original;const undo=await previewChannelBackup(f.xr,f.control,f.library,backup);await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
test('group mute preview is read-only and undo preserves previous individual mutes on every X-Air model',async()=>{
 for(const model of ['XR18','MR18','X18','XR12','MR12'] as const){const f=fixture(model);try{
  await f.xr.writeParameter('/ch/01/mix/on',0);const before=await f.control.capture();
  const plan=await previewGroupMute(f.xr,f.control,{model,selection:{channels:[1,2,3],target:'fader'}});assert.deepEqual(await f.control.capture(),before);
  assert.deepEqual(plan.changes.map(c=>c.address),['/ch/02/mix/on','/ch/03/mix/on']);const result=await f.control.apply(plan.token);
  assert.equal(await f.xr.readParameter('/ch/01/mix/on'),0);assert.equal(await f.xr.readParameter('/ch/03/mix/on'),0);
  assert.equal((await previewGroupMute(f.xr,f.control,{model,selection:{channels:[1,2,3],target:'fader'}})).token,null);
  const undo=await previewChannelBackup(f.xr,f.control,f.library,result.backupId);await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}}
});
test('monitor mute handles linked destinations, preserves other mixes and refuses stale topology or absent buses',async()=>{
 const f=fixture('MR12');try{
  await f.xr.writeParameter('/config/buslink/1-2',1);for(const ch of [1,2])for(const bus of [1,2])await f.db(`/ch/0${ch}/mix/0${bus}/level`,-20);const before=await f.control.capture();
  const input={model:'MR12',selection:{channels:[1,2],target:'send',bus:2}},plan=await previewGroupMute(f.xr,f.control,input);
  assert.deepEqual(plan.buses,[1,2]);assert.equal(plan.changes.length,4);assert.ok(plan.changes.every(c=>/^\/ch\/0[12]\/mix\/0[12]\/level$/.test(c.address)));
  const r=await f.control.apply(plan.token),after=await f.control.capture();for(const [a,v]of Object.entries(before.values))if(!plan.changes.some(c=>c.address===a))assert.equal(after.values[a],v,a);
  const undo=await previewChannelBackup(f.xr,f.control,f.library,r.backupId);await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
  const stale=await previewGroupMute(f.xr,f.control,input);await f.xr.writeParameter('/config/buslink/1-2',0);await assert.rejects(f.control.apply(stale.token),/État modifié/);
  await assert.rejects(previewGroupMute(f.xr,f.control,{...input,selection:{...input.selection,bus:3}}));
  await f.xr.writeParameter('/config/chlink/1-2',1);await assert.rejects(previewGroupMute(f.xr,f.control,{...input,selection:{channels:[1,3],target:'fader'}}),/deux entrées/);
 }finally{f.close();}
 const x=fixture('X32');try{await assert.rejects(previewGroupMute(x.xr,x.control,{model:'X32',selection:{channels:[1,2],target:'fader'}}),/X-Air/);}finally{x.close();}
});

test('send groups reject subgroup taps and a changed tap invalidates an already reviewed mute',async()=>{
 const f=fixture();try{
  const input={model:'XR18',selection:{channels:[1,2],target:'send',bus:1}};
  for(const ch of [1,2])await f.db(`/ch/0${ch}/mix/01/level`,-20);
  const plan=await previewGroupMute(f.xr,f.control,input);
  await f.xr.writeParameter('/ch/01/mix/01/tap',5);const before=await f.control.capture();
  await assert.rejects(f.control.apply(plan.token),/État modifié/);
  await assert.rejects(previewGroupMute(f.xr,f.control,input),/sous-groupe/);
  await assert.rejects(f.live.start('one',{...input,followMembers:true}),/sous-groupe/);
  assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
