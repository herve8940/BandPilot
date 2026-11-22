import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
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
test('follow mode is opt-in, starts read-only, disarms on reset and rejects late activation after read-only',async()=>{
 const f=await fixture();try{
  const {LiveGroupFader}=await import('../src/LiveGroupFader');const requests:any[]=[];let release:((v:Response)=>void)|null=null,hold=false;
  globalThis.fetch=async(path,data)=>{const body=JSON.parse(String(data?.body));requests.push([String(path),body]);if(String(path).endsWith('/start')){if(hold)return new Promise(r=>release=r);return new Response(JSON.stringify({token:'session',sequence:0}));}return new Response('{}');};
  const mount=(disabled=false)=>f.render(<LiveGroupFader model="XR18" selection={{channels:[1,2],target:'fader'}} disabled={disabled} onBackup={()=>{}}/>);
  await mount();assert.equal((document.querySelector('.group-follow input') as HTMLInputElement).checked,false);assert.equal(requests.length,0);
  await f.React.act(async()=>{(document.querySelector('.group-follow input') as HTMLInputElement).click();});await f.click('Activer le fader continu');assert.equal(requests[0][1].followMembers,true);assert.equal(requests.filter(r=>r[0].endsWith('/move')).length,0);
  await f.React.act(async()=>window.dispatchEvent(new f.dom.window.Event('bandpilot-console-reset')));assert.equal(requests.at(-1)[0],'/api/library/live-group/stop');assert.equal(document.querySelector('input[type=range]'),null);
  hold=true;await f.click('Activer le fader continu');await mount(true);await f.React.act(async()=>{release!(new Response(JSON.stringify({token:'late',sequence:0})));await new Promise(r=>setTimeout(r,0));});assert.equal(requests.at(-1)[1].token,'late');assert.equal(requests.at(-1)[0],'/api/library/live-group/stop');assert.equal(document.querySelector('input[type=range]'),null);
 }finally{await f.close();}
});
test('group mute and restoration require review; spill only changes the view, including read-only monitors',async()=>{
 const f=await fixture();try{
  const {MonitorDesk}=await import('../src/expert/Workspace'),{MixerModelContext}=await import('../src/MixerModel');const requests:any[]=[],writes:any[]=[];
  globalThis.fetch=async(path,init)=>{
   const p=String(path);requests.push([p,init?.body?JSON.parse(String(init.body)):undefined]);
   const value=p==='/api/auth'?{user:{role:'admin'}}:p==='/api/library/preset-options'?{model:'MR12',channels:[1,2,3].map(channel=>({channel,name:`Input ${channel}`})),monitorOutputs:2}:p==='/api/adjustment-groups'?[]:p==='/api/coach'?{profile:{musicians:[]}}:p.endsWith('/preview')?{token:'review',changes:[{address:'/ch/01/mix/01/level',before:-12,after:-90}]}:p.endsWith('/apply')?{ok:true,backupId:'saved-mutes'}:{};
   return new Response(JSON.stringify(value));
  };
  const mount=(writable=true)=>f.render(<MixerModelContext.Provider value={MIXER_MODELS.MR12}><MonitorDesk mode="simulation" values={{}} set={(a,v)=>writes.push([a,v])} writable={writable} confirmed={async()=>false}/></MixerModelContext.Provider>);
  await mount();const original=document.querySelectorAll('.monitor-source').length;assert.ok(original>3);await f.click('Réglages groupés');
  await f.React.act(async()=>{const items=document.querySelectorAll('.group-adjust-channels input');(items[0] as HTMLInputElement).click();(items[1] as HTMLInputElement).click();});
  await f.click('Afficher uniquement les pistes du groupe');assert.equal(document.querySelectorAll('.monitor-source').length,2);assert.equal(writes.length,0);assert.ok(!requests.some(r=>r[0].endsWith('/apply')));
  await f.click('Couper le groupe…');assert.equal(requests.at(-1)[0],'/api/library/group-mute/preview');assert.equal(requests.at(-1)[1].selection.bus,1);assert.match(document.querySelector('.coach-dialog')!.textContent!,/−∞/);
  await f.click('Essayer en simulation');await f.click('Rétablir les envois précédents');assert.equal(requests.at(-1)[0],'/api/library/saved-mutes/preview');await f.click('Annuler, ne rien changer');assert.equal(requests.filter(r=>r[0].endsWith('/apply')).length,1);
  await mount(false);await f.click('Quitter la vue du groupe');assert.equal(document.querySelectorAll('.monitor-source').length,original);await f.click('Afficher uniquement les pistes du groupe');assert.equal(document.querySelectorAll('.monitor-source').length,2);assert.equal(writes.length,0);assert.equal(localStorage.getItem('bandpilot-workspaces-v1'),null);
  await f.React.act(async()=>{(document.querySelectorAll('.monitor-people button')[1] as HTMLButtonElement).click();});assert.equal(document.querySelectorAll('.monitor-source').length,original);assert.equal(document.querySelector('.group-spill-notice'),null);
 }finally{await f.close();}
});
test('group follow, mute and spill labels have translations in all distributed languages',()=>{
 const keys=[
  'Conserver les retouches individuelles','Au prochain mouvement, le groupe conserve les nouveaux écarts. Le retour arrière annule uniquement le dernier mouvement du groupe.',
  'Une retouche individuelle arrête le groupe. Le retour arrière retrouve les niveaux du début de l’activation.','Annuler l’activation',
  'Vue du groupe · mix actuellement sélectionné','Quitter la vue du groupe','Afficher uniquement les pistes du groupe',
  'Couper le groupe…','Couper le groupe','Rétablir les envois précédents','Rétablir les mutes précédents',
  'Les niveaux des envois vers ce retour passent à −∞. Ils sont sauvegardés pour le rétablissement. Un retour stéréo lié est traité sur ses deux bus.',
  'Les mutes des canaux seront activés. Ils peuvent également couper ces pistes dans les retours, selon le trajet de la console.',
  'Vérifie les niveaux à restaurer. Les envois déjà à −∞ avant la coupure le restent.',
  'Vérifie les changements : les pistes déjà coupées avant cette action le restent. Les niveaux ne changent pas.',
  'Les pistes ou envois sélectionnés sont déjà coupés.'];
 for(const lang of ['en','it','es','de']){const catalog=JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`,import.meta.url),'utf8'));for(const key of keys)assert.ok(catalog[key],`${lang}: ${key}`);}
});
