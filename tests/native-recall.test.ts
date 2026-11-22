import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {decodeNativeFx} from '../src/native-fx.js';
import {nativeSceneForRecall} from '../src/native-scene-recall.js';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {MixerSync} from '../src/mixer-sync.js';

// Synthetic scenes: no rehearsal names or settings are distributed with the tests.
const room='100 2.95 40 10k 50 +0 100 2k 1 25 125 50 600 600 0 0';
const delay='50 1500 ST 1 1/2 +0 100 2k 100 25 25 2k';
const mod='1500 1/2 25 100 2k 50 1 PAR CLUB 5 10k +0 100';
const native=`/ch/01/config "Fixture" 1 In01 U01\n/ch/01/mix OFF -20 ON +0\n/headamp/01 +0 ON\n/headamp/17 +0\n/fx/1 ROOM ON\n/fx/1/par ${room}\n/fx/2 DLY ON\n/fx/2/par ${delay}\n/fx/3 MODD OFF\n/fx/3/par ${mod}\n/fx/4 ROOM ON\n/fx/4/par ${room}`;
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('native FX units, enums, aliases and padding decode to correct OSC types',()=>{
 const r=decodeNativeFx(1,3,(room+' '+Array(48).fill('0').join(' ')).split(' '));
 assert.equal(r.parameters.length,16);near(r.parameters[0]!.value,.5);near(r.parameters[2]!.value,.5);near(r.parameters[14]!.value,.5);
 near(r.parameters[1]!.value,Math.log(2.95/.3)/Math.log(29/.3));
 const d=decodeNativeFx(2,10,delay.split(' '));assert.equal(d.parameters.map(p=>p.type).join(''),'ffiiifffffff');assert.deepEqual(d.parameters.slice(2,5).map(p=>p.value),[0,4,2]);
 const m=decodeNativeFx(3,26,mod.replace('CLUB','SML').split(' '));assert.equal(m.parameters.map(p=>p.type).join(''),'fifffffiiffff');assert.equal(m.parameters[8]!.value,1);
 for(const text of [room.replace('100 ','201 '),room.replace('10k','NaN'),room+' 1',room.split(' ').slice(0,12).join(' ')])assert.throws(()=>decodeNativeFx(1,3,text.split(' ')));
 assert.throws(()=>decodeNativeFx(2,10,delay.replace('ST','bad').split(' ')),/option inconnue/);
 assert.throws(()=>decodeNativeFx(1,61,room.split(' ')),/pas encore pris en charge/);
});
test('native conversion is model-specific, preserves FX insertion, tolerates line order, and requires coherent FX pairs',()=>{
 for(const model of ['XR18','MR18','X18']){
  const p=nativeSceneForRecall(native.split('\n').reverse().join('\n'),model);
  assert.equal(p.fx.length,4);assert.equal(p.values['/fx/3/insert'],0);assert.deepEqual(p.omitted,['/headamp/17/gain']);assert.equal(p.values['/headamp/17/gain'],undefined);
 }
 for(const model of ['XR12','XR16','X32'])assert.throws(()=>nativeSceneForRecall(native,model),/uniquement/);
 assert.throws(()=>nativeSceneForRecall(`/fx/1/par ${room}`,'XR18'),/type d’effet absent/);
 assert.throws(()=>nativeSceneForRecall('/fx/1 ROOM ON','XR18'),/paramètres absents/);
});
function fixture(){const dir=mkdtempSync(join(tmpdir(),'native-recall-')),library=new LibraryStore(join(dir,'test.db'));
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});const control=new ConsoleControl(xr,library),sync=new MixerSync(xr,control,library);
 return {xr,library,control,sync,close:()=>{xr.close();library.close();rmSync(dir,{recursive:true,force:true});}};
}
test('native preview writes nothing; recall restores all four FX, keeps 48V, backs up and restores previous state',async()=>{
 const f=fixture();try{
  const entry=f.library.save('native-scene','Synthetic native scene',native),before=await f.control.capture();
  const p=await f.sync.preview(entry.id);assert.equal(p.phantom,false);assert.deepEqual(p.fxSlots,[1,2,3,4]);assert.ok(!p.changes.some(c=>c.address.endsWith('/phantom')));
  assert.deepEqual(await f.control.capture(),before);assert.equal(f.library.list('scene').length,0);
  await assert.rejects(()=>f.sync.apply(p.token,true,false,'another-id'),/expiré/);
  const result=await f.sync.apply(p.token,true,false,entry.id);
  assert.deepEqual(f.library.get(result.backupId).data,before);
  assert.equal(await f.xr.readParameter('/headamp/01/phantom'),0);assert.equal(await f.xr.readParameter('/ch/01/mix/on'),0);
  assert.equal(await f.xr.readParameter('/fx/3/insert'),0);assert.equal((await f.xr.readFx(3)).parameters[8]!.value,1);
  await assert.rejects(()=>f.sync.apply(p.token,true),/expiré/);
  await f.control.recall(f.library.get(result.backupId).data,false,true);assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
test('native invalid FX, stale state, cancellation and read failures stop before writes or backups',async()=>{
 const f=fixture();try{
  const entry=f.library.save('native-scene','Fixture',native),bad=f.library.save('native-scene','Unsupported',native.replace('MODD OFF','PIT OFF'));
  let writes=0;const write=f.xr.writeParameter.bind(f.xr);f.xr.writeParameter=async(...args)=>{writes++;return write(...args);};
  await assert.rejects(()=>f.sync.preview(bad.id),/paramètres|remplissage|hors plage/);assert.equal(writes,0);
  const p=await f.sync.preview(entry.id);f.xr.setFader(2,.6);await assert.rejects(()=>f.sync.apply(p.token,true),/table a changé/);assert.equal(writes,0);
  const cancelled=await f.sync.preview(entry.id),capture=f.control.capture.bind(f.control);
  f.control.capture=async()=>{const s=await capture();f.xr.cancelOperations();return s;};
  await assert.rejects(()=>f.sync.apply(cancelled.token,true),/interrompue/);assert.equal(writes,0);assert.equal(f.library.list('scene').length,0);
  f.control.capture=async()=>{const s=await capture();delete s.values['/ch/01/mix/on'];return s;};
  await assert.rejects(()=>f.sync.preview(entry.id),/ne peuvent pas être lus/);assert.equal(writes,0);
 }finally{f.close();}
});
test('native final verification detects later side effects and keeps the recovery backup',async()=>{
 const f=fixture();try{
  const e=f.library.save('native-scene','Fixture',native),p=await f.sync.preview(e.id),capture=f.control.capture.bind(f.control);let reads=0;
  f.control.capture=async()=>{const s=await capture();if(++reads===2)s.values['/ch/01/mix/on']=1;return s;};
  await assert.rejects(()=>f.sync.apply(p.token,true),/potentiellement partielle.*Lecture différente après rappel/);
  assert.equal(f.library.list('scene').length,1);
 }finally{f.close();}
});
