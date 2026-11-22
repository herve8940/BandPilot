import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MIXER_MODELS} from '../../shared/mixer-models';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),originals=new Map();
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,fetch:async()=>new Response(JSON.stringify({profile:{musicians:[{name:'Hervé',bus:2,channels:[1]}]}}))})){
  originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 }
 const React=await import('react');originals.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{configurable:true,value:React});
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const render=async(el:React.ReactNode)=>{await React.act(async()=>{root.render(el);await new Promise(r=>setTimeout(r,0));});};
 const click=async(label:string)=>{const b=[...dom.window.document.querySelectorAll('button')].find((e:any)=>e.textContent.includes(label));assert.ok(b,label);await React.act(async()=>b!.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 return {dom,React,render,click,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
test('display changes require saving and stay independent by model and screen',async()=>{
 const f=await fixture();try{
  const {DeskLayoutTools,useDeskLayout}=await import('../src/expert/Workspace');const {INPUTS}=await import('../src/xair/strips');
  function Workspace({model='XR18'}:{model?:string}){return <DeskLayoutTools desk={useDeskLayout(model)} values={{'/ch/01/config/name':'Chant'}} strips={INPUTS.slice(0,2)}/>;}
  await f.render(<Workspace/>);const doc=f.dom.window.document;
  const open=async()=>{await f.click('Personnaliser');await f.click('Affichage');};
  const hidden=()=>!(doc.querySelector('input[aria-label="Afficher Chant"]') as HTMLInputElement).checked;
  await open();await f.React.act(async()=>{(doc.querySelector('input[aria-label="Afficher Chant"]') as HTMLInputElement).click();});
  assert.equal(hidden(),true);assert.equal(localStorage.getItem('bandpilot-workspaces-v1'),null);
  await f.click('Enregistrer l’affichage');
  await f.render(<Workspace model="XR12"/>);await open();assert.equal(hidden(),false);await f.click('Annuler');
  await f.render(<Workspace/>);await open();assert.equal(hidden(),true);await f.click('Annuler');
  await f.React.act(async()=>{Object.defineProperty(f.dom.window,'innerWidth',{value:500,configurable:true});f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));});
  await open();assert.equal(hidden(),false);await f.click('Annuler');
  assert.match(localStorage.getItem('bandpilot-workspaces-v1')!,/XR18:medium/);
 }finally{await f.close();}
});
test('monitor desk writes only the selected bus sends, EQ and compressor; read-only and small-model limits hold',async()=>{
 const f=await fixture();try{
  const {MonitorDesk}=await import('../src/expert/Workspace'),{MixerModelContext}=await import('../src/MixerModel');
  const writes:[string,unknown][]=[];const values={'/ch/01/config/name':'Basse','/bus/2/mix/fader':.5,'/bus/2/dyn/thr':.5,'/bus/2/eq/1/g':.5,'/bus/2/eq/mode':0};
  const render=(writable:boolean,model=MIXER_MODELS.XR18)=>f.render(<MixerModelContext.Provider value={model}><MonitorDesk values={values} writable={writable} set={(a,v)=>writes.push([a,v])} confirmed={async()=>false}/></MixerModelContext.Provider>);
  await render(true);await f.click('Hervé');
  const key=async(selector:string)=>{const el=f.dom.window.document.querySelector(selector);assert.ok(el,selector);await f.React.act(async()=>el!.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));};
  await key('[role="slider"][aria-label="Basse vers Hervé"]');assert.match(writes.pop()![0],/^\/ch\/01\/mix\/02\/level$/);
  await f.click('Égaliseur du retour');await key('[role="slider"][aria-label="Gain"]');assert.equal(writes.pop()![0],'/bus/2/eq/1/g');
  await f.click('Compression du retour');await key('[role="slider"][aria-label="Seuil"]');assert.equal(writes.pop()![0],'/bus/2/dyn/thr');
  await render(false);writes.length=0;await key('[role="slider"][aria-label="Seuil"]');assert.equal(writes.length,0);
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

test('custom view editing previews ordered mixed strips, cancels safely, and preserves old settings',async()=>{
 const f=await fixture();try{
  const {DeskLayoutTools,useDeskLayout}=await import('../src/expert/Workspace'),{ALL,INPUTS}=await import('../src/xair/strips');
  const old={hidden:['ch2'],outputs:false,density:'comfortable'};localStorage.setItem('bandpilot-workspaces-v1',JSON.stringify({'XR18:medium':{...old,banks:[{id:'bank-test',name:'My band',strips:['ch1','bus1','dca1','lr']}],activeBank:'bank-test'}}));
  function Desk({model='XR18'}:{model?:string}){return <DeskLayoutTools strips={INPUTS} allStrips={ALL} values={{}} desk={useDeskLayout(model)}/>;}
  const order=()=>JSON.parse(localStorage.getItem('bandpilot-workspaces-v1')!)['XR18:medium'].banks[0].strips;
  await f.render(<Desk/>);await f.click('Personnaliser');
  const move=async()=>f.React.act(async()=>{(f.dom.window.document.querySelector('[aria-label="Monter la tranche Bus 1"]') as HTMLButtonElement).click();});
  await move();assert.deepEqual(order(),['ch1','bus1','dca1','lr']);await f.click('Annuler');
  await f.click('Personnaliser');assert.equal(f.dom.window.document.querySelector('.desk-selected-list li')?.getAttribute('data-strip-id'),'ch1');
  await move();await f.click('Enregistrer la vue');
  const layout=JSON.parse(localStorage.getItem('bandpilot-workspaces-v1')!)['XR18:medium'];assert.deepEqual(layout.banks[0].strips,['bus1','ch1','dca1','lr']);assert.equal(layout.outputs,false);assert.deepEqual(layout.hidden,['ch2']);
  await f.click('Personnaliser');await f.click('Affichage');await f.click('Réinitialiser');await f.click('Enregistrer l’affichage');
  assert.deepEqual(order(),['bus1','ch1','dca1','lr'],'reset display must keep custom views');
  await f.render(<Desk model="MR12"/>);await f.click('Personnaliser');assert.equal(f.dom.window.document.querySelector('.desk-selected-list'),null);await f.click('Annuler');
  await f.render(<Desk/>);await f.click('Personnaliser');assert.equal(f.dom.window.document.querySelectorAll('.desk-selected-list li').length,4);
 }finally{await f.close();}
});
test('desktop bridge migrates old preferences and restores a custom view with empty browser storage',async()=>{
 const f=await fixture();try{
  const {DeskLayoutTools,useDeskLayout}=await import('../src/expert/Workspace'),{ALL,INPUTS}=await import('../src/xair/strips');
  localStorage.setItem('bandpilot-workspaces-v1',JSON.stringify({'XR18:medium':{hidden:['ch2'],outputs:false,density:'comfortable'}}));
  let saved:any=null;
  (f.dom.window as any).bandpilotWorkspaces={get:()=>saved,set:(value:unknown)=>{saved=JSON.parse(JSON.stringify(value));return true;}};
  function Desk(){return <DeskLayoutTools strips={INPUTS} allStrips={ALL} values={{}} desk={useDeskLayout('XR18')}/>;}
  await f.render(<Desk/>);assert.deepEqual(saved['XR18:medium'].hidden,['ch2']);
  await f.click('Personnaliser');
  await f.React.act(async()=>{(f.dom.window.document.querySelector('.desk-strip-choice[data-strip-id="ch1"]') as HTMLButtonElement).click();});
  await f.click('Bus / Main');await f.React.act(async()=>{(f.dom.window.document.querySelector('.desk-strip-choice[data-strip-id="lr"]') as HTMLButtonElement).click();});
  await f.click('Enregistrer la vue');assert.deepEqual(saved['XR18:medium'].banks[0].strips,['ch1','lr']);
  await f.render(null);localStorage.clear();await f.render(<Desk/>);await f.click('Personnaliser');
  assert.deepEqual([...f.dom.window.document.querySelectorAll('.desk-selected-list li')].map(x=>x.getAttribute('data-strip-id')),['ch1','lr']);
  assert.equal(saved['XR18:medium'].density,'comfortable');
 }finally{await f.close();}
});
