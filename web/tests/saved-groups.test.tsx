import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {GROUP_CONFLICT} from '../../shared/adjustment-group';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
async function fixture(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}),originals=new Map(),calls:any[]=[];
 const state={groups:[] as any[],model:'XR18',fail:false,role:'admin'};
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const fetch=async(path:string,options:any)=>{const body=options?.body?JSON.parse(options.body):undefined;calls.push({path,body});let data:any={},status=200;
  if(path==='/api/auth')data={user:{role:state.role}};
  else if(path==='/api/library/preset-options')data={model:state.model,family:'xair',monitorOutputs:state.model==='XR12'?2:6,channels:[1,2,3,4].map(n=>({channel:n,name:'Input '+n}))};
  else if(path.startsWith('/api/adjustment-groups?'))data=state.groups.filter(g=>g.model===new URL(path,'http://localhost').searchParams.get('model'));
  else if(path==='/api/adjustment-groups'){if(state.fail){status=400;data={error:GROUP_CONFLICT};}else{data={...body,id:body.id??'group-'+state.groups.length,revision:(body.revision??0)+1};state.groups=[...state.groups.filter(g=>g.id!==data.id),data];}}
  else if(path.endsWith('/remove'))state.groups=state.groups.filter(g=>g.id!==body.id);
  else if(path.endsWith('/preview'))data={token:'preview',changes:[{address:'/ch/01/mix/02/level',before:.5,after:.48}],buses:[body.bus??2],skippedSilent:0};
  else if(path.endsWith('/apply'))data={ok:true,backupId:'backup'};
  return new Response(JSON.stringify(data),{status});
 };
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,fetch})){originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});}
 const React=await import('react');originals.set('React',Object.getOwnPropertyDescriptor(globalThis,'React'));Object.defineProperty(globalThis,'React',{configurable:true,value:React});const {createRoot}=await import('react-dom/client'),root=createRoot(document.getElementById('root')!);
 const flush=()=>React.act(async()=>{await new Promise(r=>setTimeout(r,0));});
 return {state,calls,React,dom,async render(el:any){await React.act(async()=>root.render(el));await flush();},async click(text:string){const b=[...document.querySelectorAll('button')].find(b=>b.textContent!.trim()===text)!;assert.ok(b,text);assert.equal(b.disabled,false,text);await React.act(async()=>b.click());await flush();},async change(selector:string,value:string){const e=document.querySelector(selector) as HTMLInputElement;assert.ok(e,selector);await React.act(async()=>{Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype,'value')!.set!.call(e,value);e.dispatchEvent(new dom.window.Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));});await flush();},async check(index:number){await React.act(async()=>{(document.querySelectorAll('.group-adjust-channels input')[index] as HTMLInputElement).click();});},async close(){await React.act(async()=>root.unmount());dom.window.close();for(const[k,v]of originals)v?Object.defineProperty(globalThis,k,v):delete(globalThis as any)[k];}};
}
test('saved selections survive remount and require a fresh explicit preview before apply and undo',async()=>{
 const f=await fixture();try{const {GroupedAdjustments}=await import('../src/GroupedAdjustments');
  await f.render(<GroupedAdjustments model="XR18" mode="simulation" canWrite/>);await f.click('Réglages groupés');await f.check(0);await f.check(2);
  await f.change('.group-adjust-fields select','send');await f.change('.group-adjust-fields label:nth-child(2) select','2');await f.change('.saved-group-fields input','My strings');await f.change('input[type=number]','-4');await f.click('Enregistrer un nouveau groupe');
  assert.deepEqual(f.state.groups[0],{model:'XR18',name:'My strings',channels:[1,3],target:'send',bus:2,id:'group-0',revision:1});assert.ok(!f.calls.some(c=>c.path.endsWith('/preview')||c.path.endsWith('/apply')));
  await f.render(null);await f.render(<GroupedAdjustments model="XR18" mode="simulation" canWrite/>);await f.click('Réglages groupés');assert.equal(document.querySelectorAll('.group-adjust-channels input:checked').length,0);
  await f.change('.saved-group-fields select','group-0');assert.equal(document.querySelectorAll('.group-adjust-channels input:checked').length,2);assert.equal((document.querySelector('input[type=number]') as HTMLInputElement).value,'-1');
  await f.change('input[type=number]','-2');await f.click('Prévisualiser les réglages…');assert.deepEqual(f.calls.at(-1).body,{model:'XR18',channels:[1,3],target:'send',bus:2,delta:-2});await f.click('Annuler, ne rien changer');assert.ok(!f.calls.some(c=>c.path.endsWith('/apply')));
  await f.click('Prévisualiser les réglages…');await f.click('Essayer en simulation');await f.click('Revenir au réglage précédent');assert.equal(f.calls.at(-1).path,'/api/library/backup/preview');await f.click('Essayer en simulation');assert.equal(f.calls.at(-1).path,'/api/library/backup/apply');
 }finally{await f.close();}
});
test('metadata saves work read-only, conflicts preserve the draft, deletion is explicit and does not recall audio',async()=>{
 const f=await fixture();try{const {GroupedAdjustments}=await import('../src/GroupedAdjustments');
  await f.render(<GroupedAdjustments model="XR18" mode="real" canWrite={false}/>);await f.click('Réglages groupés');await f.check(0);await f.check(1);await f.change('.saved-group-fields input','Vocal group');await f.click('Enregistrer un nouveau groupe');
  assert.equal((document.querySelector('button[type=submit]') as HTMLButtonElement).disabled,true);
  await f.change('.saved-group-fields input','Draft stays');f.state.fail=true;await f.click('Mettre à jour ce groupe');assert.equal((document.querySelector('.saved-group-fields input') as HTMLInputElement).value,'Draft stays');assert.match(document.querySelector('[role=alert]')!.textContent!,/changé ailleurs/);
  f.state.fail=false;await f.click('Recharger la liste');assert.equal((document.querySelector('.saved-group-fields select') as HTMLSelectElement).value,'');await f.change('.saved-group-fields select','group-0');assert.equal((document.querySelector('.saved-group-fields input') as HTMLInputElement).value,'Vocal group');
  await f.click('Supprimer ce groupe…');await f.click('Annuler');assert.equal(f.state.groups.length,1);await f.click('Supprimer ce groupe…');await f.click('Confirmer la suppression du groupe');assert.equal(f.state.groups.length,0);assert.equal(document.querySelectorAll('.group-adjust-channels input:checked').length,2);assert.ok(!f.calls.some(c=>c.path.endsWith('/preview')||c.path.endsWith('/apply')));
 }finally{await f.close();}
});
test('monitor groups stay on their destination and reset when changing return, model or mode',async()=>{
 const f=await fixture();try{const {GroupedAdjustments}=await import('../src/GroupedAdjustments');
  f.state.groups=[{id:'return2',revision:1,model:'XR18',name:'Stage pair',target:'send',bus:2,channels:[1,2]},{id:'front',revision:1,model:'XR18',name:'Front only',target:'fader',channels:[1,3]}];
  await f.render(<GroupedAdjustments model="XR18" mode="simulation" fixedBus={2} canWrite/>);await f.click('Réglages groupés');assert.equal(document.querySelectorAll('.saved-group-fields select option').length,2);await f.change('.saved-group-fields select','return2');assert.ok([...document.querySelectorAll('.group-adjust-fields select')].every(e=>(e as HTMLSelectElement).disabled));
  await f.render(<GroupedAdjustments model="XR18" mode="simulation" fixedBus={1} canWrite/>);await f.click('Réglages groupés');assert.equal(document.querySelectorAll('.group-adjust-channels input:checked').length,0);assert.equal(document.querySelectorAll('.saved-group-fields select option').length,1);
  f.state.model='XR12';await f.render(<GroupedAdjustments model="XR12" mode="real" canWrite/>);await f.click('Réglages groupés');assert.equal(document.querySelectorAll('.saved-group-fields select option').length,1);assert.equal(document.querySelectorAll('.group-adjust-channels input:checked').length,0);
  await f.render(<GroupedAdjustments model="X32" mode="real" canWrite/>);assert.equal(document.querySelector('.group-adjustments'),null);
  f.state.role='guest';await f.render(<GroupedAdjustments model="XR18" mode="real" canWrite/>);assert.equal(document.querySelector('.group-adjustments'),null);
 }finally{await f.close();}
});
test('group controls and conflict errors are translated in five languages while user names stay unchanged',async()=>{
 const f=await fixture(),i18n=await import('../src/i18n');try{const {GroupedAdjustments}=await import('../src/GroupedAdjustments');
  f.state.groups=[{id:'personal',revision:1,model:'XR18',name:'Meine Stimme $&',target:'gate',channels:[1,2]}];
  for(const lang of ['fr','en','it','es','de'] as const){i18n.setLanguage(lang);await f.render(<GroupedAdjustments key={lang} model="XR18" mode="real" canWrite={false}/>);await f.click(i18n.translate('Réglages groupés',lang));await f.change('.saved-group-fields select','personal');assert.match(document.body.textContent!,/Meine Stimme \$&/);f.state.fail=true;await f.click(i18n.translate('Mettre à jour ce groupe',lang));assert.ok(document.body.textContent!.includes(i18n.translate(GROUP_CONFLICT,lang)));if(lang!=='fr')assert.ok(!document.body.textContent!.includes('Sélections mémorisées'));}
 }finally{i18n.setLanguage('fr');await f.close();}
});
