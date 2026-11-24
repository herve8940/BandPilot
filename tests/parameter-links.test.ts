import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleControl} from '../src/console-control.js';
import {ParameterLinks} from '../src/parameter-links.js';
import {validateParameterLinks} from '../shared/parameter-links.js';
function fixture(){
 const xr=new XR18({mode:'simulation',model:'XR18',host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);let now=1000;
 const links=new ParameterLinks(xr,control,library,()=>now);
 const definition=library.saveParameterLinks({model:'XR18',revision:0,links:[{channels:[1,3],setting:'hpon',band:1}]});
 return {xr,library,control,links,definition,advance:(ms:number)=>now+=ms,close(){xr.close();library.close();}};
}
test('parameter link definitions are versioned, isolated by model, validated and never send audio',async()=>{
 const f=fixture();try{
  const before=await f.control.capture();
  assert.deepEqual(f.library.parameterLinks('MR12').links,[]);
  assert.throws(()=>f.library.saveParameterLinks({...f.definition,revision:0}),/autre écran/);
  for(const links of [[{channels:[1,13],setting:'eq',band:1}],[{channels:[1,2],setting:'tap',band:1}],[{channels:[1,2],setting:'pan',band:1},{channels:[2,3],setting:'pan',band:2}]])assert.throws(()=>validateParameterLinks({model:'MR12',revision:0,links}));
  assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
test('one explicit controller lease, ordered writes, backup, expiration and reconnection',async()=>{
 const f=fixture();try{
  const before=await f.control.capture(),s=await f.links.start('one',f.definition,()=>{});
  assert.deepEqual(await f.control.capture(),before);
  await assert.rejects(f.links.start('two',f.definition,()=>{}),/déjà actifs/);
  await assert.rejects(f.links.move('two',{...s,index:0,value:1,sequence:1},()=>{}),/désactivés/);
  await assert.rejects(f.links.move('one',{...s,index:0,value:1,sequence:2},()=>{}),/Ordre/);
  const result=await f.links.move('one',{...s,index:0,value:1,sequence:1},()=>{});assert.ok(result.backupId);
  assert.equal(await f.xr.readParameter('/ch/01/preamp/hpon'),1);assert.equal(await f.xr.readParameter('/ch/03/preamp/hpon'),1);
  assert.equal(await f.xr.readParameter('/ch/02/preamp/hpon'),before.values['/ch/02/preamp/hpon']);
  f.links.stop('two',s.token);f.advance(14000);f.links.pulse('one',s.token);f.advance(14000);
  await f.links.move('one',{...s,index:0,value:0,sequence:2},()=>{});
  f.advance(15000);await assert.rejects(f.links.move('one',{...s,index:0,value:1,sequence:3},()=>{}),/désactivés/);
  const next=await f.links.start('two',f.definition,()=>{});f.xr.cancelOperations();assert.throws(()=>f.links.pulse('two',next.token),/désactivés/);
  const reconnected=await f.links.start('two',f.definition,()=>{});await f.xr.reconnect({mode:'simulation',model:'XR18',host:'127.0.0.1',port:10024,enableWrites:false});assert.throws(()=>f.links.pulse('two',reconnected.token),/désactivés/);
 }finally{f.close();}
});
test('editing definitions or stereo topology disarms links before sending audio',async()=>{
 const f=fixture();try{
  let s=await f.links.start('one',f.definition,()=>{});
  f.library.saveParameterLinks(f.definition);
  await assert.rejects(f.links.move('one',{...s,index:0,value:1,sequence:1},()=>{}),/désactivés/);
  s=await f.links.start('one',f.library.parameterLinks('XR18'),()=>{});
  await f.xr.writeParameter('/config/chlink/1-2',1);
  const before=await f.control.capture();
  await assert.rejects(f.links.move('one',{...s,index:0,value:1,sequence:1},()=>{}));
  assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
test('a stop while reading a linked edit prevents the prepared write',async()=>{
 const f=fixture();try{
  const s=await f.links.start('one',f.definition,()=>{}),before=await f.control.capture();
  const read=f.xr.readParameter.bind(f.xr);let release!:()=>void,entered!:()=>void;
  const held=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);let once=true;
  f.xr.readParameter=async a=>{if(once){once=false;entered();await held;}return read(a);};
  const move=f.links.move('one',{...s,index:0,value:1,sequence:1},()=>{});await started;f.links.stop('one',s.token);release();await assert.rejects(move,/désactivés/);
  f.xr.readParameter=read;assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});

test('a temporary relative group keeps offsets at the limit and never replaces saved links',async()=>{
 const f=fixture();
 try{
  await f.xr.writeParameter('/ch/01/mix/pan',.2);
  await f.xr.writeParameter('/ch/03/mix/pan',.8);
  const original=await f.control.capture();
  const s=await f.links.start('one',{model:'XR18',revision:f.definition.revision,quick:{scope:'pan',channels:[1,3]}},()=>{});
  assert.deepEqual(await f.control.capture(),original);
  const result=await f.links.move('one',{...s,index:0,channel:1,value:.7,sequence:1},()=>{});
  assert.ok(result.backupId);
  assert.ok(Math.abs(Number(await f.xr.readParameter('/ch/01/mix/pan'))-.4)<.00001);
  assert.equal(await f.xr.readParameter('/ch/03/mix/pan'),1);
  await f.links.move('one',{...s,index:0,channel:3,value:.85,sequence:2},()=>{});
  assert.ok(Math.abs(Number(await f.xr.readParameter('/ch/01/mix/pan'))-.25)<.00001);
  assert.deepEqual(f.library.parameterLinks('XR18'),f.definition);
  const after=await f.control.capture();
  await assert.rejects(f.links.move('one',{...s,index:0,channel:2,value:.3,sequence:3},()=>{}));
  assert.deepEqual(await f.control.capture(),after);
  assert.throws(()=>f.links.pulse('one',s.token));
 }finally{f.close();}
});
