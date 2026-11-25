import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {VocalFx,vocalFxProgram} from '../src/vocal-fx.js';
import {toWire} from '../src/parameters.js';
import type {CoachProfile} from '../src/sound-coach.js';
import {VOCAL_AMBIENCES} from '../shared/vocal-ambiences.js';
const profile:CoachProfile={version:1,completed:[],inputs:[{channel:1,name:'Chant',source:'lead-rock'},{channel:2,name:'Chœurs',source:'backing-vocal'}],musicians:[{name:'Voix',bus:1,role:'chant',channels:[1]},{name:'Guitare',bus:2,role:'guitare',channels:[3]}]};
function fixture(){const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false}),db=new LibraryStore(':memory:');return {xr,db,fx:new VocalFx(xr,db,()=>profile),close(){xr.close();db.close();}};}
const choice={channel:1,ambience:'pop',doses:{'1':-18,'2':-24}};
test('vocal ambience maps only known X-Air effect vectors, including wet-only delay',()=>{
 for(const a of VOCAL_AMBIENCES){const f=vocalFxProgram(a.id,1);assert.equal(f.parameters.length,12);assert.ok(f.parameters.every(p=>Number.isFinite(p.value)&&p.value>=0&&p.value<=(p.type==='i'?4:1)));}
 const delay=vocalFxProgram('slap',1);assert.deepEqual(delay.parameters.map(p=>p.type).join(''),'ffiiifffffff');assert.equal(delay.parameters[0]!.value,1);assert.equal(delay.parameters[9]!.value,.08);
 assert.throws(()=>vocalFxProgram('unknown',1));
});
test('preview does not write; independent monitor amounts preserve dry signal, masters and FOH',async()=>{
 const f=fixture();try{
  const unchanged:Record<string,number|string>={};for(const a of ['/ch/01/mix/fader','/ch/01/mix/01/level','/bus/1/mix/fader','/lr/mix/on','/headamp/01/phantom','/rtn/1/mix/01/level'])unchanged[a]=await f.xr.readParameter(a);
  const before=f.xr.parameterState(),p=await f.fx.preview(choice);assert.deepEqual(f.xr.parameterState(),before);assert.equal(p.slot,1);
  await f.fx.apply(p.token,true);assert.equal(f.fx.status().session!.phase,'trial');
  assert.equal(await f.xr.readParameter('/rtn/1/mix/01/level'),toWire('/rtn/1/mix/01/level',-18));assert.equal(await f.xr.readParameter('/rtn/1/mix/02/level'),toWire('/rtn/1/mix/02/level',-24));
  assert.equal(await f.xr.readParameter('/rtn/1/mix/lr'),0);assert.equal(await f.xr.readParameter('/rtn/1/mix/01/tap'),3);assert.equal(await f.xr.readParameter('/rtn/1/config/name'),'Voix FX');
  for(const a of ['/ch/01/mix/fader','/ch/01/mix/01/level','/bus/1/mix/fader','/lr/mix/on','/headamp/01/phantom'])assert.equal(await f.xr.readParameter(a),unchanged[a],a);
  await f.fx.undo(false,true);assert.equal(f.fx.status().session,null);assert.equal(await f.xr.readParameter('/rtn/1/mix/01/level'),unchanged['/rtn/1/mix/01/level']);
 }finally{f.close();}
});
test('used slots, inserted effects and stale previews are never overwritten',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/ch/03/mix/07/level',.5);await f.xr.writeParameter('/fx/2/insert',1);
  const p=await f.fx.preview(choice);assert.equal(p.slot,3);
  await f.xr.writeParameter('/ch/04/mix/09/level',.4);await assert.rejects(f.fx.apply(p.token,true),/console a changé/);assert.equal(f.fx.status().session,null);
  await f.xr.writeParameter('/ch/03/mix/10/level',.5);await assert.rejects(f.fx.preview(choice),/quatre effets/);
 }finally{f.close();}
});
test('factory return levels do not falsely occupy an unfed effect; FX-to-FX sends do',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/rtn/1/mix/fader',.75);await f.xr.writeParameter('/rtn/1/mix/lr',1);assert.equal((await f.fx.preview(choice)).slot,1);
  await f.xr.writeParameter('/rtn/1/mix/08/level',.4);assert.equal((await f.fx.preview(choice)).slot,3,'both the sending effect and its fed destination are occupied');
 }finally{f.close();}
});
test('undo of a second style restores the first, removal restores original',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview(choice);await f.fx.apply(p.token,true);await f.fx.keep();const first=await f.xr.readFx(1);
  const resumed=f.fx;assert.equal(resumed.status().session!.phase,'kept');
  const second=await resumed.preview({...choice,ambience:'rock'});await resumed.apply(second.token,true);await resumed.undo(false,true);
  assert.equal(resumed.status().session!.choice.channel,1);assert.deepEqual(await f.xr.readFx(1),first);assert.equal(await f.xr.readParameter('/ch/02/mix/07/level'),0);
  await resumed.undo(true,true);assert.equal(resumed.status().session,null);assert.equal(await f.xr.readParameter('/ch/01/mix/07/level'),0);
 }finally{f.close();}
});
test('partial effect write retains an explicit recovery snapshot and blocks more trials',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview(choice),write=f.xr.applyFx.bind(f.xr);let fail=true;
  f.xr.applyFx=async fx=>{if(fail)throw Error('test disconnect');return write(fx);};
  await assert.rejects(f.fx.apply(p.token,true),/Essai incomplet/);assert.equal(f.fx.status().session!.phase,'recovery');await assert.rejects(f.fx.preview(choice),/annule/);
  fail=false;const resumed=f.fx;await resumed.undo(false,true);assert.equal(resumed.status().session,null);
 }finally{f.close();}
});
test('stereo monitors need equal doses; invalid or unassigned destinations are rejected',async()=>{
 const f=fixture();try{
  await f.xr.writeParameter('/config/buslink/1-2',1);await assert.rejects(f.fx.preview(choice),/paire stéréo/);
  const p=await f.fx.preview({...choice,doses:{'1':-18,'2':-18}});assert.equal(p.monitors[0]!.db,p.monitors[1]!.db);
  for(const bad of [{...choice,channel:3},{...choice,doses:{'6':-18}},{...choice,doses:{'1':4}}])await assert.rejects(f.fx.preview(bad));
 }finally{f.close();}
});
test('musicians can dose the shared effect from their phones without breaking style undo',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview(choice);await f.fx.apply(p.token,true);await f.fx.keep();
  const second=await f.fx.preview({...choice,ambience:'slap'});await f.fx.apply(second.token,true);
  const amount=toWire('/rtn/1/mix/02/level',-15);await f.xr.writeParameter('/rtn/1/mix/02/level',amount);
  await f.fx.undo(false,true);assert.equal(await f.xr.readParameter('/rtn/1/mix/02/level'),amount);assert.equal(f.fx.status().session!.choice.ambience,'pop');
  await f.xr.writeParameter('/rtn/1/mix/03/level',.5);const result=await f.fx.readDoses();assert.match(result.session!.conflict!,/rtn\/1\/mix\/03\/level/);assert.equal(result.readings?.['3'],undefined);await assert.rejects(f.fx.undo(true,true),/diffère/);
 }finally{f.close();}
});

