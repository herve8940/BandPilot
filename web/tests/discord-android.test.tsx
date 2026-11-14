import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

test('Android copies through the native bridge and opens Discord links outside the WebView',async()=>{
 const dom=new JSDOM('<div></div>',{url:'http://localhost'}),saved=new Map(),calls:any[]=[];
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLAnchorElement:dom.window.HTMLAnchorElement,localStorage:dom.window.localStorage})){
  saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 }
 try{
  dom.window.BandPilotAndroid={getLanguage:()=> 'fr',setLanguage:()=>true,invoke:(action:string,id:string,json:string)=>{calls.push({action,...JSON.parse(json)});dom.window.__bandpilotAndroidResult(id,{copied:true});}};
  await import('../src/android-bridge');
  const text='Incident BandPilot — essai\n\nSimulation MR18';
  assert.equal((await dom.window.bandpilotSupport.copyText(text)).copied,true);
  assert.deepEqual(calls,[{action:'clipboard',text}]);
  const React=await import('react');saved.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{value:React,configurable:true});
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {CommunityLink}=await import('../src/CommunityLink');
  const html=renderToStaticMarkup(React.createElement(CommunityLink,{destination:'bugs'}));
  assert.match(html,/target="_self"/);
  assert.match(html,/https:\/\/discord.com\/channels\/1570533717917573260\/1570534866049699882/);
  assert.equal(calls.length,1,'rendering a link does not open or post anything');
 }finally{dom.window.close();for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete(globalThis as any)[key];}}
});
