import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {defaultFxParameters,FX_SCHEMAS} from '../../shared/fx-parameters';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),originals=new Map(),calls:{path:string;body:any}[]=[];
 const state={admin:true,failure:'',fx:{slot:1,algorithm:10,parameters:defaultFxParameters(10)}};
 const sockets:any[]=[];
 class Socket{static OPEN=1;readyState=1;onmessage:any;onclose:any;onopen:any;constructor(){sockets.push(this);}send(){}close(){this.onclose?.();}}
 const install=(key:string,value:unknown)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
 for(const[k,v]of Object.entries({window:dom.window,location:dom.window.location,WebSocket:Socket,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,confirm:()=>true}))install(k,v);
 install('fetch',async(path:string,options?:RequestInit)=>{const body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({path,body});if(state.failure===path)return new Response(JSON.stringify({error:'Échec simulé'}),{status:500});let result:any={};
  if(path==='/api/auth')result={user:{role:state.admin?'admin':'guest'}};
  else if(path.startsWith('/api/console/fx'))result=state.fx;
  else if(path.endsWith('/preview'))result={token:'test-token',before:state.fx,desired:body.data??state.fx};
  else if(path.endsWith('/apply'))result={ok:true,backupId:'backup'};
  return new Response(JSON.stringify(result));
 });
 const React=await import('react');install('React',React);const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
 const render=async(el:React.ReactNode)=>React.act(async()=>{root.render(el);await new Promise(r=>setTimeout(r,0));});
 const click=async(label:string)=>React.act(async()=>{const button=[...dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent===label) as HTMLButtonElement;assert.ok(button,label);assert.equal(button.disabled,false);button.click();await new Promise(r=>setTimeout(r,0));});
 const change=async(selector:string,value:string)=>React.act(async()=>{const e=dom.window.document.querySelector(selector) as any;assert.ok(e,selector);Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype,'value')!.set!.call(e,value);e.dispatchEvent(new dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));});
 return {state,calls,sockets,dom,React,render,click,change,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete(globalThis as any)[k];}}};
}
test('FX editor uses units, prepares tempo without writes, previews, explicitly applies and offers undo',async()=>{
 const f=await fixture();try{const {FxConsole}=await import('../src/FxConsole');await f.render(<FxConsole/>);await f.click('Lire le slot');
  assert.match(f.dom.window.document.body.textContent,/Durée du délai/);
  await f.change('.fx-tempo input','120');await f.change('.fx-tempo select','0.75');await f.click('Préparer cette durée');
  const delay=f.dom.window.document.querySelectorAll('.parameter-card input')[1] as HTMLInputElement;assert.equal(Number(delay.value),375);
  assert.ok(!f.calls.some(c=>c.body),'editing and tap preparation send nothing');
  await f.click('Prévisualiser les changements');const preview=f.calls.at(-1)!;assert.deepEqual(preview.body.expected,f.state.fx);assert.equal(preview.body.data.parameters[1].value,(375-1)/2999);assert.ok(!f.calls.some(c=>c.path.endsWith('/apply')));
  await f.click('Confirmer et appliquer');assert.deepEqual(f.calls.find(c=>c.path.endsWith('/apply'))?.body,{token:'test-token',confirm:true});
  await f.click('Préparer l’annulation');assert.equal(f.calls.at(-1)?.path,'/api/library/backup/preview');
  await f.change('select','2');assert.equal(f.dom.window.document.querySelector('[aria-label="Prévisualisation FX"]'),null);
 }finally{await f.close();}
});
test('non-admin FX access is read-only and every decoded label is present in four translation catalogs',async()=>{
 const f=await fixture();try{f.state.admin=false;const {FxConsole}=await import('../src/FxConsole');await f.render(<FxConsole/>);await f.click('Lire le slot');assert.equal(f.dom.window.document.querySelectorAll('.parameter-card input:not([disabled])').length,0);assert.ok(!f.dom.window.document.body.textContent.includes('Confirmer et appliquer'));
  for(const lang of ['en','it','es','de']){const catalog=(await import(`../src/i18n/${lang}.json`)).default;for(const s of Object.values(FX_SCHEMAS))for(const p of s.parameters)assert.ok(catalog[p.label],`${lang}: ${p.label}`);for(const key of ['Banques personnalisées','Retour stéréo','Garder comme référence','Préparer cette durée','Copier un mix vers ce retour'])assert.ok(catalog[key],`${lang}: ${key}`);}
 }finally{await f.close();}
});


