import {test} from 'node:test';
import assert from 'node:assert/strict';
import {XR18} from '../src/xr18.js';
import {ProcessingStore} from '../src/processing.js';
import {LibraryStore} from '../src/library-store.js';
import {ShowControl,validateFx} from '../src/show-control.js';
const setup=()=>{const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});const library=new LibraryStore(':memory:');return {xr,library,show:new ShowControl(xr,new ProcessingStore(),library)};};
test('scene restore includes mute, master, sends, creates backup and rejects reused previews',async()=>{const {xr,library,show}=setup();try{xr.setOn(1,false);xr.setMainFader(.2);xr.setMonitor(2,3,.3);const saved=library.save('scene','Test',show.capture());xr.setOn(1,true);xr.setMainFader(.4);xr.setMonitor(2,3,.6);const p=show.preview(saved.id);await show.apply(saved.id,p.token,true);assert.equal(xr.listChannels()[0]!.on,false);assert.equal(xr.mainState().fader,.2);assert.equal(xr.advancedState()['/ch/03/mix/02/level']!.value,.3);assert.equal(library.list('scene').length,2);await assert.rejects(show.apply(saved.id,p.token,true));}finally{library.close();}});
test('manual change invalidates preview without altering console',async()=>{const {xr,library,show}=setup();try{const saved=library.save('scene','Test',show.capture());const p=show.preview(saved.id);xr.setFader(2,.1);await assert.rejects(show.apply(saved.id,p.token,true),/état modifié/);assert.equal(xr.listChannels()[1]!.fader,.1);}finally{library.close();}});
test('ReaCue requires arm, deduplicates event and manual override disarms',async()=>{const {xr,library,show}=setup();try{xr.setFader(1,.2);const saved=library.save('scene','Song',show.capture());library.save('cue','Refrain',{songId:'song',section:'refrain',targetId:saved.id});const event={eventId:'event-1',songId:'song',section:'refrain'};await assert.rejects(show.event(event),/désarmé/);show.arm(true);xr.setFader(1,.5);await show.event(event);assert.equal(xr.listChannels()[0]!.fader,.2);xr.setFader(1,.6);assert.equal((await show.event(event) as {duplicate:boolean}).duplicate,true);assert.equal(xr.listChannels()[0]!.fader,.6);show.manualOverride();await assert.rejects(show.event({...event,eventId:'event-2'}),/désarmé/);}finally{library.close();}});
test('invalid imported scenes and FX are rejected before changing anything',()=>{const {library,show}=setup();try{const s=show.capture();s.channels[15]!.fader=NaN;assert.throws(()=>show.validateScene(s));assert.throws(()=>validateFx({slot:5,algorithm:0,parameters:[]}));assert.throws(()=>validateFx({slot:1,algorithm:0,parameters:[{type:'f',value:1.1}]}));}finally{library.close();}});
test('FX simulation recalls typed values, hardware is opt-in',async()=>{const {library,show}=setup();try{const saved=library.save('fx','Plate',{slot:1,algorithm:0,parameters:[{type:'f',value:.3}]});const p=show.preview(saved.id);await show.apply(saved.id,p.token,true);assert.equal(show.capture().fx[0]!.parameters[0]!.value,.3);}finally{library.close();}});

test('manual override interrupts complete ReaCue recall and failed events are never replayed',async()=>{
 const {xr,library,show}=setup();try{
  xr.setFader(1,.2);const scene=await show.console.capture();
  for(const a of Object.keys(scene.values))if(a.endsWith('/phantom'))delete scene.values[a];
  const saved=library.save('scene','ReaCue complete',scene);library.save('cue','Chorus',{songId:'song',section:'chorus',targetId:saved.id});
  xr.setFader(1,.6);show.arm(true);const event={eventId:'unique-1',songId:'song',section:'chorus'};
  // Hold the backup read in flight so interruption does not depend on OS timer resolution.
  const capture=show.console.capture.bind(show.console);let captured!:()=>void,resume!:()=>void;
  const started=new Promise<void>(resolve=>{captured=resolve;}),pending=new Promise<void>(resolve=>{resume=resolve;});
  show.console.capture=async()=>{const scene=await capture();captured();await pending;return scene;};
  const recall=show.event(event);await started;show.manualOverride();resume();await assert.rejects(recall,/interrompu/);assert.equal(xr.listChannels()[0]?.fader,.6);
  show.arm(true);assert.equal((await show.event(event) as {duplicate?:boolean}).duplicate,true);assert.equal(xr.listChannels()[0]?.fader,.6);
 }finally{xr.close();library.close();}
});

