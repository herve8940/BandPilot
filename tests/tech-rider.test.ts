import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProfile,SoundCoach,type CoachProfile} from '../src/sound-coach.js';
import {patchSignature,personalPatch,stageCoordinates,stagePosition} from '../shared/tech-rider.js';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const profile:CoachProfile={
 version:1,completed:[],
 inputs:[{channel:1,name:'Keys L',source:'keys'},{channel:2,name:'Keys R',source:'keys'},{channel:3,name:'Chant',source:'lead-rock'}],
 musicians:[{bus:1,name:'Léa',role:'clavier',channels:[1,2]},{bus:2,name:'Sam',role:'chant',channels:[3]}],
 tech:{inputs:{1:{connection:'di',stereoWith:2},3:{connection:'micro',phantom:true}},positions:{1:{row:0,column:1}}},
};
test('technical rider validates adjacent pairs, positions and prunes removed assignments',()=>{
 const valid=validateProfile(profile);
 assert.equal(valid.tech?.inputs?.[1]?.stereoWith,2);
 assert.throws(()=>validateProfile({...profile,tech:{inputs:{1:{stereoWith:2},2:{stereoWith:3}}}}),/stéréo/);
 assert.throws(()=>validateProfile({...profile,tech:{positions:{1:{row:3,column:1}}}}),/Position/);
 const smaller=validateProfile({...profile,inputs:[profile.inputs[0]!],musicians:[]});
 assert.equal(smaller.tech?.inputs?.[1]?.stereoWith,undefined);
 assert.deepEqual(smaller.tech?.positions,{});
});
test('expanded rider survives a database reopen without changing any mixer parameter',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bandpilot-rider-')),file=join(dir,'rider.db');
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});
 let library=new LibraryStore(file);
 try{
  const coach=new SoundCoach(xr,new ConsoleControl(xr,library),library),before=xr.parameterState();
  const detailed:CoachProfile={...profile,tech:{...profile.tech,bandName:'Les Échos',contactName:'Sam',contactEmail:'sam@example.test',eventDate:'2026-12-15',providedEquipment:'Console\nBatterie',requestedEquipment:'Deux DI',notes:'Balance à 16 h',updatedAt:'2026-11-06T10:00:00.000Z',
   inputs:{1:{connection:'di',stereoWith:2,phantom:false,microphone:'DI passive',provider:'band',stand:'none',notes:'Sortie gauche'},2:{connection:'di'},3:{connection:'micro',phantom:true}},
   positions:{1:{row:2,column:1,x:52.5,y:81}},monitors:{1:{kind:'in-ear',mode:'stereo',equipment:'Émetteur du groupe',power:true,notes:'Paire à convenir'}}}};
  coach.saveProfile(detailed);library.close();library=new LibraryStore(file);
  const loaded=new SoundCoach(xr,new ConsoleControl(xr,library),library).profile();
  assert.deepEqual(loaded.tech,JSON.parse(JSON.stringify(validateProfile(detailed).tech)));
  assert.equal(loaded.tech?.inputs?.[1]?.phantom,false);
  assert.equal(loaded.tech?.inputs?.[2]?.phantom,undefined,'unknown 48 V is not silently changed to no');
  assert.deepEqual(xr.parameterState(),before);
  assert.equal(patchSignature(loaded),patchSignature(profile),'document edits do not invalidate the live patch');
 }finally{library.close();xr.close();rmSync(dir,{recursive:true,force:true});}
});
test('rider rejects malformed metadata and prunes removed musicians while retaining old grid positions',()=>{
 for(const tech of [{eventDate:'2026-02-31'},{bandName:'a'.repeat(101)},{inputs:{1:{phantom:'yes'}}},{inputs:{1:{stand:'unknown'}}},{positions:{1:{row:0,column:0,x:NaN,y:20}}},{positions:{1:{row:0,column:0,x:20}}},{monitors:{1:{kind:'invalid'}}},{monitors:[]}]){
  assert.throws(()=>validateProfile({...profile,tech}));
 }
 const old=validateProfile(profile);
 assert.deepEqual(old.tech?.positions?.[1],{row:0,column:1});
 assert.deepEqual(stageCoordinates(old.tech?.positions?.[1],0),{x:50,y:20});
 assert.deepEqual(stagePosition(-100,200),{x:16,y:80,column:0,row:2});
 const pruned=validateProfile({...profile,musicians:[],tech:{...profile.tech,monitors:{1:{kind:'wedge'}}}});
 assert.deepEqual(pruned.tech?.monitors,{});assert.deepEqual(pruned.tech?.positions,{});
});
test('phone card contains only the matching musician’s inputs, and rewiring changes the signature',()=>{
 assert.deepEqual(personalPatch(profile,1,'Léa').map(i=>i.channel),[1,2]);
 assert.deepEqual(personalPatch(profile,1,'Sam'),[]);
 assert.deepEqual(personalPatch(profile,2,'Sam').map(i=>i.channel),[3]);
 assert.equal(patchSignature(profile),patchSignature({...profile,inputs:[...profile.inputs].reverse()}));
 assert.notEqual(patchSignature(profile),patchSignature({...profile,musicians:[{...profile.musicians![0]!,bus:4}]}));
});
