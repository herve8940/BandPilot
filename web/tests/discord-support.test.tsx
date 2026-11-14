import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),saved=new Map();
 const requests:string[]=[];
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string)=>{requests.push(path);return new Response(JSON.stringify(path==='/api/auth'?{user:{role:'musician'}}:{version:'2.3.7',build:'test'}));}})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const React=await import('react');saved.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{value:React,configurable:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const i18n=await import('../src/i18n');i18n.setLanguage('fr');
 const mount=async(node:any)=>React.act(async()=>{root.render(node);await new Promise(r=>setTimeout(r,0));});
 const click=async(text:string)=>{const button=[...dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent.trim()===text) as HTMLButtonElement;assert.ok(button,text);await React.act(async()=>{button.click();await new Promise(r=>setTimeout(r,0));});};
 return {dom,React,root,mount,click,requests,i18n,async close(){await React.act(async()=>root.unmount());i18n.setLanguage('fr');dom.window.close();for(const[k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}

test('all users get the correct help channels, including when local authentication is unavailable',async()=>{
 const f=await fixture();try{
  const {SupportCenter}=await import('../src/SupportCenter');
  let diagnostics=0;f.dom.window.bandpilotSupport={prepare:async()=>{diagnostics++;return {};}};
  await f.mount(<SupportCenter/>);await f.click('Aide et incidents');
  const doc=f.dom.window.document;
  for(const [label,id] of [['Demander de l’aide sur Discord','1570534770297806888'],['Ouvrir #bugs-tests','1570534866049699882'],['Guide de démarrage sur Discord','1571098590925955082'],['Proposer une idée sur Discord','1570534825700368424']]){
   const link=doc.querySelector(`a[aria-label="${label}"]`);
   assert.equal(link?.getAttribute('href'),`https://discord.com/channels/1570533717917573260/${id}`);
   assert.equal(link?.getAttribute('target'),'_blank');assert.equal(link?.getAttribute('rel'),'noopener noreferrer');
  }
  assert.ok(doc.querySelector('a[href="https://discord.gg/FtWwEPmwE7"]'));
  assert.equal(doc.querySelector('.support-advanced'),null);assert.equal(diagnostics,0);
  assert.deepEqual(f.requests.sort(),['/api/auth','/api/version']);
  await f.mount(null);globalThis.fetch=async()=>{throw Error('offline');};await f.mount(<SupportCenter/>);await f.click('Aide et incidents');
  assert.ok(doc.querySelector('a[href$="/1570534770297806888"]'));assert.equal(diagnostics,0);
  await f.mount(null);globalThis.fetch=async()=>new Response(JSON.stringify({error:'Unauthorized'}),{status:401});
  await f.mount(<SupportCenter/>);await f.click('Aide et incidents');
  assert.ok(doc.querySelector('a[href$="/1570534770297806888"]'));
 }finally{await f.close();}
});

test('Discord copies exactly the redacted preview without collecting diagnostics or publishing',async()=>{
 const f=await fixture();try{
  const {DiscordIncident}=await import('../src/DiscordSupport');let copied='';
  Object.defineProperty(f.dom.window.navigator,'clipboard',{value:{writeText:async(text:string)=>{copied=text;}},configurable:true});
  const summary='Test @everyone';const description='Erreur à 192.0.2.1 pour musicien@example.com /Users/example/private token=secret';
  await f.mount(<DiscordIncident summary={summary} description={description} version={{version:'2.3.7',build:'test'}}/>);
  const preview=f.dom.window.document.querySelector('.discord-preview') as HTMLTextAreaElement;
  assert.match(preview.value,/2.3.7/);assert.doesNotMatch(preview.value,/@everyone|192\.0\.2\.1|musicien@example.com|\/Users\/example|token=secret/);
  assert.equal(copied,'');await f.click('Copier le message Discord');assert.equal(copied,preview.value);
  assert.match(f.dom.window.document.querySelector('[role=status]').textContent,/Message copié/);assert.deepEqual(f.requests,[]);
  await f.mount(<DiscordIncident summary={summary} description="Autre problème" version={{version:'2.3.7',build:'test'}}/>);
  assert.equal(f.dom.window.document.querySelector('[role=status]'),null,'changed drafts must not claim to be copied');
  assert.equal(copied.includes('Autre problème'),false);
 }finally{await f.close();}
});

test('clipboard failure selects the preview, and a native clipboard bridge copies the same text',async()=>{
 const f=await fixture();try{
  const {DiscordIncident}=await import('../src/DiscordSupport');
  Object.defineProperty(f.dom.window.navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}},configurable:true});
  await f.mount(<DiscordIncident summary="Connexion" description="Simulation XR12" version={{version:'2.3.7',build:''}}/>);
  await f.click('Copier le message Discord');
  const preview=f.dom.window.document.querySelector('.discord-preview') as HTMLTextAreaElement;
  assert.equal(preview.selectionStart,0);assert.equal(preview.selectionEnd,preview.value.length);
  assert.match(f.dom.window.document.querySelector('[role=status]').textContent,/manuellement/);
  let nativeText='';f.dom.window.bandpilotSupport={copyText:async(text:string)=>{nativeText=text;return {copied:true};}};
  await f.click('Copier le message Discord');assert.equal(nativeText,preview.value);
  assert.match(f.dom.window.document.querySelector('[role=status]').textContent,/Message copié/);
 }finally{await f.close();}
});

test('empty and oversized messages cannot be copied; all five languages update labels and the preview',async()=>{
 const f=await fixture();try{
  const {DiscordIncident}=await import('../src/DiscordSupport');let copies=0;
  Object.defineProperty(f.dom.window.navigator,'clipboard',{value:{writeText:async()=>{copies++;}},configurable:true});
  await f.mount(<DiscordIncident summary=" " description="" version={{version:'',build:''}}/>);
  await f.click('Copier le message Discord');assert.equal(copies,0);
  await f.mount(<DiscordIncident summary={'s'.repeat(140)} description={'d'.repeat(1500)} version={{version:'v'.repeat(100),build:'b'.repeat(80)}}/>);
  const input=f.dom.window.document.querySelector('input');
  await f.React.act(async()=>{Object.getOwnPropertyDescriptor(f.dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'c'.repeat(200));input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));});
  for(const lang of ['fr','en','it','es','de'] as const){
   await f.React.act(async()=>f.i18n.setLanguage(lang));
   const doc=f.dom.window.document,preview=doc.querySelector('.discord-preview');
   assert.ok(preview.value.length>2000);assert.ok(doc.querySelector('[role=alert]'));
   assert.equal(doc.querySelector('button').disabled,true);assert.equal(copies,0);
   assert.match(preview.value,new RegExp(f.i18n.translate('Incident BandPilot',lang)));
   assert.equal(doc.querySelector('button').textContent,f.i18n.translate('Copier le message Discord',lang));
  }
 }finally{await f.close();}
});

