import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleControl} from '../src/console-control.js';
import {SceneRecall} from '../src/scene-recall.js';
import {CommandControl} from '../src/command-control.js';
import {ConsoleCommands} from '../src/console-commands.js';
import {MidiScenes} from '../src/midi-scenes.js';

const first='/ch/01/mix/fader',second='/ch/02/mix/fader';
const destination='/ch/03/mix/fader',protectedDestination='/ch/04/mix/fader';
async function fixture(){
 const xr=new XR18({mode:'simulation',model:'MR12',host:'127.0.0.1',port:10024,enableWrites:false});
 const library=new LibraryStore(':memory:');
 const control=new ConsoleControl(xr,library),recall=new SceneRecall(xr,control,library);
 const scenes=new MidiScenes(xr,library,recall),engine=new CommandControl(xr,control,library,Date.now,scenes);
 await xr.writeParameter(first,.4);await xr.writeParameter(second,.6);
 const scene=library.save('scene','Test scene',await control.capture());
 const cue=scenes.save({name:'Test pedal',model:'MR12',sourceId:scene.id,scope:{
  channels:[1,2],sections:['levels'],mapping:[{source:1,target:3},{source:2,target:4}]
 }});
 const prepare=(ids=[cue.id],mode='midi')=>engine.prepare('admin',{model:'MR12',mode,ids});
 const arm=async()=>engine.arm('admin',(await prepare()).token,()=>{});
 return {xr,library,control,recall,scenes,engine,scene,cue,prepare,arm,close(){xr.close();library.close();}};
}
test('MIDI scene recall reviews all targets, remaps inputs, respects scene protections and saves the state just before firing',async()=>{
 const f=await fixture();
 try{
  f.library.saveProtections({model:'MR12',revision:0,rules:[{channel:4,sections:['levels']}]});
  await f.xr.writeParameter(destination,.4);
  const beforeArm=await f.control.capture();
  const macro=new ConsoleCommands(f.xr,f.control,f.library).save({name:'Synthetic macro',data:{version:1,model:'MR12',steps:[{target:'mute',channel:5,value:1}]}});
  const review=await f.prepare([macro.id,f.cue.id]);
  assert.equal(review.commands.length,1);
  assert.equal(review.scenes[0]!.targets.find(target=>target.address===destination)?.before,review.scenes[0]!.targets.find(target=>target.address===destination)?.after);
  assert.deepEqual(review.scenes[0]!.excluded,[{channel:4,section:'levels'}]);
  assert.deepEqual(await f.control.capture(),beforeArm);
  await assert.rejects(f.engine.arm('other',review.token,()=>{}));
  const session=await f.engine.arm('admin',review.token,()=>{});
  assert.deepEqual(await f.control.capture(),beforeArm);
  await f.xr.writeParameter(destination,.2);
  const beforeFire=await f.control.capture();
  const result=await f.engine.pulse('admin',{token:session.token,id:f.cue.id,sequence:1},()=>{});
  assert.equal(result.results[0]?.written,1);
  assert.deepEqual(await f.control.capture(),{...beforeFire,values:{...beforeFire.values,[destination]:.4}});
  const backup=result.results[0]!.backupId!;
  f.engine.stop('admin',session.token);
  const undo=await f.recall.previewBackup(backup);
  await f.recall.apply(backup,undo.token,true);
  assert.deepEqual(await f.control.capture(),beforeFire);
 }finally{f.close();}
});
test('scene trigger refuses changed protections, topology or deleted scenes without writing',async()=>{
 for(const reason of ['protection','source','deleted'] as const){
  const f=await fixture();
  try{
   const session=await f.arm();
   if(reason==='protection')f.library.saveProtections({model:'MR12',revision:0,rules:[{channel:4,sections:['levels']}]});
   if(reason==='source')await f.xr.writeParameter('/ch/03/config/insrc',5);
   if(reason==='deleted')f.library.delete(f.scene.id);
   const before=await f.control.capture();
   await assert.rejects(f.engine.pulse('admin',{token:session.token,id:f.cue.id,sequence:1},()=>{}));
   assert.deepEqual(await f.control.capture(),before);
   assert.equal(f.library.list('scene-recall-backup').length,0);
  }finally{f.close();}
 }
});
test('MIDI scene setup rejects wrong model, unsafe scope, out-of-range destination and automatic mode',async()=>{
 const f=await fixture();
 try{
  const input={model:'MR12',name:'Invalid cue',sourceId:f.scene.id,scope:{channels:[1],sections:['levels']}};
  assert.throws(()=>f.scenes.save({...input,model:'XR18'}));
  assert.throws(()=>f.scenes.save({...input,scope:{channels:[1],sections:['routing']}}));
  assert.throws(()=>f.scenes.save({...input,scope:{...input.scope,mapping:[{source:1,target:13}]}}));
  assert.throws(()=>f.scenes.save({...input,sourceId:f.cue.id}));
  await assert.rejects(f.prepare([f.cue.id],'automatic'));
  await assert.rejects(f.prepare([f.cue.id],'once'));
 }finally{f.close();}
});
test('stopping during a MIDI scene recall cancels remaining writes and retains the selective backup',async()=>{
 const f=await fixture();
 try{
  await f.xr.writeParameter(destination,.2);await f.xr.writeParameter(protectedDestination,.3);
  const before=await f.control.capture(),session=await f.arm();
  const write=f.xr.writeParameter.bind(f.xr);
  let count=0;
  f.xr.writeParameter=async(...args)=>{
   const result=await write(...args);
   count++;
   f.engine.stop('admin',session.token);
   return result;
  };
  let backup='';
  await assert.rejects(f.engine.pulse('admin',{token:session.token,id:f.cue.id,sequence:1},()=>{}),(error:Error&{backupId?:string})=>{
   backup=error.backupId??'';return !!backup;
  });
  assert.equal(count,1);
  assert.equal(await f.xr.readParameter(protectedDestination),.3);
  f.xr.writeParameter=write;
  const undo=await f.recall.previewBackup(backup);
  await f.recall.apply(backup,undo.token,true);
  assert.deepEqual(await f.control.capture(),before);
 }finally{f.close();}
});
