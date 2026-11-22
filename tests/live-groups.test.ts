import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleControl} from '../src/console-control.js';
import {LiveGroups} from '../src/live-groups.js';
import {previewChannelBackup} from '../src/channel-operations.js';
import {toWire,fromWire} from '../src/parameters.js';
function fixture(model:'XR18'|'MR12'='XR18'){
 const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
 return {xr,library,control,live:new LiveGroups(xr,control,library),close(){xr.close();library.close();}};
}
test('continuous groups arm without writes, preserve offsets and silence, reject reordered commands and undo the whole gesture',async()=>{
 const f=fixture();try{
  for(const [ch,db]of [[1,-15],[2,-6]] as const)await f.xr.writeParameter(`/ch/0${ch}/mix/fader`,toWire(`/ch/0${ch}/mix/fader`,db));
  await f.xr.writeParameter('/ch/03/mix/fader',0);
  const before=await f.control.capture(),s=await f.live.start('one',{model:'XR18',selection:{channels:[1,2,3],target:'fader'}});
  assert.deepEqual(await f.control.capture(),before);
  await assert.rejects(f.live.start('two',{model:'XR18',selection:{channels:[4,5],target:'fader'}}),/déjà actif/);
  const a=await f.live.move('one',{token:s.token,sequence:1,offset:3},()=>{});
  assert.equal(fromWire('/ch/01/mix/fader',await f.xr.readParameter('/ch/01/mix/fader')),-12);
  assert.equal(await f.xr.readParameter('/ch/03/mix/fader'),0);
  await assert.rejects(f.live.move('one',{token:s.token,sequence:1,offset:5},()=>{}),/ordre/);
  await f.live.move('one',{token:s.token,sequence:2,offset:-5},()=>{});
  assert.equal(fromWire('/ch/01/mix/fader',await f.xr.readParameter('/ch/01/mix/fader')),-20);
  f.live.stop('one',s.token);
  const undo=await previewChannelBackup(f.xr,f.control,f.library,a.backupId!);await f.control.apply(undo.token);
  assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
test('monitor groups stay on their mix, reject stale values, invalid buses and other owners; disconnects disarm',async()=>{
 const f=fixture('MR12');try{
  const input={model:'MR12',selection:{channels:[1,2],target:'send',bus:2}};
  await assert.rejects(f.live.start('one',{...input,selection:{...input.selection,bus:3}}),/retour|groupe/i);
  for(const ch of [1,2])await f.xr.writeParameter(`/ch/0${ch}/mix/02/level`,.5);
  const before=await f.control.capture(),s=await f.live.start('one',input);
  await assert.rejects(f.live.move('two',{token:s.token,sequence:1,offset:2},()=>{}),/désactivé/);
  await f.live.move('one',{token:s.token,sequence:1,offset:2},()=>{});
  const after=await f.control.capture();for(const [a,v]of Object.entries(before.values))if(!/^\/ch\/0[12]\/mix\/02\/level$/.test(a))assert.equal(after.values[a],v,a);
  await f.xr.writeParameter('/ch/01/mix/02/level',.4);
  await assert.rejects(f.live.move('one',{token:s.token,sequence:2,offset:3},()=>{}),/État modifié/);
  await assert.rejects(f.live.move('one',{token:s.token,sequence:2,offset:3},()=>{}),/désactivé/);
  const next=await f.live.start('one',input);f.xr.cancelOperations();await assert.rejects(f.live.move('one',{token:next.token,sequence:1,offset:1},()=>{}),/désactivé/);
 }finally{f.close();}
});

test('stop during preparation prevents writes and releases the controller; stop during a completed step still returns its recovery backup',async()=>{
 const f=fixture();try{
  const input={model:'XR18',selection:{channels:[1,2],target:'fader'}};
  await f.xr.writeParameter('/ch/01/mix/fader',.5);await f.xr.writeParameter('/ch/02/mix/fader',.5);
  const before=await f.control.capture(),s=await f.live.start('one',input);
  const read=f.xr.readParameter.bind(f.xr);let release!:()=>void,entered!:()=>void;
  const held=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);let once=true;
  f.xr.readParameter=async a=>{if(once){once=false;entered();await held;}return read(a);};
  const moving=f.live.move('one',{token:s.token,sequence:1,offset:2},()=>{});await started;f.live.stop('one',s.token);release();await assert.rejects(moving,/désactivé/);f.xr.readParameter=read;
  assert.deepEqual(await f.control.capture(),before);
  const next=await f.live.start('one',input),apply=f.control.apply.bind(f.control);let finish!:()=>void,applied!:()=>void;
  const completion=new Promise<void>(r=>finish=r),written=new Promise<void>(r=>applied=r);
  f.control.apply=async(...args)=>{const result=await apply(...args);applied();await completion;return result;};
  const step=f.live.move('one',{token:next.token,sequence:1,offset:2},()=>{});await written;f.live.stop('one',next.token);finish();const result=await step;assert.ok(result.backupId);
  f.control.apply=apply;const undo=await previewChannelBackup(f.xr,f.control,f.library,result.backupId!);await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