test('small manual FX changes invalidate a preview and a kept session',async()=>{
 const f=fixture();try{
  await f.xr.applyFx(vocalFxProgram('natural',1));const p=await f.fx.preview(choice);
  const manual=await f.xr.readFx(1);manual.parameters[0]!.value+=.01;await f.xr.applyFx(manual);
  await assert.rejects(f.fx.apply(p.token,true),/console a changé/);assert.equal(f.fx.status().session,null);
  const next=await f.fx.preview(choice);await f.fx.apply(next.token,true);await f.fx.keep();
  const changed=await f.xr.readFx(1);changed.parameters[0]!.value+=.01;await f.xr.applyFx(changed);
  await assert.rejects(f.fx.undo(true,true),/paramètres de l’effet diffèrent/);assert.deepEqual(await f.xr.readFx(1),changed);
 }finally{f.close();}
});

test('an obsolete browser proposal cannot consume the latest proposal',async()=>{
 const f=fixture();try{
  const first=await f.fx.preview(choice),latest=await f.fx.preview({...choice,ambience:'rock'});
  await assert.rejects(f.fx.apply(first.token,true),/Relis la proposition/);
  await f.fx.apply(latest.token,true);assert.equal(f.fx.status().session!.choice.ambience,'rock');
 }finally{f.close();}
});

