import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleCommands,commandValues} from '../src/console-commands.js';
import {CommandControl,conditionMatches} from '../src/command-control.js';
import {toWire} from '../src/parameters.js';
import {previewChannelBackup} from '../src/channel-operations.js';
function fixture(model:'XR18'|'MR12'='XR18'){
 const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library),commands=new ConsoleCommands(xr,control,library);
 let now=1000;const engine=new CommandControl(xr,control,library,()=>now);
 const save=(extra:Record<string,unknown>={},steps=[{channel:3,target:'mute',value:1}])=>commands.save({name:'Synthetic automation',data:{version:1,model,steps,...extra}});
 const arm=async(id:string,mode='midi')=>{const p=await engine.prepare('owner',{model,mode,ids:[id]});return engine.arm('owner',p.token,()=>{});};
 return {xr,library,control,commands,engine,save,arm,advance:(ms:number)=>{now+=ms;},close(){xr.close();library.close();}};
}
const rule={channel:1,target:'fader',threshold:-10,comparison:'above',hysteresis:.5} as const;
test('command timing preserves legacy data and validates model, finite delays, thresholds and hysteresis',()=>{
 const legacy={version:1,model:'MR12',steps:[{channel:1,target:'mute',value:1}]};assert.deepEqual(commandValues(legacy).command,legacy);
 for(const extra of [{delayMs:-1},{delayMs:30001},{delayMs:.5},{condition:{...rule,threshold:11}},{condition:{...rule,channel:13}},{condition:{...rule,hysteresis:-1}},{condition:{...rule,target:'mute',threshold:0,hysteresis:.5}},{condition:{...rule,target:'send',bus:3}}])assert.throws(()=>commandValues({...legacy,...extra}));
 const checked=commandValues({...legacy,delayMs:1500,condition:rule}).command;assert.equal(checked.delayMs,1500);assert.deepEqual(checked.condition,rule);
 assert.equal(conditionMatches(rule,-9.6,false),false);assert.equal(conditionMatches(rule,-9.4,false),true);assert.equal(conditionMatches(rule,-10.4,true),true);assert.equal(conditionMatches(rule,-10.6,true),false);
});
test('MIDI session prepares and arms without audio, is scoped to owner/selection, saves exact undo, rejects replay',async()=>{
 const f=fixture();try{
  const before=await f.control.capture(),one=f.save(),two=f.save({},[{channel:4,target:'mute',value:1}]);
  const p=await f.engine.prepare('owner',{model:'XR18',mode:'midi',ids:[one.id]});assert.deepEqual(await f.control.capture(),before);
  await assert.rejects(f.engine.arm('other',p.token,()=>{}));const s=await f.engine.arm('owner',p.token,()=>{});assert.deepEqual(await f.control.capture(),before);
  await assert.rejects(f.engine.pulse('other',{token:s.token,id:one.id,sequence:1},()=>{}));
  const r=await f.engine.pulse('owner',{token:s.token,id:one.id,sequence:1},()=>{});assert.equal(r.results.length,1);assert.equal(await f.xr.readParameter('/ch/03/mix/on'),0);
  const undo=await previewChannelBackup(f.xr,f.control,f.library,r.results[0]!.backupId!);await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
  await assert.rejects(f.engine.pulse('owner',{token:s.token,id:two.id,sequence:2},()=>{}));assert.deepEqual(await f.control.capture(),before);
  const next=await f.arm(one.id);await f.engine.pulse('owner',{token:next.token,id:one.id,sequence:1},()=>{});await assert.rejects(f.engine.pulse('owner',{token:next.token,id:one.id,sequence:1},()=>{}));
 }finally{f.close();}
});
test('delayed commands require a live lease, coalesce repeated presses and Stop cancels pending work',async()=>{
 const f=fixture();try{
  const command=f.save({delayMs:2000}),s=await f.arm(command.id);
  let r=await f.engine.pulse('owner',{token:s.token,id:command.id,sequence:1},()=>{});assert.equal(r.results.length,0);assert.equal(r.pending[0]!.remainingMs,2000);
  f.advance(1500);r=await f.engine.pulse('owner',{token:s.token,id:command.id,sequence:2},()=>{});assert.equal(r.pending[0]!.remainingMs,500);
  f.advance(500);r=await f.engine.pulse('owner',{token:s.token},()=>{});assert.equal(r.results.length,1);assert.equal(await f.xr.readParameter('/ch/03/mix/on'),0);
  f.engine.stop('owner',s.token);await f.xr.writeParameter('/ch/03/mix/on',1);
  const once=await f.arm(command.id,'once');f.advance(2000);f.engine.stop('owner',once.token);await assert.rejects(f.engine.pulse('owner',{token:once.token},()=>{}));assert.equal(await f.xr.readParameter('/ch/03/mix/on'),1);
  const expired=await f.arm(command.id,'once');f.advance(16000);await assert.rejects(f.engine.pulse('owner',{token:expired.token},()=>{}));assert.equal(await f.xr.readParameter('/ch/03/mix/on'),1);
 }finally{f.close();}
});
test('automatic macro observes crossings, holds through delay, cancels a brief crossing and only repeats after reset',async()=>{
 const f=fixture();try{
  const command=f.save({delayMs:1000,condition:rule});await f.xr.writeParameter('/ch/01/mix/fader',toWire('/ch/01/mix/fader',-5));
  const s=await f.arm(command.id,'automatic'),pulse=()=>f.engine.pulse('owner',{token:s.token},()=>{});
  assert.equal((await pulse()).results.length,0,'already true on arm does not fire');f.advance(1100);assert.equal((await pulse()).results.length,0);
  await f.xr.writeParameter('/ch/01/mix/fader',toWire('/ch/01/mix/fader',-15));await pulse();await f.xr.writeParameter('/ch/01/mix/fader',toWire('/ch/01/mix/fader',-5));assert.equal((await pulse()).pending.length,1);
  f.advance(500);await f.xr.writeParameter('/ch/01/mix/fader',toWire('/ch/01/mix/fader',-15));assert.equal((await pulse()).pending.length,0);f.advance(1000);assert.equal(await f.xr.readParameter('/ch/03/mix/on'),1);
  await f.xr.writeParameter('/ch/01/mix/fader',toWire('/ch/01/mix/fader',-5));await pulse();f.advance(1000);assert.equal((await pulse()).results.length,1);assert.equal(await f.xr.readParameter('/ch/03/mix/on'),0);assert.equal((await pulse()).results.length,0);
 }finally{f.close();}
});
test('automatic rules reject cycles, changed sources, changed commands, reconnection and unsupported models',async()=>{
 const f=fixture('MR12');try{
  const self=f.save({condition:{...rule,target:'mute',threshold:0,hysteresis:0,channel:3}});await assert.rejects(f.arm(self.id,'automatic'),/condition/);
  const a=f.save({condition:rule},[{channel:3,target:'fader',value:-20}]),b=f.save({condition:{...rule,channel:3}},[{channel:1,target:'fader',value:-20}]);await assert.rejects(f.engine.prepare('owner',{model:'MR12',mode:'automatic',ids:[a.id,b.id]}),/condition/);
  const c=f.save({condition:rule}),s=await f.arm(c.id,'automatic');await f.xr.writeParameter('/config/chlink/1-2',1);await assert.rejects(f.engine.pulse('owner',{token:s.token},()=>{}),/source/);assert.equal(await f.xr.readParameter('/ch/03/mix/on'),1);
  const changed=await f.arm(c.id);f.library.update(c.id,{...c.data as object,delayMs:100});await assert.rejects(f.engine.pulse('owner',{token:changed.token,id:c.id,sequence:1},()=>{}),/changé/);
  f.engine.stop('owner',changed.token);const reset=await f.arm(a.id);f.xr.cancelOperations();await assert.rejects(f.engine.pulse('owner',{token:reset.token,id:a.id,sequence:1},()=>{}));
  await assert.rejects(f.engine.prepare('owner',{model:'X32',mode:'midi',ids:[a.id]}));
 }finally{f.close();}
});
test('Stop during readback prevents later macro writes and preserves a partial-operation backup',async()=>{
 const f=fixture();try{
  const c=f.save({},[{channel:3,target:'mute',value:1},{channel:4,target:'mute',value:1}]),s=await f.arm(c.id);
  const original=f.xr.writeParameter.bind(f.xr);f.xr.writeParameter=async(...args)=>{const result=await original(...args);f.engine.stop('owner',s.token);return result;};
  let error:any;try{await f.engine.pulse('owner',{token:s.token,id:c.id,sequence:1},()=>{});}catch(e){error=e;}
  assert.ok(error?.backupId);assert.equal(await f.xr.readParameter('/ch/03/mix/on'),0);assert.equal(await f.xr.readParameter('/ch/04/mix/on'),1);
  assert.deepEqual((f.library.get(error.backupId).data as any).values,{'/ch/03/mix/on':1,'/ch/04/mix/on':1});
 }finally{f.close();}
});
test('Stop while a macro preview is being read prevents every write',async()=>{
 const f=fixture();try{
  const c=f.save(),s=await f.arm(c.id);const read=f.xr.readParameter.bind(f.xr);let cancelled=false;
  f.xr.readParameter=async a=>{const value=await read(a);if(!cancelled){cancelled=true;f.engine.stop('owner',s.token);}return value;};
  await assert.rejects(f.engine.pulse('owner',{token:s.token,id:c.id,sequence:1},()=>{}));assert.equal(await read('/ch/03/mix/on'),1);assert.equal(f.library.list('channel-operation-backup').length,0);
 }finally{f.close();}
});

