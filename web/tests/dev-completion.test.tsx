import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {MIXER_MODELS} from '../../shared/mixer-models';
import {midiSignal,midiPickup,validMidiBindings} from '../src/expert/midi-controls';
import {layoutFile,parseLayoutFile} from '../src/expert/layout-transfer';
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
test('output EQ follows the real mode, edits GEQ only, confirms mode/reset and refuses unread or X32 controls',async()=>{
 const f=await fixture();try{
  const {EqView}=await import('../src/xair/views'),{GEQ_KEYS}=await import('../src/xair/OutputGraphicEq'),{BUSES}=await import('../src/xair/strips'),{MixerModelContext}=await import('../src/MixerModel');
  const writes:any[]=[],plans:any[]=[],values:any={'/bus/1/eq/mode':2,'/bus/1/eq/on':1,...Object.fromEntries(GEQ_KEYS.map(k=>[`/bus/1/geq/${k}`,.5]))};
  const mount=(model=MIXER_MODELS.XR18)=>f.render(<MixerModelContext.Provider value={model}><EqView strip={BUSES[0]!} values={values} set={(a,v)=>writes.push([a,v])} confirmed={async(v)=>{plans.push(v);return true;}} canWrite={true} open={()=>{}}/></MixerModelContext.Provider>);
  await mount();assert.equal(document.querySelectorAll('.output-geq input[type=range]').length,31);assert.equal(document.querySelector('.xm-eq-graph'),null);
  await f.change('.output-geq input[aria-label="Bus 1 · 1000 Hz"]','-6');assert.deepEqual(writes, [['/bus/1/geq/1k',.3]]);
  await f.change('.output-eq-mode select','0');assert.deepEqual(plans.pop(),{'/bus/1/eq/mode':0});
  await f.click('Remettre les 31 bandes à 0 dB');assert.equal(Object.keys(plans[0]).length,31);assert.ok(Object.values(plans[0]).every(v=>v===0));
  delete values['/bus/1/geq/20'];await mount();assert.ok((document.querySelector('.output-geq input') as HTMLInputElement).disabled);
  delete values['/bus/1/eq/mode'];await mount();assert.equal(document.querySelector('.xm-eq-graph'),null);assert.equal(document.querySelector('.output-geq'),null);
  await mount(MIXER_MODELS.X32);assert.equal(document.querySelector('.output-geq'),null);assert.equal(document.querySelector('.output-eq-mode'),null);
 }finally{await f.close();}
});
test('layout transfer keeps ordering and names, refuses cross-model, duplicate and foreign strips',()=>{
 const layout={hidden:['ch2'],outputs:false,density:'comfortable' as const,banks:[{id:'bank-test',name:'Personal view',strips:['bus1','ch1','lr']}],activeBank:'bank-test'},file=layoutFile('XR18','wide',layout),allowed=['ch1','ch2','bus1','lr'];
 assert.deepEqual(parseLayoutFile(JSON.stringify(file),'XR18',allowed).layout,layout);
 assert.throws(()=>parseLayoutFile(JSON.stringify(file),'MR12',allowed));
 assert.throws(()=>parseLayoutFile(JSON.stringify(file),'XR18',['ch1','ch2','lr']));
 assert.throws(()=>parseLayoutFile(JSON.stringify({...file,layout:{...layout,banks:[...layout.banks,...layout.banks]}}),'XR18',allowed));
 assert.throws(()=>parseLayoutFile(JSON.stringify({...file,layout:{...layout,phantom:true}}),'XR18',allowed));
});
test('MIDI parser handles note-off and 14-bit pitch, rejects malformed/sysex, pickup requires crossing and model limits are explicit',()=>{
 assert.equal(midiSignal(new Uint8Array([0x90,12,0]))?.pressed,false);assert.equal(midiSignal(new Uint8Array([0x80,12,127]))?.pressed,false);
 assert.equal(midiSignal(new Uint8Array([0xef,127,127]))?.value,1);assert.equal(midiSignal(new Uint8Array([0xb1,12,64]))?.channel,2);
 assert.equal(midiSignal(new Uint8Array([0xf0,12,64])),null);assert.equal(midiSignal(new Uint8Array([0xb0,128,64])),null);
 assert.equal(midiPickup(undefined,.2,.7),false);assert.equal(midiPickup(.2,.8,.7),true);
 const binding={id:'one',device:'test',kind:'cc',channel:1,number:2,target:'/ch/01/mix/03/level'};
 assert.equal(validMidiBindings([binding],MIXER_MODELS.XR18).length,1);assert.throws(()=>validMidiBindings([binding],MIXER_MODELS.MR12));
 assert.throws(()=>validMidiBindings([{...binding,kind:'pitch',number:0,target:'/ch/01/mix/on'}],MIXER_MODELS.XR18));
 assert.throws(()=>validMidiBindings([{...binding,target:'/headamp/01/phantom'}],MIXER_MODELS.XR18));assert.throws(()=>validMidiBindings([binding,{...binding,id:'two'}],MIXER_MODELS.XR18));
});
test('MIDI learn and saving never write, armed CC uses pickup, notes ignore release, console reset and read-only disarm',async()=>{
 const f=await fixture();try{
  const {MidiControls}=await import('../src/expert/MidiControls');const writes:any[]=[];
  const port:any=new f.dom.window.EventTarget();Object.assign(port,{id:'synthetic',name:'Test controller',state:'connected',open:async()=>port,close:async()=>port});
  const access:any=new f.dom.window.EventTarget();access.inputs=new Map([[port.id,port]]);access.outputs=new Map();Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>access});
  const values={'/ch/01/mix/fader':.75,'/ch/01/mix/on':1};
  const render=(canWrite=true)=>f.render(<MidiControls values={values} canWrite={canWrite} set={(a,v)=>writes.push([a,v])}/>);
  const send=async(bytes:number[])=>f.React.act(async()=>{const event=new f.dom.window.Event('midimessage');Object.defineProperty(event,'data',{value:new Uint8Array(bytes)});port.dispatchEvent(event);await new Promise(r=>setTimeout(r,0));});
  await render();await f.React.act(async()=>{const d=document.querySelector('details')!;d.open=true;d.dispatchEvent(new f.dom.window.Event('toggle'));});
  await f.click('Connecter un périphérique MIDI');await f.change('.midi-controls select','synthetic');
  await f.click('Apprendre la prochaine commande');await send([0xb0,7,10]);assert.equal(writes.length,0);assert.match(localStorage.getItem('bandpilot-midi-mappings-v1')!,/synthetic/);
  await f.click('Activer le contrôle MIDI');await send([0xb0,7,20]);assert.equal(writes.length,0);await send([0xb0,7,100]);assert.equal(writes.length,1);assert.equal(writes[0][0],'/ch/01/mix/fader');
  await f.React.act(async()=>window.dispatchEvent(new f.dom.window.Event('bandpilot-console-reset')));await send([0xb0,7,120]);assert.equal(writes.length,1);
  await f.change('.midi-controls label:nth-of-type(2) select','/ch/01/mix/on');await f.click('Apprendre la prochaine commande');await send([0x90,42,100]);assert.equal(writes.length,1);
  await f.click('Activer le contrôle MIDI');await send([0x90,42,100]);await send([0x90,42,100]);await send([0x90,42,0]);assert.equal(writes.length,2);assert.deepEqual(writes[1],['/ch/01/mix/on',0]);
  await render(false);await send([0x90,42,100]);assert.equal(writes.length,2);
 }finally{await f.close();}
});
test('peak hold expires normally or keeps the maximum, reset clears even held meters',async()=>{
 const f=await fixture();try{
  const {nextPeak,meterPreferences}=await import('../src/xair/meter-preferences');const {Meter,meterStore}=await import('../src/xair/controls');
  assert.deepEqual(nextPeak({value:-3,at:0},-20,2000,1500),{value:-20,at:2000});assert.deepEqual(nextPeak({value:-3,at:0},-20,2000,-1),{value:-3,at:0});
  meterPreferences.set(-1);meterStore.set([-3]);await f.render(<Meter indexes={[0]}/>);await f.React.act(async()=>meterStore.set([-30]));const first=(document.querySelector('.xm-meter-peak') as HTMLElement).style.bottom;
  await f.React.act(async()=>meterPreferences.reset());assert.notEqual((document.querySelector('.xm-meter-peak') as HTMLElement).style.bottom,first);
  await f.React.act(async()=>meterPreferences.set(0));assert.equal(document.querySelector('.xm-meter-peak'),null);await f.React.act(async()=>meterPreferences.set(1500));
 }finally{await f.close();}
});
test('new feature labels are translated in every shipped language',()=>{
 const files=['xair/OutputGraphicEq.tsx','xair/meter-preferences.tsx','expert/LayoutTransfer.tsx','expert/MidiControls.tsx','expert/ConsoleCommands.tsx','expert/CommandActivation.tsx','expert/ResonanceGuide.tsx','LiveGroupFader.tsx','OutputProtectionsPanel.tsx','OutputSceneRecallPanel.tsx'];
 const keys=files.flatMap(file=>[...readFileSync(new URL('../src/'+file,import.meta.url),'utf8').matchAll(/tx\('([^']+)'\)/g)].map(m=>m[1]!));
 for(const lang of ['en','it','es','de']){const catalog=JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`,import.meta.url),'utf8'));for(const key of keys)assert.ok(catalog[key],`${lang}: ${key}`);}
});