test('linking the selected voice after preview invalidates the trial before writing',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview(choice);
  await f.xr.writeParameter('/config/chlink/1-2',1);
  const before=f.xr.parameterState();
  await assert.rejects(f.fx.apply(p.token,true),/console a changé/);
  assert.equal(f.fx.status().session,null);
  assert.deepEqual(f.xr.parameterState(),before);
 }finally{f.close();}
});

test('an old simulated Rock trial cannot block the real console',async()=>{
 const f=fixture();try{
  f.db.save('vocal-fx','Ambiance vocale',{identity:'["simulation","XR18","",10024]',phase:'trial',slot:1,choice:{...choice,ambience:'rock'}});
  const fx=new VocalFx(f.xr,f.db,()=>profile);
  const p=await fx.preview(choice);
  await fx.apply(p.token,true);
  const originalStatus=f.xr.status.bind(f.xr);
  f.xr.status=()=>({...originalStatus(),mode:'real',host:'192.168.68.83'});
  assert.equal(fx.status().session,null);
  assert.equal(new VocalFx(f.xr,f.db,()=>profile).status().session,null);
 }finally{f.close();}
});

test('source presets are enforced and an instrument trial uses only its own FX send',async()=>{
 const f=fixture();try{
  const instrumentProfile={...profile,inputs:[...profile.inputs,{channel:3,name:'Caisse claire',source:'snare'},{channel:4,name:'Basse',source:'bass-di'}]};
  const fx=new VocalFx(f.xr,f.db,()=>instrumentProfile);
  await assert.rejects(fx.preview({...choice,channel:3,ambience:'pop'}),/adaptée/);
  await assert.rejects(fx.preview({...choice,channel:4,ambience:'drum-space'}),/adaptée/);
  const proposal=await fx.preview({...choice,channel:3,ambience:'snare-plate'});
  await fx.apply(proposal.token,true);
  assert.equal(await f.xr.readParameter('/rtn/1/config/name'),'Ambiance FX');
  assert.equal(await f.xr.readParameter('/rtn/1/mix/lr'),0);
  assert.equal(await f.xr.readParameter('/ch/01/mix/07/level'),0);
  assert.equal(await f.xr.readParameter('/ch/03/mix/07/level'),toWire('/ch/03/mix/07/level',0));
  await fx.undo(false,true);
  assert.equal(await f.xr.readParameter('/ch/03/mix/07/level'),0);
 }finally{f.close();}
});

test('switching from voice to snare preserves the vocal processor, send and return',async()=>{
 const f=fixture();
 try{
  const group={...profile,inputs:[profile.inputs[0]!,{channel:2,name:'Caisse claire',source:'snare'}]};
  const fx=new VocalFx(f.xr,f.db,()=>group);
  const voice=await fx.preview({...choice,mainDb:-18});
  const kept=(await fx.apply(voice.token,true)).session!;
  await fx.keep(kept.id);
  const program=await f.xr.readFx(1),before=f.xr.parameterState();
  const snare={channel:2,ambience:'snare-plate',mainDb:-12,doses:{'1':-24,'2':-90}};
  const proposal=await fx.preview(snare);
  assert.equal(proposal.slot,2);
  await assert.rejects(fx.preview(snare,undefined,kept.id),/autre entrée/);
  assert.deepEqual(f.xr.parameterState(),before);
  const accepted=(await fx.apply(proposal.token,true)).session!;
  await fx.keep(accepted.id);
  assert.deepEqual(fx.status().sessions.map(s=>[s.slot,s.choice.channel]),[[1,1],[2,2]]);
  assert.deepEqual(await f.xr.readFx(1),program);
  for(const address of ['/ch/01/mix/07/level','/rtn/1/mix/fader','/rtn/1/mix/01/level','/rtn/1/mix/02/level'])
   assert.equal(await f.xr.readParameter(address),before[address]!.value,address);
  assert.equal(await f.xr.readParameter('/ch/01/mix/08/level'),0);
  assert.equal(await f.xr.readParameter('/ch/02/mix/07/level'),0);
  assert.equal(await f.xr.readParameter('/ch/02/mix/08/level'),toWire('/ch/02/mix/08/level',0));
  await fx.undo(true,true,accepted.id);assert.deepEqual(await f.xr.readFx(1),program);
  assert.deepEqual(fx.status().sessions.map(s=>s.id),[kept.id]);
 }finally{f.close();}
});

