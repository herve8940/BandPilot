import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {OutputSceneRecall} from '../src/output-scene-recall.js';
import {defaultFxParameters} from '../shared/fx-parameters.js';
function fixture(model:'XR18'|'MR12'='XR18'){
 const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
 return {xr,library,control,recall:new OutputSceneRecall(xr,control,library),close(){xr.close();library.close();}};
}
test('output recall previews without writes, applies selected GEQ and FX, preserves sends and routing, and restores exactly',async()=>{
 for(const model of ['XR18','MR12'] as const){const f=fixture(model);try{
  await f.xr.writeParameter('/bus/1/eq/mode',2);await f.xr.writeParameter('/bus/1/geq/1k',.3);
  await f.xr.applyFx({slot:2,algorithm:60,parameters:defaultFxParameters(60)});
  const scene=f.library.save('scene','Synthetic output scene',await f.control.capture());
  await f.xr.writeParameter('/bus/1/geq/1k',.7);await f.xr.writeParameter('/bus/1/eq/mode',0);await f.xr.applyFx({slot:2,algorithm:10,parameters:defaultFxParameters(10)});
  const before=await f.control.capture(),plan=await f.recall.preview(scene.id,{targets:['/bus/1'],sections:['eq'],fxSlots:[2]});
  assert.deepEqual(await f.control.capture(),before);assert.ok(plan.token);assert.equal(plan.fx.length,1);
  const result=await f.recall.apply(scene.id,plan.token,()=>{}),after=await f.control.capture();
  assert.equal(after.values['/bus/1/geq/1k'],.3);assert.equal(after.fx[1]!.algorithm,60);
  for(const [a,v]of Object.entries(before.values))if(!a.startsWith('/bus/1/eq/')&&!a.startsWith('/bus/1/geq/')&&a!=='/fx/2/type')assert.equal(after.values[a],v,a);
  const restarted=new OutputSceneRecall(f.xr,f.control,f.library),undo=await restarted.backup(result.backupId);await restarted.apply(result.backupId,undo.token,()=>{});
  assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}}
});
test('output protections are preferences, protect both linked buses and FX, block full recalls and invalidate pending previews',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/config/buslink/1-2',1);
  const source=await f.control.capture();source.values['/bus/1/geq/1k']=.3;source.values['/bus/2/geq/1k']=.3;source.fx[0]={slot:1,algorithm:60,parameters:defaultFxParameters(60)};
  const scene=f.library.save('scene','Synthetic linked output',source),before=await f.control.capture();
  const scope={targets:['/bus/1','/bus/2'],sections:['eq'],fxSlots:[1]},stale=await f.recall.preview(scene.id,scope);
  const saved=f.library.saveOutputProtections({model:'XR18',revision:0,rules:[{target:'/bus/2',sections:['eq']},{target:'fx:1',sections:['fx']}]});
  assert.deepEqual(await f.control.capture(),before);assert.throws(()=>f.control.assertFullRecall(),/protections/);
  await assert.rejects(f.recall.apply(scene.id,stale.token,()=>{}),/protections ont changé/);
  const blocked=await f.recall.preview(scene.id,scope);assert.equal(blocked.token,null);assert.ok(blocked.excluded.includes('/bus/1'));assert.ok(blocked.excluded.includes('FX 1'));
  assert.throws(()=>f.library.saveOutputProtections({...saved,revision:0,rules:[]}),/changé/);
  f.library.saveOutputProtections({...saved,rules:[]});const plan=await f.recall.preview(scene.id,scope),applied=await f.recall.apply(scene.id,plan.token,()=>{});
  f.library.saveOutputProtections({model:'XR18',revision:2,rules:[{target:'/bus/1',sections:['eq']},{target:'fx:1',sections:['fx']}]});
  const undo=await f.recall.backup(applied.backupId);assert.equal(undo.token,null);
 }finally{f.close();}
});
test('output recall refuses invalid models, incomplete pairs and stale output or FX state before writing',async()=>{
 const f=fixture('MR12');try{
  const scene=f.library.save('scene','Synthetic scene',await f.control.capture());
  await assert.rejects(f.recall.preview(scene.id,{targets:['/bus/3'],sections:['eq'],fxSlots:[]}),/invalide/);
  const source=scene.data as any;source.values['/config/buslink/1-2']=1;source.values['/bus/1/geq/1k']=.2;source.values['/bus/2/geq/1k']=.2;f.library.update(scene.id,source);await f.xr.writeParameter('/config/buslink/1-2',1);
  await assert.rejects(f.recall.preview(scene.id,{targets:['/bus/1'],sections:['eq'],fxSlots:[]}),/deux bus/);
  const plan=await f.recall.preview(scene.id,{targets:['/bus/1','/bus/2'],sections:['eq'],fxSlots:[]});await f.xr.writeParameter('/bus/1/geq/1k',.6);const before=await f.control.capture();await assert.rejects(f.recall.apply(scene.id,plan.token,()=>{}),/État modifié/);assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
