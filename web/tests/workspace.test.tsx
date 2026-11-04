import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MIXER_MODELS} from '../../shared/mixer-models';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),originals=new Map();
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,fetch:async()=>new Response(JSON.stringify({profile:{musicians:[{name:'Hervé',bus:2,channels:[1]}]}}))})){
  originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 }
 const React=await import('react');originals.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{configurable:true,value:React});
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const render=async(el:React.ReactNode)=>{await React.act(async()=>{root.render(el);await new Promise(r=>setTimeout(r,0));});};
 const click=async(label:string)=>{const b=[...dom.window.document.querySelectorAll('button')].find((e:any)=>e.textContent.includes(label));assert.ok(b,label);await React.act(async()=>b!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 return {dom,React,render,click,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
test('personal layouts hide only UI, persist, and remain independent by model and screen',async()=>{
 const f=await fixture();try{
  const {DeskLayoutTools,useDeskLayout}=await import('../src/expert/Workspace');const {INPUTS}=await import('../src/xair/strips');
  function Workspace({model='XR18'}:{model?:string}){return <DeskLayoutTools desk={useDeskLayout(model)} values={{'/ch/01/config/name':'Chant'}} strips={INPUTS.slice(0,2)}/>;}
  await f.render(<Workspace/>);const doc=f.dom.window.document;
  const toggle=async()=>f.React.act(async()=>{const input=doc.querySelector('input[aria-label="Afficher Chant"]') as any;input.click();});
  await toggle();assert.equal((doc.querySelector('input[aria-label="Afficher Chant"]') as any).checked,false);
  await f.render(<Workspace model="XR12"/>);assert.equal((doc.querySelector('input[aria-label="Afficher Chant"]') as any).checked,true);
  await f.render(<Workspace/>);assert.equal((doc.querySelector('input[aria-label="Afficher Chant"]') as any).checked,false);
  await f.React.act(async()=>{Object.defineProperty(f.dom.window,'innerWidth',{value:500,configurable:true});f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));});
  assert.equal((doc.querySelector('input[aria-label="Afficher Chant"]') as any).checked,true);
  assert.match(localStorage.getItem('bandpilot-workspaces-v1')!,/XR18:medium/);
  await f.click('Réinitialiser');assert.equal((doc.querySelector('input[aria-label="Afficher Chant"]') as any).checked,true);
 }finally{await f.close();}
});
test('monitor desk writes only the selected bus sends, EQ and compressor; read-only and small-model limits hold',async()=>{
 const f=await fixture();try{
  const {MonitorDesk}=await import('../src/expert/Workspace'),{MixerModelContext}=await import('../src/MixerModel');
  const writes:[string,unknown][]=[];const values={'/ch/01/config/name':'Basse','/bus/2/mix/fader':.5,'/bus/2/dyn/thr':.5,'/bus/2/eq/1/g':.5};
  const render=(writable:boolean,model=MIXER_MODELS.XR18)=>f.render(<MixerModelContext.Provider value={model}><MonitorDesk values={values} writable={writable} set={(a,v)=>writes.push([a,v])} confirmed={async()=>false} reduction={()=>null}/></MixerModelContext.Provider>);
  await render(true);await f.click('Hervé');
  const key=async(selector:string)=>{const el=f.dom.window.document.querySelector(selector);assert.ok(el,selector);await f.React.act(async()=>el!.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));};
  await key('[role="slider"][aria-label="Basse vers Hervé"]');assert.match(writes.pop()![0],/^\/ch\/01\/mix\/02\/level$/);
  await f.click('Égaliseur du retour');await key('[role="slider"][aria-label="Gain"]');assert.equal(writes.pop()![0],'/bus/2/eq/1/g');
  await f.click('Compression du retour');await key('[role="slider"][aria-label="Threshold"]');assert.equal(writes.pop()![0],'/bus/2/dyn/thr');
  await render(false);writes.length=0;await key('[role="slider"][aria-label="Threshold"]');assert.equal(writes.length,0);
  await render(false,MIXER_MODELS.XR12);assert.equal(f.dom.window.document.querySelectorAll('.monitor-people button').length,2);
  assert.ok(!f.dom.window.document.querySelector('button[aria-pressed="true"]')?.textContent.includes('Bus 6'));
 }finally{await f.close();}
});
test('signal path labels the real pick-off point rather than assuming every send includes EQ',async()=>{
 const f=await fixture();try{const {SignalPath}=await import('../src/expert/Workspace'),{INPUTS,BUSES}=await import('../src/xair/strips');
 await f.render(<SignalPath source={INPUTS[0]!} bus={BUSES[1]!} values={{'/ch/01/preamp/rtnsw':1,'/ch/01/mix/02/tap':1}}/>);
 assert.match(f.dom.window.document.body.textContent,/USB/);assert.match(f.dom.window.document.body.textContent,/Avant EQ/);
 }finally{await f.close();}
});