test('a saved Rock trial can be inspected and released after the console switches to Room',async t=>{
 const f=fixture();
 try{
  const status=f.xr.status.bind(f.xr);
  f.xr.status=()=>({...status(),mode:'real',connected:true,writesEnabled:true,host:'192.0.2.8'});
  const preview=await f.fx.preview({...choice,ambience:'rock'});
  await f.fx.apply(preview.token,true);
  const original=await f.xr.readFx(1);
  const room={slot:1,algorithm:3,parameters:[]};
  await f.xr.applyFx(room);
  const level='/rtn/1/mix/01/level';
  await f.xr.writeParameter(level,toWire(level,-12));
  const writes=[t.mock.method(f.xr,'applyFx'),t.mock.method(f.xr,'applyParameters'),t.mock.method(f.xr,'writeParameter')];
  const session=new VocalFx(f.xr,f.db,()=>profile);
  await assert.rejects(session.keep(),/Plate Reverb.*Room Reverb/);
  await assert.rejects(session.undo(false,true),/Room Reverb/);
  const observed=await session.readDoses();
  assert.match(observed.session!.conflict!,/Room Reverb/);
  assert.ok(Math.abs(observed.readings!['1']!+12)<0.01);
  assert.equal(observed.session!.choice.doses['1'],-18);
  const reopened=new VocalFx(f.xr,f.db,()=>profile);
  assert.equal(reopened.status().session?.conflict,observed.session!.conflict);
  // If the mixer returns to the saved effect, normal tracking can resume.
  await f.xr.applyFx(original);
  assert.equal((await reopened.readDoses()).session?.conflict,undefined);
  await f.xr.applyFx(room);
  const expected=await f.xr.readFx(1);
  const before=writes.map(w=>w.mock.callCount());
  await reopened.readDoses();
  await assert.rejects(reopened.archive(false),/Confirme/);
  assert.ok(reopened.status().session);
  await reopened.archive(true);
  assert.equal(new VocalFx(f.xr,f.db,()=>profile).status().session,null);
  assert.deepEqual(await f.xr.readFx(1),expected);
  assert.equal(await f.xr.readParameter(level),toWire(level,-12));
  assert.deepEqual(writes.map(w=>w.mock.callCount()),before);
  assert.equal(before[0],2);
  assert.equal(before[1],0);
  assert.equal((await reopened.preview(choice)).slot,2);
 }finally{f.close();}
});

test('a resumed Aux input can audition a front-only effect and undo it without touching other mixes',async()=>{
 const f=fixture();
 try{
  const draft:CoachProfile={version:1,completed:[],inputs:[{channel:0,name:'Aux',source:''}],musicians:[]};
  const main='/rtn/1/mix/fader',src='/rtn/aux/mix/07/level';
  await f.xr.writeParameter(main,.48);
  await f.xr.writeParameter('/rtn/2/mix/01/level',.35);
  const initial=f.xr.parameterState(),fxBefore=await f.xr.readFx(1);
  const choice={channel:0,ambience:'short-room',mainDb:-18,doses:{}};
  for(const bad of [{...choice,mainDb:8},{...choice,mainDb:-90},{...choice,channel:3},{...choice,doses:{'2':-18}}])
   await assert.rejects(f.fx.preview(bad,draft));
  const p=await f.fx.preview(choice,draft);
  assert.deepEqual(f.xr.parameterState(),initial);
  assert.equal(p.voice,'Aux');assert.deepEqual(p.monitors,[]);
  await f.fx.apply(p.token,true);
  assert.equal(await f.xr.readParameter(src),toWire(src,0));
  assert.equal(await f.xr.readParameter('/rtn/aux/mix/07/tap'),4);
  assert.equal(await f.xr.readParameter('/rtn/1/mix/lr'),1);
  assert.equal(await f.xr.readParameter(main),toWire(main,-18));
  assert.equal(await f.xr.readParameter('/rtn/2/mix/01/level'),.35);
  assert.equal(f.fx.status().session?.sourceMissing,false);
  await f.fx.keep();
  await f.fx.undo(true,true);
  assert.equal(await f.xr.readParameter(main),.48);assert.equal(await f.xr.readParameter(src),0);
  assert.deepEqual(await f.xr.readFx(1),fxBefore);
 }finally{f.close();}
});

