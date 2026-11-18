import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

test('Android library export preserves JSON and native scenes and returns save, cancel and failure results',async()=>{
 const dom=new JSDOM('<div></div>',{url:'http://localhost'}),originals=new Map(),calls:any[]=[];
 let result:any={saved:true};
 for(const key of ['window','document','HTMLAnchorElement','localStorage','Blob','FileReader']){
  originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='window'?dom.window:dom.window[key]});
 }
 try{
  dom.window.BandPilotAndroid={getLanguage:()=> 'fr',setLanguage:()=>true,invoke:(action:string,id:string,json:string)=>{
   calls.push({action,...JSON.parse(json)});dom.window.__bandpilotAndroidResult(id,result);
  }};
  await import('../src/android-bridge');
  assert.equal(calls.length,0,'opening the bridge must not write or export');
  for(const [filename,content,mime] of [
   ['Voix été.json','{"name":"Voix été","kind":"channel-preset"}','application/json'],
   ['Scène.SCN','/ch/01/config "Fixture" 1 In01 U01\n','text/plain'],
  ]){
   assert.deepEqual(await dom.window.bandpilotFiles.save({filename,content}),{saved:true});
   assert.equal(calls.at(-1).action,'save');assert.equal(calls.at(-1).name,filename);assert.equal(calls.at(-1).mime,mime);
   assert.equal(Buffer.from(calls.at(-1).base64,'base64').toString('utf8'),content);
  }
  result={cancelled:true};assert.deepEqual(await dom.window.bandpilotFiles.save({filename:'cancel.json',content:'{}'}),result);
  result={error:'Storage unavailable'};assert.deepEqual(await dom.window.bandpilotFiles.save({filename:'fail.json',content:'{}'}),result);
 }finally{
  dom.window.close();for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete (globalThis as any)[key];}
 }
});
