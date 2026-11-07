import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {VocalFx} from '../src/vocal-fx.js';
import {ConsoleControl} from '../src/console-control.js';
import {SoundCoach,validateProfile,type CoachProfile} from '../src/sound-coach.js';
function fixture(){
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false}),db=new LibraryStore(':memory:');
 let host='192.0.2.18';const original=xr.status.bind(xr);
 // Keep all transport operations in simulation, exercising real-session persistence only.
 xr.status=()=>({...original(),mode:'real',connected:true,writesEnabled:true,host});
 const profile:CoachProfile={version:1,completed:[],inputs:[{channel:1,source:'lead-rock',name:'Chant'}],musicians:[{name:'Voix',bus:1,role:'chant',channels:[1]}]};
 return {xr,db,profile,fx:new VocalFx(xr,db,()=>profile),move(){host='192.0.2.19';},close(){xr.close();db.close();}};
}
test('a kept ambience can follow an IP change only after matching readbacks, without writing audio',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview({channel:1,ambience:'rock',doses:{1:-18}});await f.fx.apply(p.token,true);await f.fx.keep();
  f.move();assert.equal(f.fx.status().session?.sameConsole,false);
  const before=f.xr.parameterState(),effect=await f.xr.readFx(1);
  await assert.rejects(f.fx.reconnect(false),/confirme/);await f.fx.reconnect(true);
  assert.equal(f.fx.status().session?.sameConsole,true);assert.deepEqual(f.xr.parameterState(),before);assert.deepEqual(await f.xr.readFx(1),effect);
  assert.equal(new VocalFx(f.xr,f.db,()=>f.profile).status().session?.sameConsole,true);
 }finally{f.close();}
});
test('a different effect cannot be adopted; an orphan can be archived with no console write',async()=>{
 const f=fixture();try{
  const p=await f.fx.preview({channel:1,ambience:'rock',doses:{1:-18}});await f.fx.apply(p.token,true);await f.fx.keep();f.move();
  const effect=await f.xr.readFx(1);effect.parameters[0]!.value+=.1;await f.xr.applyFx(effect);
  await assert.rejects(f.fx.reconnect(true),/ne correspondent pas/);assert.equal(f.fx.status().session?.sameConsole,false);
  f.profile.inputs=[];assert.equal(f.fx.status().session?.sourceMissing,true);const before=f.xr.parameterState();
  await assert.rejects(f.fx.archive(false),/Confirme/);await f.fx.archive(true);
  assert.equal(f.fx.status().session,null);assert.deepEqual(f.xr.parameterState(),before);assert.deepEqual(await f.xr.readFx(1),effect);
  assert.equal(new VocalFx(f.xr,f.db,()=>f.profile).status().session,null);
 }finally{f.close();}
});
test('twelve-character accented labels survive saving and produce valid console names',()=>{
 const profile:CoachProfile={version:1,completed:[],inputs:[{channel:1,source:'lead-rock',name:'Guitare Éric'}]};
 assert.equal(validateProfile(profile).inputs[0]!.name,'Guitare Éric');
 assert.equal(SoundCoach.channelValues(profile.inputs[0]!)['/ch/01/config/name'],'Guitare Eric');
 assert.throws(()=>validateProfile({...profile,inputs:[{...profile.inputs[0]!,name:'1234567890123'}]}),/12 caractères/);
});
test('preparation retries a lost read once but never validation errors or a changed connection',async()=>{
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false}),db=new LibraryStore(':memory:'),control=new ConsoleControl(xr,db),read=xr.readParameter.bind(xr);let calls=0;
 try{
  const before=xr.parameterState();xr.readParameter=async a=>{if(++calls===1)throw Error('Pas de réponse XR18 : '+a);return read(a);};
  await control.preview({'/ch/01/mix/fader':-18});assert.equal(calls,2);assert.deepEqual(xr.parameterState(),before);
  calls=0;xr.readParameter=async()=>{calls++;throw Error('Paramètre invalide');};await assert.rejects(control.preview({'/ch/01/mix/fader':-18}),/invalide/);assert.equal(calls,1);
  calls=0;xr.readParameter=async()=>{calls++;control.identity=()=> 'changed';throw Error('Pas de réponse XR18');};await assert.rejects(control.preview({'/ch/01/mix/fader':-18}),/Pas de réponse/);assert.equal(calls,1);
 }finally{xr.close();db.close();}
});
