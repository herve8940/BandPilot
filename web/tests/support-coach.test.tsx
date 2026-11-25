import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),saved=new Map();
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:(fn:any)=>setTimeout(fn,0),fetch:async(path:string)=>new Response(JSON.stringify(path==='/api/auth'?{user:{role:'admin'}}:{version:'2.3.2',build:'fixture'}))})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 const React=await import('react');saved.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{value:React,configurable:true});
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const mount=async(node:any)=>React.act(async()=>{root.render(node);await new Promise(r=>setTimeout(r,0));});
 const click=async(text:string)=>{const button=[...dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent.trim()===text||dom.window.document.getElementById(b.getAttribute('aria-labelledby')??'')?.textContent===text) as HTMLButtonElement;assert.ok(button,text);await React.act(async()=>{button.click();await new Promise(r=>setTimeout(r,0));});};
 return {dom,React,root,mount,click,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
function restoreBlank(dom:any,profile:any,mode:string){
 const key=JSON.stringify(['bp-guided-mixer','XR18',mode,undefined,undefined]);
 dom.window.sessionStorage.setItem(key,JSON.stringify({kind:'blank',step:'inputs',profile,fresh:false}));
}
test('adding and choosing an input stays local; failed saving never advances the coach',async()=>{
 const f=await fixture();try{
  const {InputsStep}=await import('../src/CoachSetup');let current:any={version:1,completed:[],inputs:[]},applied=0,advanced=0,saveSucceeds=false;
  const data:any={sources:[{id:'lead-rock',name:'Chant',label:'Chant',group:'Voix',family:'voice',color:1},{id:'keys',name:'Clavier',label:'Clavier',group:'Claviers',family:'keys',color:2}],presets:{},templates:[],drumKit:[]};
  function Harness(){const [profile,set]=f.React.useState(current);return <InputsStep data={data} profile={profile} setProfile={p=>{current=p;set(p);}} admin busy={false} canApply onApplyChannel={()=>applied++} onApplyAll={()=>applied++} onSave={async()=>saveSucceeds} notify={()=>{}} onNext={()=>advanced++} onBlank={()=>{}}/>;}
  await f.mount(<Harness/>);await f.click('Ajouter un instrument');assert.equal(current.inputs.length,1);
  const select=[...f.dom.window.document.querySelectorAll('select')].find((s:any)=>s.value==='lead-rock') as HTMLSelectElement;
  await f.React.act(async()=>{select.value='keys';select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(current.inputs[0].source,'keys');assert.equal(applied,0);
  await f.click('Étape suivante : régler les gains →');assert.equal(advanced,0);
  saveSucceeds=true;await f.click('Étape suivante : régler les gains →');assert.equal(advanced,1);assert.equal(applied,0);
 }finally{await f.close();}
});
test('support checks updates on startup, previews the report and sends only after review',async()=>{
 const f=await fixture();try{
  const calls:string[]=[];f.dom.window.bandpilotSupport={status:async()=>({configured:true}),checkUpdate:async()=>{calls.push('check');return {available:true,version:'2.3.3'};},prepare:async()=>{calls.push('prepare');return {id:'id',content:'{"schema":1}'};},send:async()=>{calls.push('send');return {url:'https://github.com/herve8940/BandPilot/issues/42'};},export:async()=>({saved:true}),browser:async()=>({copied:true}),openUpdate:async()=>({opened:true})};
  const {SupportCenter}=await import('../src/SupportCenter');await f.mount(<SupportCenter/>);assert.deepEqual(calls,['check']);assert.match(f.dom.window.document.body.textContent,/2.3.3/);
  await f.click('Aide et incidents');const input=f.dom.window.document.querySelector('input');
  await f.React.act(async()=>{Object.getOwnPropertyDescriptor(f.dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'Erreur ajout');input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));});
  await f.click('Préparer le rapport');assert.deepEqual(calls,['check','prepare']);
  await f.click('Créer l’issue sur GitHub');assert.ok(!calls.includes('send'));
  await f.React.act(async()=>f.dom.window.document.querySelector('input[type=checkbox]').click());
  await f.click('Créer l’issue sur GitHub');assert.deepEqual(calls,['check','prepare','send']);assert.ok(f.dom.window.document.querySelector('a[href$="/issues/42"]'));
 }finally{await f.close();}
});
test('ambience recovery remains accessible when a foreign or missing source disables the usual controls',async()=>{
 const f=await fixture();try{
  const calls:string[]=[];let session:any={slot:1,phase:'kept',choice:{channel:5,ambience:'rock',doses:{1:-18}},sameConsole:false,sourceMissing:true,savedHost:'192.0.2.1',currentHost:'192.0.2.2'};
  globalThis.fetch=async(path:any,init:any)=>{if(init?.method==='POST'){calls.push(path);if(path.endsWith('/archive'))session=null;}return new Response(JSON.stringify({supported:true,voices:[{channel:4,name:'Micro 1',source:'lead-rock'}],monitors:[{bus:1,name:'Voix'}],session}));};
  const original=globalThis.confirm;globalThis.confirm=()=>true;
  try{const {VocalAmbience}=await import('../src/VocalAmbience');await f.mount(<VocalAmbience canApply simulation={false}/>);
   assert.equal(f.dom.window.document.querySelector('fieldset').disabled,true);assert.equal(f.dom.window.document.querySelector('[aria-label="Source à traiter"]').value,'4');
   await f.click('Archiver cet ancien suivi');assert.deepEqual(calls,['/api/coach/vocal-fx/archive']);assert.equal(f.dom.window.document.querySelector('fieldset').disabled,false);
  }finally{if(original)globalThis.confirm=original;else delete(globalThis as any).confirm;}
 }finally{await f.close();}
});

test('automatic update progress is visible and opting out persists without installing or changing audio',async()=>{
 const f=await fixture();try{
  let listener:any,unsubscribed=false;const calls:any[]=[];
  f.dom.window.bandpilotSupport={status:async()=>({configured:false}),checkUpdate:async()=>({available:false,automaticEnabled:true}),onUpdate:(fn:any)=>{listener=fn;return()=>{unsubscribed=true;};},setAutomaticUpdates:async(value:boolean)=>{calls.push(value);return {available:true,automaticEnabled:value,phase:'available',version:'2.3.4'};},openUpdate:async()=>{calls.push('manual');return {};}};
  const {SupportCenter}=await import('../src/SupportCenter');await f.mount(<SupportCenter/>);
  await f.React.act(async()=>listener({available:true,version:'2.3.4',automaticEnabled:true,automatic:{},phase:'downloading',progress:42}));
  assert.match(f.dom.window.document.querySelector('.update-notice').textContent,/42%/);
  await f.React.act(async()=>listener({available:true,version:'2.3.4',automaticEnabled:true,automatic:{},phase:'ready'}));
  assert.match(f.dom.window.document.querySelector('.update-notice').textContent,/quitteras BandPilot/);
  await f.click('Aide et incidents');
  await f.React.act(async()=>{f.dom.window.document.querySelector('input[type=checkbox]').click();await new Promise(r=>setTimeout(r,0));});
  assert.deepEqual(calls,[false]);assert.equal(f.dom.window.document.querySelector('input[type=checkbox]').checked,false);
  await f.React.act(async()=>f.root.unmount());assert.equal(unsubscribed,true);
 }finally{await f.close();}
});

test('a failed instrument validation is visible inside its dialog and cannot resend a consumed plan',async()=>{
 const f=await fixture();try{
  const {SoundCoach}=await import('../src/SoundCoach');let applied=0;
  const profile={version:1,completed:[],inputs:[{channel:1,source:'lead-rock',name:'Chant'}],musicians:[]};
  const catalog={role:'admin',profile,steps:[{id:'inputs',title:'2. Dire qui est branché où',text:''}],sources:[{id:'lead-rock',label:'Chant',name:'Chant',color:1,group:'Voix'}],presets:{},templates:[],drumKit:[],symptoms:[]};
  globalThis.fetch=async(path:any,init:any)=>{
   if(path==='/api/coach/apply'){applied++;return new Response(JSON.stringify({error:'État modifié : prévisualiser à nouveau'}),{status:400});}
   return new Response(JSON.stringify(path==='/api/coach'?catalog:path==='/api/coach/prepare'?{token:'once',title:'Chant',explanation:'Réglages',inputs:['Chant'],changes:[]}:{}));
  };
  restoreBlank(f.dom,profile,'simulation');
  await f.mount(<SoundCoach status={{mode:'simulation',connected:true,writesEnabled:false}} online meters={{channels:[],available:false,updatedAt:null}} onConnect={()=>{}} onMonitors={()=>{}} onExpert={()=>{}}/>);
  await f.click('Instruments');
  await f.click('Préparer les réglages');await f.click('Essayer en simulation');
  const dialog=f.dom.window.document.querySelector('dialog');assert.match(dialog.querySelector('[role=alert]')?.textContent??'',/État modifié/);
  assert.equal(dialog.querySelector('button.primary').disabled,true);await f.click('Essayer en simulation');assert.equal(applied,1);
  await f.click('Fermer');await f.click('Préparer les réglages');assert.equal(f.dom.window.document.querySelector('dialog button.primary').disabled,false);
 }finally{await f.close();}
});

test('a full group refuses a partial drum kit without removing its existing electronic drums',async()=>{
 const f=await fixture();try{
  const {InputsStep}=await import('../src/CoachSetup');let current:any={version:1,completed:[],inputs:Array.from({length:16},(_,i)=>({channel:i+1,source:i===15?'drum-module':'lead-rock',name:'Canal '+(i+1)}))},notice='';
  const ids=['lead-rock','drum-module','kick','snare','tom1','tom2','tom3','oh-left','oh-right'];
  const data:any={sources:ids.map(id=>({id,name:id,label:id,group:'Instruments',color:1})),presets:{},templates:[],drumKit:ids.slice(2)};
  function Harness(){const [p,set]=f.React.useState(current);return <InputsStep data={data} profile={p} setProfile={v=>{current=v;set(v);}} admin busy={false} canApply onApplyChannel={()=>{}} onApplyAll={()=>{}} onSave={async()=>true} notify={m=>notice=m} onNext={()=>{}} onBlank={()=>{}}/>;}
  const before=structuredClone(current);await f.mount(<Harness/>);await f.click('Ajouter la batterie détailléeKick, snare, tom 1, tom 2, tom 3, OH 1, OH 2 sur les entrées libres.');
  assert.deepEqual(current,before);assert.match(notice,/entrées libres/);assert.doesNotMatch(notice,/ajoutée/);
 }finally{await f.close();}
});

test('moving an input to another socket keeps its musician assignment',async()=>{
 const f=await fixture();try{
  const {InputsStep}=await import('../src/CoachSetup');let current:any={version:1,completed:[],inputs:[{channel:1,source:'lead-rock',name:'Chant'}],musicians:[{name:'Hervé',bus:1,role:'chant',channels:[1]}]};
  const data:any={sources:[{id:'lead-rock',name:'Chant',label:'Chant',group:'Voix',color:1}],presets:{},templates:[],drumKit:[]};
  function Harness(){const[p,set]=f.React.useState(current);return <InputsStep data={data} profile={p} setProfile={v=>{current=v;set(v);}} admin busy={false} canApply onApplyChannel={()=>{}} onApplyAll={()=>{}} onSave={async()=>true} notify={()=>{}} onNext={()=>{}} onBlank={()=>{}}/>;}
  await f.mount(<Harness/>);await f.React.act(async()=>{const select=f.dom.window.document.querySelector('.coach-inputs select');select.value='4';select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(current.inputs[0].channel,4);assert.deepEqual(current.musicians[0].channels,[4]);
 }finally{await f.close();}
});

test('sound choice updates instrument cards locally and sends the chosen profile only on preparation',async()=>{
 const f=await fixture();try{
  const {InputsStep}=await import('../src/CoachSetup');let current:any={version:1,completed:[],headroom:'standard',musicians:[{name:'Batterie',bus:1,role:'batterie',channels:[1]}],tech:{monitors:{1:{kind:'wedge'}}},inputs:[{channel:1,source:'tom1',name:'Tom 1'}]},prepared:any=null;
  const card=(title:string)=>({title,description:'',advice:'',lines:[title]});
  const data:any={sources:[{id:'tom1',name:'Tom 1',label:'Tom 1',group:'Batterie',family:'toms',color:4}],presets:{tom1:card('Rock')},presetsBySound:{'live-rock':{tom1:card('Gate rock')},'natural':{tom1:card('Expandeur préparé, non activé')}},templates:[],drumKit:[]};
  function Harness(){const [profile,set]=f.React.useState(current);return <InputsStep data={data} profile={profile} setProfile={p=>{current=p;set(p);}} admin busy={false} canApply onApplyChannel={p=>{prepared=p;}} onApplyAll={p=>{prepared=p;}} onSave={async()=>true} notify={()=>{}} onNext={()=>{}} onBlank={()=>{}}/>;}
  await f.mount(<Harness/>);assert.match(f.dom.window.document.body.textContent,/Gate rock/);
  const select=f.dom.window.document.querySelector('select[aria-label="Base sonore"]') as HTMLSelectElement;
  await f.React.act(async()=>{select.value='natural';select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(current.sound,'natural');assert.equal(prepared,null);
  assert.equal(current.headroom,'standard');assert.equal(current.tech.monitors[1].kind,'wedge');
  assert.match(f.dom.window.document.body.textContent,/Expandeur préparé, non activé/);const headroom=f.dom.window.document.querySelector('select[aria-label="Marge à l’entrée"]') as HTMLSelectElement;
  await f.React.act(async()=>{headroom.value='extra';headroom.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(current.sound,'natural');assert.equal(current.headroom,'extra');assert.equal(current.tech.monitors[1].kind,'wedge');assert.equal(prepared,null);
  await f.click('Préparer les réglages');assert.equal(prepared.sound,'natural');assert.equal(prepared.headroom,'extra');
 }finally{await f.close();}
});


test('each musician chooses a listening type locally without changing others or the processing style',async()=>{
 const f=await fixture();try{
  const {EarsStep}=await import('../src/CoachSetup');let current:any={version:1,completed:[],sound:'live-rock',headroom:'extra',inputs:[{channel:1,source:'overheads',name:'OH'}],musicians:[{name:'A',bus:1,role:'batterie',channels:[1]},{name:'B',bus:2,role:'batterie',channels:[1]}],tech:{monitors:{2:{kind:'wedge',equipment:'Wedge B'}}}},applied:any=null;
  const recipes={batterie:{cymbals:-90}},personal={batterie:{cymbals:-26}};
  const data:any={sources:[{id:'overheads',family:'cymbals',color:4}],roles:[{id:'batterie',label:'Batterie',hint:''}],recipes,recipesByListening:{'in-ear':personal,headphones:personal,wedge:recipes},ownLevel:-3};
  function Harness(){const[p,set]=f.React.useState(current);return <EarsStep data={data} profile={p} setProfile={v=>{current=v;set(v);}} admin busy={false} canApply onSuggest={()=>{}} onApply={v=>{applied=v;}} onShare={()=>{}} onSave={()=>{}}/>;}
  await f.mount(<Harness/>);
  const select=f.dom.window.document.querySelector('select[aria-label="Écoute de A"]') as HTMLSelectElement;
  await f.React.act(async()=>{select.value='in-ear';select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(current.tech.monitors[1].kind,'in-ear');assert.equal(current.tech.monitors[2].kind,'wedge');
  assert.equal(current.sound,'live-rock');assert.equal(current.headroom,'extra');assert.equal(applied,null);assert.equal(current.tech.monitors[2].equipment,'Wedge B');
  const mixes=f.dom.window.document.querySelectorAll('.mixbars');assert.match(mixes[0].textContent,/-26 dB/);assert.match(mixes[1].textContent,/coupé/);
  const bus=f.dom.window.document.querySelector('.coach-musician select') as HTMLSelectElement;
  await f.React.act(async()=>{bus.value='3';bus.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(current.musicians[0].bus,3);assert.equal(current.tech.monitors[1],undefined);assert.equal(current.tech.monitors[3].kind,'in-ear');assert.equal(current.tech.monitors[2].equipment,'Wedge B');
 }finally{await f.close();}
});

test('Android support shows logs, exports them and installs only after explicit confirmation',async()=>{
 const f=await fixture();try{
  let confirms=0,installs=0,exports=0;
  f.dom.window.bandpilotSupport={status:async()=>({configured:false}),checkUpdate:async()=>({available:true,version:'2.4.0-android.2',phase:'ready',automaticEnabled:false,automatic:{}}),installUpdate:async()=>{installs++;return {permissionRequired:true};},exportLogs:async()=>{exports++;return {saved:true};},openUpdate:async()=>({})};
  f.dom.window.confirm=()=>++confirms>1;
  globalThis.fetch=async(path:any)=>new Response(JSON.stringify(path==='/api/auth'?{user:{role:'admin'}}:path==='/api/diagnostics/report'?{events:[{event:'android.engine_start'}]}:{version:'2.4.0-android.2'}));
  const {SupportCenter}=await import('../src/SupportCenter');await f.mount(<SupportCenter/>);
  assert.equal(installs,0);assert.doesNotMatch(f.dom.window.document.body.textContent,/installée automatiquement quand tu quitteras/);
  await f.click('Installer');assert.equal(installs,0);await f.click('Installer');assert.equal(installs,1);
  await f.click('Aide et incidents');assert.match(f.dom.window.document.body.textContent,/Autorise BandPilot/);
  await f.click('Afficher les logs');assert.match(f.dom.window.document.querySelector('pre').textContent,/android.engine_start/);
  await f.click('Exporter les logs');assert.equal(exports,1);assert.equal(installs,1);
 }finally{await f.close();}
});

test('guided soundcheck measures the selected input in read-only mode and never applies the gain',async()=>{
 const f=await fixture();
 try{
  const {SoundCoach}=await import('../src/SoundCoach');
  const profile={version:1,inputs:[{channel:3,source:'bass-di',name:'Basse'}],completed:[]};
  const requests:{path:string;body:any}[]=[];
  globalThis.fetch=async(path:any,init:any)=>{
   const body=JSON.parse(init?.body??'{}');requests.push({path,body});
   const data=path==='/api/coach'?{role:'admin',profile,steps:[{id:'levels',title:'3. Niveaux',text:''}],sources:[],templates:[],symptoms:[],drumKit:[]}:
    path==='/api/coach/calibration'?[]:path==='/api/coach/gain'?{report:{available:false,title:'Signal trop faible'},decision:null,proposal:null}:{};
   return new Response(JSON.stringify(data));
  };
  restoreBlank(f.dom,profile,'real');
  await f.mount(<SoundCoach status={{mode:'real',connected:true,writesEnabled:false}} online meters={{channels:[],available:false,updatedAt:null}} onConnect={()=>{}} onMonitors={()=>{}} onExpert={()=>{}}/>);
  assert.equal(requests.some(r=>r.path==='/api/coach/gain'),false);
  await f.click('Niveaux');await f.click('Mesurer (5 s)');
  assert.deepEqual(requests.filter(r=>r.path==='/api/coach/gain').map(r=>r.body),[{channel:3}]);
  assert.equal(requests.some(r=>r.path.endsWith('/apply')),false);
  assert.match(f.dom.window.document.querySelector('.gain-result').textContent,/Signal trop faible/);
 }finally{await f.close();}
});

test('a changed effect offers live readings and an explicit exit from the trial',async()=>{
 const f=await fixture(),originalConfirm=globalThis.confirm;
 try{
  const {VocalAmbience}=await import('../src/VocalAmbience');
  const conflict='L’ambiance utilisait Plate Reverb. La console utilise actuellement Room Reverb.';
  let session:any={slot:1,phase:'trial',sameConsole:true,choice:{channel:1,ambience:'rock',doses:{1:-18}}};
  const state=()=>({session,supported:true,voices:[{channel:1,name:'Micro 1',source:'lead-rock'}],monitors:[{bus:1,name:'Chant'}]});
  const calls:string[]=[];
  globalThis.fetch=async(path:any,init:any)=>{
   if(init?.method!=='POST')return Response.json(state());
   calls.push(path.split('/').at(-1));
   if(path.endsWith('/keep')){
    session={...session,conflict};
    return Response.json({code:'ambience-conflict',error:conflict,state:state()},{status:409});
   }
   if(path.endsWith('/read-doses'))return Response.json({...state(),readings:{1:-13}});
   assert.ok(path.endsWith('/archive'));assert.equal(JSON.parse(init.body).confirm,true);
   session=null;return Response.json(state());
  };
  await f.mount(<VocalAmbience canApply simulation={false}/>);
  await f.click('Garder cette ambiance');
  const doc=f.dom.window.document;
  assert.match(doc.body.textContent,/Plate Reverb.*Room Reverb/);
  assert.doesNotMatch(doc.body.textContent,/Garder cette ambiance|Revenir avant l’essai/);
  await f.click('Relire les dosages des musiciens');
  assert.match(doc.body.textContent,/Niveaux actuels du retour d’effet.*Chant · -13.0 dB/);
  globalThis.confirm=()=>false;await f.click('Terminer le suivi');
  assert.deepEqual(calls,['keep','read-doses']);
  globalThis.confirm=()=>true;await f.click('Terminer le suivi');
  assert.deepEqual(calls,['keep','read-doses','archive']);
  assert.equal(doc.querySelector('fieldset').disabled,false);
 }finally{if(originalConfirm)globalThis.confirm=originalConfirm;else delete(globalThis as any).confirm;await f.close();}
});

test('Concert resumes the exact encore, opens its attached PDF and starts a reordered set at its first song',async()=>{
 const f=await fixture();
 try{
  const {Concert}=await import('../src/show/Concert');
  const intro={id:'a',title:'Intro',artist:'',bpm:null,hasPdf:true};
  const final={id:'b',title:'Final',artist:'',bpm:null};
  const sheets:string[]=[],commands:string[]=[];
  globalThis.fetch=async(path,init)=>{
   if(init?.method==='POST')commands.push(String(path));
   return Response.json({bridge:'offline',tabs:[],transport:'idle'});
  };
  const render=(songs:typeof final[])=>f.mount(<Concert entries={songs.map((song,index)=>({song,index}))} onSetlist={()=>{}} onSheet={id=>sheets.push(id)}/>);
  const text=(selector:string)=>f.dom.window.document.querySelector(selector)?.textContent;
  await render([intro,final,intro]);
  await f.click('Commencer le concert');
  await f.click('Morceau suivant');
  assert.equal(text('.concert-cue h1'),'Final');
  await f.click('Morceau suivant');
  await f.click('Ouvrir la fiche PDF');
  assert.deepEqual(sheets,['a']);
  await f.mount(null);
  await render([intro,final,intro]);
  assert.match(text('.concert-cue small'),/3 \/ 3/);
  await f.click('Terminer le concert');
  await render([final,intro]);
  assert.equal(text('.concert-cue h1'),'Final');
  assert.match(text('.concert-cue small'),/sélectionné · 1 \/ 2/);
  assert.deepEqual(commands,[]);
 }finally{await f.close();}
});

test('fresh soundcheck and monitor choices request a scoped preview and wait for confirmation',async()=>{
 const f=await fixture();try{
  const {SoundCoach}=await import('../src/SoundCoach');
  const {SoundCoach:Engine}=await import('../../src/sound-coach');
  const {XR18}=await import('../../src/xr18'),{ConsoleControl}=await import('../../src/console-control'),{LibraryStore}=await import('../../src/library-store');
  const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false}),db=new LibraryStore(':memory:');
  const {EarsShare}=await import('../../src/ears');
  const phones=new EarsShare(':memory:',xr,()=>undefined,()=>null);
  try{
   const control=new ConsoleControl(xr,db),engine=new Engine(xr,control,db);
   const {blankSceneValues,BLANK_SCENE_TEXT}=await import('../../src/blank-scene');
   phones.create('Ancien',3);
   engine.saveProfile({version:1,completed:[],inputs:[{channel:1,source:'lead-rock',name:'Voix'},{channel:4,source:'bass-di',name:'Basse'}],musicians:[{bus:1,role:'chant',name:'Voix',channels:[1]}]});
   let writes=0;
   globalThis.fetch=async(path:any,init:any)=>{
    const data=JSON.parse(init?.body??'{}');let result:unknown={};
    if(path==='/api/console/blank')result={...await control.preview(Object.fromEntries(Object.entries(blankSceneValues()).filter(([a])=>xr.supports(a))),true),...BLANK_SCENE_TEXT,inputs:[]};
    if(path==='/api/coach')result={...engine.catalog(),role:'admin'};
    if(path==='/api/coach/profile')result=engine.saveProfile(data.profile);
    if(path==='/api/coach/prepare')result=await engine.prepare(data.channel,data.resetUnused);
    if(path==='/api/coach/ears')result=await engine.prepareEars(data.bus,data.resetUnused,phones);
    if(path==='/api/coach/ears/share'){engine.saveProfile(data.profile);result=(await phones.prepareRoster(engine.profile().musicians??[])).commit();}
    if(path==='/api/coach/apply'){writes++;result=await engine.apply(data.token,data.confirm);}
    return new Response(JSON.stringify(result));
   };
   const render=async(step:string)=>{
    await f.mount(<SoundCoach key={step} status={{mode:'simulation',connected:true,writesEnabled:false}} online meters={{channels:[],available:false,updatedAt:null}} onConnect={()=>{}} onMonitors={()=>{}} onExpert={()=>{}}/>);
   };
   await render('inputs');
   const previous=engine.profile();
   await f.click('Partir d’une scène vierge');assert.match(f.dom.window.document.querySelector('dialog').textContent,/48 V/);
   await f.click('Annuler, ne rien changer');assert.equal(writes,0);assert.deepEqual(engine.profile(),previous);
   await f.click('Partir d’une scène vierge');await f.click('Essayer en simulation');assert.equal(writes,1);
   assert.equal(f.dom.window.document.querySelectorAll('.coach-input2').length,0);
   assert.deepEqual(engine.profile(),previous);writes=0;
   await f.click('Reprendre les instruments de mon groupe enregistré');
   await f.click('Préparer le groupe et fermer les entrées inutilisées');
   assert.match(f.dom.window.document.querySelector('dialog').textContent,/Entrées ramenées au silence · 2, 3, 5/);
   await f.click('Annuler, ne rien changer');assert.equal(writes,0);
   await render('ears');await f.click('Retours');
   await f.click('Enregistrer les musiciens et leurs QR');assert.deepEqual(phones.list().map(s=>s.name),['Voix']);assert.equal(writes,0);
   const checkbox=f.dom.window.document.querySelector('.coach-section input[type=checkbox]');
   assert.equal(checkbox.checked,false);await f.React.act(async()=>checkbox.click());
   await f.click('Préparer les réglages');
   assert.match(f.dom.window.document.querySelector('dialog').textContent,/Bus des musiciens · 1/);
   assert.doesNotMatch(f.dom.window.document.querySelector('dialog').textContent,/Bus ramenés au silence/);
   assert.match(f.dom.window.document.querySelector('dialog').textContent,/Le QR de ce retour/);
   await f.click('Annuler, ne rien changer');await f.click('Appliquer les retours de tous (1)');
   assert.match(f.dom.window.document.querySelector('dialog').textContent,/Bus ramenés au silence · 2, 3, 4, 5, 6/);
   assert.match(f.dom.window.document.querySelector('dialog').textContent,/Les QR suivront la liste du groupe/);
   assert.equal(writes,0);await f.click('Essayer en simulation');assert.equal(writes,1);
  }finally{phones.close();xr.close();db.close();}
 }finally{await f.close();}
});

test('resuming a mixer shows all channels and sends before the optional gain test',async()=>{
 const f=await fixture();
 try{
  const {SoundCoach}=await import('../src/SoundCoach');
  const {STEPS,SOURCES,ROLES,MONITOR_RECIPES,OWN_LEVEL}=await import('../../src/sound-coach');
  const {MixerModelContext}=await import('../src/MixerModel');
  const {MIXER_MODELS}=await import('../../shared/mixer-models');
  for(const model of [MIXER_MODELS.XR18,MIXER_MODELS.MR12]){
   const calls:string[]=[],measured:number[]=[];
   const opened:(number|'aux')[]=[];
   const values={'/ch/01/config/name':'Accordéon','/ch/01/config/insrc':2,'/headamp/03/gain':.5,
    '/ch/01/preamp/rtnsw':0,'/ch/01/mix/02/level':.5,'/ch/01/mix/fader':0,'/ch/01/mix/on':0,
    '/ch/02/preamp/rtnsw':1,'/ch/02/config/rtnsrc':5,'/ch/02/preamp/rtntrim':.75,
    '/config/chlink/1-2':1,'/config/buslink/1-2':1,'/bus/2/config/name':'Casque','/rtn/aux/config/name':'Synthé'};
   const entry={kind:'scene',id:model.id,name:'Base',data:{version:2,model:model.id,values,fx:[]}};
   const group={version:1,inputs:[{channel:2,name:'Autre groupe',source:'keys'}],completed:[]};
   const catalog={role:'admin',profile:group,steps:STEPS,symptoms:[],sources:SOURCES,templates:[],presets:{},drumKit:[],roles:ROLES,recipes:MONITOR_RECIPES,ownLevel:OWN_LEVEL};
   globalThis.fetch=async(path:any,init:any)=>{
    calls.push(path);
    let result;
    if(path==='/api/coach/mixer-capture'||path==='/api/library/'+model.id)result=entry;
    else if(path==='/api/coach')result=catalog;
    else if(path==='/api/coach/calibration')result=[];
    else if(path==='/api/coach/gain'){const body=JSON.parse(init.body);assert.equal(body.fromMixer,true);measured.push(body.channel);result={report:{title:'Signal',message:'Signal'},decision:null,proposal:null};}
    else throw Error(path);
    return new Response(JSON.stringify(result));
   };
   const mount=async(key:string)=>f.mount(<MixerModelContext.Provider value={model}><SoundCoach key={key} status={{model:model.id,mode:'real',host:'127.0.0.1',port:10024,connected:true,writesEnabled:false}} online meters={{channels:[],available:false,updatedAt:null}} onConnect={()=>{}} onMonitors={()=>{}} onExpert={(n,_view,aux)=>opened.push(aux??n!)}/></MixerModelContext.Provider>);
   f.dom.window.localStorage.setItem('xr18-coach-step','levels');
   await mount(model.id);
   assert.ok(f.dom.window.document.querySelector('.coach-next .balance-mic'));
   assert.ok(f.dom.window.document.querySelector('.balance-start-options .balance-resume'));
   await f.click('Reprendre le mélangeur actuel');
   const doc=f.dom.window.document;
   assert.equal(doc.querySelectorAll('.balance-inputs tbody tr').length,model.channels+1);
   assert.equal(doc.querySelectorAll('.balance-sends thead th').length,model.buses+1);
   assert.match(doc.querySelector('.balance-inputs [data-strip=ch1]').textContent,/Accordéon.*Stéréo 1–2.*Prise 3.*\+24\.0 dB.*-∞ dB.*Coupé/);
   assert.match(doc.querySelector('.balance-sends [data-strip=ch1] td:nth-child(3)').textContent,/-10\.0 dB/);
   assert.match(doc.querySelector('.balance-sends thead').textContent,/Casque/);
   assert.match(doc.querySelector('.balance-inputs [data-strip=aux]').textContent,/Synthé/);
   assert.match(doc.querySelector('.balance-inputs [data-strip=ch3]').textContent,/—/);
   if(model.usbChannels)assert.match(doc.querySelector('.balance-inputs [data-strip=ch2]').textContent,/USB 6.*\+9\.0 dB.*Trim USB/);
   else assert.match(doc.querySelector('.balance-sends thead').textContent,/Bus interne/);
   assert.doesNotMatch(doc.body.textContent,/Mesurer le gain|Profil précédent/);
   const rows=(strip:string)=>doc.querySelector('.balance-inputs [data-strip='+strip+']');
   const actClick=(el:HTMLElement)=>f.React.act(async()=>el.click());
   const next=()=>Array.from(doc.querySelectorAll('button')).find((b:any)=>b.textContent==='Continuer avec la sélection') as HTMLButtonElement;
   assert.ok(next().disabled);
   await f.click('Cocher les entrées nommées (2)');
   assert.deepEqual(Array.from(doc.querySelectorAll('.balance-pick input:checked'),(el:any)=>el.closest('tr').dataset.strip),['ch1','aux']);
   await f.click('Tout cocher');assert.equal(doc.querySelectorAll('.balance-pick input:checked').length,model.channels+1);
   await f.click('Tout décocher');assert.ok(next().disabled);
   await actClick(rows('ch1').querySelector('label'));
   await actClick(rows('ch3').querySelector('td'));
   await actClick(rows('aux').querySelector('input'));
   await actClick(rows('ch2').querySelector('.balance-inspect'));
   assert.deepEqual(opened,[2]);assert.equal(doc.querySelectorAll('.balance-pick input:checked').length,3);
   await mount(model.id+'-again');
   assert.ok(doc.querySelector('.coach-next .balance-mic'));await f.click('Instruments');
   assert.equal(doc.querySelectorAll('.balance-pick input:checked').length,3);
   await f.click('Continuer avec la sélection');
   assert.equal(doc.querySelector('.balance-track [aria-current=step]').textContent,'Niveaux');
   const selector=()=>doc.querySelector('.gain-picker select');
   const change=async(value:string)=>f.React.act(async()=>{const el=selector();el.value=value;el.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
   assert.deepEqual(Array.from(selector().options,(o:any)=>o.value),['1','3','0']);
   assert.match(doc.querySelector('.gain-card').textContent,/Gain au départ de la balance.*24/);
   await change('0');assert.doesNotMatch(doc.querySelector('.gain-step').textContent,/Mesurer \(5 s\)/);
   await f.click('Ouvrir la tranche');assert.deepEqual(opened,[2,'aux']);
   await f.click('Continuer · Écoute');assert.equal(doc.querySelector('.balance-track [aria-current=step]').textContent,'Écoute');
   assert.deepEqual(Array.from(doc.querySelector('.coach-channel select').options,(o:any)=>o.value),['1','3','0']);
   await f.click('Continuer · Retours');assert.equal(doc.querySelector('.balance-track [aria-current=step]').textContent,'Retours');
   assert.deepEqual(Array.from(doc.querySelectorAll('.balance-sends tr[data-strip]'),(tr:any)=>tr.dataset.strip),['ch1','ch3','aux']);
   await f.click('Ajouter un musicien');
   const card=()=>doc.querySelector('.coach-musician');
   await actClick(card().querySelector('.own button'));
   const choose=async(index:number,value:string)=>f.React.act(async()=>{
    const select=card().querySelectorAll('select')[index];select.value=value;select.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));
   });
   await choose(1,'guitare');await choose(2,'wedge');
   assert.deepEqual(Array.from(card().querySelectorAll('.own button'),(b:any)=>b.textContent),['Accordéon','Entrée 3','Synthé']);
   await mount(model.id+'-returns');await f.click('Retours');
   assert.equal(card().querySelectorAll('select')[2].value,'wedge');
   assert.equal(card().querySelector('.own .on').textContent,'Accordéon');
   assert.match(card().querySelector('.mixbars').textContent,/Accordéon-3 dB/);
   assert.doesNotMatch(card().textContent,/Autre groupe/);
   await f.click('Continuer · Sauvegarde');assert.equal(doc.querySelector('.balance-track [aria-current=step]').textContent,'Sauvegarde');
   assert.deepEqual([...new Set(calls)].sort(),['/api/coach','/api/coach/mixer-capture','/api/library/'+model.id].sort());
   await f.click('Niveaux');await change('3');await f.click('Mesurer (5 s)');assert.deepEqual(measured,[3]);
   await f.click('Vue d’ensemble');await f.click('Continuer ma balance');
   assert.equal(doc.querySelector('.balance-track [aria-current=step]').textContent,'Niveaux');

  }
 }finally{await f.close();}
});
