import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DEFAULT_MIXER, MIXER_MODELS} from '../../shared/mixer-models';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

async function fixture(auth:()=>Promise<unknown>=async()=>({enabled:false,user:{id:'local',name:'Session locale',role:'admin',buses:[]}}),
 workspace:(options?:RequestInit)=>Promise<unknown>=async()=>null) {
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
  else if(path==='/api/workspace')data=await workspace(options);
  else if(path==='/api/version')data={version:'test'};
  else if(/^\/api\/monitor\/\d+\/profiles$/.test(path))data=[];
  else if(/^\/api\/monitor\/\d+$/.test(path))data={levels:Array(16).fill(0)};
  else if(path==='/api/ears-share')data={running:false,addresses:[],shares:[],port:8018};
  else if(path==='/api/mixer-sync')data={sources:[]};
  else if(path.startsWith('/api/expert-surfaces?'))data={model:'XR18',revision:0,surfaces:[]};
  else if(['/api/users','/api/library','/api/songs','/api/setlists','/api/rehearsals'].includes(path))data=[];
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
  assert.equal(f.dom.window.document.querySelector('[data-page]')?.getAttribute('data-page'),'coach');
  await f.React.act(async()=>f.dom.window.document.querySelector('.regie-device')!.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true})));await f.flush();
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

test('workspace autosave keeps the final edit in order when an earlier save is slow',async()=>{
 const writes:string[]=[];
 let finish:(()=>void)|undefined;
 const f=await fixture(undefined,async options=>{
  if(options?.method!=='PUT')return {notes:'Archived draft',setlist:[]};
  writes.push(JSON.parse(String(options.body)).notes);
  if(writes.length===1)await new Promise<void>(resolve=>{finish=resolve;});
  return {};
 });
 try{
  const {default:App}=await import('../src/App');
  await f.mount(<App/>);
  const doc=f.dom.window.document;
  await f.React.act(async()=>doc.querySelector('button[data-workspace=prep]').click());
  await f.React.act(async()=>[...doc.querySelectorAll('.subnav button')].find(b=>b.textContent==='Notes de répète')!.click());
  const note=doc.querySelector('textarea')!;
  assert.equal(note.value,'Archived draft');
  assert.deepEqual(writes,[],'opening the saved draft is read-only');
  for(const value of ['first','second','final']){
   await f.React.act(async()=>{
    Object.getOwnPropertyDescriptor(f.dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(note,value);
    note.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
   });
  }
  assert.deepEqual(writes,['first']);
  await f.React.act(async()=>finish!());
  await f.flush();
  assert.deepEqual(writes,['first','final']);
  assert.equal(note.value,'final');
 }finally{finish?.();await f.close();}
});

test('live meter and EQ frames do not redraw the repertoire or send mixer commands',async()=>{
 const f=await fixture();
 try{
  const {default:App}=await import('../src/App');
  let commits=0;
  await f.mount(<f.React.Profiler id="workspace" onRender={()=>commits++}><App/></f.React.Profiler>);
  const prep=f.dom.window.document.querySelector('button[data-workspace=prep]');
  await f.React.act(async()=>prep.click());
  await f.flush();
  assert.ok(f.dom.window.document.querySelector('.prepare-library'));
  const before=commits;
  for(let i=0;i<12;i++){
   await f.React.act(async()=>{
    f.sockets[0]!.emit({type:'meters',state:{channels:[-18+i],updatedAt:new Date().toISOString(),available:true}});
    f.sockets[0]!.emit({type:'parameter',state:{address:'/ch/01/eq/1/g',value:i}});
   });
  }
  assert.equal(commits-before,0,'12 successive mixer frames while reading a setlist');
  assert.ok(!f.outbound.some(m=>m.type==='set'));
 }finally{await f.close();}
});

test('simple mixer can hide spare inputs again and switch destinations from the keyboard',async()=>{
 const f=await fixture();
 try{
  const {SimpleMixer}=await import('../src/SimpleMixer');
  await f.mount(<SimpleMixer canWrite simulation onExpert={()=>{}}/>);
  await f.React.act(async()=>f.sockets.at(-1)!.emit({type:'snapshot',parameters:{'/ch/01/config/name':{value:'Micro'}}}));
  const doc=f.dom.window.document;
  const strips=()=>doc.querySelectorAll('.sm-strips .sm-strip').length;
  const check=()=>doc.querySelector('.sm-check input')!;
  const named=strips();
  await f.React.act(async()=>check().click());assert.ok(strips()>named);
  await f.React.act(async()=>check().click());assert.equal(strips(),named);
  const first=doc.querySelector('[role=tab]')!;
  await f.React.act(async()=>first.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  assert.equal(doc.activeElement?.id,'sm-mix-1');
  assert.equal(doc.querySelector('[role=tabpanel]')?.getAttribute('aria-labelledby'),'sm-mix-1');
  assert.ok(!f.outbound.some(m=>m.type==='set'));
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
  const sound=doc.querySelector('button[data-workspace=mix]');assert.ok(sound);
  await f.React.act(async()=>sound.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true})));await f.flush();
  await click('Retours','.subnav button');
  assert.equal(doc.querySelectorAll('.monitor-desk').length,1);
  assert.ok(!doc.body.textContent.includes('Ouvrir la régie des retours'));
  await click('Téléphones','.bp-section-tabs button');
  assert.equal(doc.querySelectorAll('.monitor-desk').length,0);
  assert.ok([...doc.querySelectorAll('button')].some((e:any)=>e.textContent==='Démarrer le partage'));
  await click('Mix et traitements','.bp-section-tabs button');assert.equal(doc.querySelectorAll('.monitor-desk').length,1);
  localStorage.setItem('xr18-expert-view','ears');
  await click('Mixage','.subnav button');await click('Expert');
  assert.equal(doc.querySelectorAll('[aria-label="Mode Expert"]').length,1);
  assert.ok(![...doc.querySelectorAll('.xs2-tabs button')].some((e:any)=>e.textContent==='Ears'));
  await f.React.act(async()=>{for(const ws of f.sockets)ws.emit({type:'status',status:{...f.status,connected:false}});});await f.flush();
  await f.React.act(async()=>{for(const ws of f.sockets)ws.emit({type:'status',status:{...f.status,connected:true}});});await f.flush();
  assert.equal(doc.querySelectorAll('[aria-label="Mode Expert"]').length,1,'reconnect must not throw the musician back into settings');
  assert.ok(!f.outbound.some(m=>m.type==='set'),'navigation never sends audio controls');
  assert.ok(!f.writes.includes('/api/ears-share/start'),'sharing does not start on navigation');
 }finally{await f.close();}
});

