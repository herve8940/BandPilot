import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
test('BandStudio recording panel sends explicit commands to the displayed project',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://127.0.0.1:9999/'}),originals=new Map<string,PropertyDescriptor|undefined>();
 const install=(k:string,v:unknown)=>{originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});};
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))install(k,v);
 const state={projectID:'song-a',name:'Répétition',loaded:true,recording:false,playing:false,pending:false,busy:false,position:15,notice:'',capture:{elapsed:0,meters:[],settings:{deviceUID:'usb',channels:[{input:1,name:'Kick'}],mode:'live',latencyMS:0,punchStart:0,punchEnd:0,preRoll:2},devices:[{uid:'usb',name:'XR18 USB',channels:18,rate:48000}]}};
 const sent:any[]=[];install('fetch',async(path:string,options?:RequestInit)=>{if(options?.body)sent.push({path,...JSON.parse(String(options.body))});return new Response(JSON.stringify(state),{status:200});});
 const React=await import('react');install('React',React);const {createRoot}=await import('react-dom/client');const root=createRoot(dom.window.document.getElementById('root'));
 try{
  const {BandStudioRecording}=await import('../src/expert/BandStudioRecording');await React.act(async()=>root.render(<BandStudioRecording/>));await React.act(async()=>{await new Promise(r=>setTimeout(r,10));});
  const click=async(label:string)=>{const b=[...dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent===label) as HTMLButtonElement;assert.ok(b,label);assert.equal(b.disabled,false);await React.act(async()=>b.click());};
  await click('● REC');assert.deepEqual(sent.at(-1),{path:'/api/bandstudio/command',projectID:'song-a',action:'record'});
  await click('■ Arrêter et conserver');assert.equal(sent.at(-1).action,'stop');
  assert.equal(dom.window.document.querySelectorAll('input[type=checkbox]').length,18);
  assert.ok(sent.every(x=>x.path==='/api/bandstudio/command'));
 }finally{await React.act(async()=>root.unmount());dom.window.close();for(const[k,v]of originals){if(v)Object.defineProperty(globalThis,k,v);else delete (globalThis as any)[k];}}
});
