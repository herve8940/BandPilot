import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AdjustmentGroups} from '../src/adjustment-groups.js';
import {StudioDatabase} from '../src/database.js';
const input={model:'XR18',name:'Strings',target:'send',bus:2,channels:[3,1]};
test('saved groups survive restart alongside old profiles, retain scope and reject concurrent edits',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bp-groups-')),path=join(dir,'test.db');let store:AdjustmentGroups|undefined;
 try{
  const db=new StudioDatabase(path);const profile=db.saveEarProfile({musician:'Musician A',bus:2,levels:Array(16).fill(.4)});db.close();
  store=new AdjustmentGroups(path);assert.deepEqual(store.list('XR18'),[]);const group=store.save(input);assert.deepEqual(group.channels,[1,3]);assert.equal(group.revision,1);store.close();store=new AdjustmentGroups(path);
  assert.deepEqual(store.list('XR18'),[group]);assert.deepEqual(store.list('MR18'),[]);
  const edited=store.save({...group,name:'Strings stage',channels:[1,3,4]});assert.equal(edited.revision,2);
  assert.throws(()=>store!.save({...group,name:'Old browser'}),/changé ailleurs/);assert.throws(()=>store!.remove(group),/changé ailleurs/);
  assert.throws(()=>store!.save({...edited,model:'MR18'}),/changé ailleurs/);
  const other=store.save({...input,model:'MR18'});store.remove(edited);assert.deepEqual(store.list('XR18'),[]);assert.deepEqual(store.list('MR18'),[other]);
  const reopened=new StudioDatabase(path);assert.deepEqual(reopened.listEarProfiles(),[profile]);reopened.close();
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
test('group definitions respect small models, independent destinations and reject audio values',()=>{
 const store=new AdjustmentGroups(':memory:');try{
  for(const model of ['XR12','MR12']){assert.throws(()=>store.save({...input,model,bus:3}),/absente/);assert.throws(()=>store.save({...input,model,channels:[1,13]}),/entrées/);assert.ok(store.save({...input,model,bus:2}));}
  assert.throws(()=>store.save({...input,model:'X32'}),/X-Air/);assert.throws(()=>store.save({...input,channels:[1,1]}),/entrées/);
  assert.throws(()=>store.save({...input,delta:-2}),/invalide/);assert.throws(()=>store.save({...input,values:{'/ch/01/mix/fader':1}}),/invalide/);
  assert.throws(()=>store.save({...input,name:' '}),/Nomme/);assert.throws(()=>store.save({...input,target:'eq',band:5}),/bande/);
  const foh=store.save({...input,target:'fader',name:'FOH'});assert.equal(foh.bus,undefined);assert.equal(foh.band,undefined);
  const monitor=store.save({...input,name:'Monitor'});assert.equal(monitor.bus,2);assert.equal(foh.target,'fader');
  assert.throws(()=>store.save({...input,name:'monitor'}),/déjà/);
  for(let n=2;n<32;n++)store.save({...input,name:'Group '+n});assert.throws(()=>store.save({...input,name:'Too many'}),/32 groupes/);
 }finally{store.close();}
});
