import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(canApply=true,overrides:Record<string,unknown>={}){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),saved=new Map(),calls:{path:string;body:any}[]=[];
 const state:any={supported:true,voices:[{channel:1,name:'Chant'}],monitors:[{bus:1,name:'Retour chant'},{bus:2,name:'Basse'}],session:null,...overrides};
 const preview={token:'voice-plan',slot:1,voice:'Chant',ambience:{name:'Pop'},monitors:[{bus:1,name:'Retour chant',db:-18},{bus:2,name:'Basse',db:-24}],message:'Dosages indépendants'};
 const globals={window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,confirm:()=>true,fetch:async(path:string,init:any={})=>{const body=init.body?JSON.parse(init.body):{};if(init.method==='POST')calls.push({path,body});if(path.endsWith('/apply'))state.session={slot:1,choice:{channel:1,ambience:'pop',doses:{'1':-18,'2':-24}},phase:'trial',sameConsole:true};if(path.endsWith('/keep'))state.session.phase='kept';const catalog={role:'admin',steps:[{id:'tone',title:'4. Écouter et corriger',text:'Écouter puis essayer'}],profile:{version:1,inputs:[{channel:1,name:'Chant',source:'lead-rock'}],completed:[],musicians:state.monitors},symptoms:[{id:'dry',label:'La voix est trop sèche'}],aiConfigured:false};return new Response(JSON.stringify(path==='/api/coach'?catalog:path.endsWith('/preview')?preview:state));}};
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
test('a group without monitors can choose an input, change its effect and preview the main mix',async()=>{
 const f=await fixture(true,{monitors:[],voices:[{channel:2,name:'Clavier',source:'keys'},{channel:6,name:'Instrument',source:'electric-rhythm'}]});
 try{
  const select=async(label:string,value:string)=>f.React.act(async()=>{
   const el=f.dom.window.document.querySelector('[aria-label="'+label+'"]');
   el.value=value;el.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));
  });
  assert.ok(f.button('Petit hall'));
  await select('Source à traiter','6');await f.click('Écho court');
  assert.equal(f.button('Préparer mon ambiance').disabled,true);
  await select('Dosage en façade','-24');assert.deepEqual(f.calls,[]);
  await f.click('Préparer mon ambiance');
  assert.deepEqual(f.calls,[{path:'/api/coach/vocal-fx/preview',body:{channel:6,ambience:'slap',doses:{},mainDb:-24}}]);
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

test('switching directly from vocals to snare starts a fresh effect and keeps the vocal card editable',async()=>{
 const voice={id:'voice',slot:1,choice:{channel:1,ambience:'pop',mainDb:-12,doses:{'1':-24}},phase:'kept',sameConsole:true};
 const f=await fixture(true,{voices:[{channel:1,name:'Chant',source:'lead-rock'},{channel:2,name:'Caisse claire',source:'snare'}],sessions:[voice],session:voice,capacity:4});
 try{
  const field=(label:string)=>f.dom.window.document.querySelector('[aria-label="'+label+'"]') as HTMLSelectElement;
  await f.React.act(async()=>{const source=field('Source à traiter');source.value='2';source.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(f.calls.length,0);
  assert.equal(f.dom.window.document.querySelector('.balance-fx-editing strong').textContent,'Nouvel effet');
  assert.equal(field('Dosage en façade').value,'-90');
  await f.click('Plaque caisse claire');await f.click('Préparer mon ambiance');
  assert.deepEqual(f.calls[0]!.body,{channel:2,ambience:'snare-plate',doses:{'1':-18,'2':-18},sessionId:null});
  await f.click('FX 1');
  assert.equal(field('Source à traiter').value,'1');
  assert.equal(field('Dosage en façade').value,'-12');
  assert.equal(field('Ambiance pour Retour chant').value,'-24');
  assert.equal(f.dom.window.document.querySelector('.vocal-preview'),null);
  await f.click('Préparer mon ambiance');
  assert.equal(f.calls[1]!.body.sessionId,'voice');
 }finally{await f.close();}
});

test('a full rack lets the musician change inputs during a trial and protects all four slots',async()=>{
 const effects=Array.from({length:4},(_,i)=>({id:'effect'+i,slot:i+1,sameConsole:true,phase:i===0?'trial':'kept',choice:{channel:1,ambience:'natural',doses:{'1':-18}}}));
 const f=await fixture(true,{voices:[{channel:1,name:'Chant',source:'lead-rock'},{channel:2,name:'Caisse claire',source:'snare'}],session:effects[0],sessions:effects,capacity:4});
 try{
  const source=f.dom.window.document.querySelector('[aria-label="Source à traiter"]') as HTMLSelectElement;
  assert.equal(source.matches(':disabled'),false);
  await f.React.act(async()=>{source.value='2';source.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.match(f.dom.window.document.querySelector('.balance-fx-editing').textContent,/Nouvel effet.*Tous les emplacements FX sont utilisés/);
  assert.equal(f.dom.window.document.querySelectorAll('.balance-fx-rack button').length,4);
  assert.equal(f.button('Préparer mon ambiance').matches(':disabled'),true);
  await f.click('FX 1');
  assert.equal(source.value,'1');
  assert.equal(f.button('Garder cette ambiance').matches(':disabled'),false);
  assert.deepEqual(f.calls,[]);
 }finally{await f.close();}
});

test('coach keeps instrument correction and vocal ambience in distinct simple views',async()=>{
 const f=await fixture();try{
  f.dom.window.requestAnimationFrame=(fn:any)=>setTimeout(fn,0);
  f.dom.window.sessionStorage.setItem(JSON.stringify(['bp-guided-mixer','XR18','simulation',undefined,undefined]),JSON.stringify({kind:'blank',step:'tone',profile:{version:1,inputs:[{channel:1,name:'Chant',source:'lead-rock'}],completed:[]}}));
  const {SoundCoach}=await import('../src/SoundCoach');
  await f.React.act(async()=>{f.root.render(<SoundCoach status={{mode:'simulation',connected:true,writesEnabled:false}} online={true} meters={{channels:[],updatedAt:null,available:false}} onConnect={()=>{}} onExpert={()=>{}} onMonitors={()=>{}}/>);await new Promise(r=>setTimeout(r,0));});
  await f.click('Écoute');
  assert.match(f.dom.window.document.body.textContent,/Je m’occupe de/);assert.equal(f.dom.window.document.querySelector('[aria-label="Effets de la balance"]'),null);
  await f.click('Effets par instrument');assert.ok(f.dom.window.document.querySelector('[aria-label="Effets de la balance"]'));assert.doesNotMatch(f.dom.window.document.body.textContent,/Je m’occupe de|Annuler le dernier réglage guidé/);
  await f.click('Corriger un instrument');assert.match(f.dom.window.document.body.textContent,/Je m’occupe de/);assert.equal(f.dom.window.document.querySelector('[aria-label="Effets de la balance"]'),null);
  await f.click('La voix est trop sèche');assert.ok(f.dom.window.document.querySelector('[aria-label="Effets de la balance"]'));assert.ok(f.calls.every(c=>c.path==='/api/coach/profile'),'switching tools saves only the group, never audio');
 }finally{await f.close();}
});
