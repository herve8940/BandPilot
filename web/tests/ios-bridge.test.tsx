import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

test('iPad exports clicked diagnostics, rejects remote downloads and delegates PDF/update actions',async()=>{
 const dom=new JSDOM('<!doctype html><a download="diagnostic.log" href="/api/diagnostics/log">Journal</a>',{url:'http://127.0.0.1:9999/'});
 const originals=new Map<string,PropertyDescriptor|undefined>(),calls:any[]=[],requests:string[]=[];
 const install=(k:string,v:unknown)=>{originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});};
 const w=dom.window;
 w.BandPilotIOS={getLanguage:()=> 'en',setLanguage:()=>true,invoke:(action:string,id:string,json:string)=>{calls.push({action,input:JSON.parse(json)});queueMicrotask(()=>w.__bandpilotIOSResult(id,{saved:true,available:false}));}};
 for(const [k,v] of Object.entries({window:w,document:w.document,location:w.location,HTMLAnchorElement:w.HTMLAnchorElement,FileReader:w.FileReader,Blob:w.Blob,fetch:async(url:unknown)=>{requests.push(String(url));return {ok:true,blob:async()=>new w.Blob(['debug'],{type:'text/plain'})};}}))install(k,v);
 try{
  await import('../src/ios-bridge');
  assert.equal(w.document.documentElement.dataset.platform,'ios');
  assert.equal(w.bandpilotLanguage.get(),'en');
  const anchor=w.document.querySelector('a');
  anchor.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  for(let i=0;i<50&&!calls.length;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(calls[0].action,'save');assert.equal(calls[0].input.name,'diagnostic.log');assert.equal(Buffer.from(calls[0].input.base64,'base64').toString(),'debug');
  anchor.href='https://example.com/private';anchor.click();await new Promise(r=>setTimeout(r,5));assert.equal(requests.length,1,'remote files cannot be fetched through the native export bridge');
  await w.bandpilotDocuments.saveTechRiderPDF({html:'<h1>Éric</h1>',filename:'fiche.pdf'});
  assert.deepEqual(calls.at(-1),{action:'print',input:{html:'<h1>Éric</h1>',name:'fiche.pdf'}});
  await w.bandpilotSupport.checkUpdate();assert.equal(calls.at(-1).action,'checkUpdate');
  await w.bandpilotSupport.copyText('Incident BandPilot — iPad');
  assert.deepEqual(calls.at(-1),{action:'clipboard',input:{text:'Incident BandPilot — iPad'}});
  const discord=w.document.createElement('a');discord.target='_blank';discord.href='https://discord.com/channels/1570533717917573260/1570534866049699882';w.document.body.append(discord);discord.click();
  assert.deepEqual(calls.at(-1),{action:'open',input:{url:discord.href}});
  w.open('http://example.com');assert.equal(calls.at(-1).action,'open','only HTTPS links leave the application');
 }finally{dom.window.close();for(const [k,d] of originals){if(d)Object.defineProperty(globalThis,k,d);else delete (globalThis as any)[k];}}
});
