import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

test('manager sees eleven configured inputs and the transport stays usable while they load',async()=>{
 const {JSDOM}=createRequire(import.meta.url)('jsdom');
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
 const configured=Array.from({length:11},(_,i)=>({usb:i+1,name:'Instrument '+(i+1),available:true,stereo:false}));
 const project={id:'song',inputs:2,start:0,ending:30,pos:0,marks:[],choices:[],takes:[],armed:0,recordTracks:[]};
 const state={bridge:'ready',transport:'idle',tabs:[{id:'song',title:'Test',number:1,saved:true}],project};
 let resolveInputs!:(value:Response)=>void;
 const inputs=new Promise<Response>(resolve=>{resolveInputs=resolve;});
 const commands:unknown[]=[];
 const fetch=async(path:string,options:RequestInit)=>{
  if(path.endsWith('/configured-inputs'))return inputs;
  if(options.method==='POST')commands.push(JSON.parse(String(options.body)));
  return Response.json(state);
 };
 const React=await import('react');
 const originals=new Map();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,React,fetch,IS_REACT_ACT_ENVIRONMENT:true})){
  originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperty(globalThis,key,{configurable:true,value});
 }
 const {createRoot}=await import('react-dom/client');
 const {RehearsalDesk}=await import('../src/show/RehearsalDesk');
 const root=createRoot(document.getElementById('root')!);
 try{
  await React.act(async()=>root.render(<RehearsalDesk token="manager"/>));
  assert.ok(document.querySelector('.sh-transport-info'));
  await React.act(async()=>resolveInputs(Response.json(configured)));
  const rows=[...document.querySelectorAll('.bp-inputs label.sh-check')];
  assert.equal(rows.length,11);
  for(const [i,row] of rows.entries()){
   assert.ok(row.textContent?.includes(configured[i].name));
   assert.equal(row.querySelector('input')?.disabled,i>=2);
  }
  assert.deepEqual(commands,[]);
  await React.act(async()=>rows[1].querySelector('input')!.click());
  assert.deepEqual(commands,[{action:'configuredInput',project:'song',index:2,name:'Instrument 2',stereo:false}]);
 }finally{
  await React.act(async()=>root.unmount());
  dom.window.close();
  for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