test('compound conditions schedule stages and run a separate falling-edge action',async()=>{
 const f=fixture();
 try{
  const config={conditionSet:{match:'all',rules:[rule,{...rule,channel:2}],offSteps:[{channel:3,target:'mute',value:0}]}};
  const c=f.save(config,[{channel:3,target:'mute',value:1},{channel:4,target:'mute',value:1,delayMs:1000}] as {channel:number;target:string;value:number;delayMs?:number}[]);
  const s=await f.arm(c.id,'automatic'),pulse=()=>f.engine.pulse('owner',{token:s.token},()=>{});
  await f.xr.writeParameter('/ch/01/mix/fader',.75);
  assert.equal((await pulse()).results.length,0);
  await f.xr.writeParameter('/ch/02/mix/fader',.75);
  const first=await pulse();
  assert.equal(first.results.length,1);
  assert.equal(first.pending[0]?.remainingMs,1000);
  assert.equal(await f.xr.readParameter('/ch/03/mix/on'),0);
  assert.equal(await f.xr.readParameter('/ch/04/mix/on'),1);
  await f.xr.writeParameter('/ch/02/mix/fader',.2);
  const falling=await pulse();
  assert.equal(falling.results.length,1);
  assert.equal(falling.pending.length,0);
  assert.equal(await f.xr.readParameter('/ch/03/mix/on'),1);
  f.advance(1500);await pulse();
  assert.equal(await f.xr.readParameter('/ch/04/mix/on'),1);
  await f.xr.writeParameter('/ch/02/mix/fader',.75);
  await pulse();f.advance(1000);await pulse();
  assert.equal(await f.xr.readParameter('/ch/04/mix/on'),0);
 }finally{f.close();}
});
