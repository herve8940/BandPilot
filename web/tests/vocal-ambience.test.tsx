import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(canApply=true){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),saved=new Map(),calls:{path:string;body:any}[]=[];
 const state:any={supported:true,voices:[{channel:1,name:'Chant'}],monitors:[{bus:1,name:'Hervé'},{bus:2,name:'Basse'}],session:null};
 const preview={token:'voice-plan',slot:1,voice:'Chant',ambience:{name:'Pop'},monitors:[{bus:1,name:'Hervé',db:-18},{bus:2,name:'Basse',db:-24}],message:'Dosages indépendants'};
 const globals={window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,confirm:()=>true,fetch:async(path:string,init:any={})=>{const body=init.body?JSON.parse(init.body):{};if(init.method==='POST')calls.push({path,body});if(path.endsWith('/apply'))state.session={slot:1,choice:{channel:1,ambience:'pop',doses:{'1':-18,'2':-24}},phase:'trial',sameConsole:true};if(path.endsWith('/keep'))state.session.phase='kept';const catalog={role:'admin',steps:[{id:'tone',title:'4. Écouter et corriger',text:'Écouter puis essayer'}],profile:{version:1,inputs:[{channel:1,name:'Chant',source:'lead-rock'}],completed:[],musicians:state.monitors},symptoms:[{id:'dry',label:'La voix est trop sèche'}],aiConfigured:false};return new Response(JSON.stringify(path==='/api/coach'?catalog:path.endsWith('/preview')?preview:state));}};
 for(const [k,v] of Object.entries(globals)){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,value:v,writable:true});}
 const React=await import('react');saved.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{configurable:true,value:React});
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));const {VocalAmbience}=await import('../src/VocalAmbience');
 await React.act(async()=>{root.render(<VocalAmbience canApply={canApply} simulation={true}/>);await new Promise(r=>setTimeout(r,0));});
 const button=(name:string)=>[...dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent.includes(name)) as HTMLButtonElement;
 const click=async(name:string)=>{const b=button(name);assert.ok(b,name);await React.act(async()=>{b.click();await new Promise(r=>setTimeout(r,0));});};
 return {dom,React,root,calls,button,click,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,v]of saved){if(v)Object.defineProperty(globalThis,k,v);else delete(globalThis as any)[k];}}};
}
test('voice toolbox separates selection, preview, listening and keeping; monitor choices stay independent',async()=>{
 const f=await fixture();try{
  assert.equal(f.calls.length,0);await f.click('Pop');
  await f.React.act(async()=>{const select=f.dom.window.document.querySelector('[aria-label="Ambiance pour Basse"]');select.value='-24';select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(f.calls.length,0);await f.click('Préparer mon ambiance');assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0]!.body,{channel:1,ambience:'pop',doses:{'1':-18,'2':-24}});
  await f.click('Essayer en simulation');assert.equal(f.calls[1]!.path,'/api/coach/vocal-fx/apply');assert.equal(f.button('Garder cette ambiance').disabled,false);assert.match(f.dom.window.document.body.textContent,/Voix FX/);
  await f.click('Garder cette ambiance');assert.equal(f.calls[2]!.path,'/api/coach/vocal-fx/keep');assert.match(f.dom.window.document.body.textContent,/ambiance conservée/);
 }finally{await f.close();}
});
test('read-only voice preparation cannot apply; gate reference requires explicit listening identification',async()=>{
 const f=await fixture(false);try{
  assert.equal(f.button('Préparer mon ambiance').disabled,true);assert.equal(f.calls.length,0);
  const {WorkshopGate}=await import('../src/show/WorkshopGate');const proposed:any[]=[];
  await f.React.act(async()=>f.root.render(<WorkshopGate channel={1} name="Chant" start={0} stop={30} temporal={{quietStart:0,softStart:1,activeSpreadDb:8,activeMedianDb:-20,activePeakDb:-6,attackMs:20,decayMs:150,events:10}} busy={false} onListen={()=>{}} onPropose={r=>proposed.push(r)}/>));
  assert.equal(f.button('Proposer un gate doux').disabled,true);
  await f.React.act(async()=>f.dom.window.document.querySelector('input[type=checkbox]').click());await f.click('Proposer un gate doux');assert.deepEqual(proposed,[{quietStart:0,quietStop:.5,softStart:1,softStop:1.5}]);assert.equal(f.calls.length,0);
 }finally{await f.close();}
});

test('coach keeps instrument correction and vocal ambience in distinct simple views',async()=>{
 const f=await fixture();try{
  f.dom.window.localStorage.setItem('xr18-coach-step','tone');
  const {SoundCoach}=await import('../src/SoundCoach');
  await f.React.act(async()=>{f.root.render(<SoundCoach status={{mode:'simulation',connected:true,writesEnabled:false}} online={true} meters={{channels:[],updatedAt:null,available:false}} onConnect={()=>{}} onExpert={()=>{}} onMonitors={()=>{}}/>);await new Promise(r=>setTimeout(r,0));});
  assert.match(f.dom.window.document.body.textContent,/Je m’occupe de/);assert.equal(f.dom.window.document.querySelector('[aria-label="Ambiance de la voix"]'),null);
  await f.click('Ambiances des sources');assert.ok(f.dom.window.document.querySelector('[aria-label="Ambiance de la voix"]'));assert.doesNotMatch(f.dom.window.document.body.textContent,/Je m’occupe de|Annuler le dernier réglage guidé/);
  await f.click('Corriger un instrument');assert.match(f.dom.window.document.body.textContent,/Je m’occupe de/);assert.equal(f.dom.window.document.querySelector('[aria-label="Ambiance de la voix"]'),null);
  await f.click('La voix est trop sèche');assert.ok(f.dom.window.document.querySelector('[aria-label="Ambiance de la voix"]'));assert.equal(f.calls.length,0,'switching tools never changes audio');
 }finally{await f.close();}
});
