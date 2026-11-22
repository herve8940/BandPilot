import test from 'node:test';
import assert from 'node:assert/strict';
import {FX_SCHEMAS,fxToWire,fxFromWire,defaultFxParameters,canEditFx,tempoTap,tempoDelayMs} from '../shared/fx-parameters.js';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleControl} from '../src/console-control.js';
import {FxPresets} from '../src/fx-presets.js';
import {previewMonitorCopy} from '../src/monitor-copy.js';
function fixture(model:import('../shared/mixer-models.js').MixerModelId='XR18'){const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);return {xr,library,control,close(){xr.close();library.close();}};}
test('twelve FX schemas roundtrip units, retain enum types, and reject out-of-range edits',()=>{
 assert.equal(Object.keys(FX_SCHEMAS).length,61);
 for(const [id,schema] of Object.entries(FX_SCHEMAS)){
  assert.ok(canEditFx({slot:1,algorithm:Number(id),parameters:defaultFxParameters(Number(id))}));
  for(const p of schema.parameters){for(const value of p.scale==='enum'?[0,p.options.length-1]:[p.lo,(p.hi+p.lo)/2,p.hi]){const wire=fxToWire(p,value);assert.ok(Math.abs(fxFromWire(p,wire.value)-value)<1e-6);assert.equal(wire.type,p.scale==='enum'?'i':'f');}assert.throws(()=>fxToWire(p,NaN));}
 }
 assert.ok(!canEditFx({slot:1,algorithm:7,parameters:[]}));
 assert.equal(fxFromWire(FX_SCHEMAS[10]!.parameters[1]!,fxToWire(FX_SCHEMAS[10]!.parameters[1]!,500).value),500);
});
test('tap tempo handles jitter, bounce, pause and musical divisions without silent clamping',()=>{
 let result={taps:[] as number[],bpm:null as number|null};for(const t of [0,500,1002,1500,2000])result=tempoTap(result.taps,t);
 assert.equal(result.bpm,120);assert.equal(tempoTap(result.taps,2010).bpm,120);assert.deepEqual(tempoTap(result.taps,6000),{taps:[6000],bpm:null});
 assert.equal(tempoDelayMs(120),500);assert.equal(tempoDelayMs(120,.75),375);assert.equal(tempoDelayMs(120,2),1000);assert.throws(()=>tempoDelayMs(24,2));assert.throws(()=>tempoDelayMs(0));
});
test('FX draft rejects stale read, preview writes nothing, apply backs up and undo restores the vector',async()=>{
 const f=fixture();try{const service=new FxPresets(f.xr,f.control,f.library),before=await f.xr.readFx(1),desired={...before,parameters:defaultFxParameters(10),algorithm:10};
  const p=await service.preview('edit',desired,undefined,before);assert.deepEqual(await f.xr.readFx(1),before);
  const applied=await service.apply('edit',p.token);assert.equal((await f.xr.readFx(1)).algorithm,10);
  await assert.rejects(service.preview('edit',before,undefined,before),/État modifié/);
  const undo=await service.preview('undo',f.library.get(applied.backupId).data);await service.apply('undo',undo.token);assert.deepEqual(await f.xr.readFx(1),before);
  const stale=await service.preview('edit',desired,undefined,before);await f.xr.applyFx({...before,parameters:before.parameters.map((p,i)=>i? p:{...p,value:.75})});await assert.rejects(service.apply('edit',stale.token),/État modifié/);
 }finally{f.close();}
});
test('monitor copy preserves masters and processing, guards source changes, and supports stereo undo',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/ch/01/mix/01/level',.3);await f.xr.writeParameter('/ch/01/mix/03/level',.1);await f.xr.writeParameter('/bus/3/mix/fader',.4);
  const p=await previewMonitorCopy(f.xr,f.control,1,3);assert.ok(p.changes.every(c=>/\/mix\/03\/level$/.test(c.address)));assert.equal(await f.xr.readParameter('/ch/01/mix/03/level'),.1);
  await f.xr.writeParameter('/ch/01/mix/01/level',.5);await assert.rejects(f.control.apply(p.token),/État modifié/);
  await f.xr.writeParameter('/config/buslink/1-2',1);await f.xr.writeParameter('/config/buslink/3-4',1);await f.xr.writeParameter('/ch/01/mix/01/pan',.8);
  const plan=await previewMonitorCopy(f.xr,f.control,1,3);assert.equal(plan.stereo,true);assert.ok(plan.changes.some(c=>c.address==='/ch/01/mix/03/pan'));
  const result=await f.control.apply(plan.token);assert.equal(await f.xr.readParameter('/ch/01/mix/03/pan'),.8);assert.equal(await f.xr.readParameter('/bus/3/mix/fader'),.4);
  const undo=await f.control.preview(f.library.get(result.backupId).data,true);await f.control.apply(undo.token);assert.equal(await f.xr.readParameter('/ch/01/mix/03/level'),.1);
  await assert.rejects(previewMonitorCopy(f.xr,f.control,2,3),/paires stéréo/);await assert.rejects(previewMonitorCopy(f.xr,f.control,1,5),/paires stéréo/);
 }finally{f.close();}
});
test('small models cannot copy to missing physical outputs',async()=>{for(const model of ['XR12','MR12'] as const){const f=fixture(model);try{await assert.rejects(previewMonitorCopy(f.xr,f.control,1,3),/disponibles/);}finally{f.close();}}});

test('selecting a known algorithm in the simulated mixer exposes its editable parameter vector',async()=>{
 const f=fixture();try{await f.xr.writeParameter('/fx/2/type',10);const delay=await f.xr.readFx(2);assert.equal(delay.algorithm,10);assert.ok(canEditFx(delay));assert.equal(fxFromWire(FX_SCHEMAS[10]!.parameters[1]!,delay.parameters[1]!.value),500);}finally{f.close();}
});
