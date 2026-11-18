import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {captureChannelPreset,channelPresetValues,validateChannelPreset,previewChannelPreset} from '../src/channel-presets.js';
import {FxPresets} from '../src/fx-presets.js';
import {parseLibraryFile} from '../web/src/library-files.js';

function setup(model:'XR18'|'XR12'|'X32'='XR18'){
  const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,model});
  const library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
  return {xr,library,control,close(){xr.close();library.close();}};
}
test('channel export/import and partial recall preserve gain, routing, monitor sends and other instruments; backup restores processing',async()=>{
  const f=setup();try{
    await f.xr.writeParameter('/ch/01/eq/1/g',.7);
    await f.xr.writeParameter('/ch/01/dyn/thr',.4);
    await f.xr.writeParameter('/headamp/07/gain',.3);
    await f.xr.writeParameter('/ch/07/mix/01/level',.2);
    const before=JSON.stringify(f.xr.parameterState());
    const preset=await captureChannelPreset(f.xr,f.control,1,['eq','compressor','gate']);
    assert.equal(JSON.stringify(f.xr.parameterState()),before,'capture does not write');
    const file=parseLibraryFile('voice.json',JSON.stringify({kind:'channel-preset',name:'My voice',data:preset}));
    const imported=validateChannelPreset(file.data);
    const values=channelPresetValues(f.xr,imported,7,['eq']);
    assert.ok(Object.keys(values).every(a=>a.startsWith('/ch/07/eq/')||a.startsWith('/ch/07/preamp/hp')));
    const original=await f.xr.readParameter('/ch/07/eq/1/g');
    const plan=await f.control.preview(values,true);
    assert.equal(await f.xr.readParameter('/ch/07/eq/1/g'),original,'preview does not apply');
    const result=await f.control.apply(plan.token);
    assert.equal(await f.xr.readParameter('/ch/07/eq/1/g'),.7);
    assert.equal(await f.xr.readParameter('/headamp/07/gain'),.3);
    assert.equal(await f.xr.readParameter('/ch/07/mix/01/level'),.2);
    assert.equal(await f.xr.readParameter('/ch/07/mix/fader'),.5);
    assert.equal(await f.xr.readParameter('/ch/01/dyn/thr'),.4);
    const rollback=await f.control.preview(f.library.get(result.backupId).data,true);
    await f.control.apply(rollback.token);
    assert.equal(await f.xr.readParameter('/ch/07/eq/1/g'),original);
  }finally{f.close();}
});
test('extract a preset from a saved scene, never from the current channel; incomplete sections are refused',async()=>{
  const f=setup();try{
    await f.xr.writeParameter('/ch/03/eq/2/g',.3);
    const scene=await f.control.capture();
    await f.xr.writeParameter('/ch/03/eq/2/g',.8);
    const p=await captureChannelPreset(f.xr,f.control,3,['eq'],scene.values);
    assert.equal(p.values['eq/2/g'],.3);
    delete scene.values['/ch/03/eq/2/g'];
    await assert.rejects(captureChannelPreset(f.xr,f.control,3,['eq'],scene.values),/incomplète/);
  }finally{f.close();}
});
test('a mono recall refuses a linked stereo destination, including linking after preview',async()=>{
  const f=setup();try{
    const p=await captureChannelPreset(f.xr,f.control,1,['eq']);
    await f.xr.writeParameter('/config/chlink/7-8',1);
    await assert.rejects(previewChannelPreset(f.xr,f.control,p,7),/lié en stéréo/);
    await f.xr.writeParameter('/config/chlink/7-8',0);
    const plan=await previewChannelPreset(f.xr,f.control,p,8);
    await f.xr.writeParameter('/config/chlink/7-8',1);
    await assert.rejects(f.control.apply(plan.token),/État modifié/);
    assert.equal(f.library.list('parameter-backup').length,0);
  }finally{f.close();}
});
test('preset validation refuses injected routing, phantom, invalid values, versions and external sidechains',async()=>{
  const f=setup();try{
    const p=await captureChannelPreset(f.xr,f.control,1,['eq','compressor']);
    for(const change of [{values:{...p.values,'/headamp/01/phantom':1}},{values:{...p.values,'mix/fader':1}},{values:{...p.values,'eq/1/g':2}},{values:{...p.values,'dyn/keysrc':2}},{version:2},{sections:[]},{model:'__proto__'},{sourceChannel:17}])assert.throws(()=>validateChannelPreset({...p,...change}));
    assert.throws(()=>channelPresetValues(f.xr,p,2,['gate']));
    assert.throws(()=>channelPresetValues(f.xr,p,0));
    await f.xr.writeParameter('/ch/01/dyn/keysrc',3);
    await assert.rejects(captureChannelPreset(f.xr,f.control,1,['compressor']),/sidechain/);
    assert.ok(await captureChannelPreset(f.xr,f.control,1,['eq']));
  }finally{f.close();}
});
test('model and channel limits apply on capture and recall, including X32 partial support',async()=>{
  for(const model of ['XR12','X32'] as const){const f=setup(model);try{
    const channel=model==='XR12'?12:32,p=await captureChannelPreset(f.xr,f.control,channel,['eq','compressor','gate']);
    assert.equal(p.model,model);assert.ok(channelPresetValues(f.xr,p,1));
    await assert.rejects(captureChannelPreset(f.xr,f.control,channel+1,['eq']));
    assert.throws(()=>channelPresetValues(f.xr,{...p,model:'XR18',sourceChannel:1},1));
  }finally{f.close();}}
});
test('FX can move to another slot, refuses changed live parameters, and provides a restorable backup',async()=>{
  const f=setup();try{
    const fx=new FxPresets(f.xr,f.control,f.library);
    const saved={slot:1,algorithm:10,parameters:[{type:'f' as const,value:.7}]};
    const old=await f.xr.readFx(3);
    const plan=await fx.preview('preset',saved,3);
    assert.deepEqual(await f.xr.readFx(3),old);
    const result=await fx.apply('preset',plan.token);
    assert.deepEqual(await f.xr.readFx(3),{...saved,slot:3});
    assert.deepEqual(await f.xr.readFx(1),{...old,slot:1});
    const backup=f.library.get(result.backupId),undo=await fx.preview(backup.id,backup.data);
    await fx.apply(backup.id,undo.token);assert.deepEqual(await f.xr.readFx(3),old);
    const stale=await fx.preview('preset',saved,3);
    await f.xr.applyFx({...saved,slot:3,parameters:[{type:'f',value:.2}]});
    await assert.rejects(fx.apply('preset',stale.token),/État modifié/);
    assert.equal((await f.xr.readFx(3)).parameters[0]!.value,.2);
  }finally{f.close();}
});
test('file recognition accepts older scenes, native scenes and FX but refuses unrelated JSON',()=>{
  for(const data of [{kind:'scene',name:'Legacy',data:{version:1}},{kind:'fx',data:{slot:2}},{scope:'console',version:2,values:{},fx:[]}])assert.ok(parseLibraryFile('test.json',JSON.stringify(data)));
  assert.equal(parseLibraryFile('TEST.SCN','/ch/01/config "Lead" 1 In01 U01').kind,'native-scene');
  for(const text of ['null','[]','{','{}','{"kind":"parameter-backup","data":{}}'])assert.throws(()=>parseLibraryFile('bad.json',text));
});
test('native export saves exact content only to the chosen path; cancellation does not write',async()=>{
  const {saveLibraryFile}=createRequire(import.meta.url)(resolve('desktop/library-export.cjs'));
  const dir=await mkdtemp(join(tmpdir(),'bandpilot-export-'));try{
    const file=join(dir,'chosen.json');let calls=0;
    const options={input:{filename:'../../preset.json',content:'{"kind":"scene"}'},win:{},documents:dir,title:'Export',dialog:{showSaveDialog:async(_win:unknown,input:{defaultPath:string})=>{calls++;assert.equal(input.defaultPath,join(dir,'preset.json'));return {canceled:false,filePath:file};}}};
    assert.deepEqual(await saveLibraryFile(options),{saved:true});assert.equal(await readFile(file,'utf8'),options.input.content);
    assert.deepEqual(await saveLibraryFile({...options,input:{...options.input,content:'{}'},dialog:{showSaveDialog:async()=>({canceled:true})}}),{cancelled:true});assert.equal(await readFile(file,'utf8'),options.input.content);
    await assert.rejects(saveLibraryFile({...options,input:{filename:'bad.sh',content:'echo bad'}}));assert.equal(calls,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