test('front and monitor doses are independent on a small console and unavailable on X32',async()=>{
 for(const model of ['MR12','X32'] as const){
  const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false});
  const db=new LibraryStore(':memory:'),fx=new VocalFx(xr,db,()=>profile);
  try{
   const request={...choice,mainDb:-24};
   if(model==='X32'){
    assert.equal(fx.status().supported,false);
    await assert.rejects(fx.preview(request),/X-Air/);continue;
   }
   const front='/rtn/1/mix/fader',monitor='/rtn/1/mix/01/level';
   const draft=await fx.preview(request);await fx.apply(draft.token,true);await fx.keep();
   assert.equal(await xr.readParameter(front),toWire(front,-24));
   assert.equal(await xr.readParameter(monitor),toWire(monitor,-18));
   const dry=await fx.preview(choice);await fx.apply(dry.token,true);
   assert.equal(await xr.readParameter('/rtn/1/mix/lr'),0);
   await fx.undo(false,true);assert.equal(fx.status().session?.choice.mainDb,-24);
   assert.equal(await xr.readParameter('/rtn/1/mix/lr'),1);
  }finally{xr.close();db.close();}
 }
});

test('layered and independent effects survive a restart, selective undo and a full rack',async()=>{
 const f=fixture();
 const simulated=f.xr.status.bind(f.xr);
 // The transport stays simulated. A real-mode identity exercises the on-disk library format.
 f.xr.status=()=>({...simulated(),mode:'real',connected:true,writesEnabled:true});
 try{
  let rack=new VocalFx(f.xr,f.db,()=>profile);
  const create=async(channel:number,ambience:string,db:number)=>{
   const p=await rack.preview({channel,ambience,doses:{1:db,2:-90},mainDb:db},undefined,null);
   const trial=(await rack.apply(p.token,true)).session!;
   await rack.keep(trial.id);
   return trial;
  };
  const reverb=await create(1,'pop',-18);
  const echo=await create(1,'slap',-24);
  const backing=await create(2,'backing-stage',-12);
  const first=await f.xr.readFx(reverb.slot);
  assert.deepEqual(rack.status().sessions.map(s=>[s.slot,s.choice.channel]),[[1,1],[2,1],[3,2]]);
  const scene=await new (await import('../src/console-control.js')).ConsoleControl(f.xr,f.db).capture();
  assert.deepEqual(scene.fx.slice(0,3).map(fx=>fx.algorithm),[5,10,0]);
  assert.equal(scene.values['/ch/01/mix/08/level'],toWire('/ch/01/mix/08/level',0));
  assert.equal(scene.values['/ch/02/mix/08/level'],0);
  assert.equal(scene.values['/ch/02/mix/09/level'],toWire('/ch/02/mix/09/level',0));

  rack=new VocalFx(f.xr,f.db,()=>profile);
  assert.deepEqual(rack.status().sessions.map(s=>s.id),[reverb.id,echo.id,backing.id]);
  await assert.rejects(rack.undo(true,true),/Sélectionne/);
  await assert.rejects(rack.undo(true,true,'missing'),/Sélectionne/);
  const revised=await rack.preview({...choice,ambience:'rock'},undefined,echo.id);
  assert.equal(revised.slot,2);
  await rack.apply(revised.token,true);await rack.undo(false,true,echo.id);
  assert.equal((await f.xr.readFx(2)).algorithm,10);
  await create(2,'rock',-24);
  await assert.rejects(rack.preview({...choice},undefined,null),/quatre effets/);
  await rack.undo(true,true,echo.id);
  assert.deepEqual(await f.xr.readFx(reverb.slot),first);
  assert.equal(await f.xr.readParameter('/ch/01/mix/08/level'),0);
  assert.deepEqual(rack.status().sessions.map(s=>s.slot),[1,3,4]);
  assert.equal((await rack.preview(choice,undefined,null)).slot,2);
 }finally{f.close();}
});
