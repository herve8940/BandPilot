import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DEFAULT_MIXER, MIXER_MODELS} from '../../shared/mixer-models';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

async function fixture(auth:()=>Promise<unknown>=async()=>({enabled:false,user:{id:'local',name:'Session locale',role:'admin',buses:[]}})) {
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://127.0.0.1:9999/'});
 const originals=new Map<string,PropertyDescriptor|undefined>();
 const install=(k:string,v:unknown)=>{originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});};
 const sockets:Socket[]=[],outbound:any[]=[];
 class Socket {readyState=1;onopen:any;onmessage:any;onclose:any;onerror:any;static OPEN=1;constructor(){sockets.push(this);queueMicrotask(()=>this.onopen?.({}));}send(data:string){outbound.push(JSON.parse(data));}close(){}emit(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}}
 dom.window.HTMLElement.prototype.scrollTo=()=>{};
 dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
 const status={profile:DEFAULT_MIXER,model:'XR18',mode:'real',host:'192.0.2.18',port:10024,connected:true,writesEnabled:false};
 const writes:string[]=[];
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,location:dom.window.location,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,WebSocket:Socket,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:(f:()=>void)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true}))install(k,v);
 install('fetch',async(input:string,options?:RequestInit)=>{
  const path=String(input);if(options?.method&&options.method!=='GET')writes.push(path);
  let data:unknown={};let code=200;
  if(path==='/api/auth')data=await auth();
  else if(path==='/api/status')data=status;
  else if(path==='/api/channels')data=Array.from({length:16},(_,i)=>({channel:i+1,fader:.5,on:true,updatedAt:null}));
  else if(path==='/api/main')data={channel:0,fader:.5,on:true,updatedAt:null};
  else if(path==='/api/workspace')data=null;
  else if(path==='/api/version')data={version:'test'};
  else if(/^\/api\/monitor\/\d+\/profiles$/.test(path))data=[];
  else if(/^\/api\/monitor\/\d+$/.test(path))data={levels:Array(16).fill(0)};
  else if(path==='/api/ears-share')data={running:false,addresses:[],shares:[],port:8018};
  else if(path==='/api/mixer-sync')data={sources:[]};
  else if(['/api/users','/api/library','/api/songs','/api/setlists','/api/rehearsals'].includes(path))data=[];
  else if(path==='/api/reacue')data={armed:false};
  else if(path.includes('/processing'))data={state:{revision:0}};
  else if(path.startsWith('/api/coach')){code=503;data={error:'Coach unused by this test'};}
  return new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json'}});
 });
 const React=await import('react');install('React',React);const {createRoot}=await import('react-dom/client');const root=createRoot(dom.window.document.getElementById('root'));
 const errors:unknown[][]=[];const consoleError=console.error;console.error=(...args)=>errors.push(args);
 const flush=async()=>{await React.act(async()=>{await new Promise(r=>setTimeout(r,0));});};
 return {dom,root,React,errors,writes,sockets,outbound,status,flush,async mount(element:React.ReactNode){await React.act(async()=>root.render(element));await flush();},async close(){await React.act(async()=>root.unmount());console.error=consoleError;dom.window.close();for(const [k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete (globalThis as any)[k];}}};
}

test('startup and repeated mixer snapshots keep one connection panel with the local admin controls',async()=>{
 const f=await fixture();
 try{
  const {default:App}=await import('../src/App');
  await f.mount(<f.React.StrictMode><App/></f.React.StrictMode>);
  for(let i=0;i<15;i++){
   await f.React.act(async()=>{for(const ws of f.sockets)ws.emit({type:'status',status:{...f.status,profile:{...DEFAULT_MIXER}}});});await f.flush();
  }
  const doc=f.dom.window.document;
  assert.equal([...doc.querySelectorAll('h2')].filter((h:any)=>h.textContent==='Connexion à ma console').length,1,'only one panel after repeated state updates');
  assert.equal([...doc.querySelectorAll('button')].filter((b:any)=>b.textContent==='Détecter et connecter ma console').length,1);
  assert.ok(doc.body.textContent.includes('Activer le contrôle'));
  assert.ok(!doc.body.textContent.includes('La connexion à la console est gérée par l’administrateur.'));
  assert.equal(f.errors.filter(args=>String(args[0]).includes('same key')).length,0,'no duplicate React keys');
  assert.ok(!f.writes.includes('/api/connection'),'reading startup state never connects or enables hardware control');
  await f.React.act(async()=>{for(const ws of f.sockets)ws.emit({type:'status',status:{...f.status,model:'MR12',profile:MIXER_MODELS.MR12}});});await f.flush();
  assert.equal([...doc.querySelectorAll('h2')].filter((h:any)=>h.textContent==='Connexion à ma console').length,1,'model changes remount cleanly');
 }finally{await f.close();}
});

