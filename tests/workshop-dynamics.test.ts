import test from 'node:test';
import assert from 'node:assert/strict';
import {evidence,type AudioWindow,type Mapping} from '../src/workshop.js';
import {dynamicsAdvice} from '../src/workshop-dynamics-advice.js';
import {envelopePoints,temporalEvidence} from '../shared/workshop-envelope.js';
import {PARAMETERS,defaultWire,toWire} from '../src/parameters.js';
const mapping:Mapping[]=[{index:0,guid:'v',name:'Voix',channel:1,channels:1,family:'voice'}];
const values=()=>Object.fromEntries(Object.entries(PARAMETERS).filter(([a])=>a.startsWith('/ch/01/')).map(([a,p])=>[a,a==='/ch/01/dyn/on'||a.endsWith('/filter/on')?0:defaultWire(p)]));
const windows=(levels:number[]):AudioWindow[]=>levels.map((level,i)=>({start:i,duration:1,rate:48000,samples:48000,clipped:0,peak:10**(level/20),sumSquares:48000*10**((level-3)/10),envelope:{step:.02,peak:Array(50).fill(level),rms:Array(50).fill(Math.max(-120,level-3))}}));
test('20 ms envelopes reject malformed data and do not infer compression from silence alone',()=>{
 assert.throws(()=>envelopePoints([{start:0,duration:1,envelope:{step:.02,peak:[NaN],rms:[0]}}]),/invalide/);
 const e=evidence(1,'Voix',windows([-70,-12,-70,-12]));assert.ok(e.temporal);assert.equal(dynamicsAdvice([e],mapping,values()).filter(a=>a.kind==='dynamics').length,0);
 assert.equal(temporalEvidence(windows([-120,-120])),undefined);
});
test('measured active spread yields bounded instrument compression without makeup or unrelated writes',()=>{
 const e=evidence(1,'Voix',windows([-70,-30,-28,-26,-20,-15,-8,-70]));const a=dynamicsAdvice([e],mapping,values()).find(a=>a.kind==='dynamics');assert.ok(a);
 assert.equal(a.changes['/ch/01/dyn/mgain'],0);assert.equal(a.changes['/ch/01/dyn/auto'],0);assert.ok(Object.keys(a.changes).every(a=>a.startsWith('/ch/01/dyn/')));
 assert.ok(Number(a.changes['/ch/01/dyn/attack'])>=5);assert.ok(Number(a.changes['/ch/01/dyn/release'])>=80);
 const modified=values();modified['/ch/01/dyn/keysrc']=2;assert.deepEqual(dynamicsAdvice([e],mapping,modified).find(a=>a.kind==='dynamics')!.changes,{});
});
test('gate needs verified references, sufficient separation, and only proposes a gentle expander',()=>{
 const e=evidence(1,'Voix',windows([-55,-27,-18,-12])),refs={'1':{quietStart:0,quietStop:.5,softStart:1,softStop:1.5}};
 assert.equal(dynamicsAdvice([e],mapping,values()).some(a=>a.kind==='gate'),false);
 const a=dynamicsAdvice([e],mapping,values(),refs).find(a=>a.kind==='gate')!;assert.equal(a.changes['/ch/01/gate/mode'],1);assert.equal(a.changes['/ch/01/gate/range'],6);assert.ok(Number(a.changes['/ch/01/gate/thr'])< -32);assert.ok(Object.keys(a.changes).every(a=>a.startsWith('/ch/01/gate/')));
 for(const levels of [[-31,-27,-18,-12],[-120,-27,-18,-12]]){const bad=dynamicsAdvice([evidence(1,'Voix',windows(levels))],mapping,values(),refs).find(a=>a.kind==='gate')!;assert.deepEqual(bad.changes,{});assert.ok(bad.unavailableReason);}
 const filtered=values();filtered['/ch/01/gate/filter/on']=1;assert.deepEqual(dynamicsAdvice([e],mapping,filtered,refs).find(a=>a.kind==='gate')!.changes,{});
});
