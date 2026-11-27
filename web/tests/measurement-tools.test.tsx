import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MIXER_MODELS} from '../../shared/mixer-models';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),originals=new Map();let handler=async(_path:string,_options:any)=>({});const requests:any[]=[];
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,options:any)=>{requests.push({path,options});const value=await handler(path,options);return new Response(JSON.stringify(value));}})){originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});}
 const React=await import('react');originals.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{configurable:true,value:React});const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!);
 return {React,dom,requests,handle:(f:typeof handler)=>handler=f,render:async(el:any)=>React.act(async()=>{root.render(el);await new Promise(r=>setTimeout(r,0));}),wait:async(ms=450)=>React.act(async()=>{await new Promise(r=>setTimeout(r,ms));}),click:async(label:string)=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);await React.act(async()=>b.click());},async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,v]of originals)v?Object.defineProperty(globalThis,k,v):delete(globalThis as any)[k];}};
}
test('EQ spectrum starts explicitly, freezes and compares only its source, restores on navigation, without audio writes',async()=>{
 const f=await fixture();try{const {EqView}=await import('../src/xair/views'),{INPUTS}=await import('../src/xair/strips');let bands=Array(100).fill(-40),frame=true;
 f.handle(async(path,options)=>path.endsWith('/start')?{token:'view',connectionId:1}:path.endsWith('/read')?{connectionId:1,frame:frame?{bands,at:Date.now()}:null}:{ok:true});
 const props={values:{'/ch/01/config/name':'Meine Stimme'},set:()=>assert.fail('audio write'),canWrite:false,confirmed:async()=>false,open:()=>{}};
 await f.render(<EqView {...props} strip={INPUTS[0]!}/>);assert.equal(f.requests.length,0);await f.click('Afficher le RTA');await f.wait();assert.equal(document.querySelectorAll('.spectrum-line').length,1);
 await f.click('Figer le spectre');await f.click('Garder comme référence');const held=document.querySelector('.spectrum-held')!.getAttribute('points');bands=Array(100).fill(-20);await f.wait();assert.equal(document.querySelector('.spectrum-held')!.getAttribute('points'),held);assert.ok(document.querySelector('.spectrum-reference-line'));
 await f.click('Reprendre le direct');frame=false;await f.wait();assert.equal(document.querySelector('.spectrum-line'),null);assert.ok(document.querySelector('.spectrum-reference-line'));
 await f.render(<EqView {...props} strip={INPUTS[1]!}/>);assert.equal(document.querySelector('.spectrum-reference-line'),null);assert.equal(document.querySelector('.spectrum-held'),null);assert.ok(f.requests.some(r=>r.path.endsWith('/stop')));assert.ok(f.requests.every(r=>r.path.startsWith('/api/eq-rta/')));
 }finally{await f.close();}
});
test('late RTA start is released after view change and unsupported models never start measurements',async()=>{
 const f=await fixture();try{const {EqView}=await import('../src/xair/views'),{INPUTS}=await import('../src/xair/strips'),{MixerModelContext}=await import('../src/MixerModel');let resolve!:(v:any)=>void;
 f.handle(async path=>path.endsWith('/start')?await new Promise(r=>resolve=r):{ok:true});const props={values:{},set:()=>{},canWrite:false,confirmed:async()=>false,open:()=>{}};
 await f.render(<EqView {...props} strip={INPUTS[0]!}/>);await f.click('Afficher le RTA');await f.render(<EqView {...props} strip={INPUTS[1]!}/>);await f.React.act(async()=>resolve({token:'late',connectionId:1}));assert.ok(f.requests.some(r=>r.path.endsWith('/stop')&&r.options.body.includes('late')));
 await f.render(<MixerModelContext.Provider value={MIXER_MODELS.X32}><EqView {...props} strip={INPUTS[0]!}/></MixerModelContext.Provider>);assert.equal(document.querySelector('.eq-spectrum-tools'),null);
 }finally{await f.close();}
});
test('dynamics history handles gate/bus mapping, duplicates, missing frames, freeze and connection reset',async()=>{
 const f=await fixture();try{const {GainReduction,reductionPath}=await import('../src/expert/GainReduction'),{INPUTS,BUSES}=await import('../src/xair/strips');let frame:any={gate:Array(16).fill(-4),comp:Array(16).fill(-6),bus:Array(6).fill(-8),lr:-2,at:Date.now()},connectionId=1;
 f.handle(async()=>({frame,connectionId}));await f.render(<GainReduction strip={INPUTS[0]!} kind="gate"/>);assert.match(document.body.textContent!,/-4.0 dB/);await f.click('Historique de réduction du gain');await f.wait(550);assert.ok(document.querySelector('.reduction-history svg path')?.getAttribute('d')?.includes('M'));
 await f.click('Figer l’historique');frame=null;await f.wait(550);assert.match(document.body.textContent!,/Historique figé/);assert.equal(document.querySelector('[role=meter]')?.getAttribute('aria-valuetext'),'Mesure indisponible');connectionId=2;await f.wait(550);assert.doesNotMatch(document.body.textContent!,/Historique figé/);
 frame={bus:Array(6).fill(-8),at:Date.now()};await f.render(<GainReduction strip={BUSES[1]!}/>);assert.match(document.body.textContent!,/-8.0 dB/);assert.equal(document.querySelector('.reduction-history'),null);
 const path=reductionPath([{at:1000,db:-3},{at:1500,db:null},{at:2000,db:-5},{at:4500,db:-2}],5000,15);assert.equal((path.match(/M/g)||[]).length,3,'gaps are not connected');
 assert.ok(f.requests.every(r=>r.path==='/api/dynamics'&&r.options.method===undefined));
 }finally{await f.close();}
});
test('measurement controls remain translated in five languages without changing a personal source name',async()=>{
 const f=await fixture();try{const {EqView}=await import('../src/xair/views'),{GainReduction}=await import('../src/expert/GainReduction'),{INPUTS}=await import('../src/xair/strips'),{setLanguage}=await import('../src/i18n');
 for(const[lang,label]of [['fr','Afficher le RTA'],['en','Show RTA'],['it','Mostra RTA'],['es','Mostrar RTA'],['de','RTA anzeigen']] as const){setLanguage(lang);await f.render(<><EqView strip={INPUTS[0]!} values={{'/ch/01/config/name':'Mein Mikro'}} set={()=>{}} canWrite={false} confirmed={async()=>false} open={()=>{}}/><GainReduction strip={INPUTS[0]!}/></>);assert.ok(document.body.textContent!.includes(label));assert.ok(document.body.textContent!.includes('Mein Mikro'));if(lang!=='fr')assert.ok(!document.body.textContent!.includes('Un seul analyseur est partagé'));}
 setLanguage('fr');
 }finally{await f.close();}
});

