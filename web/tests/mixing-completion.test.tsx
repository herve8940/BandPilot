import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {BATCH_SETTINGS} from '../../shared/batch-edit';
import {MIXER_MODELS} from '../../shared/mixer-models';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),saved=new Map();
 for(const [k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,confirm:()=>true,fetch:async()=>new Response('{}')})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});}
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const React=await import('react');saved.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{configurable:true,value:React});const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const render=async(el:React.ReactNode)=>React.act(async()=>{root.render(el);await new Promise(r=>setTimeout(r,0));});
 const click=async(label:string)=>React.act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label)! as HTMLButtonElement;assert.ok(b,label);assert.ok(!b.disabled,label);b.click();await new Promise(r=>setTimeout(r,0));});
 const change=async(selector:string,value:string)=>React.act(async()=>{const el=document.querySelector(selector) as HTMLInputElement;assert.ok(el,selector);Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new dom.window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));await new Promise(r=>setTimeout(r,0));});
 return {React,dom,render,click,change,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
test('links follow direct controls across remounted views, keep saved definitions inactive and stop on connection reset',async()=>{
 const f=await fixture();const savedWS=Object.getOwnPropertyDescriptor(globalThis,'WebSocket'),savedLocation=Object.getOwnPropertyDescriptor(globalThis,'location');try{
  const sockets:any[]=[],writes:any[]=[],requests:any[]=[];
  class Socket{static OPEN=1;readyState=1;onopen?:()=>void;onmessage?:(e:any)=>void;onclose?:()=>void;constructor(){sockets.push(this);queueMicrotask(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify({type:'snapshot',parameters:{'/ch/01/preamp/hpon':{value:0}}})});});}send(s:string){const m=JSON.parse(s);if(m.type==='set')writes.push(m);}close(){this.onclose?.();}}
  Object.defineProperty(globalThis,'WebSocket',{configurable:true,writable:true,value:Socket});Object.defineProperty(globalThis,'location',{configurable:true,value:f.dom.window.location});
  globalThis.fetch=async(path,init)=>{const p=String(path),d=init?.body?JSON.parse(String(init.body)):undefined;requests.push([p,d]);return new Response(JSON.stringify(p==='/api/auth'?{user:{role:'admin'}}:p==='/api/library/parameter-links'?{model:'XR18',revision:1,links:[{channels:[1,3],setting:'hpon',band:1}]}:p.endsWith('/start')?{token:'owner',sequence:0}:p.endsWith('/move')?{sequence:d.sequence}:{}));};
  const {ParameterLinksProvider,ParameterLinksBar}=await import('../src/expert/parameter-links'),{useLiveMixer}=await import('../src/xair/controls');
  function Control(){const live=useLiveMixer();return <button onClick={()=>live.set('/ch/01/preamp/hpon',1)}>Change HPF</button>;}
  const mount=(page:string,writable=true)=>f.render(<ParameterLinksProvider model={MIXER_MODELS.XR18} canWrite={writable}><ParameterLinksBar canWrite={writable} mode="simulation"/><Control key={page}/></ParameterLinksProvider>);
  await mount('console');assert.ok(!requests.some(r=>r[0].endsWith('/start')));
  await f.click('Change HPF');assert.equal(writes.length,1);
  await f.click('Activer les liens de pistes');await f.click('Change HPF');assert.equal(writes.length,1);assert.equal(requests.filter(r=>r[0].endsWith('/move')).length,1);
  await mount('surface');await f.click('Change HPF');assert.equal(requests.filter(r=>r[0].endsWith('/move')).length,2);assert.equal(writes.length,1);
  await f.React.act(async()=>sockets.at(-1).onmessage({data:JSON.stringify({type:'snapshot',parameters:{}})}));
  assert.equal(requests.at(-1)[0],'/api/library/parameter-links/stop');await f.click('Change HPF');assert.equal(writes.length,2);
  await f.click('Activer les liens de pistes');await mount('surface',false);assert.equal(requests.at(-1)[0],'/api/library/parameter-links/stop');
 }finally{await f.close();for(const [key,desc] of [['WebSocket',savedWS],['location',savedLocation]] as const){if(desc)Object.defineProperty(globalThis,key,desc);else delete (globalThis as any)[key];}}
});
test('old browser links import explicitly without activation, late arming after navigation/read-only is released',async()=>{
 const f=await fixture();try{
  localStorage.setItem('bandpilot-parameter-links:MR12',JSON.stringify([{channels:[1,2],setting:'eq',band:1}]));
  const requests:any[]=[];let release:((r:Response)=>void)|undefined;
  globalThis.fetch=async(path,init)=>{const p=String(path),d=init?.body?JSON.parse(String(init.body)):undefined;requests.push([p,d]);if(p.endsWith('/start'))return new Promise(r=>release=r);return new Response(JSON.stringify(p==='/api/auth'?{user:{role:'admin'}}:p==='/api/library/parameter-links'?{model:'MR12',revision:d?1:0,links:d?.links??[]}:{}));};
  const {ParameterLinksProvider,ParameterLinksBar}=await import('../src/expert/parameter-links');
  const mount=(writable=true)=>f.render(<ParameterLinksProvider model={MIXER_MODELS.MR12} canWrite={writable}><ParameterLinksBar canWrite={writable} mode="simulation"/></ParameterLinksProvider>);
  await mount();assert.ok(!requests.some(r=>r[1]));await f.click('Importer les liens de ce navigateur');assert.deepEqual(requests.at(-1)[1].links,[{channels:[1,2],setting:'eq',band:1}]);assert.ok(!requests.some(r=>r[0].endsWith('/move')));
  await f.click('Activer les liens de pistes');await mount(false);await f.React.act(async()=>{release!(new Response(JSON.stringify({token:'late',sequence:0})));await new Promise(r=>setTimeout(r,0));});assert.deepEqual(requests.at(-1),['/api/library/parameter-links/stop',{token:'late'}]);
  assert.ok(localStorage.getItem('bandpilot-parameter-links:MR12'));
 }finally{await f.close();}
});
test('surface files preserve older widgets, new group/parameter controls and model boundaries',async()=>{
 const {surfaceFile,parseSurfaceFile,validateSurfaces}=await import('../../shared/expert-surfaces');
 const base={id:'one',label:'',channel:1,bus:1,x:0,y:0,width:4,height:3};
 const data={model:'MR12',revision:2,surfaces:[{id:'test',name:'Practice',widgets:[{...base,kind:'fader' as const},{...base,id:'group',kind:'group' as const,x:4,members:[1,2],mix:2},{...base,id:'eq',kind:'parameter' as const,x:8,setting:'eqGain' as const,band:2}]}]};
 assert.deepEqual(parseSurfaceFile(JSON.stringify(surfaceFile(data as any)),'MR12'),validateSurfaces(data).surfaces);
 assert.throws(()=>parseSurfaceFile(JSON.stringify(surfaceFile(data as any)),'XR18'));
 assert.throws(()=>validateSurfaces({...data,surfaces:[{...data.surfaces[0],widgets:[{...base,kind:'group',members:[1,13],mix:2}]}]}));
 assert.throws(()=>validateSurfaces({...data,surfaces:[{...data.surfaces[0],widgets:[{...base,kind:'parameter',setting:'phantom',band:1}]}]}));
});
test('surface group widgets stay inactive on load and parameter edits use the selected band only',async()=>{
 const f=await fixture();try{
  const {SurfaceEditor}=await import('../src/expert/SurfaceEditor'),{MixerModelContext}=await import('../src/MixerModel');const writes:any[]=[],requests:any[]=[];
  const widget={label:'',channel:1,bus:1,y:0,width:4,height:4};
  globalThis.fetch=async(path,init)=>{requests.push([path,init?.body]);return new Response(JSON.stringify({model:'MR12',revision:1,surfaces:[{id:'test',name:'Group surface',widgets:[{...widget,id:'main',kind:'group',x:0,members:[1,2],mix:0},{...widget,id:'monitor',kind:'group',x:4,members:[1,2],mix:2},{...widget,id:'eq',kind:'parameter',x:8,setting:'eqGain',band:3}]}]}));};
  await f.render(<MixerModelContext.Provider value={MIXER_MODELS.MR12}><SurfaceEditor values={{'/ch/01/eq/3/g':.5}} set={(a,v)=>writes.push([a,v])} canWrite rehearsal={false} mode="simulation" openChannel={()=>{}}/></MixerModelContext.Provider>);
  assert.equal(document.querySelectorAll('.bank-group-fader button').length,2);assert.ok(requests.every(r=>r[1]===undefined));
  await f.change('.surface-widget input[type=range]','3');assert.deepEqual(writes,[['/ch/01/eq/3/g',.6]]);
 }finally{await f.close();}
});
test('all mixing completion labels have translations in the four additional languages',()=>{
 const files=['expert/parameter-links.tsx','expert/SurfaceEditor.tsx','expert/MixPreparation.tsx','expert/BatchEdit.tsx','PortableScenesPanel.tsx','expert/GainFaders.tsx','expert/SurfaceCommand.tsx'];
 const keys=files.flatMap(file=>[...readFileSync(new URL('../src/'+file,import.meta.url),'utf8').matchAll(/tx\('([^']+)'\)/g)].map(m=>m[1]!));
 keys.push(...Object.values(BATCH_SETTINGS).map(d=>d.label),'Commande favorite','Gains / trims','Gains / trims actifs : le niveau à la source change aussi dans les retours et l’enregistrement. Les sorties et les groupes gardent leurs faders de volume.');
 for(const lang of ['en','it','es','de']){const catalog=JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`,import.meta.url),'utf8'));for(const key of keys)assert.ok(catalog[key],`${lang}: ${key}`);}
});


test('a guest never loads, imports or activates administrator links',async()=>{
 const f=await fixture();try{
  const requests:string[]=[];localStorage.setItem('bandpilot-parameter-links:XR18',JSON.stringify([{channels:[1,2],setting:'eq',band:1}]));
  globalThis.fetch=async path=>{requests.push(String(path));return new Response(JSON.stringify({user:{role:'guest'}}));};
  const {ParameterLinksProvider,ParameterLinksBar}=await import('../src/expert/parameter-links');
  await f.render(<ParameterLinksProvider model={MIXER_MODELS.XR18} canWrite><ParameterLinksBar canWrite mode="simulation"/></ParameterLinksProvider>);
  assert.deepEqual(requests,['/api/auth']);assert.equal(document.querySelector('.parameter-links-switch'),null);
 }finally{await f.close();}
});
test('reloading a saved surface with the same widget IDs disarms its running groups',async()=>{
 const f=await fixture();try{
  const {SurfaceEditor}=await import('../src/expert/SurfaceEditor'),{MixerModelContext}=await import('../src/MixerModel');const requests:any[]=[];let revision=1;
  const surface={id:'test',name:'Group surface',widgets:[{id:'group',kind:'group',label:'',channel:1,bus:1,x:0,y:0,width:4,height:4,members:[1,2],mix:0}]};
  globalThis.fetch=async(path,init)=>{const p=String(path),data=init?.body?JSON.parse(String(init.body)):undefined;requests.push([p,data]);return new Response(JSON.stringify(p.startsWith('/api/expert-surfaces')?{model:'MR12',revision,surfaces:[surface]}:p.endsWith('/start')?{token:'old-surface',sequence:0}:{}));};
  await f.render(<MixerModelContext.Provider value={MIXER_MODELS.MR12}><SurfaceEditor values={{}} set={()=>{}} canWrite rehearsal={false} mode="simulation" openChannel={()=>{}}/></MixerModelContext.Provider>);
  await f.click('Activer le fader continu');assert.ok(document.querySelector('.bank-group-fader input[type=range]'));
  revision++;await f.click('Recharger');assert.equal(document.querySelector('.bank-group-fader input[type=range]'),null);assert.deepEqual(requests.at(-1),['/api/library/live-group/stop',{token:'old-surface'}]);
 }finally{await f.close();}
});
test('a custom room target is previewed explicitly and the estimate clears when the preference changes',async()=>{
 const f=await fixture();try{
  const {RoomEqPanel}=await import('../src/expert/MixPreparation');const requests:any[]=[];
  globalThis.fetch=async(path,init)=>{requests.push([String(path),JSON.parse(String(init?.body))]);return new Response(JSON.stringify({token:null,changes:[],roomEstimate:[{hz:1000,measured:4,target:0,estimated:1}]}));};
  await f.render(<RoomEqPanel model="MR12" canWrite outputs={2} mode="simulation"/>);
  await f.change('fieldset.preparation-fields select','custom');
  await f.change('fieldset.preparation-fields label:nth-of-type(2) select','3');
  await f.change('fieldset.preparation-fields label:nth-of-type(3) select','-2');
  const curve=[40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500].map(hz=>hz+' 0').join('\n');
  await f.React.act(async()=>{const input=document.querySelector('input[type=file]')!;Object.defineProperty(input,'files',{configurable:true,value:[{size:curve.length,text:async()=>curve}]});input.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));});
  assert.equal(requests.length,0);await f.click('Prévisualiser la sélection');
  assert.deepEqual(requests[0][1].targetCurve,{lowDb:3,highDb:-2});assert.ok(document.querySelector('.room-estimate svg'));
  await f.change('fieldset.preparation-fields label:nth-of-type(2) select','2');assert.equal(document.querySelector('.room-estimate'),null);assert.equal(requests.length,1);
 }finally{await f.close();}
});

test('gain faders require known routing and explicit arming, reset after routing, connection and permission changes',async()=>{
 const f=await fixture();try{
  const {knownGain,GainFader,useGainFaders}=await import('../src/expert/GainFaders'),{INPUTS}=await import('../src/xair/strips');
  const strip=INPUTS[0]!,writes:any[]=[];
  const values={'/ch/01/config/insrc':2,'/ch/01/preamp/rtnsw':0,'/headamp/03/gain':.5};
  assert.equal(knownGain(strip,{},MIXER_MODELS.XR18),null);assert.equal(knownGain(strip,{'/headamp/01/gain':.5},MIXER_MODELS.XR18),null);
  assert.equal(knownGain(strip,{...values,'/ch/01/config/insrc':8},MIXER_MODELS.MR12),null);
  assert.equal(knownGain(strip,{...values,'/ch/01/preamp/rtnsw':1,'/ch/01/preamp/rtntrim':.5},MIXER_MODELS.MR12),null);
  assert.equal(knownGain(strip,{...values,'/headamp/03/gain':NaN},MIXER_MODELS.XR18),null);
  function Harness({v=values,writable=true,scope='main'}:{v?:Record<string,number>;writable?:boolean;scope?:string}){const g=useGainFaders(MIXER_MODELS.XR18,v,writable,scope);return <><button aria-pressed={g.active} onClick={g.toggle}>Gains</button>{g.active&&<GainFader strip={strip} values={v} model={MIXER_MODELS.XR18} set={(a,v)=>writes.push([a,v])} disabled={!writable}/>}</>;}
  await f.render(<Harness/>);assert.equal(document.querySelector('.gain-fader [role=slider]'),null);assert.deepEqual(writes,[]);
  await f.click('Gains');assert.deepEqual(writes,[]);assert.equal(document.querySelector('.gain-fader [role=slider]')?.getAttribute('aria-valuetext'),'24.0 dB');
  await f.React.act(async()=>document.querySelector('.gain-fader [role=slider]')!.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})));assert.deepEqual(writes,[['/headamp/03/gain',36.5/72]]);
  await f.render(<Harness v={{...values,'/ch/01/config/insrc':1}}/>);assert.equal(document.querySelector('.gain-fader [role=slider]'),null);
  await f.click('Gains');await f.React.act(async()=>window.dispatchEvent(new f.dom.window.Event('bandpilot-console-reset')));assert.equal(document.querySelector('.gain-fader [role=slider]'),null);
  await f.click('Gains');await f.render(<Harness writable={false}/>);assert.equal(document.querySelector('.gain-fader [role=slider]'),null);
  await f.render(<Harness/>);assert.equal(document.querySelector('.gain-fader [role=slider]'),null);
  await f.click('Gains');await f.render(<Harness scope="bus2"/>);assert.equal(document.querySelector('.gain-fader [role=slider]'),null);
  assert.equal(writes.length,1);
 }finally{await f.close();}
});
test('surface output targets and favorite commands round trip with version 2 while legacy surfaces keep version 1',async()=>{
 const {surfaceFile,parseSurfaceFile,validateSurfaces}=await import('../../shared/expert-surfaces');
 const base={id:'bus',label:'',channel:1,bus:1,x:0,y:0,width:4,height:3,kind:'fader' as const};
 const data={model:'MR12',revision:0,surfaces:[{id:'test',name:'Outputs',widgets:[base]}]};assert.equal(surfaceFile(data).version,1);
 const widgets=[{...base,strip:'bus2'},{...base,id:'dca',x:4,strip:'dca1'},{...base,id:'command',x:8,kind:'command' as const,commandId:'saved-command'}];
 const extended={...data,surfaces:[{...data.surfaces[0]!,widgets}]};assert.equal(surfaceFile(extended).version,2);assert.deepEqual(parseSurfaceFile(JSON.stringify(surfaceFile(extended)),'MR12'),validateSurfaces(extended).surfaces);
 for(const widget of [{...base,strip:'ch13'},{...base,strip:'unknown'},{...base,kind:'send',strip:'lr'},{...base,kind:'command',commandId:'../missing'}])assert.throws(()=>validateSurfaces({...data,surfaces:[{...data.surfaces[0],widgets:[widget]}]}));
});
test('surface commands remain inert until a preview is confirmed and missing local commands are disabled',async()=>{
 const f=await fixture();try{
  const {SurfaceCommand}=await import('../src/expert/SurfaceCommand');const requests:any[]=[];
  const entry={id:'saved',kind:'console-command',name:'Test command',data:{version:1,model:'XR18',steps:[{channel:1,target:'mute',value:0}]}} as any;
  globalThis.fetch=async(path,init)=>{const p=String(path);requests.push([p,init?.body?JSON.parse(String(init.body)):undefined]);return new Response(JSON.stringify(p.endsWith('/preview')?{token:'preview',changes:[{address:'/ch/01/mix/on',before:1,after:0}]}:{backupId:'undo'}));};
  await f.render(<SurfaceCommand entry={entry} canWrite mode="simulation"/>);assert.deepEqual(requests,[]);
  await f.click('Prévisualiser les changements');assert.equal(requests.length,1);assert.ok(document.querySelector('.coach-dialog'));
  await f.click('Annuler, ne rien changer');assert.equal(requests.length,1);
  await f.click('Prévisualiser les changements');await f.click('Essayer en simulation');assert.deepEqual(requests.at(-1),['/api/library/commands/saved/apply',{token:'preview',confirm:true}]);
  assert.ok(document.body.textContent?.includes('Annuler'));
  await f.render(<SurfaceCommand entry={undefined} canWrite mode="simulation"/>);assert.ok((document.querySelector('button') as HTMLButtonElement).disabled);assert.equal(requests.length,3);
 }finally{await f.close();}
});
test('gain compensation preview names every affected channel and shared-source preference alone sends nothing',async()=>{
 const f=await fixture();try{
  const {GainCompensationPanel}=await import('../src/expert/MixPreparation');const requests:any[]=[];
  globalThis.fetch=async(path,init)=>{requests.push([String(path),JSON.parse(String(init?.body))]);return new Response(JSON.stringify({token:'gain',changes:[{address:'/headamp/01/gain',before:20,after:18}],affectedChannels:[1,3]}));};
  await f.render(<GainCompensationPanel model="XR18" channel={1} canWrite mode="simulation"/>);
  await f.React.act(async()=>{(document.querySelector('input[type=checkbox]') as HTMLInputElement).click();});assert.deepEqual(requests,[]);
  await f.click('Prévisualiser la sélection');assert.equal(requests[0][1].includeShared,true);assert.ok(document.querySelector('.coach-dialog')?.textContent?.includes('Canal 1, Canal 3'));
 }finally{await f.close();}
});

test('surface bus and DCA controls address their selected output and never fall back to an input',async()=>{
 const f=await fixture();try{
  const {SurfaceEditor}=await import('../src/expert/SurfaceEditor'),writes:any[]=[],requests:any[]=[];
  const base={label:'',channel:1,bus:1,y:0,width:4,height:3};
  globalThis.fetch=async(path,init)=>{requests.push([path,init?.body]);return new Response(JSON.stringify({model:'XR18',revision:1,surfaces:[{id:'test',name:'Outputs',widgets:[{...base,id:'bus',kind:'fader',strip:'bus2',x:0},{...base,id:'dca',kind:'mute',strip:'dca1',x:4}]}]}));};
  await f.render(<SurfaceEditor values={{'/bus/2/mix/fader':.5,'/dca/1/on':1,'/ch/01/mix/fader':.75}} set={(a,v)=>writes.push([a,v])} canWrite rehearsal={false} mode="simulation" openChannel={()=>{}}/>);
  assert.deepEqual(writes,[]);assert.equal(requests.length,1);
  await f.click('Mute · DCA 1');assert.deepEqual(writes,[['/dca/1/on',0]]);
  assert.ok(document.querySelector('.surface-widget:first-child')?.textContent?.includes('Bus 2'));
 }finally{await f.close();}
});

test('studio faders retain volume precision and reset, gain reset can be disabled, and read-only stops an active drag',async()=>{
 const f=await fixture();try{
  const {Fader}=await import('../src/xair/controls');const writes:number[]=[];
  const render=(disabled=false,reset:number|null=.75)=>f.render(<Fader value={.5} label="Test volume" disabled={disabled} reset={reset} onChange={v=>writes.push(v)}/>);
  await render();assert.deepEqual(writes,[]);assert.equal(document.querySelector('[role=slider]')?.getAttribute('aria-valuetext'),'-10.0 dB');
  const keyboard=async(shiftKey:boolean)=>f.React.act(async()=>document.querySelector('[role=slider]')!.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowUp',shiftKey,bubbles:true})));
  await keyboard(false);await keyboard(true);assert.deepEqual(writes,[.51,.502]);
  const double=async()=>f.React.act(async()=>document.querySelector('[role=slider]')!.dispatchEvent(new f.dom.window.MouseEvent('dblclick',{bubbles:true})));
  await double();assert.equal(writes.at(-1),.75);await render(false,null);await double();assert.equal(writes.length,3);
  const track=document.querySelector('.xm-fader-track') as HTMLElement;track.setPointerCapture=()=>{};track.getBoundingClientRect=()=>({top:0,bottom:100,height:100,left:0,right:30,width:30,x:0,y:0,toJSON:()=>({})});Object.defineProperty(track,'clientHeight',{value:100});
  const pointer=async(type:string,y:number)=>f.React.act(async()=>track.dispatchEvent(new f.dom.window.MouseEvent(type,{clientY:y,bubbles:true})));
  await pointer('pointerdown',50);assert.equal(writes.length,3);await pointer('pointermove',40);assert.equal(writes.at(-1),.6);
  await render(true,null);await pointer('pointermove',30);await keyboard(false);await double();assert.equal(writes.length,4);
 }finally{await f.close();}
});
