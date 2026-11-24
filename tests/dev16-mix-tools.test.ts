import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {previewBatchEdit,previewChannelBackup} from '../src/channel-operations.js';
import {previewGainCompensation,previewRoomEq,previewMixPreparationBackup} from '../src/mix-preparation.js';
import {SceneRecall} from '../src/scene-recall.js';
import {OutputSceneRecall} from '../src/output-scene-recall.js';
import {ExpertViewLink} from '../src/expert-view-link.js';
import {parseRoomCurve,roomCorrections} from '../shared/room-eq.js';
import {MIXER_MODELS} from '../shared/mixer-models.js';
import {fromWire,toWire,type Value} from '../src/parameters.js';

function fixture(model:'XR18'|'MR12'='XR18'){
 const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false});
 const library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
 const set=(a:string,v:Value)=>xr.writeParameter(a,toWire(a,v));
 const get=async(a:string)=>fromWire(a,await xr.readParameter(a));
 return {xr,library,control,set,get,close(){xr.close();library.close();}};
}
test('batch editing confirms only selected pan and linked bus taps, with a scoped reversible backup',async()=>{
 const f=fixture('MR12');
 try{
  const input={model:'MR12',channels:[1,3],setting:'pan',value:-40};
  const before=await f.control.capture(),p=await previewBatchEdit(f.xr,f.control,input);
  assert.deepEqual(await f.control.capture(),before);
  const result=await f.control.apply(p.token);
  assert.equal(await f.get('/ch/01/mix/pan'),-40);
  assert.equal(await f.get('/ch/02/mix/pan'),0);
  const undo=await previewChannelBackup(f.xr,f.control,f.library,result.backupId);
  await f.control.apply(undo.token);
  assert.deepEqual(await f.control.capture(),before);
  await f.set('/config/buslink/1-2',1);
  const tap=await previewBatchEdit(f.xr,f.control,{...input,setting:'tap',bus:2,value:4});
  assert.equal(tap.changes.length,4);
  await f.set('/config/buslink/1-2',0);
  await assert.rejects(f.control.apply(tap.token),/État modifié/);
  await assert.rejects(previewBatchEdit(f.xr,f.control,{...input,setting:'tap',bus:3,value:4}),/absente/);
  await assert.rejects(previewBatchEdit(f.xr,f.control,{...input,setting:'routing',value:0}));
 }finally{f.close();}
});
test('scene scope snapshots preserve different families by channel, output and scene',async()=>{
 const f=fixture();
 try{
  const recall=new SceneRecall(f.xr,f.control,f.library),output=new OutputSceneRecall(f.xr,f.control,f.library);
  await f.set('/ch/01/eq/1/g',4);await f.set('/ch/02/eq/1/g',6);await f.set('/ch/01/mix/fader',-10);await f.set('/ch/02/mix/fader',-15);
  await f.set('/bus/1/eq/1/g',4);await f.set('/bus/2/eq/1/g',6);await f.set('/bus/1/mix/fader',-10);await f.set('/bus/2/mix/fader',-15);
  const scene=f.library.save('scene','Synthetic scoped scene',await f.control.capture());
  const other=f.library.save('scene','Unrelated scene',scene.data);
  for(const a of ['/ch/01/eq/1/g','/ch/02/eq/1/g','/bus/1/eq/1/g','/bus/2/eq/1/g'])await f.set(a,0);
  for(const a of ['/ch/01/mix/fader','/ch/02/mix/fader','/bus/1/mix/fader','/bus/2/mix/fader'])await f.set(a,-30);
  const before=await f.control.capture();
  const input={channels:[1,2],sections:['eq','levels'],perChannel:{1:['eq'],2:['levels']}};
  const outputs={targets:['/bus/1','/bus/2'],sections:['eq','levels'],fxSlots:[],perTarget:{'/bus/1':['levels'],'/bus/2':['eq']}};
  f.library.saveRecallScope(scene.id,'inputs',recall.validatedScope(scene.id,input));
  f.library.saveRecallScope(scene.id,'outputs',output.validatedScope(scene.id,outputs));
  assert.equal(f.library.recallScope(other.id,'inputs'),null);
  assert.deepEqual(await f.control.capture(),before);
  const preview=await recall.preview(scene.id,f.library.recallScope(scene.id,'inputs'));
  assert.deepEqual(preview.changes.map(c=>c.address).sort(),['/ch/01/eq/1/g','/ch/02/mix/fader']);
  await recall.apply(scene.id,preview.token,true);
  const previewOut=await output.preview(scene.id,f.library.recallScope(scene.id,'outputs'));
  assert.deepEqual(previewOut.changes.map(c=>c.address).sort(),['/bus/1/mix/fader','/bus/2/eq/1/g']);
  await output.apply(scene.id,previewOut.token,()=>{});
  assert.equal(await f.get('/ch/01/mix/fader'),-30);
  assert.equal(await f.get('/bus/2/mix/fader'),-30);
  f.library.delete(scene.id);
  assert.equal(f.library.recallScope(scene.id,'outputs'),null);
 }finally{f.close();}
});
test('gain shift compensates active thresholds and only pre-fader sends, verifies routing and restores exact values',async()=>{
 const f=fixture('MR12');
 try{
  await f.set('/headamp/01/gain',20);await f.set('/ch/01/mix/fader',-15);
  await f.set('/ch/01/dyn/thr',-20);await f.set('/ch/01/gate/thr',-38);
  for(const bus of ['01','02','07'])await f.set('/ch/01/mix/'+bus+'/level',-15);
  await f.set('/ch/01/mix/02/tap',4);
  const before=await f.control.capture(),input={model:'MR12',channel:1,delta:3};
  const p=await previewGainCompensation(f.xr,f.control,input);
  assert.deepEqual(await f.control.capture(),before);
  assert.equal(p.changes.at(-1)?.address,'/headamp/01/gain');
  const result=await f.control.apply(p.token);
  for(const [a,v] of Object.entries({'/headamp/01/gain':23,'/ch/01/mix/fader':-18,'/ch/01/dyn/thr':-17,'/ch/01/gate/thr':-35,'/ch/01/mix/01/level':-18,'/ch/01/mix/02/level':-15,'/ch/01/mix/07/level':-18}))assert.ok(Math.abs(Number(await f.get(a))-v)<1e-7,a);
  const undo=await previewMixPreparationBackup(f.xr,f.control,f.library,result.backupId);
  assert.equal(undo.changes[0]?.address,'/headamp/01/gain');
  await f.control.apply(undo.token);
  assert.deepEqual(await f.control.capture(),before);
  const stale=await previewGainCompensation(f.xr,f.control,input);
  await f.set('/ch/02/config/insrc',0);
  await assert.rejects(f.control.apply(stale.token),/État modifié/);
  await assert.rejects(previewGainCompensation(f.xr,f.control,input),/entrée dédiée/);
 }finally{f.close();}
});
test('room response and peak corrections attenuate only selected active GEQ and preserve linked outputs',async()=>{
 const f=fixture();
 try{
  const curve=parseRoomCurve('* Freq Hz SPL dB Phase\n'+[40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000].map(hz=>hz+' '+(hz===1000?88:76)+' 0').join('\n'));
  assert.deepEqual(roomCorrections(curve,undefined,3),[{index:17,db:-3}]);
  assert.throws(()=>roomCorrections(curve,1000,3));
  const request={model:'XR18',target:'/bus/2',curve,maxCut:3};
  await assert.rejects(previewRoomEq(f.xr,f.control,request),/GEQ/);
  await f.set('/config/buslink/1-2',1);
  for(const bus of [1,2])await f.set('/bus/'+bus+'/eq/mode',1);
  const before=await f.control.capture(),plan=await previewRoomEq(f.xr,f.control,request);
  assert.deepEqual(plan.changes.map(c=>c.address),['/bus/1/geq/1k','/bus/2/geq/1k']);
  assert.deepEqual(await f.control.capture(),before);
  const result=await f.control.apply(plan.token);
  for(const bus of [1,2])assert.ok(Math.abs(Number(await f.get('/bus/'+bus+'/geq/1k'))+3)<1e-7);
  const undo=await previewMixPreparationBackup(f.xr,f.control,f.library,result.backupId);
  await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
  assert.deepEqual(roomCorrections(undefined,1010,1.5),[{index:17,db:-1.5}]);
 }finally{f.close();}
});
test('linked screens advertise only validated view and input to the matching connection for five seconds',()=>{
 let now=0;
 const link=new ExpertViewLink(()=>now),publisher='00000000-0000-0000-0000-000000000001';
 assert.equal(link.read('XR18 real'),null);
 assert.throws(()=>link.publish('one','MR12',MIXER_MODELS.MR12,{publisher,channel:16,view:'channel'}));
 assert.throws(()=>link.publish('one','XR18 real',MIXER_MODELS.XR18,{publisher,channel:1,view:'midi'}));
 link.publish('one','XR18 real',MIXER_MODELS.XR18,{publisher,channel:8,view:'meters'});
 assert.deepEqual(link.read('XR18 real'),{view:'meters',channel:8});
 link.publish('one','XR18 real',MIXER_MODELS.XR18,{publisher,channel:8,view:'analysis'});
 assert.throws(()=>link.publish('two','XR18 real',MIXER_MODELS.XR18,{publisher,channel:2,view:'channel'}));
 assert.equal(link.read('XR18 simulation'),null);
 assert.deepEqual(link.read('XR18 real'),{channel:8,view:'analysis'});
 now=5000;assert.equal(link.read('XR18 real'),null);
});

