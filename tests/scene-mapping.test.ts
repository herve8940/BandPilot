import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {SceneRecall} from '../src/scene-recall.js';
import type {MixerModelId} from '../shared/mixer-models.js';
const mono={channels:[1],sections:['eq'],mapping:[{source:1,target:7}]};
const stereo={channels:[1,2],sections:['eq'],mapping:[{source:1,target:7},{source:2,target:8}]};
function fixture(model:MixerModelId='XR18'){
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,model}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library),recall=new SceneRecall(xr,control,library);
 return {xr,library,control,recall,save:async()=>library.save('scene','Synthetic mapping scene',await control.capture()),close(){xr.close();library.close();}};
}
test('mapped processing changes only the destination, preserves mixed monitor sends and old scenes, and undo follows the destination',async()=>{
 for(const model of ['XR18','MR18','X18','XR12','MR12'] as const){const f=fixture(model);try{
  await f.xr.writeParameter('/ch/01/eq/1/g',.7);const scene=await f.save(),originalScene=structuredClone(scene.data);
  await f.xr.writeParameter('/ch/01/eq/1/g',.2);await f.xr.writeParameter('/ch/07/eq/1/g',.3);
  await f.xr.writeParameter('/ch/07/mix/01/level',.1);await f.xr.writeParameter('/ch/07/mix/02/level',.6);await f.xr.writeParameter('/ch/07/config/insrc',4);
  const before=await f.control.capture(),p=await f.recall.preview(scene.id,mono);
  assert.deepEqual(p.mapping,mono.mapping);assert.deepEqual(p.changes.map(c=>c.address),['/ch/07/eq/1/g']);assert.deepEqual(await f.control.capture(),before);
  const result=await f.recall.apply(scene.id,p.token,true),after=await f.control.capture();assert.equal(after.values['/ch/07/eq/1/g'],.7);after.values['/ch/07/eq/1/g']=.3;assert.deepEqual(after,before);
  assert.deepEqual(f.library.get(scene.id).data,originalScene);
  const backup=f.library.get(result.backupId).data as any;assert.deepEqual(Object.keys(backup.values),['/ch/07/eq/1/g']);assert.ok(!Object.keys(backup.guards).some(a=>a.startsWith('/ch/01/')));
  await f.xr.writeParameter('/ch/01/config/insrc',3);await f.xr.writeParameter('/ch/01/eq/1/g',.8);
  const undo=await f.recall.previewBackup(result.backupId);await f.recall.apply(result.backupId,undo.token,true);
  assert.equal(await f.xr.readParameter('/ch/07/eq/1/g'),.3);assert.equal(await f.xr.readParameter('/ch/01/eq/1/g'),.8);assert.equal(await f.xr.readParameter('/ch/07/mix/02/level'),.6);
  // Files without an explicit model remain valid on the existing compatible models.
  if(['XR18','MR18','X18'].includes(model)){const old=structuredClone(originalScene) as any;delete old.model;const entry=f.library.save('scene','Older scene',old);assert.ok((await f.recall.preview(entry.id,mono)).token);}
 }finally{f.close();}}
});
test('mono channel swaps use the saved scene snapshot, with labels and levels only when selected',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/ch/01/config/name','Source A');await f.xr.writeParameter('/ch/07/config/name','Source B');await f.xr.writeParameter('/ch/01/mix/fader',.25);await f.xr.writeParameter('/ch/07/mix/fader',.75);
  const scene=await f.save(),before=await f.control.capture(),p=await f.recall.preview(scene.id,{channels:[7,1],sections:['labels','levels'],mapping:[{source:7,target:1},{source:1,target:7}]});
  assert.deepEqual(p.mapping,[{source:1,target:7},{source:7,target:1}]);const result=await f.recall.apply(scene.id,p.token,true);
  assert.equal(await f.xr.readParameter('/ch/01/config/name'),'Source B');assert.equal(await f.xr.readParameter('/ch/07/config/name'),'Source A');assert.equal(await f.xr.readParameter('/ch/07/mix/fader'),.25);
  const undo=await f.recall.previewBackup(result.backupId);await f.recall.apply(result.backupId,undo.token,true);assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
test('invalid, duplicate, missing and unavailable mappings fail before audio writes or backups',async()=>{
 const f=fixture('XR12');try{
  const scene=await f.save(),before=await f.control.capture();
  for(const mapping of [null,{},[],[{source:1,target:1}], [{source:1,target:7},{source:1,target:8}], [{source:1,target:7},{source:2,target:7}], [{source:1,target:7},{source:3,target:8}], [{source:1,target:7},{source:2,target:13}], [{source:1,target:7},{source:2,target:'8'}], [{source:1,target:7},{source:2,target:0}], [{source:1,target:7},{source:2,target:8.5}], [null,null]]){
   await assert.rejects(f.recall.preview(scene.id,{channels:[1,2],sections:['eq'],mapping}),/destination/);
  }
  const partial=await f.control.capture();delete partial.values['/ch/01/eq/1/g'];const saved=f.library.save('scene','Incomplete',partial);await assert.rejects(f.recall.preview(saved.id,mono),/tous les réglages/);
  assert.deepEqual(await f.control.capture(),before);assert.equal(f.library.list('scene-recall-backup').length,0);
 }finally{f.close();}
});
test('linked stereo mapping keeps L/R settings and validates source geometry and destination sharing',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/config/chlink/1-2',1);await f.xr.writeParameter('/config/linkcfg/eq',0);
  await f.xr.writeParameter('/ch/01/eq/1/g',.7);await f.xr.writeParameter('/ch/02/eq/1/g',.2);const scene=await f.save();
  for(const scope of [mono,{...stereo,mapping:[{source:1,target:8},{source:2,target:7}]},{...stereo,mapping:[{source:1,target:7},{source:2,target:10}]}])await assert.rejects(f.recall.preview(scene.id,scope),/paire complète/);
  await assert.rejects(f.recall.preview(scene.id,stereo),/liaison stéréo diffère/);
  await f.xr.writeParameter('/config/chlink/7-8',1);await f.xr.writeParameter('/ch/07/eq/1/g',.3);await f.xr.writeParameter('/ch/08/eq/1/g',.4);
  const before=await f.control.capture(),p=await f.recall.preview(scene.id,stereo);assert.deepEqual(p.stereoLink?.pairs,[7]);
  const applied=await f.recall.apply(scene.id,p.token,true);assert.equal(await f.xr.readParameter('/ch/07/eq/1/g'),.7);assert.equal(await f.xr.readParameter('/ch/08/eq/1/g'),.2);
  const undo=await f.recall.previewBackup(applied.backupId);await f.recall.apply(applied.backupId,undo.token,true);assert.deepEqual(await f.control.capture(),before);
  await f.xr.writeParameter('/config/linkcfg/eq',1);await assert.rejects(f.recall.preview(scene.id,stereo),/égaliseur est partagé/);
 }finally{f.close();}
});
test('a destination changed after preview or before undo cannot be silently overwritten',async()=>{
 for(const address of ['/ch/07/eq/1/g','/ch/07/config/insrc','/config/chlink/7-8']){const f=fixture();try{
  await f.xr.writeParameter('/ch/01/eq/1/g',.7);const scene=await f.save(),p=await f.recall.preview(scene.id,mono);
  await f.xr.writeParameter(address,address.includes('/eq/')?.9:1);await assert.rejects(f.recall.apply(scene.id,p.token,true),/État modifié/);assert.equal(f.library.list('scene-recall-backup').length,0);
 }finally{f.close();}}
 const f=fixture();try{
  await f.xr.writeParameter('/ch/01/eq/1/g',.7);const scene=await f.save(),p=await f.recall.preview(scene.id,mono),result=await f.recall.apply(scene.id,p.token,true);
  await f.xr.writeParameter('/ch/07/config/rtnsrc',2);await assert.rejects(f.recall.previewBackup(result.backupId),/sources ont changé/);
 }finally{f.close();}
});
test('native scene remapping exposes unused destinations and leaves missing FX decoding and source text alone',async()=>{
 const f=fixture();try{
  const text='/ch/01/config "Native voice" 3 In01 U01\n/ch/01/mix OFF -20 ON +0\n/fx/1 PIT ON',scene=f.library.save('native-scene','Native fixture',text);
  const options=f.recall.options(scene.id);assert.equal(options.channels.length,1);assert.equal(options.destinations.length,16);assert.ok(options.destinations.some(c=>c.channel===7));
  const before=await f.control.capture(),p=await f.recall.preview(scene.id,{...mono,sections:['labels','levels']});assert.ok(p.changes.every(c=>c.address.startsWith('/ch/07/')));
  const result=await f.recall.apply(scene.id,p.token,true);assert.equal(await f.xr.readParameter('/ch/07/config/name'),'Native voice');assert.deepEqual(f.library.get(scene.id).data,text);
  const undo=await f.recall.previewBackup(result.backupId);await f.recall.apply(result.backupId,undo.token,true);assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
