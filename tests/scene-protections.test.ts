import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {SceneRecall} from '../src/scene-recall.js';
import {MixerSync} from '../src/mixer-sync.js';
import {ShowControl} from '../src/show-control.js';
import {ProcessingStore} from '../src/processing.js';
import type {MixerModelId} from '../shared/mixer-models.js';
import type {SceneProtection} from '../shared/scene-protections.js';

function fixture(model:MixerModelId='XR18'){
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,model}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library),recall=new SceneRecall(xr,control,library);
 return {xr,library,control,recall,protect:(rules:SceneProtection[])=>library.saveProtections({...library.protections(model),rules}),save:async()=>library.save('scene','Synthetic scene',await control.capture()),close(){xr.close();library.close();}};
}
test('protection metadata persists per model, defaults empty, rejects malformed and stale edits',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bp-protect-')),path=join(dir,'library.db');let store=new LibraryStore(path);
 try{
  assert.deepEqual(store.protections('XR18'),{model:'XR18',revision:0,rules:[]});
  const old=store.protections('XR18'),saved=store.saveProtections({...old,rules:[{channel:7,sections:['levels','eq']}]});
  assert.equal(saved.revision,1);assert.deepEqual(saved.rules[0]!.sections,['eq','levels']);
  store.close();store=new LibraryStore(path);assert.deepEqual(store.protections('XR18'),saved);assert.equal(store.protections('MR18').rules.length,0);
  assert.throws(()=>store.saveProtections({...old,rules:[]}),/protections ont changé/);
  for(const rules of [null,[{channel:17,sections:['eq']}],[{channel:1,sections:[]}],[{channel:1,sections:['gain']}],[{channel:1,sections:['eq','eq']}],[{channel:1,sections:['eq']},{channel:1,sections:['gate']}],[{channel:1,sections:['eq'],extra:true}]])assert.throws(()=>store.saveProtections({...saved,rules}));
  assert.throws(()=>store.saveProtections({...saved,model:'XR12',rules:[{channel:13,sections:['eq']}]}));assert.throws(()=>store.protections('X32'));
  assert.deepEqual(store.saveProtections(saved),saved,'idempotent save leaves valid previews intact');
  assert.equal(store.saveProtections({...saved,rules:[]}).rules.length,0);assert.equal(store.list('scene').length,0);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('destination protection skips selected families, preserves mixed monitors and has destination-only undo on all models',async()=>{
 for(const model of ['XR18','MR18','X18','XR12','MR12'] as const){const f=fixture(model);try{
  await f.xr.writeParameter('/ch/01/eq/1/g',.7);await f.xr.writeParameter('/ch/01/dyn/thr',.3);const saved=await f.save();
  await f.xr.writeParameter('/ch/07/eq/1/g',.2);await f.xr.writeParameter('/ch/07/dyn/thr',.8);
  await f.xr.writeParameter('/ch/07/mix/01/level',.2);await f.xr.writeParameter('/ch/07/mix/02/level',.65);
  const before=await f.control.capture();f.protect([{channel:7,sections:['eq']}]);assert.deepEqual(await f.control.capture(),before);
  const p=await f.recall.preview(saved.id,{channels:[1],sections:['eq','compressor'],mapping:[{source:1,target:7}]});
  assert.deepEqual(p.excluded,[{channel:7,section:'eq'}]);assert.ok(p.changes.length);assert.ok(p.changes.every(c=>c.address.startsWith('/ch/07/dyn/')));
  const result=await f.recall.apply(saved.id,p.token,true),after=await f.control.capture();assert.equal(after.values['/ch/07/eq/1/g'],.2);
  after.values['/ch/07/dyn/thr']=before.values['/ch/07/dyn/thr']!;assert.deepEqual(after,before);
  const backup=f.library.get(result.backupId).data as any;assert.ok(Object.keys(backup.values).every(a=>a.startsWith('/ch/07/dyn/')));
  const undo=await f.recall.previewBackup(result.backupId);await f.recall.apply(result.backupId,undo.token,true);assert.deepEqual(await f.control.capture(),before);
  f.protect([{channel:1,sections:['compressor']}]);const sourceProtected=await f.recall.preview(saved.id,{channels:[1],sections:['compressor'],mapping:[{source:1,target:7}]});assert.ok(sourceProtected.token,'source protections do not protect unrelated destinations');
  assert.deepEqual(f.library.get(saved.id),saved);
 }finally{f.close();}}
});
test('linked families remain protected on both sides even with independent L/R; other families keep asymmetric values',async()=>{
 const f=fixture();try{
  for(const pair of ['1-2','7-8'])await f.xr.writeParameter('/config/chlink/'+pair,1);
  await f.xr.writeParameter('/config/linkcfg/eq',0);await f.xr.writeParameter('/config/linkcfg/dyn',0);
  for(const [ch,eq,dyn] of [['01',.7,.2],['02',.3,.8]] as const){await f.xr.writeParameter(`/ch/${ch}/eq/1/g`,eq);await f.xr.writeParameter(`/ch/${ch}/dyn/thr`,dyn);}
  const saved=await f.save();f.protect([{channel:8,sections:['eq']}]);
  const p=await f.recall.preview(saved.id,{channels:[1,2],sections:['eq','compressor'],mapping:[{source:1,target:7},{source:2,target:8}]});
  assert.deepEqual(p.excluded,[{channel:7,section:'eq'},{channel:8,section:'eq'}]);assert.ok(p.changes.every(c=>/\/dyn\//.test(c.address)));
  const before=await f.control.capture();const result=await f.recall.apply(saved.id,p.token,true);
  assert.equal(await f.xr.readParameter('/ch/07/dyn/thr'),.2);assert.equal(await f.xr.readParameter('/ch/08/dyn/thr'),.8);
  const undo=await f.recall.previewBackup(result.backupId);await f.recall.apply(result.backupId,undo.token,true);assert.deepEqual(await f.control.capture(),before);
  await f.xr.writeParameter('/config/linkcfg/eq',1);const protectedConflict=await f.recall.preview(saved.id,{channels:[1,2],sections:['eq'],mapping:[{source:1,target:7},{source:2,target:8}]});assert.equal(protectedConflict.token,null,'protected source differences need not be sent');
 }finally{f.close();}
});
test('protection changes invalidate preview and undo, including direct console token replay and changes during reads',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/ch/01/eq/1/g',.7);const saved=await f.save();await f.xr.writeParameter('/ch/01/eq/1/g',.2);
  const p=await f.recall.preview(saved.id,{channels:[1],sections:['eq']});f.protect([{channel:1,sections:['eq']}]);
  await assert.rejects(f.control.apply(p.token),/protections ont changé/);assert.equal(f.library.list('scene-recall-backup').length,0);
  const no=f.recall.preview(saved.id,{channels:[1],sections:['eq']});assert.equal((await no).token,null);
  f.protect([]);const q=await f.recall.preview(saved.id,{channels:[1],sections:['eq']}),result=await f.recall.apply(saved.id,q.token,true);
  const undo=await f.recall.previewBackup(result.backupId);f.protect([{channel:1,sections:['eq']}]);await assert.rejects(f.recall.apply(result.backupId,undo.token,true),/protections ont changé/);
  const blockedUndo=await f.recall.previewBackup(result.backupId);assert.equal(blockedUndo.token,null);assert.equal(blockedUndo.excluded.length,1);
  assert.equal(await f.xr.readParameter('/ch/01/eq/1/g'),.7);
  f.protect([]);const read=f.xr.readParameter.bind(f.xr);let first=true;f.xr.readParameter=async a=>{const v=await read(a);if(first){first=false;f.protect([{channel:1,sections:['gate']}]);}return v;};
  await assert.rejects(f.recall.preview(saved.id,{channels:[1],sections:['eq']}),/protections ont changé/);
 }finally{f.close();}
});
test('full recalls, legacy scenes, native scenes and pending synchronisation cannot bypass active protections',async()=>{
 const f=fixture(),processing=new ProcessingStore();try{
  const show=new ShowControl(f.xr,processing,f.library),sync=new MixerSync(f.xr,f.control,f.library),saved=await f.save();
  const legacy=f.library.save('scene','Legacy',show.capture()),native=f.library.save('native-scene','Native','/ch/01/config "Voice" 3 In01 U01');
  const nativePlan=await sync.preview(native.id),pending=show.preview(legacy.id,true),before=await f.control.capture();
  f.protect([{channel:1,sections:['eq']}]);
  await assert.rejects(f.control.recall(saved.data,false,true),/protections de scène/);
  assert.throws(()=>show.preview(saved.id,true),/protections de scène/);
  await assert.rejects(show.apply(legacy.id,pending.token,true),/expirée|protections/);
  await assert.rejects(sync.preview(native.id),/protections de scène/);await assert.rejects(sync.apply(nativePlan.token,true),/protections de scène/);
  assert.deepEqual(await f.control.capture(),before);assert.equal(f.library.list('scene').length,2);
  f.protect([]);const p=show.preview(legacy.id,true);assert.ok((await show.apply(legacy.id,p.token,true)).ok);
 }finally{f.close();}
});
test('native selective scenes respect protections and the original file stays intact',async()=>{
 const f=fixture();try{
  const text='/ch/01/config "Voice" 3 In01 U01\n/ch/01/mix OFF -20 ON +0',entry=f.library.save('native-scene','Native',text);f.protect([{channel:7,sections:['labels']}]);
  const p=await f.recall.preview(entry.id,{channels:[1],sections:['labels','levels'],mapping:[{source:1,target:7}]});assert.ok(p.changes.every(c=>c.address.startsWith('/ch/07/mix/')));assert.deepEqual(p.excluded,[{channel:7,section:'labels'}]);
  await f.recall.apply(entry.id,p.token,true);assert.equal(f.library.get(entry.id).data,text);
 }finally{f.close();}
});
