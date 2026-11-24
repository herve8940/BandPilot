import test from 'node:test';
import assert from 'node:assert/strict';
import type {MixerModelId} from '../shared/mixer-models.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {SoundCoach, type CoachProfile} from '../src/sound-coach.js';
import {XR18} from '../src/xr18.js';

function fixture(model:MixerModelId='XR18'){
 const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false});
 const db=new LibraryStore(':memory:'),coach=new SoundCoach(xr,new ConsoleControl(xr,db),db);
 const profile:CoachProfile={version:1,completed:[],inputs:[{channel:2,name:'Voix',source:'lead-rock'},{channel:5,name:'Basse',source:'bass-di'}],
  musicians:[{name:'Voix',bus:1,role:'chant',channels:[2]},{name:'Basse',bus:2,role:'basse',channels:[5]}]};
 return {xr,coach,profile,close(){xr.close();db.close();}};
}

for(const model of ['XR18','MR12'] as const)test(model+' new soundcheck clears old strips and all their sends only after confirmation, and undoes them',async()=>{
 const {xr,coach,profile,close}=fixture(model);
 const old={'/ch/03/config/name':'Ancien micro','/ch/03/mix/fader':.8,'/ch/03/mix/01/level':.7,
  '/ch/03/mix/01/grpon':1,'/ch/03/mix/09/level':.6,'/ch/03/dyn/on':1,'/ch/03/eq/1/g':.7};
 try{
  const kept={'/headamp/03/gain':.6,'/headamp/03/phantom':1,'/ch/02/mix/fader':.73,'/ch/05/mix/02/level':.44,'/lr/mix/fader':.8,'/bus/1/mix/fader':.6};
  await xr.applyParameters({...old,...kept},true);
  const before=xr.parameterState();coach.saveProfile(profile);const additive=await coach.prepare();
  assert.ok(additive.changes.every(c=>/^\/ch\/(02|05)\//.test(c.address)));
  const plan=await coach.prepare(undefined,true);assert.deepEqual(xr.parameterState(),before);
  assert.equal(plan.silentInputs?.length,xr.model().channels-2);
  await assert.rejects(coach.apply(plan.token,false),/Confirmation/);
  assert.equal((await coach.apply(plan.token,true)).ok,true);
  for(const [a,v] of Object.entries(kept))assert.equal(await xr.readParameter(a),v,a);
  assert.equal(await xr.readParameter('/ch/02/config/name'),'Voix');assert.equal(await xr.readParameter('/ch/05/config/name'),'Basse');
  for(const a of Object.keys(old))assert.equal(await xr.readParameter(a),a.endsWith('name')?'':a.endsWith('/g')?.5:0,a);
  await coach.apply((await coach.undo()).token,true);
  for(const [a,v] of Object.entries(old))assert.equal(await xr.readParameter(a),v,a);
 }finally{close();}
});

for(const model of ['XR18','XR12'] as const)test(model+' monitor cleanup scopes a single return and all returns, including Aux, effects and subgroup sends',async()=>{
 const {xr,coach,profile,close}=fixture(model);
 try{
  profile.musicians=profile.musicians!.slice(0,1);coach.saveProfile(profile);
  const stale={'/ch/03/mix/01/level':.6,'/rtn/1/mix/01/level':.7,'/rtn/aux/mix/01/level':.5,
   '/ch/03/mix/01/grpon':1,'/bus/2/config/name':'Ancien','/bus/2/mix/fader':.7,'/ch/02/mix/02/level':.8,'/ch/03/mix/02/level':.4};
  await xr.applyParameters(stale);const before=xr.parameterState();
  const legacy=await coach.prepareEars(1);assert.ok(!legacy.changes.some(c=>c.address in stale));
  const single=await coach.prepareEars(1,true);assert.deepEqual(single.activeBuses,[1]);assert.deepEqual(single.silentBuses,[]);
  assert.deepEqual(xr.parameterState(),before);
  assert.ok(single.changes.every(c=>/^(\/bus\/1\/|.*\/mix\/01\/)/.test(c.address)));
  await coach.apply(single.token,true);
  for(const [a,v] of Object.entries(stale))assert.equal(await xr.readParameter(a),a.includes('/mix/01/')?0:v,a);
  assert.ok(Number(await xr.readParameter('/ch/02/mix/01/level'))>0);
  const all=await coach.prepareEars(undefined,true);assert.equal(all.silentBuses?.length,xr.model().monitorOutputs-1);
  await coach.apply(all.token,true);
  assert.equal(await xr.readParameter('/ch/02/mix/02/level'),0);assert.equal(await xr.readParameter('/bus/2/config/name'),'');
  assert.equal(await xr.readParameter('/bus/2/mix/fader'),0);
  await coach.apply((await coach.undo()).token,true);assert.equal(await xr.readParameter('/bus/2/mix/fader'),.7);
  coach.saveProfile({...profile,musicians:[]});const silent=await coach.prepareEars(undefined,true);
  assert.equal(silent.silentBuses?.length,xr.model().monitorOutputs);
  await assert.rejects(coach.prepareEars(1,true),/Aucun musicien/);
 }finally{close();}
});

test('linked inputs and monitor pairs stay together across preview, apply and undo',async()=>{
 const {xr,coach,profile,close}=fixture();
 try{
  coach.saveProfile({...profile,musicians:profile.musicians!.slice(0,1)});
  await xr.writeParameter('/config/chlink/1-2',1);
  await assert.rejects(coach.prepare(undefined,true),/deux entrées/);
  await xr.writeParameter('/config/chlink/1-2',0);await xr.writeParameter('/config/buslink/1-2',1);
  const plan=await coach.prepareEars(1,true);assert.deepEqual(plan.activeBuses,[1,2]);assert.deepEqual(plan.silentBuses,[]);
  await coach.apply(plan.token,true);
  assert.equal(await xr.readParameter('/ch/02/mix/01/level'),await xr.readParameter('/ch/02/mix/02/level'));
  const stale=await coach.prepareEars(1,true);await xr.writeParameter('/config/buslink/1-2',0);
  await assert.rejects(coach.apply(stale.token,true),/tat modifié/);
  await assert.rejects(coach.undo(),/tat modifié/);
  await xr.writeParameter('/config/buslink/1-2',1);coach.saveProfile(profile);
  await assert.rejects(coach.prepareEars(undefined,true),/même paire/);
 }finally{close();}
});

test('phone roster follows confirmed monitor plans, including single-bus scope, old previews and partial application',async()=>{
 const {EarsShare}=await import('../src/ears.js');
 const {xr,profile,coach,close}=fixture('MR18'),ears=new EarsShare(':memory:',xr,()=>undefined,()=>null);
 try{
  const old=ears.create('Ancien',1),extra=ears.create('Autre',5);
  coach.saveProfile(profile);
  const stale=await coach.prepareEars(undefined,false,ears);
  await assert.rejects(coach.apply(stale.token,false),/Confirmation/);
  profile.musicians![0]!.name='Clavier';coach.saveProfile(profile);
  await assert.rejects(coach.apply(stale.token,true),/musiciens ont changé/);
  assert.deepEqual(ears.list(),[old,extra]);
  const single=await coach.prepareEars(1,false,ears);assert.equal(single.qrScope,'bus');
  await coach.apply(single.token,true);const kept=ears.list()[0]!;
  assert.equal(kept.name,'Clavier');assert.deepEqual(ears.list()[1],extra);
  const partial=await coach.prepareEars(undefined,false,ears);
  const original=xr.applyParameters;
  try{
   xr.applyParameters=async()=>({failed:['/bus/2/mix/on']});
   assert.equal((await coach.apply(partial.token,true)).ok,false);
  }finally{xr.applyParameters=original;}
  assert.deepEqual(ears.list(),[kept,extra]);
  const group=await coach.prepareEars(undefined,true,ears);assert.equal(group.qrScope,'group');
  await coach.apply(group.token,true);assert.deepEqual(ears.list()[0],kept);
  assert.deepEqual(ears.list().map(s=>s.name),['Clavier','Basse']);
  coach.saveProfile({...profile,musicians:[]});await coach.apply((await coach.prepareEars(undefined,true,ears)).token,true);
  assert.deepEqual(ears.list(),[]);assert.equal(ears.status().running,false);
 }finally{ears.close();close();}
});
