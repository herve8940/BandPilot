import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {workspaceStore} = createRequire(import.meta.url)('../desktop/workspaces.cjs');

test('desktop mixer views survive a new store instance and keep legacy layouts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bandpilot-views-'));
  try {
    const layouts = {'XR18:wide':{hidden:['ch2'], outputs:false, density:'comfortable', activeBank:'bank-test', banks:[{id:'bank-test', name:'Vocals and monitors', strips:['ch1','bus1','lr']}]}, 'MR12:small':{hidden:[], outputs:true, density:'compact'}};
    assert.equal(workspaceStore(directory).get(), null);
    assert.equal(workspaceStore(directory).set(layouts), true);
    assert.deepEqual(workspaceStore(directory).get(), layouts);
    assert.equal(workspaceStore(directory).set({...layouts, '../../other':layouts['XR18:wide']}), false);
    assert.equal(workspaceStore(directory).set({'XR18:wide':{...layouts['XR18:wide'], audio:{gain:1}}}), false);
    assert.deepEqual(workspaceStore(directory).get(), layouts, 'invalid data must leave the saved views intact');
  } finally { rmSync(directory, {recursive:true, force:true}); }
});

test('peak and MIDI preferences survive restart independently, invalid saves preserve prior settings',()=>{
 const require=createRequire(import.meta.url),{meteringStore}=require('../desktop/metering.cjs'),{controllerMappingsStore}=require('../desktop/controller-mappings.cjs');
 const directory=mkdtempSync(join(tmpdir(),'bandpilot-controls-'));
 try{
  assert.equal(meteringStore(directory).get(),null);assert.equal(meteringStore(directory).set({holdMs:-1}),true);assert.deepEqual(meteringStore(directory).get(),{holdMs:-1});assert.equal(meteringStore(directory).set({holdMs:400}),false);assert.deepEqual(meteringStore(directory).get(),{holdMs:-1});
  const mapping={XR18:[{id:'synthetic',device:'synthetic-port',channel:1,number:7,kind:'cc',target:'/ch/01/mix/fader'}],MR12:[]};assert.equal(controllerMappingsStore(directory).set(mapping),true);assert.deepEqual(controllerMappingsStore(directory).get(),mapping);
  assert.equal(controllerMappingsStore(directory).set({XR18:[{...mapping.XR18[0],channel:17}]}),false);assert.deepEqual(controllerMappingsStore(directory).get(),mapping);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('desktop MIDI storage preserves new encoders, Program Change and feedback alongside old profiles',()=>{
 const {controllerMappingsStore}=createRequire(import.meta.url)('../desktop/controller-mappings.cjs'),directory=mkdtempSync(join(tmpdir(),'bandpilot-midi-v13-'));
 try{const b={id:'test',device:'virtual',kind:'cc',channel:1,number:7,target:'/ch/01/mix/fader',ccMode:'custom',stepDb:.5,increment:24,decrement:27};const map={XR18:[b,{id:'pc',device:'virtual',kind:'program',channel:1,number:3,target:'command:12345678-1234-1234-1234-123456789abc'}],MR12:[{id:'led',device:'virtual',kind:'note',channel:1,number:42,target:'/ch/01/mix/on',feedback:true}]};assert.equal(controllerMappingsStore(directory).set(map),true);assert.deepEqual(controllerMappingsStore(directory).get(),map);assert.equal(controllerMappingsStore(directory).set({XR18:[{...b,decrement:24}]}),false);assert.deepEqual(controllerMappingsStore(directory).get(),map);}finally{rmSync(directory,{recursive:true,force:true});}
});