test('expert navigation never leaves duplicate preset panels or stale channel actions',async()=>{
 const f=await fixture();try{
  const {ExpertStudio}=await import('../src/expert/ExpertStudio');
  const mount=(channel:number)=>f.mount(<ExpertStudio canWrite selectedChannel={channel}/>);
  const doc=f.dom.window.document;
  const navigate=async(label:string)=>{
   const button=[...doc.querySelectorAll('.xs2-tabs button')].find(b=>b.textContent===label)!;
   assert.ok(button,label);await f.React.act(async()=>button.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true})));await f.flush();
  };
  await mount(1);
  for(const channel of [1,2,7,1]){
   await mount(channel);
   for(const label of ['Canal','Mélangeur','Surfaces','Canal','Surfaces']){
    await navigate(label);
    const panels=doc.querySelectorAll('.channel-preset-tools');
    assert.equal(panels.length,label==='Surfaces'?0:1,`${label}: one preset panel only on channel/mixer views`);
    if(panels.length)assert.match(panels[0]!.textContent!,new RegExp(`Canal ${channel} ·`));
    if(label==='Surfaces')assert.equal(doc.querySelectorAll('.surface-editor').length,1);
   }
  }
  assert.equal(f.errors.filter(args=>String(args[0]).includes('same key')).length,0,'panels have distinct React identities');
  assert.ok(!f.outbound.some(m=>m.type==='set'),'navigation never writes audio');
  assert.ok(!f.writes.some(p=>p.startsWith('/api/library/')),'navigation never creates or recalls presets');
 }finally{await f.close();}
});

test('Scenes offers a blank scene with preview, cancellation, explicit apply and restore',async()=>{
 const f=await fixture();try{
  const doc=f.dom.window.document, original=globalThis.fetch;
  const actions:{path:string;body:any}[]=[];
  globalThis.fetch=async(input,options)=>{
   const path=String(input);
   if(path==='/api/library/preset-options')return Response.json({model:'XR18',family:'xair',monitorOutputs:6,channels:[]});
   if(path.endsWith('protections'))return Response.json({model:'XR18',revision:0,rules:[]});
   if(!['/api/console/blank','/api/console/apply','/api/console/restore'].includes(path))return original(input,options);
   actions.push({path,body:JSON.parse(String(options?.body??'{}'))});
   const restore=path.endsWith('/restore');
   return new Response(JSON.stringify(path.endsWith('/apply')?{backupId:'before',failed:[]}:
    {token:restore?'undo':'reset',title:restore?'Revenir à avant':'Partir d’une scène vierge',explanation:'Aperçu',inputs:[],changes:[]}));
  };
  f.dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  f.dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const click=async(button:any)=>{assert.ok(button);await f.React.act(async()=>button.click());await f.flush();};
  const action=(selector:string,label:string)=>[...doc.querySelectorAll(selector)].find((e:any)=>e.textContent.trim()===label);
  const {default:App}=await import('../src/App');await f.mount(<App/>);
  await click(doc.querySelector('[data-workspace=prep]'));await click(action('.subnav button','Scènes'));
  const blank=()=>action('.scenes-page button','Partir d’une scène vierge');
  assert.equal(blank().matches(':disabled'),true);assert.equal(actions.length,0);
  await f.React.act(async()=>{for(const ws of f.sockets)ws.emit({type:'status',status:{...f.status,writesEnabled:true}});});await f.flush();
  await click(blank());await click(action('dialog button','Annuler, ne rien changer'));
  assert.deepEqual(actions.map(a=>a.path),['/api/console/blank']);
  await click(blank());await click(action('dialog button','Appliquer sur ma console'));
  assert.equal(actions.at(-1)?.body.confirm,true);assert.equal(actions.at(-1)?.body.token,'reset');
  await click(action('.scenes-page button','Revenir à avant'));assert.equal(actions.at(-1)?.body.backupId,'before');
  await click(action('dialog button','Appliquer sur ma console'));assert.equal(actions.at(-1)?.body.token,'undo');
  assert.equal(action('.scenes-page button','Revenir à avant'),undefined);
 }finally{await f.close();}
});
