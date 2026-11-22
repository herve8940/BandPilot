import {test} from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {captureChannelPreset,validateChannelPreset,previewChannelPreset} from '../src/channel-presets.js';
import {previewChannelBackup,previewGroupedAdjustment} from '../src/channel-operations.js';
import {fromWire,toWire} from '../src/parameters.js';
import type {MixerModelId} from '../shared/mixer-models.js';
import {parseLibraryFile} from '../web/src/library-files.js';

function fixture(model:MixerModelId='XR18'){
  const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,model});
  const library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
  return {xr,library,control,db:async(a:string,d:number)=>xr.writeParameter(a,toWire(a,d)),readDb:async(a:string)=>Number(fromWire(a,await xr.readParameter(a))),close(){xr.close();library.close();}};
}
test('stereo presets round trip independent L/R on all X-Air models, preserve other settings and restore after a service restart',async()=>{
  for(const model of ['XR18','MR18','X18','XR12','MR12'] as const){const f=fixture(model);try{
    await f.db('/ch/01/eq/1/g',4);await f.db('/ch/02/eq/1/g',-2);
    await f.db('/ch/01/dyn/thr',-15);await f.db('/ch/02/dyn/thr',-21);
    const before=await f.control.capture();
    const p=await captureChannelPreset(f.xr,f.control,1,['eq','compressor'],undefined,true);
    assert.equal(p.version,2);if(p.version!==2)throw Error('stereo required');
    assert.equal(p.linked,false);assert.notEqual(p.values['eq/1/g'],p.rightValues['eq/1/g']);
    assert.deepEqual(await f.control.capture(),before,'saving writes no audio');
    const file=parseLibraryFile('stereo.json',JSON.stringify(p));assert.deepEqual(validateChannelPreset(file.data),p);
    const plan=await previewChannelPreset(f.xr,f.control,p,9,['eq']);assert.ok(plan.token);
    assert.ok(plan.changes.every(c=>/^\/ch\/(09|10)\/(eq\/|preamp\/hp)/.test(c.address)));
    const result=await f.control.apply(plan.token),after=await f.control.capture();
    assert.equal(await f.readDb('/ch/09/eq/1/g'),4);assert.ok(Math.abs(await f.readDb('/ch/10/eq/1/g')+2)<1e-8);
    for(const c of plan.changes)after.values[c.address]=before.values[c.address]!;
    assert.deepEqual(after,before,'only requested processing changes, no gain, routing, pan, sends or dynamics');
    const restarted=new ConsoleControl(f.xr,f.library),undo=await previewChannelBackup(f.xr,restarted,f.library,result.backupId);
    await restarted.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
    const fromScene=await captureChannelPreset(f.xr,f.control,1,['eq'],before.values,true);assert.equal(fromScene.version,2);
  }finally{f.close();}}
});
test('stereo capture and import reject malformed pairs and foreign or incomplete data; mono defaults remain v1',async()=>{
  const f=fixture('XR12');try{
    const mono=await captureChannelPreset(f.xr,f.control,12,['eq']);assert.equal(mono.version,1);
    for(const n of [0,2,12,13])await assert.rejects(captureChannelPreset(f.xr,f.control,n,['eq'],undefined,true));
    const p=await captureChannelPreset(f.xr,f.control,1,['eq','gate'],undefined,true);
    for(const patch of [{stereo:false},{linked:'false'},{rightValues:null},{rightValues:{'eq/on':1}},{rightValues:{'gate/keysrc':2,'eq/on':1}},{model:'X32'},{sourceChannel:2}])assert.throws(()=>validateChannelPreset({...p,...patch}));
    await assert.rejects(previewChannelPreset(f.xr,f.control,{...p,model:'XR18'},3),/autre modèle/);
    await assert.rejects(previewChannelPreset(f.xr,f.control,p,12),/Paire/);
    const values=(await f.control.capture()).values;delete values['/config/chlink/1-2'];
    await assert.rejects(captureChannelPreset(f.xr,f.control,1,['eq'],values,true),/liaison/);
  }finally{f.close();}
  const x=fixture('X32');try{await assert.rejects(captureChannelPreset(x.xr,x.control,1,['eq'],undefined,true),/Paire/);}finally{x.close();}
});
test('linked stereo presets and undo require the complete compatible pair and guard link and routing changes',async()=>{
  const f=fixture();try{
    await f.xr.writeParameter('/config/chlink/1-2',1);await f.xr.writeParameter('/config/chlink/3-4',1);
    await f.xr.writeParameter('/config/linkcfg/eq',1);
    for(const ch of ['01','02'])await f.db(`/ch/${ch}/eq/1/g`,3);
    const p=await captureChannelPreset(f.xr,f.control,1,['eq'],undefined,true);
    await assert.rejects(previewChannelPreset(f.xr,f.control,p,5),/liaisons/);
    for(const address of ['/config/chlink/3-4','/config/linkcfg/eq','/ch/04/config/insrc']){
      const old=await f.xr.readParameter(address),plan=await previewChannelPreset(f.xr,f.control,p,3);
      await f.xr.writeParameter(address,old===0?1:0);
      await assert.rejects(f.control.apply(plan.token),/État modifié/);
      await f.xr.writeParameter(address,old);
    }
    const plan=await previewChannelPreset(f.xr,f.control,p,3),result=await f.control.apply(plan.token);
    assert.equal(await f.readDb('/ch/03/eq/1/g'),3);assert.equal(await f.readDb('/ch/04/eq/1/g'),3);
    await f.xr.writeParameter('/config/chlink/3-4',0);
    await assert.rejects(previewChannelBackup(f.xr,f.control,f.library,result.backupId),/liaisons/);
    await f.xr.writeParameter('/config/chlink/3-4',1);await f.db('/ch/04/eq/1/g',5);
    await assert.rejects(previewChannelPreset(f.xr,f.control,p,3),/égaliseur est partagé/);
  }finally{f.close();}
});
test('group adjustments keep offsets in physical dB across fader curves, leave silence and unrelated musicians untouched, and undo only affected inputs',async()=>{
  const f=fixture();try{
    await f.db('/ch/01/mix/fader',-40);await f.db('/ch/03/mix/fader',-8);await f.xr.writeParameter('/ch/05/mix/fader',0);
    const before=await f.control.capture();
    const plan=await previewGroupedAdjustment(f.xr,f.control,{channels:[1,3,5],target:'fader',delta:3});
    assert.equal(plan.skippedSilent,1);assert.equal(plan.changes.length,2);assert.deepEqual(await f.control.capture(),before);
    const result=await f.control.apply(plan.token);
    assert.ok(Math.abs(await f.readDb('/ch/01/mix/fader')+37)<1e-8);assert.ok(Math.abs(await f.readDb('/ch/03/mix/fader')+5)<1e-8);
    assert.equal(await f.xr.readParameter('/ch/05/mix/fader'),0);
    const after=await f.control.capture();for(const c of plan.changes)after.values[c.address]=before.values[c.address]!;assert.deepEqual(after,before);
    await f.xr.writeParameter('/ch/05/config/insrc',2); // Unchanged silent input must not prevent restoring the other two.
    const undo=await previewChannelBackup(f.xr,f.control,f.library,result.backupId);await f.control.apply(undo.token);
    assert.equal(await f.readDb('/ch/01/mix/fader'),-40);assert.equal(await f.xr.readParameter('/ch/05/config/insrc'),2);
  }finally{f.close();}
});
test('grouped EQ and thresholds support different instruments and each monitor mix stays scoped',async()=>{
  for(const model of ['XR18','XR12','MR12'] as const){const f=fixture(model);try{
    for(const [target,path] of [['eq','eq/2/g'],['compressor','dyn/thr'],['gate','gate/thr'],['send','mix/02/level']]){
      const a=`/ch/01/${path}`,b=`/ch/03/${path}`;
      if(target==='send'){await f.db(a,-30);await f.db(b,-15);}
      const beforeA=await f.readDb(a),beforeB=await f.readDb(b),other=await f.xr.readParameter('/ch/01/mix/01/level');
      const p=await previewGroupedAdjustment(f.xr,f.control,{channels:[1,3],target,delta:-2,band:2,bus:2});await f.control.apply(p.token);
      assert.ok(Math.abs(await f.readDb(a)-beforeA+2)<1e-8);assert.ok(Math.abs(await f.readDb(b)-beforeB+2)<1e-8);
      assert.equal(await f.xr.readParameter('/ch/01/mix/01/level'),other);
    }
    if(model!=='XR18')await assert.rejects(previewGroupedAdjustment(f.xr,f.control,{channels:[1,3],target:'send',delta:1,bus:3}),/Sortie/);
  }finally{f.close();}}
});
test('linked input and monitor pairs are one operation, with no partial linked writes or clamping',async()=>{
  const f=fixture();try{
    await f.xr.writeParameter('/config/chlink/1-2',1);await f.xr.writeParameter('/config/buslink/1-2',1);
    for(const ch of ['01','02'])for(const bus of ['01','02'])await f.db(`/ch/${ch}/mix/${bus}/level`,-18);
    await assert.rejects(previewGroupedAdjustment(f.xr,f.control,{channels:[1,3],target:'send',delta:2,bus:1}),/deux entrées/);
    const p=await previewGroupedAdjustment(f.xr,f.control,{channels:[1,2],target:'send',delta:2,bus:2});
    assert.deepEqual(p.buses,[1,2]);assert.equal(p.changes.length,4);await f.control.apply(p.token);
    for(const ch of ['01','02'])for(const bus of ['01','02'])assert.equal(await f.readDb(`/ch/${ch}/mix/${bus}/level`),-16);
    await f.db('/ch/02/mix/02/level',-20);
    await assert.rejects(previewGroupedAdjustment(f.xr,f.control,{channels:[1,2],target:'send',delta:2,bus:1}),/deux bus.*diffèrent/);
    const before=await f.control.capture();await f.db('/ch/03/eq/1/g',14);
    await assert.rejects(previewGroupedAdjustment(f.xr,f.control,{channels:[3,5],target:'eq',delta:2,band:1}),/dépasse la plage/);
    assert.equal(await f.xr.readParameter('/ch/05/eq/1/g'),before.values['/ch/05/eq/1/g']);
  }finally{f.close();}
});
test('invalid, stale, interrupted and read-only group operations fail without writes; failures retain recovery backups',async()=>{
  const f=fixture();try{
    const valid={channels:[1,3],target:'fader',delta:1};
    for(const patch of [{channels:[]},{channels:[1]},{channels:[1,1]},{channels:[1,17]},{delta:0},{delta:NaN},{delta:13},{target:'gain'},{target:'eq',band:5}])await assert.rejects(previewGroupedAdjustment(f.xr,f.control,{...valid,...patch}));
    const p=await previewGroupedAdjustment(f.xr,f.control,valid);await f.db('/ch/03/mix/fader',-30);await assert.rejects(f.control.apply(p.token),/État modifié/);
    const read=f.xr.readParameter.bind(f.xr);let reads=0;
    f.xr.readParameter=async(a:string)=>{const v=await read(a);if(a==='/ch/01/mix/fader'&&++reads===1)await f.xr.writeParameter(a,.9);return v;};
    await assert.rejects(previewGroupedAdjustment(f.xr,f.control,valid),/État modifié/);f.xr.readParameter=read;
    const failed=await previewGroupedAdjustment(f.xr,f.control,valid),apply=f.xr.applyParameters.bind(f.xr);
    f.xr.applyParameters=async()=>{throw Error('Synthetic transport failure');};
    await assert.rejects(f.control.apply(failed.token),/partielle.*sauvegarde/);assert.ok(f.library.list('channel-operation-backup').length);
    f.xr.applyParameters=apply;
    for(const ch of ['01','03'])await f.xr.writeParameter(`/ch/${ch}/mix/fader`,0);
    assert.equal((await previewGroupedAdjustment(f.xr,f.control,valid)).token,null);
    const status=f.xr.status.bind(f.xr);f.xr.status=()=>({...status(),mode:'real',connected:true,writesEnabled:false});
    await assert.rejects(previewGroupedAdjustment(f.xr,f.control,valid),/active son contrôle/);
  }finally{f.close();}
});