test('FX save validates the name, stores the edited draft without audio writes, and reports errors honestly',async()=>{
 const f=await fixture();try{
  const {FxConsole}=await import('../src/FxConsole');await f.render(<FxConsole/>);await f.click('Lire le slot');
  const button=()=>[...f.dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Enregistrer ce preset') as HTMLButtonElement;
  await f.change('.fx-preset-save input','   ');assert.equal(button().disabled,true);assert.match(f.dom.window.document.body.textContent,/Donne un nom/);
  assert.equal(f.dom.window.document.querySelector('.fx-preset-save input').maxLength,120);
  await f.change('.fx-preset-save input','  Mon délai  ');
  await f.change('.parameter-card:nth-child(2) input','375');
  f.state.failure='/api/library';await f.click('Enregistrer ce preset');
  assert.equal(f.dom.window.document.querySelector('[role=alert]')?.textContent,'Échec simulé');
  assert.equal(f.dom.window.document.querySelector('.fx-feedback.success'),null);
  assert.equal(f.dom.window.document.querySelector('.fx-preset-save input').value,'  Mon délai  ','a failed save keeps the draft');
  f.state.failure='';await f.click('Enregistrer ce preset');
  const saved=f.calls.filter(c=>c.path==='/api/library').at(-1)!.body;
  assert.equal(saved.name,'Mon délai');assert.equal(saved.data.parameters[1].value,(375-1)/2999);
  assert.equal(f.dom.window.document.querySelector('[role=alert]'),null);
  assert.match(f.dom.window.document.querySelector('.fx-feedback.success')!.textContent,/Preset enregistré/);
  assert.ok(!f.calls.some(c=>c.path.endsWith('/apply')||c.path.endsWith('/preview')));
  await f.change('select','2');assert.equal(f.dom.window.document.querySelector('.fx-feedback'),null);
 }finally{await f.close();}
});

test('FX advanced fields block fractional integers, out-of-range and empty values before saving',async()=>{
 const f=await fixture();try{
  f.state.fx={slot:1,algorithm:18,parameters:[{type:'i',value:1},{type:'f',value:.3}]};
  const {FxConsole}=await import('../src/FxConsole');await f.render(<FxConsole/>);await f.click('Lire le slot');
  const save=()=>[...f.dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Enregistrer ce preset') as HTMLButtonElement;
  const preview=()=>[...f.dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Prévisualiser les changements') as HTMLButtonElement;
  assert.equal(f.dom.window.document.querySelector('.parameter-card input').step,'1');
  for(const value of ['0.5','128','-1','']){
   await f.change('.parameter-card:first-child input',value);assert.equal(save().disabled,true);assert.equal(preview().disabled,true);
   assert.equal(f.dom.window.document.querySelector('.parameter-card input').getAttribute('aria-invalid'),'true');
  }
  assert.ok(!f.calls.some(c=>c.body));
  await f.change('.parameter-card:first-child input','2');
  await f.change('.parameter-card:nth-child(2) input','1.1');assert.equal(save().disabled,true);
  await f.change('.parameter-card:nth-child(2) input','0.7');await f.click('Enregistrer ce preset');
  assert.deepEqual(f.calls.at(-1)!.body.data.parameters,[{type:'i',value:2},{type:'f',value:.7}]);
  await f.change('.parameter-card:first-child input','');await f.click('Lire le slot');
  assert.equal(save().disabled,false);assert.equal(f.dom.window.document.querySelector('.fx-field-error'),null);
 }finally{await f.close();}
});

test('confirmed mixer changes distinguish successful backups from HTTP and live errors',async()=>{
 const f=await fixture();try{
  const {useLiveMixer}=await import('../src/xair/controls');
  function Harness(){const live=useLiveMixer();return <><button onClick={()=>void live.confirmed({'/fx/1/type':0},'Test')}>Confirmer test</button><p data-kind={live.messageKind}>{live.message}</p></>;}
  await f.render(<Harness/>);await f.click('Confirmer test');
  assert.equal(f.dom.window.document.querySelector('p').dataset.kind,'success');assert.match(f.dom.window.document.querySelector('p').textContent,/Appliqué. Sauvegarde/);
  f.state.failure='/api/console/apply';await f.click('Confirmer test');
  assert.equal(f.dom.window.document.querySelector('p').dataset.kind,'error');assert.equal(f.dom.window.document.querySelector('p').textContent,'Échec simulé');
  f.state.failure='';await f.click('Confirmer test');
  await f.React.act(async()=>f.sockets[0].onmessage({data:JSON.stringify({type:'live-error',error:'Connexion perdue'})}));
  assert.equal(f.dom.window.document.querySelector('p').dataset.kind,'error');assert.equal(f.dom.window.document.querySelector('p').textContent,'Connexion perdue');
 }finally{await f.close();}
});

test('dual GEQ edits and flat preparation preserve the opposite side and both output gains without writes',async()=>{
 const f=await fixture();try{
  f.state.fx={slot:1,algorithm:27,parameters:defaultFxParameters(27)};
  f.state.fx.parameters[0]={type:'f',value:.3};f.state.fx.parameters[31]={type:'f',value:.4};f.state.fx.parameters[32]={type:'f',value:.7};f.state.fx.parameters[63]={type:'f',value:.6};
  const {FxConsole}=await import('../src/FxConsole');await f.render(<FxConsole/>);await f.click('Lire le slot');
  assert.equal(f.dom.window.document.querySelectorAll('.fx-geq input[type=range]').length,31);
  assert.equal(f.dom.window.document.querySelector('.parameter-grid'),null);
  await f.change('.fx-geq-faders label:nth-child(18) input','-4.5');
  await f.click('Côté B (droite)');await f.change('.fx-geq-detail select','30');await f.change('.fx-geq-detail label:nth-of-type(2) input','-7');
  await f.click('Préparer les 31 bandes à 0 dB');
  assert.ok(!f.calls.some(c=>c.body),'preparing gains writes nothing');
  await f.click('Enregistrer ce preset');const saved=f.calls.at(-1)!.body.data;
  assert.equal(saved.parameters[0].value,.3);assert.equal(saved.parameters[17].value,.35);assert.equal(saved.parameters[31].value,.4);
  assert.ok(saved.parameters.slice(32,63).every((p:any)=>p.value===.5));assert.equal(saved.parameters[63].value,.6);
  await f.click('Prévisualiser les changements');assert.deepEqual(f.calls.at(-1)!.body.expected,f.state.fx);
  assert.match(f.dom.window.document.querySelector('[aria-label="Prévisualisation FX"]').textContent,/Côté A \(gauche\) · 1 kHz/);
  await f.click('Confirmer et appliquer');await f.click('Préparer l’annulation');assert.equal(f.calls.at(-1)?.path,'/api/library/backup/preview');
 }finally{await f.close();}
});

test('GEQ invalid drafts remain visible across sides, block save/preview and can be corrected; malformed vectors stay advanced',async()=>{
 const f=await fixture();try{
  f.state.fx={slot:1,algorithm:29,parameters:defaultFxParameters(29)};
  const {FxConsole}=await import('../src/FxConsole');await f.render(<FxConsole/>);await f.click('Lire le slot');
  const save=()=>[...f.dom.window.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Enregistrer ce preset') as HTMLButtonElement;
  await f.change('.fx-geq-detail label:nth-of-type(2) input','16');assert.equal(save().disabled,true);
  await f.click('Côté B (droite)');assert.match(f.dom.window.document.querySelector('.fx-geq [role=alert]').textContent,/Côté A/);
  await f.change('.fx-geq-detail label:nth-of-type(3) input','');assert.equal(save().disabled,true);
  await f.click('Préparer les 31 bandes à 0 dB');assert.equal(save().disabled,true,'flattening B does not clear A or output errors');
  await f.change('.fx-geq-detail label:nth-of-type(3) input','-2.5');await f.click('Côté A (gauche) ⚠');await f.click('Bande à 0 dB');assert.equal(save().disabled,false);
  assert.ok(!f.calls.some(c=>c.body));
  f.state.fx.parameters.pop();await f.click('Lire le slot');assert.equal(f.dom.window.document.querySelector('.fx-geq'),null);assert.match(f.dom.window.document.body.textContent,/Édition avancée/);
 }finally{await f.close();}
});

test('stereo GEQ shares one curve, remains read-only for guests, and all new controls translate in five languages',async()=>{
 const f=await fixture();const {setLanguage,translate}=await import('../src/i18n');try{
  f.state.admin=false;f.state.fx={slot:1,algorithm:30,parameters:defaultFxParameters(30)};
  const {FxConsole}=await import('../src/FxConsole');
  const keys=['Gain de bande','GEQ double','GEQ stéréo','True EQ double','True EQ stéréo','Côté A (gauche)','Côté B (droite)','Stéréo (gauche + droite)','Égaliseur graphique FX','31 bandes · ±15 dB','Côté à régler','Une seule courbe règle les deux côtés de cet effet stéréo.','Prépare les bandes ici, puis prévisualise et confirme pour les appliquer.','Vue des gains de bande','Gains des bandes, pas une mesure acoustique ni la réponse exacte du filtre.','Curseurs des 31 bandes','Bande à régler','Bande à 0 dB','Préparer les 31 bandes à 0 dB','Uniquement le côté affiché. Le niveau de sortie est conservé.'];
  for(const lang of ['fr','en','it','es','de'] as const){
   await f.React.act(async()=>setLanguage(lang));await f.render(<FxConsole/>);await f.click(translate('Lire le slot',lang));
   assert.equal(f.dom.window.document.querySelector('.fx-geq-sides'),null);
   assert.equal(f.dom.window.document.querySelectorAll('.fx-geq input:not([disabled])').length,0);
   assert.match(f.dom.window.document.querySelector('.fx-geq').textContent,new RegExp(translate('Égaliseur graphique FX',lang)));
   if(lang!=='fr'){const catalog=(await import(`../src/i18n/${lang}.json`)).default;for(const key of keys)assert.ok(catalog[key],lang+': '+key);}
  }
  assert.ok(!f.calls.some(c=>c.body));
 }finally{await f.React.act(async()=>setLanguage('fr'));await f.close();}
});