test('every Discord support phrase has translations in each shipped language',()=>{
 const source=['DiscordSupport.tsx','CommunityLink.tsx'].map(name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8')).join('\n');
 const keys=[...source.matchAll(/tx\('([^']+)'\)/g)].map(match=>match[1]);
 for(const lang of ['en','it','es','de']){
  const catalog=JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`,import.meta.url),'utf8'));
  for(const key of keys)assert.ok(catalog[key],`${lang}: ${key}`);
 }
});


test('the settings shortcut opens the existing support dialog and preserves its draft',async()=>{
 const f=await fixture();try{
  const {SupportCenter,SupportButton}=await import('../src/SupportCenter');
  await f.mount(<><SupportButton/><SupportCenter/></>);
  await f.click('Aide et incidents');
  const doc=f.dom.window.document;
  assert.equal(doc.querySelectorAll('dialog').length,1);assert.equal(doc.querySelector('dialog').open,true);
  const input=doc.querySelector('.support-dialog input');
  await f.React.act(async()=>{Object.getOwnPropertyDescriptor(f.dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'Mon incident');input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));});
  await f.React.act(async()=>doc.querySelector('button[aria-label="Fermer"]').click());
  await f.click('Aide et incidents');assert.equal(input.value,'Mon incident');
  assert.deepEqual(f.requests.sort(),['/api/auth','/api/version'],'opening another entry point does not mount another support instance');
 }finally{await f.close();}
});
