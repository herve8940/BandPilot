import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {DEFAULT_MIXER} from '../../shared/mixer-models';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(auth:()=>Promise<unknown>=async()=>({enabled:false,user:{id:'local',name:'Session locale',role:'admin',buses:[]}})) {
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://127.0.0.1:9999/'});
 const originals=new Map<string,PropertyDescriptor|undefined>();
 const install=(k:string,v:unknown)=>{originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});};
 const sockets:Socket[]=[];const socketWrites:unknown[]=[];
 class Socket {readyState=1;onopen:any;onmessage:any;onclose:any;onerror:any;static OPEN=1;constructor(){sockets.push(this);queueMicrotask(()=>this.onopen?.({}));}send(data:unknown){socketWrites.push(data);}close(){}emit(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}}
 const status={profile:DEFAULT_MIXER,model:'XR18',mode:'real',host:'192.0.2.18',port:10024,connected:true,writesEnabled:false};
 const writes:string[]=[];
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,location:dom.window.location,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,WebSocket:Socket,requestAnimationFrame:(f:()=>void)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true}))install(k,v);
 install('fetch',async(input:string,options?:RequestInit)=>{
  const path=String(input);if(options?.method&&options.method!=='GET')writes.push(path);
  let data:unknown={};let code=200;
  if(path==='/api/auth')data=await auth();
  else if(path==='/api/status')data=status;
  else if(path==='/api/channels')data=Array.from({length:16},(_,i)=>({channel:i+1,fader:.5,on:true,updatedAt:null}));
  else if(path==='/api/main')data={channel:0,fader:.5,on:true,updatedAt:null};
  else if(path==='/api/workspace')data=null;
  else if(path==='/api/version')data={version:'test'};
  else if(path==='/api/mixer-sync')data={sources:[]};
  else if(['/api/users','/api/library','/api/songs','/api/setlists','/api/rehearsals'].includes(path))data=[];
  else if(path.startsWith('/ears-api/'))data=[];
  else if(path==='/api/reacue')data={armed:false};
  else if(path.includes('/processing'))data={state:{revision:0}};
  else if(path.startsWith('/api/coach')){code=503;data={error:'Coach unused by this test'};}
  return new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json'}});
 });
 const React=await import('react');install('React',React);const {createRoot}=await import('react-dom/client');const root=createRoot(dom.window.document.getElementById('root'));
 const errors:unknown[][]=[];const consoleError=console.error;console.error=(...args)=>errors.push(args);
 const flush=async()=>{await React.act(async()=>{await new Promise(r=>setTimeout(r,0));});};
 return {dom,root,React,errors,writes,sockets,socketWrites,status,flush,async mount(element:React.ReactNode){await React.act(async()=>root.render(element));await flush();},async close(){await React.act(async()=>root.unmount());console.error=consoleError;dom.window.close();for(const [k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete (globalThis as any)[k];}}};
}


