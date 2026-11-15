import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

test('the administrator sees one notice, can refuse it, and later finds the switch in Settings',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),saved=new Map<string,PropertyDescriptor|undefined>();
 let state={available:true,enabled:true,noticeSeen:false,canEdit:true};const posts:unknown[]=[];
 const fetch=async(_url:string,init?:RequestInit)=>{
  if(init?.method==='POST'){const d=JSON.parse(String(init.body));posts.push(d);state={...state,noticeSeen:true,enabled:d.enabled??state.enabled};}
  return new Response(JSON.stringify(state),{status:200,headers:{'Content-Type':'application/json'}});
 };
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});}
 const React=await import('react');saved.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{value:React,configurable:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const i18n=await import('../src/i18n');i18n.setLanguage('fr');
 const settle=()=>React.act(async()=>{await new Promise(r=>setTimeout(r,0));});
 try{
  const {UsageNotice,UsageSettings}=await import('../src/UsageStats');
  await React.act(async()=>root.render(<UsageNotice/>));await settle();
  const doc=dom.window.document;
  assert.match(doc.body.textContent!,/numéro aléatoire, sa version, la plateforme et le modèle de console/);
  assert.equal(doc.querySelector('.usage-notice a')?.getAttribute('href'),'https://herve8940.github.io/BandPilot/PRIVACY.html');
  const refuse=[...doc.querySelectorAll('button')].find(b=>b.textContent==='Désactiver')!;
  await React.act(async()=>{refuse.click();});await settle();
  assert.deepEqual(posts,[{noticeSeen:true,enabled:false}]);
  assert.equal(doc.querySelector('.usage-notice'),null,'the notice is shown only once');
  await React.act(async()=>root.render(<UsageSettings/>));await settle();
  const box=doc.querySelector('.usage-switch input') as HTMLInputElement;
  assert.equal(box.checked,false);
  await React.act(async()=>{box.click();});await settle();
  assert.deepEqual(posts.at(-1),{noticeSeen:true,enabled:true});
  assert.equal((doc.querySelector('.usage-switch input') as HTMLInputElement).checked,true);
  i18n.setLanguage('en');await settle();
  assert.match(doc.body.textContent!,/Count this installation anonymously/);
 }finally{
  await React.act(async()=>root.unmount());i18n.setLanguage('fr');dom.window.close();
  for(const[k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as Record<string,unknown>)[k];}
 }
});
