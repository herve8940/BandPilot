import {test} from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {SceneRecall} from '../src/scene-recall.js';
import type {MixerModelId} from '../shared/mixer-models.js';

function fixture(model:MixerModelId='XR18'){
  const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,model});
  const library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library),recall=new SceneRecall(xr,control,library);
  return {xr,library,control,recall,save:async()=>library.save('scene','Test scene',await control.capture()),close(){xr.close();library.close();}};
}
test('selective recall and undo change only the chosen processing across X-Air/M-Air profiles',async()=>{
  for(const model of ['XR18','MR18','X18','XR12','MR12'] as const){const f=fixture(model);try{
    await f.xr.writeParameter('/ch/01/eq/1/g',.7);await f.xr.writeParameter('/ch/02/eq/1/g',.8);
    const saved=await f.save();
    await f.xr.writeParameter('/ch/01/eq/1/g',.3);await f.xr.writeParameter('/ch/02/eq/1/g',.4);
    await f.xr.writeParameter('/headamp/01/gain',.3);await f.xr.writeParameter('/headamp/01/phantom',1,true);
    await f.xr.writeParameter('/ch/01/mix/01/level',.2);await f.xr.writeParameter('/ch/01/mix/02/level',.6);
    await f.xr.writeParameter('/ch/01/mix/fader',.4);await f.xr.writeParameter('/ch/01/dyn/thr',.2);
    const before=await f.control.capture();
    const p=await f.recall.preview(saved.id,{channels:[1],sections:['eq']});
    assert.deepEqual(p.changes.map(c=>c.address),['/ch/01/eq/1/g']);
    assert.deepEqual(await f.control.capture(),before,'preview never writes audio');
    await assert.rejects(f.recall.apply(saved.id,p.token,false),/Confirmation/);
    const applied=await f.recall.apply(saved.id,p.token,true),after=await f.control.capture();
    assert.equal(after.values['/ch/01/eq/1/g'],.7);
    after.values['/ch/01/eq/1/g']=.3;assert.deepEqual(after,before,'all unselected values and FX preserved');
    assert.equal(f.library.get(applied.backupId).kind,'scene-recall-backup');
    await assert.rejects(f.recall.apply(saved.id,p.token,true),/expiré/);
    await f.xr.writeParameter('/ch/02/eq/1/g',.9);
    const undo=await f.recall.previewBackup(applied.backupId);await f.recall.apply(applied.backupId,undo.token,true);
    assert.equal(await f.xr.readParameter('/ch/01/eq/1/g'),.3);assert.equal(await f.xr.readParameter('/ch/02/eq/1/g'),.9);
  }finally{f.close();}}
});
test('empty, invalid, missing and foreign scene selections fail closed; legacy files keep their original recall',async()=>{
  const f=fixture();try{
    const saved=await f.save();
    for(const scope of [null,{}, {channels:[],sections:['eq']},{channels:[1,1],sections:['eq']},{channels:[17],sections:['eq']},{channels:[1],sections:[]},{channels:[1],sections:['routing']},{channels:[1],sections:['eq','eq']}])await assert.rejects(f.recall.preview(saved.id,scope));
    const old=f.library.save('scene','Old',{version:1});await assert.rejects(f.recall.preview(old.id,{channels:[1],sections:['eq']}),/complète BandPilot/);
    const data=await f.control.capture();delete data.values['/ch/01/eq/1/g'];
    const partial=f.library.save('scene','Partial',data);await assert.rejects(f.recall.preview(partial.id,{channels:[1],sections:['eq']}),/tous les réglages/);
    const foreign=f.library.save('scene','Foreign',{...await f.control.capture(),model:'XR12'});await assert.rejects(f.recall.preview(foreign.id,{channels:[1],sections:['eq']}),/autre modèle/);
    const noop=await f.recall.preview(saved.id,{channels:[1],sections:['eq']});assert.equal(noop.token,null);assert.equal(f.library.list('scene-recall-backup').length,0);
  }finally{f.close();}
  const x32=fixture('X32');try{await assert.rejects(x32.recall.preview('missing',{channels:[1],sections:['eq']}),/X-Air/);}finally{x32.close();}
});
test('linked pairs must be complete and compatible, and undo guards the stereo context',async()=>{
  const f=fixture();try{
    await f.xr.writeParameter('/config/chlink/1-2',1);
    await f.xr.writeParameter('/config/linkcfg/eq',1);
    for(const ch of ['01','02'])await f.xr.writeParameter(`/ch/${ch}/eq/1/g`,.7);
    const saved=await f.save();
    for(const ch of ['01','02'])await f.xr.writeParameter(`/ch/${ch}/eq/1/g`,.3);
    await assert.rejects(f.recall.preview(saved.id,{channels:[1],sections:['eq']}),/deux entrées/);
    const p=await f.recall.preview(saved.id,{channels:[1,2],sections:['eq']});
    const result=await f.recall.apply(saved.id,p.token,true);
    const undo=await f.recall.previewBackup(result.backupId);await f.recall.apply(result.backupId,undo.token,true);
    assert.equal(await f.xr.readParameter('/ch/01/eq/1/g'),.3);assert.equal(await f.xr.readParameter('/ch/02/eq/1/g'),.3);
    await f.xr.writeParameter('/config/chlink/1-2',0);
    await assert.rejects(f.recall.preview(saved.id,{channels:[1,2],sections:['eq']}),/liaison stéréo diffère/);
    await assert.rejects(f.recall.previewBackup(result.backupId),/liaisons ou les sources/);
    await f.xr.writeParameter('/config/chlink/1-2',1);await f.xr.writeParameter('/ch/02/eq/1/g',.8);
    const inconsistent=await f.save();await assert.rejects(f.recall.preview(inconsistent.id,{channels:[1,2],sections:['eq']}),/égaliseur est partagé/);
    await assert.rejects(f.recall.preview(saved.id,{channels:[1,2],sections:['eq']}),/égaliseur est partagé/,'an asymmetric current pair cannot create a non-restorable backup while its EQ is shared');
  }finally{f.close();}
});
test('changed values, links, routing, connection, read-only mode and another source reject pending recall',async()=>{
  for(const changed of ['/ch/01/eq/1/g','/config/chlink/1-2','/ch/01/config/insrc']){
    const f=fixture();try{
      await f.xr.writeParameter('/ch/01/eq/1/g',.7);const saved=await f.save();await f.xr.writeParameter('/ch/01/eq/1/g',.3);
      const p=await f.recall.preview(saved.id,{channels:[1],sections:['eq']});
      await f.xr.writeParameter(changed,changed.includes('/eq/')?.9:1);
      await assert.rejects(f.recall.apply(saved.id,p.token,true),/État modifié/);assert.equal(f.library.list('scene-recall-backup').length,0);
    }finally{f.close();}
  }
  const f=fixture();try{
    const saved=await f.save();await f.xr.writeParameter('/ch/01/eq/1/g',.3);
    const p=await f.recall.preview(saved.id,{channels:[1],sections:['eq']});
    await assert.rejects(f.recall.apply('other-source',p.token,true),/source modifiée/);
    f.xr.emit('reset');await assert.rejects(f.recall.apply(saved.id,p.token,true),/expiré/);
    const base=f.xr.status.bind(f.xr);f.xr.status=()=>({...base(),mode:'real',connected:true,writesEnabled:false});
    await assert.rejects(f.recall.preview(saved.id,{channels:[1],sections:['eq']}),/active son contrôle/);
  }finally{f.close();}
});
test('all supported inputs and explicit volumes/names fit the preview, failed writes retain a scoped backup',async()=>{
  const f=fixture();try{
    const saved=await f.save();
    for(let ch=1;ch<=16;ch++){await f.xr.writeParameter(`/ch/${String(ch).padStart(2,'0')}/mix/fader`,.2);await f.xr.writeParameter(`/ch/${String(ch).padStart(2,'0')}/config/name`,'Changed');}
    const p=await f.recall.preview(saved.id,{channels:Array.from({length:16},(_,i)=>i+1),sections:['eq','compressor','gate','levels','labels']});
    assert.equal(p.changes.length,32);
    const original=f.xr.applyParameters.bind(f.xr);f.xr.applyParameters=async()=>{throw Error('Transport failed');};
    await assert.rejects(f.recall.apply(saved.id,p.token,true),/partielle.*sauvegarde/);
    const backup=f.library.list('scene-recall-backup')[0]!;assert.ok(backup);
    f.xr.applyParameters=original;
    const undo=await f.recall.previewBackup(backup.id);assert.equal(undo.token,null);
  }finally{f.close();}
});