test('EQ dragging uses the visible chart coordinates on a short, wide screen',async()=>{
 const f=await fixture();
 try{
  const {EqView}=await import('../src/xair/views'),{INPUTS}=await import('../src/xair/strips');
  const edits:Record<string,unknown>={};
  const render=(canWrite:boolean,type=2)=>f.render(<EqView strip={INPUTS[0]!} values={{'/ch/01/eq/1/type':type}} set={(key,value)=>{edits[key]=value;}} canWrite={canWrite} confirmed={async()=>false} open={()=>{}}/>);
  await render(true);
  const graph=document.querySelector<SVGSVGElement>('.xm-eq-graph')!;
  graph.setPointerCapture=()=>{};
  const transform={a:.5,b:0,c:0,d:.5,inverse:()=>({a:2,b:0,c:0,d:2,e:-360,f:-160})};
  Object.defineProperty(graph,'getScreenCTM',{value:()=>transform});
  Object.defineProperty(graph,'createSVGPoint',{value:()=>({
   x:0,y:0,matrixTransform(m:ReturnType<typeof transform.inverse>){return {x:this.x*m.a+this.y*m.c+m.e,y:this.x*m.b+this.y*m.d+m.f};}
  })});
  const gesture=()=>f.React.act(async()=>{
   graph.querySelector('.xm-eq-node')!.dispatchEvent(new f.dom.window.MouseEvent('pointerdown',{bubbles:true}));
   for(const event of ['pointermove','pointerup'])graph.dispatchEvent(new f.dom.window.MouseEvent(event,{clientX:305,clientY:130,bubbles:true}));
  });
  await gesture();assert.deepEqual(edits,{'/ch/01/eq/1/f':.25,'/ch/01/eq/1/g':.7});
  delete edits['/ch/01/eq/1/g'];await render(true,0);await gesture();
  assert.deepEqual(edits,{'/ch/01/eq/1/f':.25});
  delete edits['/ch/01/eq/1/f'];await render(false);await gesture();
  assert.deepEqual(edits,{});
  transform.a=0;await render(true);await gesture();assert.deepEqual(edits,{});
 }finally{await f.close();}
});
