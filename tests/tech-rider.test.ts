import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProfile,type CoachProfile} from '../src/sound-coach.js';
import {patchSignature,personalPatch} from '../shared/tech-rider.js';

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
test('phone card contains only the matching musician’s inputs, and rewiring changes the signature',()=>{
 assert.deepEqual(personalPatch(profile,1,'Léa').map(i=>i.channel),[1,2]);
 assert.deepEqual(personalPatch(profile,1,'Sam'),[]);
 assert.deepEqual(personalPatch(profile,2,'Sam').map(i=>i.channel),[3]);
 assert.equal(patchSignature(profile),patchSignature({...profile,inputs:[...profile.inputs].reverse()}));
 assert.notEqual(patchSignature(profile),patchSignature({...profile,musicians:[{...profile.musicians![0]!,bus:4}]}));
});
