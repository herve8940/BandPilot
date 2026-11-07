import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {SoundCoach,SOURCES,consoleName,type CoachProfile} from '../src/sound-coach.js';
import dgram from 'node:dgram';
import {PARAMETERS,defaultWire,type Value} from '../src/parameters.js';
import {encodeOsc,decodeOsc,oscFloat} from '../src/osc.js';

function fixture(){
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false});
 const db=new LibraryStore(':memory:'),control=new ConsoleControl(xr,db),coach=new SoundCoach(xr,control,db);
 return {xr,db,control,coach,close(){xr.close();db.close();}};
}
test('instrument validation retries a lost preflight reply once, then applies exactly once',async()=>{
 const f=fixture();try{
  const plan=await f.control.preview({'/ch/01/config/name':'Basse'}),read=f.xr.readParameter.bind(f.xr),write=f.xr.writeParameter.bind(f.xr);let reads=0,writes=0;
  f.xr.readParameter=async a=>{if(++reads===1)throw Error('Pas de réponse XR18 : '+a);return read(a);};
  f.xr.writeParameter=async(...args)=>{writes++;return write(...args);};
  await f.control.apply(plan.token);assert.equal(reads,2);assert.equal(writes,1);
  await assert.rejects(f.control.apply(plan.token));assert.equal(writes,1);
 }finally{f.close();}
});
test('cancelling or reconnecting during the final preflight never writes to the console',async()=>{
 for(const change of ['cancel','reconnect']){
  const f=fixture();try{
   const plan=await f.control.preview({'/ch/01/config/name':'Basse'}),read=f.xr.readParameter.bind(f.xr);let writes=0;
   f.xr.readParameter=async a=>{const value=await read(a);if(change==='cancel')f.xr.cancelOperations();else f.xr.close();return value;};
   f.xr.writeParameter=async()=>{writes++;return 0;};
   await assert.rejects(f.control.apply(plan.token),/interrompue|Connexion modifiée|connexion modifiée/);assert.equal(writes,0);
  }finally{f.close();}
 }
});
test('a tolerant write retry respects cancellation and never changes another transport',async()=>{
 const f=fixture();try{let writes=0;f.xr.writeParameter=async()=>{writes++;f.xr.cancelOperations();throw Error('Pas de réponse XR18');};
  await assert.rejects(f.xr.applyParameters({'/ch/01/config/name':'Basse'},false,true),/interrompue/);assert.equal(writes,1);
 }finally{f.close();}
});
test('a replaced or removed instrument cannot inherit an earlier gain measurement',async()=>{
 const f=fixture();try{
  const p:CoachProfile={version:1,completed:[],inputs:[{channel:1,source:'kick',name:'Kick'}],calibration:{'1':{peakDb:-6,gainDb:20,at:new Date().toISOString()}}};
  f.coach.saveProfile(p,true);
  f.coach.saveProfile({...p,inputs:[{...p.inputs[0]!,name:'Grosse caisse'.slice(0,12)}]});assert.ok(f.coach.profile().calibration?.['1']);
  f.coach.saveProfile({...p,inputs:[{channel:1,source:'lead-rock',name:'Chant'}]});assert.equal(f.coach.profile().calibration?.['1'],undefined);
  f.coach.saveProfile(p,true);f.coach.saveProfile({...p,inputs:[]});f.coach.saveProfile(p);assert.equal(f.coach.profile().calibration?.['1'],undefined);
 }finally{f.close();}
});
test('unavailable gain readback cannot validate a previous measured gain',async()=>{
 const f=fixture();try{
  f.coach.saveProfile({version:1,completed:[],inputs:[{channel:1,source:'kick',name:'Kick'}],calibration:{'1':{peakDb:-6,gainDb:20,at:new Date().toISOString()}}},true);
  f.xr.readParameter=async()=>{throw Error('Pas de réponse XR18');};
  const status=(await f.coach.calibrationStatus())[0]!;assert.equal(status.valid,false);assert.equal(status.thresholds,null);
 }finally{f.close();}
});
test('a partially failed application retains the backup for the guided undo button',async()=>{
 const f=fixture();try{
  f.coach.saveProfile({version:1,completed:[],inputs:[{channel:1,source:'lead-rock',name:'Chant'}]});const plan=await f.coach.prepare(1);
  const apply=f.xr.applyParameters.bind(f.xr);f.xr.applyParameters=async values=>{const first=Object.entries(values)[0]!;await f.xr.writeParameter(first[0],first[1]);throw Error('Opération interrompue');};
  await assert.rejects(f.coach.apply(plan.token,true),/partielle/);
  f.xr.applyParameters=apply;const undo=await f.coach.undo();assert.ok(undo.token);await f.coach.apply(undo.token,true);
 }finally{f.close();}
});

test('every instrument preset validates over the real UDP transport without changing gain, phantom or volumes',async()=>{
 const peer=dgram.createSocket('udp4');await new Promise<void>(resolve=>peer.bind(0,'127.0.0.1',resolve));
 const values=new Map<string,Value>(),writes:string[]=[];
 peer.on('message',(data,remote)=>{
  const msg=decodeOsc(data),p=PARAMETERS[msg.address];if(!p)return;
  if(msg.args.length){values.set(msg.address,msg.args[0] as Value);writes.push(msg.address);}
  let value=values.get(msg.address)??defaultWire(p);
  if(typeof value==='number'&&/\/(hpf|pan)$/.test(msg.address))value=Math.round(value*100)/100;
  peer.send(encodeOsc(msg.address,[p.type==='f'?oscFloat(Number(value)):value]),remote.port,remote.address);
 });
 const xr=new XR18({mode:'real',host:'127.0.0.1',port:peer.address().port,enableWrites:true,autoSync:false});
 const db=new LibraryStore(':memory:'),coach=new SoundCoach(xr,new ConsoleControl(xr,db),db);
 try{
  await xr.start();for(let n=0;n<100&&!xr.status().connected;n++)await new Promise(r=>setTimeout(r,10));assert.equal(xr.status().connected,true);
  for(const source of SOURCES){
   const before=writes.length;
   coach.saveProfile({version:1,completed:[],inputs:[{channel:1,source:source.id,name:'Éric '+source.name.slice(0,7)}]});
   const plan=await coach.prepare(1);assert.equal(writes.length,before,'preparing '+source.id+' does not write');
   const result=await coach.apply(plan.token,true);assert.deepEqual(result.failed,[],source.id);
   assert.equal(values.get('/ch/01/config/name'),consoleName(coach.profile().inputs[0]!.name));
  }
  assert.ok(writes.length>500);assert.ok(writes.every(a=>!/(headamp|phantom|fader|mix\/on)/.test(a)));
 }finally{xr.close();db.close();peer.close();}
});