test('All five language settings update a live app without changing form drafts or mixer state', async () => {
 const f=await fixture();const i18n=await import('../src/i18n');
 try {
  i18n.setLanguage('fr');const {default:App}=await import('../src/App');await f.mount(<App/>);
  const doc=f.dom.window.document;
  await f.React.act(async()=>f.dom.window.dispatchEvent(new f.dom.window.Event('xr18-open-connection')));await f.flush();
  const ip=doc.querySelector('input[placeholder^="192.168.1.1"]') as HTMLInputElement;
  assert.ok(ip);
  await f.React.act(async()=>{
   Object.getOwnPropertyDescriptor(f.dom.window.HTMLInputElement.prototype,'value')!.set!.call(ip,'192.0.2.77');
   ip.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
  });
  const writesBefore=[...f.writes];
  const select=doc.querySelector('select[aria-label="Langue de l’application"]') as HTMLSelectElement;
  assert.ok(select,'language menu is available in Settings');
  const socketsBefore=[...f.socketWrites];
  for(const lang of ['en','it','es','de'] as const){
   await f.React.act(async()=>{select.value=lang;select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
   assert.equal(doc.documentElement.lang,lang);assert.equal(localStorage.getItem(i18n.LANGUAGE_KEY),lang);
   assert.ok(doc.body.textContent!.includes(i18n.LANGUAGES[lang].options));
   assert.ok(doc.body.textContent!.includes(i18n.translate('Détecter et connecter ma console',lang)));
   assert.ok(!doc.body.textContent!.includes('Connexion à ma console'));
   assert.equal(ip.value,'192.0.2.77','changing language preserves an unsaved form');
   assert.deepEqual(f.writes,writesBefore,'language changes send no API writes');
   assert.deepEqual(f.socketWrites,socketsBefore,'language changes send no WebSocket commands');
   assert.equal(doc.querySelectorAll(`select[aria-label="${i18n.LANGUAGES[lang].ariaLabel}"]`).length,1);
  }
  await f.React.act(async()=>i18n.setLanguage('fr'));
  assert.ok(doc.body.textContent!.includes('Connexion à ma console'));assert.equal(ip.value,'192.0.2.77');
 } finally {await f.React.act(async()=>i18n.setLanguage('fr'));await f.close();}
});

test('desktop language survives origin/port changes, invalid preferences fall back safely', async () => {
 const f=await fixture();const i18n=await import('../src/i18n');
 try {
  localStorage.setItem(i18n.LANGUAGE_KEY,'fr');
  let native='en';(window as any).bandpilotLanguage={get:()=>native,set:(v:string)=>{native=v;return true;}};
  assert.equal(i18n.readLanguage(),'en','native setting wins over this port’s stale browser preference');
  i18n.setLanguage('fr');assert.equal(native,'fr');
  for(const lang of ['fr','en','it','es','de'] as const){localStorage.clear();native=lang;assert.equal(i18n.readLanguage(),lang,'fresh origin reads native preference');i18n.setLanguage(lang);assert.equal(native,lang);assert.equal(i18n.getLocale(),i18n.LANGUAGES[lang].locale);}
  i18n.setLanguage('en');i18n.setLanguage('xx' as any);assert.equal(i18n.getLanguage(),'en');
  delete (window as any).bandpilotLanguage;localStorage.setItem(i18n.LANGUAGE_KEY,'xx');assert.equal(i18n.readLanguage(),'fr');
 } finally {i18n.setLanguage('fr');await f.close();}
});

test('display translation preserves interpolated names, whitespace, types and valid placeholders',async()=>{
 const {translate,tx,setLanguage}=await import('../src/i18n');
 assert.equal(translate('Créer un nouveau lien pour Chant  $& ? L’ancien QR code cessera de fonctionner.','en'),'Create a new link for Chant  $&? The old QR code will stop working.');
 assert.equal(translate('  Lecture seule  ','en'),'  Read-only  ');
 assert.equal(translate('Unknown user text','en'),'Unknown user text');
 assert.equal(translate('toString','en'),'toString');
 setLanguage('en');assert.equal(tx(3),3);const obj={name:'Chant'};assert.equal(tx(obj),obj);setLanguage('fr');
 const catalog=JSON.parse(readFileSync(new URL('../src/i18n/en.json',import.meta.url),'utf8'));
 for(const[source,target]of Object.entries(catalog)){
  assert.equal(typeof target,'string');assert.ok(String(target).trim(),source);
  const sourceSlots=new Set([...source.matchAll(/\{\{(\d+)\}\}/g)].map(m=>m[1]));
  for(const match of String(target).matchAll(/\{\{(\d+)\}\}/g))assert.ok(sourceSlots.has(match[1]),source);
 }
});

test('All five monitor languages keeps musician, channel and saved profile names intact and sends no fader commands',async()=>{
 const f=await fixture();const i18n=await import('../src/i18n');
 try {
  i18n.setLanguage('en');const {EarsApp}=await import('../src/ears/EarsApp');await f.mount(<EarsApp/>);
  await f.React.act(async()=>f.sockets.at(-1)!.emit({type:'snapshot',share:{name:'Chant',bus:1},sources:[{prefix:'/ch/01',label:'Ch 01',meters:[0]}],values:{'/ch/01/config/name':'Réglages','/ch/01/mix/01/level':.5,'/ch/01/mix/on':1,'/bus/1/config/name':'Basse'},cap:.75,control:false}));
  const doc=f.dom.window.document;
  for(const lang of ['fr','en','it','es','de'] as const){
  await f.React.act(async()=>i18n.setLanguage(lang));assert.equal(doc.querySelector('h1')?.textContent,'Chant');
  assert.ok(doc.body.textContent!.includes('Réglages'));assert.ok(doc.body.textContent!.includes('Basse'));
  assert.ok(doc.body.textContent!.includes(i18n.translate('Ce que j’entends',lang)));
  assert.ok([...doc.querySelectorAll('[aria-label]')].some(el=>el.getAttribute('aria-label')===i18n.translate('Niveau de Réglages dans mon retour',lang)));}
  assert.equal(f.writes.length,0);
 } finally {await f.React.act(async()=>i18n.setLanguage('fr'));await f.close();}
});

test('every catalogue covers the same messages and preserves every dynamic placeholder',async()=>{
 const {translate}=await import('../src/i18n');
 const english=JSON.parse(readFileSync(new URL('../src/i18n/en.json',import.meta.url),'utf8'));
 const slots=(value:string)=>[...value.matchAll(/\{\{(\d+)\}\}/g)].map(m=>m[1]).sort();
 // These six legacy templates interpolate French plural suffixes, not user data.
 const frenchSuffixes:Record<string,string[]>={
  '{{0}} niveau{{1}} reçu{{2}}':['1','2'],
  '{{0}} téléphone{{1}}':['1'],
  '{{0}} réglage{{1}} appliqué{{2}}{{3}}{{4}}. Écoute le résultat ; « Annuler le dernier réglage guidé » remet tout comme avant.':['1','2'],
  'Prêt · {{0}} piste{{1}} armée{{2}}':['1','2'],
  '{{0}} niveau{{1}} proche{{2}} de 0 dBFS':['1','2'],
  '{{0}} recommandation{{1}}':['1']
 };
 const labels=new Set<string>();
 for(const lang of ['en','it','es','de'] as const){
  const catalog=JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`,import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(catalog).sort(),Object.keys(english).sort(),lang);
  for(const [source,target] of Object.entries(catalog)){
   assert.equal(typeof target,'string');assert.ok(String(target).trim(),`${lang}: ${source}`);
   assert.deepEqual(slots(String(target)),slots(source).filter(slot=>!frenchSuffixes[source]?.includes(slot)),`${lang}: ${source}`);
   assert.ok(!/QZXARG|__BP\d+__/.test(String(target)),`${lang}: translation marker leaked`);
  }
  labels.add(translate('Lecture seule',lang));
  const name='Chant  $& <Müller>';
  const template='Créer un nouveau lien pour {{0}} ? L’ancien QR code cessera de fonctionner.';
  assert.equal(translate(template.replace('{{0}}',name),lang),catalog[template].replace('{{0}}',name));
  assert.equal(translate('  Lecture seule  ',lang),'  '+catalog['Lecture seule']+'  ');
 }
 assert.equal(labels.size,4,'each language has an independent translation cache');
});
