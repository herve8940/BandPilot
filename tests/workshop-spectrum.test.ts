import test from 'node:test';import assert from 'node:assert/strict';
import {spectralEvidence,SPECTRUM_HZ,inferWorkshopFamily,type SpectralWindow} from '../shared/workshop-spectrum.js';
import {spectralAdvice} from '../src/workshop-spectral-advice.js';
import {evidence,type AudioWindow} from '../src/workshop.js';
import {PARAMETERS,toWire,type Value} from '../src/parameters.js';
const bands=(boost=false)=>SPECTRUM_HZ.map(f=>boost&&f>=160&&f<=400?20:1);
const windows=(spectrum:number[]=bands()):AudioWindow[]=>Array.from({length:10},(_,i)=>({start:10+i,duration:1,peak:.5,sumSquares:100,samples:48000,clipped:0,rate:48000,spectrum}));
function params(){const out:Record<string,Value>={};for(const c of [1,2]){const p=`/ch/0${c}`;out[p+'/eq/on']=1;out[p+'/preamp/invert']=0;out[p+'/preamp/hpon']=0;out[p+'/preamp/hpf']=toWire(p+'/preamp/hpf',20);for(let b=1;b<=4;b++){out[`${p}/eq/${b}/g`]=toWire(`${p}/eq/${b}/g`,0);out[`${p}/eq/${b}/f`]=toWire(`${p}/eq/${b}/f`,1000);out[`${p}/eq/${b}/type`]=2;out[`${p}/eq/${b}/q`]=toWire(`${p}/eq/${b}/q`,1);}}return out;}
const mono={index:0,guid:'g',name:'Guitare',channel:1,channels:1};const stereo={...mono,name:'Chœurs',channels:2};
test('spectral evidence ignores silence, separates mono from stereo and does not flag a lone note as broad mud',()=>{
 assert.equal(spectralEvidence(windows(Array(28).fill(0)))!.activeSeconds,0);
 const tone=Array(28).fill(0);tone[9]=1;
 assert.equal(spectralEvidence(windows(tone))!.lowMidSeconds,0);
 assert.equal(spectralAdvice([evidence(1,'Guitare',windows(tone))],[mono],params()).length,0);
 assert.equal(spectralEvidence(windows())!.phase,undefined);
});
test('broad persistent low mids yield a bounded EQ trial, but not on a bass or on a single transient',()=>{
 const report=[evidence(1,'Guitare',windows(bands(true)))];
 const found=spectralAdvice(report,[mono],params()).find(a=>a.id==='mud-1')!;assert.ok(found);assert.equal(found.changes['/ch/01/eq/2/g'],-3);
 assert.ok(Object.keys(found.changes).every(a=>PARAMETERS[a]&&a.includes('/eq/')));
 assert.equal(spectralAdvice(report,[{...mono,family:'bass'}],params()).length,0);
 const transient=windows();transient[0]!.spectrum=bands(true);
 assert.equal(spectralAdvice([evidence(1,'Guitare',transient)],[mono],params()).filter(a=>a.id==='mud-1').length,0);
});
test('existing EQ cuts and disabled non-flat EQs are not overwritten or silently activated',()=>{
 const report=[evidence(1,'Guitare',windows(bands(true)))],p=params();
 p['/ch/01/eq/2/g']=toWire('/ch/01/eq/2/g',-3);p['/ch/01/eq/2/f']=toWire('/ch/01/eq/2/f',250);
 assert.deepEqual(spectralAdvice(report,[mono],p)[0]!.changes,{});
 p['/ch/01/eq/on']=0;assert.match(spectralAdvice(report,[mono],p)[0]!.unavailableReason!,/désactivé/);
});
function phaseWindows(correlation:number|number[]):AudioWindow[]{return windows(SPECTRUM_HZ.map(f=>f/1000)).map((w,i)=>({...w,stereo:{left:100,right:100,cross:100*(Array.isArray(correlation)?correlation[i]!:correlation),frames:48000}}));}
test('mono loss is calibrated: identical 0 dB, unrelated 3 dB, opposite at least 90 dB',()=>{
 assert.equal(spectralEvidence(phaseWindows(1))!.phase!.monoLossDb,0);
 assert.equal(spectralEvidence(phaseWindows(0))!.phase!.monoLossDb,3);
 assert.equal(spectralAdvice([evidence(1,'Chœurs',phaseWindows(0))],[stereo],params()).length,0);
 assert.equal(spectralEvidence(phaseWindows(-1))!.phase!.monoLossDb,90);
});
test('constant opposition permits a right-only polarity trial; variable, compensated and linked pairs do not',()=>{
 const p=params(),negative=[evidence(1,'Chœurs',phaseWindows(-1))];
 const advice=spectralAdvice(negative,[stereo],p)[0]!;assert.deepEqual(advice.changes,{'/ch/02/preamp/invert':1});assert.equal(advice.baseline!['/ch/01/preamp/invert'],0);
 const mixed=[evidence(1,'Chœurs',phaseWindows([1,1,1,1,1,-1,-1,-1,-1,-1]))];
 const variable=spectralAdvice(mixed,[stereo],p)[0]!;assert.deepEqual(variable.changes,{});assert.ok(variable.start>=15);assert.match(variable.hypothesis,/globale/);
 p['/ch/02/preamp/invert']=1;assert.deepEqual(spectralAdvice(negative,[stereo],p)[0]!.changes,{});
 p['/ch/02/preamp/invert']=0;p['/config/chlink/1-2']=1;assert.deepEqual(spectralAdvice(negative,[stereo],p)[0]!.changes,{});
});
test('silent or missing stereo side never produces a polarity proposal',()=>{
 const w=phaseWindows(-1);for(const v of w)v.stereo!.right=0;
 assert.equal(spectralEvidence(w)!.phase,undefined);
 assert.equal(inferWorkshopFamily('Guitare solo'),'guitar');assert.equal(inferWorkshopFamily('Chœurs synthétiques'),'backing');
});
