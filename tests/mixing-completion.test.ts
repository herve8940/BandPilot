import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_FREQUENCIES,roomCorrections,roomTargetDb} from '../shared/room-eq.js';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleControl} from '../src/console-control.js';
import {capturePortable,previewPortable,previewPortableBackup} from '../src/portable-scenes.js';
import {previewRoomEq} from '../src/mix-preparation.js';
import {fromWire,toWire} from '../src/parameters.js';
const fixture=(model:'XR18'|'MR12')=>{
 const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
 return {xr,library,control,set:(a:string,v:number|string)=>xr.writeParameter(a,toWire(a,v)),close(){xr.close();library.close();}};
};
test('flat corrections stay compatible, explicit target preserves its response, curves reject invalid preferences',()=>{
 const target={lowDb:4,highDb:-3};
 const curve=ROOM_FREQUENCIES.map(hz=>[hz,roomTargetDb(hz,target)+72]);
 assert.deepEqual(roomCorrections(curve,undefined,3,target),[]);
 const peak=curve.map(([hz,db])=>[hz,db!+(hz===1000?8:0)]);
 assert.deepEqual(roomCorrections(peak,undefined,3,target),[{index:17,db:-3}]);
 const flat=ROOM_FREQUENCIES.map(hz=>[hz,hz===1000?6:0]);
 assert.deepEqual(roomCorrections(flat,undefined,3),roomCorrections(flat,undefined,3,{lowDb:0,highDb:0}));
 for(const invalid of [{lowDb:7,highDb:0},{lowDb:0,highDb:.1},{lowDb:0,highDb:0,gain:2},null])assert.throws(()=>roomCorrections(flat,undefined,3,invalid),/cible/);
 assert.throws(()=>roomCorrections(undefined,1000,2,target));
});
test('room estimate includes the actual GEQ limit, uses the selected bus and leaves preview silent',async()=>{
 const f=fixture('MR12');try{
  await f.set('/bus/2/eq/mode',1);await f.set('/bus/2/eq/on',1);await f.set('/bus/2/geq/1k',-14);
  const before=await f.control.capture(),curve=ROOM_FREQUENCIES.map(hz=>[hz,hz===1000?8:0]);
  const plan=await previewRoomEq(f.xr,f.control,{model:'MR12',target:'/bus/2',curve,maxCut:6,targetCurve:{lowDb:0,highDb:0}});
  assert.deepEqual(await f.control.capture(),before);
  assert.equal(plan.roomEstimate?.find(p=>p.hz===1000)?.estimated,7);
  await f.control.apply(plan.token);assert.equal(fromWire('/bus/2/geq/1k',await f.xr.readParameter('/bus/2/geq/1k')),-15);
  assert.equal(await f.xr.readParameter('/lr/geq/1k'),before.values['/lr/geq/1k']);
 }finally{f.close();}
});
test('portable stereo maps XR18 to MR12, preserves independent sides, rejects split topology and restores',async()=>{
 const source=fixture('XR18'),dest=fixture('MR12');try{
  for(const f of [source,dest]){await f.set('/config/linkcfg/eq',0);await f.set('/config/linkcfg/preamp',0);await f.set('/config/linkcfg/fdrmute',1);}
  await source.set('/config/chlink/15-16',1);await dest.set('/config/chlink/3-4',1);
  for(const ch of [15,16])await source.set(`/ch/${ch}/mix/fader`,-12);
  await source.set('/ch/15/eq/1/g',3);await source.set('/ch/16/eq/1/g',-2);
  await source.set('/ch/15/mix/pan',-100);await source.set('/ch/16/mix/pan',100);
  const scene=dest.library.save('portable-scene','Stereo fixture',await capturePortable(source.xr,source.control,'XR18'));
  const body={model:'MR12',mapping:[{source:15,target:3},{source:16,target:4}],sections:['levels','eq','labels']};
  const preview=(input=body)=>previewPortable(dest.xr,dest.control,dest.library,scene,input);
  for(const mapping of [[{source:15,target:3}],[{source:15,target:4},{source:16,target:3}],[{source:15,target:3},{source:16,target:6}],[{source:15,target:5},{source:16,target:6}]])await assert.rejects(preview({...body,mapping}),/paire stéréo/);
  const before=await dest.control.capture(),plan=await preview();assert.deepEqual(await dest.control.capture(),before);
  const result=await dest.control.apply(plan.token);
  assert.equal(fromWire('/ch/03/eq/1/g',await dest.xr.readParameter('/ch/03/eq/1/g')),3);
  assert.equal(fromWire('/ch/04/eq/1/g',await dest.xr.readParameter('/ch/04/eq/1/g')),-2);
  assert.equal(fromWire('/ch/03/mix/pan',await dest.xr.readParameter('/ch/03/mix/pan')),-100);
  assert.equal(fromWire('/ch/04/mix/pan',await dest.xr.readParameter('/ch/04/mix/pan')),100);
  const backup=dest.library.get(result.backupId);
  await dest.set('/config/linkcfg/eq',1);await assert.rejects(previewPortableBackup(dest.xr,dest.control,dest.library,backup));
  await dest.set('/config/linkcfg/eq',0);
  await dest.control.apply((await previewPortableBackup(dest.xr,dest.control,dest.library,backup)).token);
  assert.deepEqual(await dest.control.capture(),before);
  await dest.set('/config/linkcfg/eq',1);await assert.rejects(preview(),/partagé/);
 }finally{source.close();dest.close();}
});
test('a protected side keeps both shared faders, independent pan stays selective, changed preferences invalidate preview',async()=>{
 const source=fixture('XR18'),dest=fixture('MR12');try{
  for(const f of [source,dest]){await f.set('/config/chlink/1-2',1);await f.set('/config/linkcfg/fdrmute',1);}
  for(const ch of ['01','02'])await source.set(`/ch/${ch}/mix/fader`,-9);
  await source.set('/ch/01/mix/pan',-100);await source.set('/ch/02/mix/pan',100);
  const scene=dest.library.save('portable-scene','Stereo fixture',await capturePortable(source.xr,source.control,'XR18'));
  dest.library.saveProtections({model:'MR12',revision:0,rules:[{channel:2,sections:['levels']}]});
  const body={model:'MR12',mapping:[{source:1,target:1},{source:2,target:2}],sections:['levels']};
  const before=await dest.control.capture(),plan=await previewPortable(dest.xr,dest.control,dest.library,scene,body);
  assert.ok(!plan.changes.some(c=>c.address.endsWith('/mix/fader')));
  assert.ok(!plan.changes.some(c=>c.address==='/ch/02/mix/pan'));
  await dest.set('/config/linkcfg/fdrmute',0);await assert.rejects(dest.control.apply(plan.token),/État modifié/);
  await dest.set('/config/linkcfg/fdrmute',1);
  await dest.control.apply((await previewPortable(dest.xr,dest.control,dest.library,scene,body)).token);
  assert.equal(await dest.xr.readParameter('/ch/01/mix/fader'),before.values['/ch/01/mix/fader']);
  assert.equal(await dest.xr.readParameter('/ch/02/mix/pan'),before.values['/ch/02/mix/pan']);
 }finally{source.close();dest.close();}
});