test('undo remains available when some selected inputs were already identical and their routing changes later',async()=>{
  const f=fixture();try{
    const saved=await f.save();await f.xr.writeParameter('/ch/01/eq/1/g',.3);
    const p=await f.recall.preview(saved.id,{channels:[1,3,7],sections:['eq']});
    const result=await f.recall.apply(saved.id,p.token,true);
    await f.xr.writeParameter('/ch/07/config/insrc',3);
    const undo=await f.recall.previewBackup(result.backupId);assert.ok(undo.token);
    await f.recall.apply(result.backupId,undo.token,true);
    assert.equal(await f.xr.readParameter('/ch/01/eq/1/g'),.3);assert.equal(await f.xr.readParameter('/ch/07/config/insrc'),3);
  }finally{f.close();}
});

test('native scenes expose only their inputs and recall selected values without requiring FX decoding',async()=>{
  for(const model of ['XR18','MR18','X18'] as const){const f=fixture(model);try{
    const text='/ch/01/config "Native test" 3 In01 U01\n/ch/01/mix OFF -20 ON +0\n/headamp/01 +20 ON\n/fx/1 ROOM ON';
    const saved=f.library.save('native-scene','Synthetic native',text);
    const options=f.recall.options(saved.id);assert.equal(options.channels.length,1);assert.equal(options.channels[0]!.savedName,'Native test');
    const before=await f.control.capture();
    const p=await f.recall.preview(saved.id,{channels:[1],sections:['labels','levels']});
    assert.ok(p.changes.length);assert.ok(p.changes.every(c=>/^\/ch\/01\/(config\/(name|color)|mix\/(on|fader))$/.test(c.address)));
    const result=await f.recall.apply(saved.id,p.token,true);
    assert.equal(await f.xr.readParameter('/ch/01/config/name'),'Native test');assert.equal(await f.xr.readParameter('/headamp/01/phantom'),before.values['/headamp/01/phantom']);
    assert.deepEqual((await f.control.capture()).fx,before.fx);
    const undo=await f.recall.previewBackup(result.backupId);await f.recall.apply(result.backupId,undo.token,true);
    assert.deepEqual(await f.control.capture(),before);
    await assert.rejects(f.recall.preview(saved.id,{channels:[1],sections:['eq']}),/tous les réglages/);
    assert.equal(f.library.get(saved.id).data,text,'native source never rewritten');
  }finally{f.close();}}
  const small=fixture('XR12');try{const s=small.library.save('native-scene','Native','/ch/01/mix OFF -20 ON +0');assert.throws(()=>small.recall.options(s.id),/uniquement/);}finally{small.close();}
});
