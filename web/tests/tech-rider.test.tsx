import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import type {Profile} from '../src/CoachSetup';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const initial:Profile={version:1,completed:[],inputs:[{channel:1,name:'Clavier L',source:'keys'},{channel:2,name:'Clavier R',source:'keys'},{channel:3,name:'Chant',source:'lead-rock'}],musicians:[{bus:1,name:'Léa',role:'clavier',channels:[1,2]},{bus:2,name:'Sam',role:'chant',channels:[3]}],tech:{inputs:{1:{connection:'di',stereoWith:2},3:{phantom:true}}}};
async function fixture(editable=true){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),originals=new Map<string,PropertyDescriptor|undefined>();
 const install=(key:string,value:unknown)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))install(k,v);
 const React=await import('react');install('React',React);const {createRoot}=await import('react-dom/client'),{TechRider}=await import('../src/TechRider');
 const root=createRoot(dom.window.document.getElementById('root'));let current=structuredClone(initial),saved:Profile|undefined,fail=false;
 function Harness(){const [profile,setProfile]=React.useState(current);return <TechRider profile={profile} editable={editable} onChange={p=>{current=p;setProfile(p);}} onSave={async p=>{if(fail)throw Error('Échec de sauvegarde');saved=p;}}/>;}
 await React.act(async()=>root.render(<Harness/>));const doc=dom.window.document;
 const click=async(text:string)=>{const b=[...doc.querySelectorAll('button')].find((el:any)=>el.textContent===text);assert.ok(b,text);await React.act(async()=>b.click());};
 const set=async(label:string,value:string,tag='input')=>{
  const wrap=[...doc.querySelectorAll('label')].find((el:any)=>el.querySelector('span')?.textContent===label),el=wrap?.querySelector(tag);assert.ok(el,label);
  await React.act(async()=>{const proto=tag==='select'?dom.window.HTMLSelectElement.prototype:tag==='textarea'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event(tag==='select'?'change':'input',{bubbles:true}));});
 };
 return {dom,doc,React,click,set,get profile(){return current;},get saved(){return saved;},fail(){fail=true;},async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
test('rider edits preserve the group, three 48 V states and keyboard stage placement; saving failures remain visible',async()=>{
 const f=await fixture();try{
  await f.set('Nom du groupe','Les Échos');await f.set('Apporté par le groupe','Console\nBatterie','textarea');
  assert.equal(f.profile.tech?.bandName,'Les Échos');assert.deepEqual(f.profile.inputs,initial.inputs);
  await f.click('Câblage');await f.set('Alimentation 48 V','false','select');assert.equal(f.profile.tech?.inputs?.[1]?.phantom,false);
  await f.set('Alimentation 48 V','','select');assert.equal(f.profile.tech?.inputs?.[1]?.phantom,undefined);assert.equal(f.profile.tech?.inputs?.[1]?.stereoWith,2);
  await f.click('Scène & retours');const card=f.doc.querySelector('[aria-label="Déplacer Léa"]');assert.ok(card);
  await f.React.act(async()=>card.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  assert.equal(f.profile.tech?.positions?.[1]?.x,20.7);
  await f.set('Type de retour','in-ear','select');assert.equal(f.profile.tech?.monitors?.[1]?.kind,'in-ear');
  await f.click('Enregistrer');assert.equal(f.saved?.tech?.bandName,'Les Échos');assert.ok(f.doc.querySelector('[role="status"]'));
  f.fail();await f.click('Enregistrer');assert.equal(f.doc.querySelector('[role="alert"]')?.textContent,'Échec de sauvegarde');
 }finally{await f.close();}
});
test('PDF export uses the current edited document, escapes text and contains both stereo channels without app controls',async()=>{
 const f=await fixture();try{
  let request:any;f.dom.window.bandpilotDocuments={saveTechRiderPDF:async(input:any)=>{request=input;return {saved:true};}};
  await f.set('Nom du groupe','Échos <script>alert(1)</script>');await f.click('Exporter PDF');
  assert.ok(request);assert.match(request.html,/&lt;script&gt;/);assert.doesNotMatch(request.html,/<script>/);
  assert.match(request.html,/Clavier L/);assert.match(request.html,/Clavier R/);assert.match(request.html,/À confirmer/);assert.match(request.html,/Requis/);
  assert.equal((request.html.match(/class="rider-sheet"/g)||[]).length,2);assert.doesNotMatch(request.html,/<button|<input|<textarea/);
  assert.ok(request.filename.endsWith('.pdf'));assert.doesNotMatch(request.filename,/[<>/]/);
  assert.equal(f.doc.querySelector('[role="status"]')?.textContent,'PDF enregistré.');
 }finally{await f.close();}
});
test('read-only rider exposes preview and export while disabling edits and movement',async()=>{
 const f=await fixture(false);try{
  assert.ok(![...f.doc.querySelectorAll('button')].some((b:any)=>b.textContent==='Enregistrer'));
  assert.ok([...f.doc.querySelectorAll('input,textarea')].every((e:any)=>e.disabled));
  await f.click('Scène & retours');assert.equal(f.doc.querySelectorAll('button.rider-stage-person').length,0);
  assert.ok([...f.doc.querySelectorAll('select,input,textarea')].every((e:any)=>e.disabled));
  await f.click('Aperçu PDF');assert.equal(f.doc.querySelectorAll('.rider-patch-table tbody tr').length,3);
 }finally{await f.close();}
});