test('shared preamp opt-in compensates every analogue consumer once, preserves USB and restores exact values',async()=>{
 const f=fixture();
 try{
  await f.set('/headamp/01/gain',20);
  await f.set('/ch/02/config/insrc',0);await f.set('/ch/03/config/insrc',0);await f.set('/ch/03/preamp/rtnsw',1);
  for(const ch of ['01','02']){await f.set(`/ch/${ch}/mix/fader`,-15);await f.set(`/ch/${ch}/mix/01/level`,-20);await f.set(`/ch/${ch}/mix/02/level`,-25);await f.set(`/ch/${ch}/mix/02/tap`,4);await f.set(`/ch/${ch}/dyn/thr`,-25);await f.set(`/ch/${ch}/gate/thr`,-40);}
  const before=await f.control.capture(),input={model:'XR18',channel:1,delta:3,includeShared:true};
  await assert.rejects(previewGainCompensation(f.xr,f.control,{...input,includeShared:false}),/entrée dédiée/);
  const plan=await previewGainCompensation(f.xr,f.control,input);
  assert.deepEqual(plan.affectedChannels,[1,2]);assert.deepEqual(await f.control.capture(),before);
  assert.equal(plan.changes.filter(c=>c.address.startsWith('/headamp/')).length,1);assert.equal(plan.changes.at(-1)?.address,'/headamp/01/gain');
  assert.ok(!plan.changes.some(c=>c.address.startsWith('/ch/03/')));
  const result=await f.control.apply(plan.token);
  for(const ch of ['01','02'])for(const [suffix,value]of Object.entries({'mix/fader':-18,'mix/01/level':-23,'mix/02/level':-25,'dyn/thr':-22,'gate/thr':-37}))assert.ok(Math.abs(Number(await f.get(`/ch/${ch}/${suffix}`))-value)<1e-7);
  const undo=await previewMixPreparationBackup(f.xr,f.control,f.library,result.backupId);await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
  const stale=await previewGainCompensation(f.xr,f.control,input);await f.set('/ch/03/preamp/rtnsw',0);
  await assert.rejects(f.control.apply(stale.token),/État modifié/);assert.equal(await f.get('/headamp/01/gain'),20);
  await f.set('/ch/03/preamp/rtnsw',1);await f.set('/ch/02/automix/group',1);
  const protectedState=await f.control.capture();await assert.rejects(previewGainCompensation(f.xr,f.control,input),/entrée dédiée/);assert.deepEqual(await f.control.capture(),protectedState);
 }finally{f.close();}
});
test('new EQ and dynamics batch controls match the protocol laws and guard their selected band',async()=>{
 const {BATCH_SETTINGS,batchPath,batchToWire,batchFromWire}=await import('../shared/batch-edit.js');
 const {validateParameterLinks}=await import('../shared/parameter-links.js');
 const settings=['eqFrequency','eqQ','compressorThreshold','gateThreshold'] as const;
 for(const setting of settings){const address='/ch/01/'+batchPath(setting,1,3),d=BATCH_SETTINGS[setting];for(const value of [d.min,(d.min+d.max)/2,d.max]){assert.ok(Math.abs(batchToWire(setting,value)-Number(toWire(address,value)))<1e-8,setting);assert.ok(Math.abs(batchFromWire(setting,Number(toWire(address,value)))-value)<1e-7,setting);}}
 const definition={model:'MR12',revision:0,links:settings.map(setting=>({channels:[1,3],setting,band:3}))};assert.equal(validateParameterLinks(definition).links.length,4);
 const f=fixture('MR12');try{
  const before=await f.control.capture(),plan=await previewBatchEdit(f.xr,f.control,{model:'MR12',channels:[1,3],setting:'eqFrequency',band:3,value:2500});
  assert.deepEqual(plan.changes.map(c=>c.address),['/ch/01/eq/3/f','/ch/03/eq/3/f']);assert.deepEqual(await f.control.capture(),before);
  const result=await f.control.apply(plan.token);assert.ok(Math.abs(Number(await f.get('/ch/03/eq/3/f'))-2500)<1e-7);
  const undo=await previewChannelBackup(f.xr,f.control,f.library,result.backupId);await f.control.apply(undo.token);assert.deepEqual(await f.control.capture(),before);
  await assert.rejects(previewBatchEdit(f.xr,f.control,{model:'MR12',channels:[1,3],setting:'eqQ',band:5,value:1}));
 }finally{f.close();}
});
