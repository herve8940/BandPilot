import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MIXER_MODELS} from '../../shared/mixer-models';
import {midiSignal,midiDelta,relativeMidiLevel,midiFeedback,validMidiBindings} from '../src/expert/midi-controls';
import {dbToFader,faderToDb} from '../src/xairMath';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),saved=new Map();
 for(const [k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,confirm:()=>true,fetch:async()=>new Response('{}')})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});}
 const React=await import('react');saved.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{configurable:true,value:React});const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const render=async(el:React.ReactNode)=>React.act(async()=>{root.render(el);await new Promise(r=>setTimeout(r,0));});
 const click=async(label:string)=>React.act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label)! as HTMLButtonElement;assert.ok(b,label);assert.ok(!b.disabled,label);b.click();await new Promise(r=>setTimeout(r,0));});
 const change=async(selector:string,value:string)=>React.act(async()=>{const el=document.querySelector(selector) as HTMLInputElement;assert.ok(el,selector);Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));await new Promise(r=>setTimeout(r,0));});
 return {React,dom,render,click,change,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
test('relative MIDI formats are explicit, scaled in dB, bounded and retain legacy bindings',()=>{
 const b={id:'encoder',device:'test',kind:'cc' as const,channel:1,number:7,target:'/ch/01/mix/fader'};
 assert.deepEqual(validMidiBindings([b],MIXER_MODELS.XR18),[b]);
 for(const [ccMode,up,down]of [['twos',1,127],['offset',65,63],['signed',1,65]] as const){const relative={...b,ccMode,stepDb:.5};assert.equal(midiDelta(up,relative),1);assert.equal(midiDelta(down,relative),-1);assert.equal(midiDelta(0,relative),0);assert.equal(midiDelta(64,relative),0);assert.ok(Math.abs(faderToDb(relativeMidiLevel(dbToFader(-12),up,relative))+11.5)<.001);}
 const custom={...b,ccMode:'custom' as const,increment:24,decrement:27,stepDb:1};assert.equal(midiDelta(24,custom),1);assert.equal(midiDelta(27,custom),-1);assert.equal(midiDelta(26,custom),0);assert.equal(relativeMidiLevel(1,24,custom),1);assert.equal(relativeMidiLevel(0,27,custom),0);assert.ok(relativeMidiLevel(0,24,custom)>0);
 for(const invalid of [{...b,ccMode:'guess'},{...b,ccMode:'signed',target:'/ch/01/mix/on'},{...custom,decrement:24},{...custom,stepDb:100},{...b,kind:'program'}])assert.throws(()=>validMidiBindings([invalid],MIXER_MODELS.XR18));
});
test('Program Change parses two-byte packets only and targets explicit commands; mute LED feedback is standard and opt-in',()=>{
 assert.deepEqual(midiSignal(new Uint8Array([0xcf,5])),{kind:'program',channel:16,number:5,value:1,pressed:true,raw:5});
 for(const bytes of [[0xc0,5,1],[0xc0,128],[0xc0],[0xf0,1],[0xd0,1]])assert.equal(midiSignal(new Uint8Array(bytes)),null);
 const b={id:'pc',device:'test',kind:'program' as const,channel:2,number:12,target:'command:12345678-1234-1234-1234-123456789abc'};
 assert.equal(validMidiBindings([b],MIXER_MODELS.MR12).length,1);assert.throws(()=>validMidiBindings([{...b,target:'/ch/01/mix/on'}],MIXER_MODELS.XR18));
 const led={id:'led',device:'test',kind:'note' as const,channel:2,number:24,target:'/ch/01/mix/on',feedback:true};assert.deepEqual(midiFeedback(led,0),[0x91,24,127]);assert.deepEqual(midiFeedback(led,1),[0x91,24,0]);assert.equal(midiFeedback({...led,feedback:false},0),null);assert.equal(midiFeedback(led,undefined),null);assert.equal(midiFeedback({...led,target:'/ch/01/mix/fader'},0),null);
});
test('relative encoder learns without writes, accumulates fast gestures and LED feedback neither loops nor survives disarm',async()=>{
 const f=await fixture();try{
  const {MidiControls}=await import('../src/expert/MidiControls');const writes:any[]=[],outgoing:any[]=[];
  const input:any=new f.dom.window.EventTarget();Object.assign(input,{id:'knobs',name:'Synthetic knobs',state:'connected',open:async()=>input,close:async()=>input});
  const output:any={id:'leds',name:'Synthetic LEDs',state:'connected',send:(bytes:number[])=>outgoing.push(bytes)};
  const access:any=new f.dom.window.EventTarget();access.inputs=new Map([[input.id,input]]);access.outputs=new Map([[output.id,output]]);Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>access});
  const values={'/ch/01/mix/fader':dbToFader(-12),'/ch/01/mix/on':1};
  const send=async(bytes:number[])=>f.React.act(async()=>{const e=new f.dom.window.Event('midimessage');Object.defineProperty(e,'data',{value:new Uint8Array(bytes)});input.dispatchEvent(e);await new Promise(r=>setTimeout(r,0));});
  const render=()=>f.render(<MidiControls values={{...values}} set={(a,v)=>writes.push([a,v])} canWrite={true} openInitially/>);
  await render();await f.click('Connecter un périphérique MIDI');await f.change('.midi-controls>label:nth-of-type(1) select','knobs');await f.change('.midi-controls>label:nth-of-type(3) select','twos');await f.click('Apprendre la prochaine commande');await send([0xb0,7,1]);assert.equal(writes.length,0);
  await f.click('Activer le contrôle MIDI');await send([0xb0,7,1]);await send([0xb0,7,1]);assert.ok(Math.abs(faderToDb(writes[1][1])+11)<.001);
  await f.click('Désactiver le contrôle MIDI');await f.change('.midi-controls>label:nth-of-type(2) select','/ch/01/mix/on');await f.change('.midi-controls>label:nth-of-type(3) select','absolute');await f.click('Apprendre la prochaine commande');await send([0x90,42,127]);assert.equal(writes.length,2);
  await f.React.act(async()=>{(document.querySelector('.midi-bindings input') as HTMLInputElement).click();});await f.change('.midi-output select','leds');await f.React.act(async()=>{(document.querySelector('.midi-output input') as HTMLInputElement).click();});assert.equal(outgoing.length,0);
  await f.click('Activer le contrôle MIDI');assert.deepEqual(outgoing,[[0x90,42,0]]);
  await send([0x90,42,0]);assert.equal(writes.length,2);await send([0x90,42,127]);assert.equal(writes.length,3);
  values['/ch/01/mix/on']=0;await render();assert.deepEqual(outgoing.at(-1),[0x90,42,127]);await send([0x90,42,127]);assert.equal(writes.length,3,'looped LED output is ignored');
  await f.click('Désactiver le contrôle MIDI');const sent=outgoing.length;values['/ch/01/mix/on']=1;await render();assert.equal(outgoing.length,sent);
 }finally{await f.close();}
});
test('MIDI command learning has no audio and requires review before Program Change can fire; hiding stops the session',async()=>{
 const f=await fixture();try{
  const {MidiControls}=await import('../src/expert/MidiControls');const id='12345678-1234-1234-1234-123456789abc',requests:any[]=[];
  const entry={id,kind:'console-command',name:'Synthetic mute',data:{version:1,model:'XR18',steps:[{channel:3,target:'mute',value:1}]}};
  Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:async(path:string,opts:any)=>{const d=opts?.body?JSON.parse(opts.body):undefined;requests.push([path,d]);return new Response(JSON.stringify(path.endsWith('/commands')?[entry]:path.endsWith('/prepare')?{token:'preview',mode:'midi',commands:[{...entry,changes:[{address:'/ch/03/mix/on',before:1,after:0}]}]}:path.endsWith('/arm')?{token:'session',sequence:0}:path.endsWith('/pulse')?{active:true,sequence:d.sequence??0,pending:[],results:d.id?[{id,backupId:'backup',written:1}]:[]}:{}));}});
  const input:any=new f.dom.window.EventTarget();Object.assign(input,{id:'pedal',name:'Synthetic pedal',state:'connected',open:async()=>input,close:async()=>input});const access:any=new f.dom.window.EventTarget();access.inputs=new Map([[input.id,input]]);access.outputs=new Map();Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>access});
  const send=async(bytes:number[])=>f.React.act(async()=>{const e=new f.dom.window.Event('midimessage');Object.defineProperty(e,'data',{value:new Uint8Array(bytes)});input.dispatchEvent(e);await new Promise(r=>setTimeout(r,10));});
  await f.render(<MidiControls values={{}} set={()=>assert.fail('No direct audio writes for command MIDI')} canWrite={true} openInitially/>);await f.click('Connecter un périphérique MIDI');await f.change('.midi-controls>label:nth-of-type(1) select','pedal');await f.change('.midi-controls>label:nth-of-type(2) select','command:'+id);await f.click('Apprendre la prochaine commande');await send([0xc0,4]);assert.equal(requests.filter(r=>r[0].endsWith('/arm')||r[0].endsWith('/pulse')).length,0);
  await f.click('Activer le contrôle MIDI');assert.ok(document.querySelector('.command-activation'));await send([0xc0,4]);assert.equal(requests.filter(r=>r[0].endsWith('/pulse')).length,0);
  await f.click('Confirmer l’activation');await send([0xc0,4]);await send([0xc0,4]);assert.equal(requests.filter(r=>r[0].endsWith('/pulse')&&r[1].id).length,1);
  await f.React.act(async()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new f.dom.window.Event('visibilitychange'));});assert.ok(requests.some(r=>r[0].endsWith('/stop')));await send([0xc0,5]);assert.equal(requests.filter(r=>r[0].endsWith('/pulse')&&r[1].id).length,1);
 }finally{await f.close();}
});
