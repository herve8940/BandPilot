import test from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleCommands,commandValues} from '../src/console-commands.js';
import {previewChannelBackup} from '../src/channel-operations.js';
import {fromWire} from '../src/parameters.js';
test('manual macros validate every step and model without accepting raw or sensitive addresses',()=>{
 const data={version:1,model:'MR12',steps:[{channel:1,target:'fader',value:-12},{channel:2,target:'mute',value:1}]};
 assert.deepEqual(commandValues(data).values,{'/ch/01/mix/fader':.475,'/ch/02/mix/on':0});
 for(const steps of [[],[{channel:1,target:'send',bus:3,value:0}],[{channel:13,target:'fader',value:0}],[{channel:1,target:'fader',value:11}],[{channel:1,target:'mute',value:.5}],[{channel:1,target:'/headamp/01/phantom',value:1}],[data.steps[0],data.steps[0]],[{channel:1,target:'eq',band:5,value:0}]])assert.throws(()=>commandValues({...data,steps}));
 assert.throws(()=>commandValues({...data,model:'X32'}));
});
test('saved macros make no changes until confirmed apply, reject stale or mismatched previews and undo mute plus levels',async()=>{
 const xr=new XR18({mode:'simulation',model:'XR18',host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library),commands=new ConsoleCommands(xr,control,library);
 try{
  const before=await control.capture(),one=commands.save({name:'Synthetic command',data:{version:1,model:'XR18',steps:[{channel:1,target:'fader',value:-12},{channel:2,target:'mute',value:1},{channel:3,target:'send',bus:2,value:-5}]}});
  const two=commands.save({name:'Other command',data:{version:1,model:'XR18',steps:[{channel:4,target:'fader',value:-8}]}}),plan=await commands.preview(one.id);
  assert.deepEqual(await control.capture(),before);
  await assert.rejects(commands.apply(two.id,plan.token,()=>{}),/expirée/);
  const result=await commands.apply(one.id,plan.token,()=>{}),after=await control.capture();
  assert.equal(fromWire('/ch/01/mix/fader',after.values['/ch/01/mix/fader']!),-12);assert.equal(after.values['/ch/02/mix/on'],0);
  for(const [a,v]of Object.entries(before.values))if(!['/ch/01/mix/fader','/ch/02/mix/on','/ch/03/mix/02/level'].includes(a))assert.equal(after.values[a],v,a);
  const undo=await previewChannelBackup(xr,control,library,result.backupId);await control.apply(undo.token);assert.deepEqual(await control.capture(),before);
  const stale=await commands.preview(one.id);await xr.writeParameter('/ch/02/mix/on',0);const edited=await control.capture();await assert.rejects(commands.apply(one.id,stale.token,()=>{}),/État modifié/);assert.deepEqual(await control.capture(),edited);
  const deleted=await commands.preview(two.id);commands.remove(two.id);await assert.rejects(commands.apply(two.id,deleted.token,()=>{}));
 }finally{xr.close();library.close();}
});
