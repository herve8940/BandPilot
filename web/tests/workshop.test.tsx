import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(initial:any){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),originals=new Map(),requests:{path:string;body:any}[]=[];
 const state=initial;
 const catalog={token:'preview-token',project:'/band.rpp',device:'XR18',outputs:18,rate:48000,tracks:[{index:0,guid:'bass',name:'Basse',channels:1,items:[{pos:0,length:60,take:'Prise 1'}]}]};
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,confirm:()=>true,fetch:async(path:string,init:any={})=>{if(init.method==='POST')requests.push({path,body:JSON.parse(init.body)});return new Response(JSON.stringify(path.endsWith('/catalog')?catalog:state));}})){
  originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 }
 const React=await import('react');originals.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{configurable:true,value:React});
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const {Workshop}=await import('../src/show/Workshop');await React.act(async()=>{root.render(<Workshop/>);await new Promise(r=>setTimeout(r,0));});
 const button=(name:string)=>[...dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent.includes(name)) as HTMLButtonElement;
 const click=async(name:string)=>{const b=button(name);assert.ok(b,name);await React.act(async()=>{b.click();await new Promise(r=>setTimeout(r,0));});};
 return {dom,React,requests,button,click,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
test('workshop mount is read-only and preparation requires mapping plus both checks',async()=>{
 const f=await fixture({active:null,history:[],supported:true,job:null});try{
 assert.equal(f.requests.length,0);await f.click('Lire les pistes');assert.equal(f.button('Préparer mon atelier').disabled,true);
 const doc=f.dom.window.document;await f.React.act(async()=>{const select=doc.querySelector('select');select.value='2';select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
 await f.React.act(async()=>{for(const c of doc.querySelectorAll('input[type=checkbox]'))c.click();});
 assert.equal(f.button('Préparer mon atelier').disabled,false);await f.click('Préparer mon atelier');
 const create=f.requests.find(r=>r.path.endsWith('/create'))!.body;assert.equal(create.token,'preview-token');assert.equal(create.mapping[0].channel,2);assert.equal(create.rawConfirmed,true);assert.equal(create.deviceConfirmed,true);
 }finally{await f.close();}
});
test('measured advice presents fact, hypothesis and impact; recovery keeps restoration accessible',async()=>{
 const s={id:'a',name:'Refrain',phase:'recovery',side:'B',model:'XR18',start:10,stop:30,mapping:[],note:'',createdAt:'2026-11-04',advice:[{id:'a',channel:1,title:'Vérifier la voix',fact:'Crête −6 dBFS',hypothesis:'À écouter',impact:'Tous les retours après traitement',start:10,stop:11,changes:{}}]};
 const f=await fixture({active:s,history:[],supported:true,job:null});try{
 assert.match(f.dom.window.document.body.textContent,/Mesure :/);assert.match(f.dom.window.document.body.textContent,/Tous les retours/);assert.equal(f.button('Écouter le passage').disabled,true);assert.equal(f.button('Terminer · garder A').disabled,false);assert.equal(f.requests.length,0);
 await f.click('Terminer · garder A');assert.deepEqual(f.requests[0],{path:'/api/workshop/finish',body:{keep:'A',confirm:true}});
 }finally{await f.close();}
});
