import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),saved=new Map();
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:(fn:any)=>setTimeout(fn,0),fetch:async(path:string)=>new Response(JSON.stringify(path==='/api/auth'?{user:{role:'admin'}}:{version:'2.3.2',build:'fixture'}))})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 const React=await import('react');saved.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{value:React,configurable:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const mount=async(node:any)=>React.act(async()=>{root.render(node);await new Promise(r=>setTimeout(r,0));});
 const click=async(text:string)=>{const button=[...dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent.trim()===text) as HTMLButtonElement;assert.ok(button,text);await React.act(async()=>{button.click();await new Promise(r=>setTimeout(r,0));});};
 return {dom,React,root,mount,click,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
test('adding and choosing an input stays local; failed saving never advances the coach',async()=>{
 const f=await fixture();try{
  const {InputsStep}=await import('../src/CoachSetup');let current:any={version:1,completed:[],inputs:[]},applied=0,advanced=0,saveSucceeds=false;
  const data:any={sources:[{id:'lead-rock',name:'Chant',label:'Chant',group:'Voix',family:'voice',color:1},{id:'keys',name:'Clavier',label:'Clavier',group:'Claviers',family:'keys',color:2}],presets:{},templates:[],drumKit:[]};
  function Harness(){const [profile,set]=f.React.useState(current);return <InputsStep data={data} profile={profile} setProfile={p=>{current=p;set(p);}} admin busy={false} canApply onApplyChannel={()=>applied++} onApplyAll={()=>applied++} onSave={async()=>saveSucceeds} notify={()=>{}} onNext={()=>advanced++} onBlank={()=>{}}/>;}
  await f.mount(<Harness/>);await f.click('Ajouter un instrument');assert.equal(current.inputs.length,1);
  const select=[...f.dom.window.document.querySelectorAll('select')].find((s:any)=>s.value==='lead-rock') as HTMLSelectElement;
  await f.React.act(async()=>{select.value='keys';select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(current.inputs[0].source,'keys');assert.equal(applied,0);
  await f.click('Étape suivante : régler les gains →');assert.equal(advanced,0);
  saveSucceeds=true;await f.click('Étape suivante : régler les gains →');assert.equal(advanced,1);assert.equal(applied,0);
 }finally{await f.close();}
});
test('support checks updates on startup, previews the report and sends only after review',async()=>{
 const f=await fixture();try{
  const calls:string[]=[];f.dom.window.bandpilotSupport={status:async()=>({configured:true}),checkUpdate:async()=>{calls.push('check');return {available:true,version:'2.3.3'};},prepare:async()=>{calls.push('prepare');return {id:'id',content:'{"schema":1}'};},send:async()=>{calls.push('send');return {url:'https://github.com/herve8940/BandPilot/issues/42'};},export:async()=>({saved:true}),browser:async()=>({copied:true}),openUpdate:async()=>({opened:true})};
  const {SupportCenter}=await import('../src/SupportCenter');await f.mount(<SupportCenter/>);assert.deepEqual(calls,['check']);assert.match(f.dom.window.document.body.textContent,/2.3.3/);
  await f.click('Signaler un problème');const input=f.dom.window.document.querySelector('input');
  await f.React.act(async()=>{Object.getOwnPropertyDescriptor(f.dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'Erreur ajout');input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));});
  await f.click('Préparer le rapport');assert.deepEqual(calls,['check','prepare']);
  await f.click('Créer l’issue sur GitHub');assert.ok(!calls.includes('send'));
  await f.React.act(async()=>f.dom.window.document.querySelector('input[type=checkbox]').click());
  await f.click('Créer l’issue sur GitHub');assert.deepEqual(calls,['check','prepare','send']);assert.ok(f.dom.window.document.querySelector('a[href$="/issues/42"]'));
 }finally{await f.close();}
});
test('ambience recovery remains accessible when a foreign or missing source disables the usual controls',async()=>{
 const f=await fixture();try{
  const calls:string[]=[];let session:any={slot:1,phase:'kept',choice:{channel:5,ambience:'rock',doses:{1:-18}},sameConsole:false,sourceMissing:true,savedHost:'192.0.2.1',currentHost:'192.0.2.2'};
  globalThis.fetch=async(path:any,init:any)=>{if(init?.method==='POST'){calls.push(path);if(path.endsWith('/archive'))session=null;}return new Response(JSON.stringify({supported:true,voices:[{channel:4,name:'Micro 1',source:'lead-rock'}],monitors:[{bus:1,name:'Voix'}],session}));};
  const original=globalThis.confirm;globalThis.confirm=()=>true;
  try{const {VocalAmbience}=await import('../src/VocalAmbience');await f.mount(<VocalAmbience canApply simulation={false}/>);
   assert.equal(f.dom.window.document.querySelector('fieldset').disabled,true);assert.equal(f.dom.window.document.querySelector('[aria-label="Source à traiter"]').value,'4');
   await f.click('Archiver cet ancien suivi');assert.deepEqual(calls,['/api/coach/vocal-fx/archive']);assert.equal(f.dom.window.document.querySelector('fieldset').disabled,false);
  }finally{if(original)globalThis.confirm=original;else delete(globalThis as any).confirm;}
 }finally{await f.close();}
});