test('pending local permissions do not claim the user lacks administrator rights',async()=>{
 let resolve!:(value:unknown)=>void;const reply=new Promise(r=>{resolve=r;});const f=await fixture(()=>reply);
 try{const {ConnectionPanel}=await import('../src/ConnectionPanel');await f.mount(<ConnectionPanel status={f.status}/>);
 assert.match(f.dom.window.document.body.textContent,/Vérification des droits de la session/);
 assert.ok(!f.dom.window.document.body.textContent.includes('gérée par l’administrateur'));
 await f.React.act(async()=>resolve({enabled:false,user:{role:'admin'}}));await f.flush();
 assert.ok(f.dom.window.document.body.textContent.includes('Détecter et connecter ma console'));
 }finally{resolve({enabled:false,user:{role:'admin'}});await f.close();}
});

test('a failed permission request stays closed with a working retry rather than a false role message',async()=>{
 let calls=0;const f=await fixture(async()=>{if(++calls===1)throw Error('Network unavailable');return {enabled:false,user:{role:'admin'}};});
 try{const {ConnectionPanel}=await import('../src/ConnectionPanel');await f.mount(<ConnectionPanel status={f.status}/>);
 const doc=f.dom.window.document;assert.match(doc.body.textContent,/Impossible de vérifier les droits/);
 assert.ok(!doc.body.textContent.includes('Activer le contrôle'));
 const retry=[...doc.querySelectorAll('button')].find((b:any)=>b.textContent==='Réessayer la vérification des droits') as any;
 await f.React.act(async()=>retry.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true})));await f.flush();
 assert.ok(doc.body.textContent.includes('Activer le contrôle'));assert.ok(!f.writes.includes('/api/connection'));
 }finally{await f.close();}
});

test('a genuine guest remains unable to detect or enable mixer control',async()=>{
 const f=await fixture(async()=>({enabled:true,user:{role:'guest'}}));
 try{const {ConnectionPanel}=await import('../src/ConnectionPanel');await f.mount(<ConnectionPanel status={f.status}/>);
 const text=f.dom.window.document.body.textContent;assert.ok(text.includes('gérée par l’administrateur'));assert.ok(!text.includes('Détecter et connecter ma console'));assert.ok(!text.includes('Activer le contrôle'));
 }finally{await f.close();}
});

test('one Returns destination contains mix and phone sharing; Expert has no duplicate Ears tab and reconnect preserves the page',async()=>{
 const f=await fixture();try{
  const {default:App}=await import('../src/App');await f.mount(<App/>);
  const doc=f.dom.window.document;
  const click=async(text:string,selector='button')=>{const b=[...doc.querySelectorAll(selector)].find((e:any)=>e.textContent===text);assert.ok(b,text);await f.React.act(async()=>b.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true})));await f.flush();};
  const sound=doc.querySelector('button[aria-label="Régler le son Coach, console et retours"]');assert.ok(sound);
  await f.React.act(async()=>sound.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true})));await f.flush();
  await click('Retours','.subnav button');
  assert.equal(doc.querySelectorAll('.monitor-desk').length,1);
  assert.ok(!doc.body.textContent.includes('Ouvrir la régie des retours'));
  await click('Téléphones','.bp-section-tabs button');
  assert.equal(doc.querySelectorAll('.monitor-desk').length,0);
  assert.ok([...doc.querySelectorAll('button')].some((e:any)=>e.textContent==='Démarrer le partage'));
  await click('Mix et traitements','.bp-section-tabs button');assert.equal(doc.querySelectorAll('.monitor-desk').length,1);
  localStorage.setItem('xr18-expert-view','ears');
  await click('Console','.subnav button');await click('Expert');
  assert.equal(doc.querySelectorAll('[aria-label="Mode Expert"]').length,1);
  assert.ok(![...doc.querySelectorAll('.xs2-tabs button')].some((e:any)=>e.textContent==='Ears'));
  await f.React.act(async()=>{for(const ws of f.sockets)ws.emit({type:'status',status:{...f.status,connected:false}});});await f.flush();
  await f.React.act(async()=>{for(const ws of f.sockets)ws.emit({type:'status',status:{...f.status,connected:true}});});await f.flush();
  assert.equal(doc.querySelectorAll('[aria-label="Mode Expert"]').length,1,'reconnect must not throw the musician back into settings');
  assert.ok(!f.outbound.some(m=>m.type==='set'),'navigation never sends audio controls');
  assert.ok(!f.writes.includes('/api/ears-share/start'),'sharing does not start on navigation');
 }finally{await f.close();}
});
