import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

const entry=(id:string,model='XR18')=>({id,kind:'channel-preset',name:`Instrument ${id}`,createdAt:'2026-01-01T12:00:00Z',data:{model,sourceChannel:1,sections:['eq','compressor','gate'],format:'bandpilot-channel-preset',version:1,values:{'eq/on':1}}});
async function fixture(){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),originals=new Map();
  const calls:{path:string;body:any}[]=[];
  const state={admin:true,fail:false,entries:[entry('saved'),entry('other','XR12')] as any[]};
  const install=(key:string,value:unknown)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))install(key,value);
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  install('fetch',async(path:string,options?:RequestInit)=>{
    const body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({path,body});
    let result:unknown={};let status=200;
    if(path==='/api/auth')result={user:{role:state.admin?'admin':'musician'}};
    else if(path==='/api/library')result=state.entries;
    else if(path==='/api/library/preset-options')result={model:'XR18',family:'xair',channels:[{channel:1,name:'Instrument A'},{channel:7,name:'Instrument B'}]};
    else if(path==='/api/console/restore'||path.endsWith('/preview'))result={token:'preview-token',title:'Restore',explanation:'',inputs:[],changes:[{address:'/ch/07/eq/on',before:0,after:1}]};
    else if(path.endsWith('/apply')){if(state.fail){state.entries.push({id:'recovery',kind:'scene',name:'Avant synchronisation PC → Table',createdAt:'2026-01-02T12:00:00Z',data:{version:2}});status=400;result={error:'Synchronisation potentiellement partielle ; sauvegarde recovery : Lecture différente : /ch/11/config/color'};}else result={ok:true,backupId:'backup'};}
    else if(path==='/api/library/capture-channel'){if(state.fail){status=400;result={error:'Connexion modifiée pendant la sauvegarde.'};}else result=entry('new');}
    return new Response(JSON.stringify(result),{status});
  });
  const React=await import('react');install('React',React);
  const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root'));
  const flush=async()=>React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  const render=async(element:React.ReactNode)=>{await React.act(async()=>root.render(element));await flush();};
  const click=async(label:string)=>{const button=[...dom.window.document.querySelectorAll('button')].find((button:any)=>button.textContent.trim()===label);assert.ok(button,label);assert.ok(!(button as any).disabled,label+' enabled');await React.act(async()=>button!.click());await flush();};
  const change=async(selector:string,value:string)=>{const field=dom.window.document.querySelector(selector) as any;assert.ok(field,selector);await React.act(async()=>{Object.getOwnPropertyDescriptor(field.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype,'value')!.set!.call(field,value);field.dispatchEvent(new dom.window.Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
  const toggle=async(index:number)=>React.act(async()=>{(dom.window.document.querySelectorAll('input[type=checkbox]')[index] as any).click();});
  return {dom,React,render,click,change,toggle,flush,calls,state,async close(){await React.act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete (globalThis as any)[key];}}};
}

test('input capture uses the selected channel and sections without applying audio settings',async()=>{
  const f=await fixture();try{
    const {ChannelPresetActions}=await import('../src/ChannelPresetActions');
    await f.render(<ChannelPresetActions channel={7} name="Instrument B" model="XR18" online canWrite={false} mode="simulation"/>);
    await f.click('Sauvegarder');await f.change('input:not([type=checkbox])','My preset');await f.toggle(1);await f.toggle(2);await f.click('Sauvegarder le preset');
    assert.deepEqual(f.calls.filter(call=>call.body),[{path:'/api/library/capture-channel',body:{name:'My preset',channel:7,sections:['eq']}}]);
    assert.match(f.dom.window.document.querySelector('[role=status]')!.textContent!,/Preset sauvegardé/);
  }finally{await f.close();}
});

test('input restore filters models, previews chosen sections, cancels without writes, applies explicitly and offers undo',async()=>{
  const f=await fixture();try{
    const {ChannelPresetActions}=await import('../src/ChannelPresetActions');
    await f.render(<ChannelPresetActions channel={7} name="Instrument B" model="XR18" online canWrite mode="simulation"/>);
    await f.click('Restaurer');assert.equal(f.dom.window.document.querySelectorAll('select option').length,2);
    await f.change('select','saved');await f.toggle(2);await f.click('Prévisualiser le preset…');
    assert.deepEqual(f.calls.at(-1),{path:'/api/library/saved/preview',body:{channel:7,sections:['eq','compressor']}});
    assert.match(f.dom.window.document.querySelector('dialog')!.textContent!,/Canal 7 · Instrument B/);
    await f.click('Annuler, ne rien changer');assert.ok(!f.calls.some(call=>call.path.endsWith('/apply')));
    await f.click('Prévisualiser le preset…');await f.click('Essayer en simulation');
    assert.deepEqual(f.calls.at(-1),{path:'/api/library/saved/apply',body:{token:'preview-token',confirm:true}});
    await f.click('Revenir au réglage précédent');assert.deepEqual(f.calls.at(-1),{path:'/api/console/restore',body:{backupId:'backup'}});
    await f.click('Essayer en simulation');assert.equal(f.calls.at(-1)!.path,'/api/console/apply');
  }finally{await f.close();}
});

test('changing input discards a pending recall; offline and read-only controls cannot apply it',async()=>{
  const f=await fixture();try{
    const {ChannelPresetActions}=await import('../src/ChannelPresetActions');
    await f.render(<ChannelPresetActions key="7" channel={7} name="Instrument B" model="XR18" online canWrite mode="real"/>);
    await f.click('Restaurer');await f.change('select','saved');await f.click('Prévisualiser le preset…');
    assert.ok(f.dom.window.document.querySelector('dialog'));
    await f.render(<ChannelPresetActions key="2" channel={2} name="Instrument C" model="XR18" online={false} canWrite={false} mode="real"/>);
    assert.equal(f.dom.window.document.querySelector('dialog'),null);assert.ok(!f.calls.some(call=>call.path.endsWith('/apply')));
    assert.ok([...f.dom.window.document.querySelectorAll('button')].find((button:any)=>button.textContent==='Sauvegarder').disabled);
    await f.click('Restaurer');await f.change('select','saved');assert.ok(f.dom.window.document.querySelector('button.primary').disabled);
  }finally{await f.close();}
});

test('capture failure preserves the draft and non-admin sessions have no mutation controls',async()=>{
  const f=await fixture();try{
    const {ChannelPresetActions}=await import('../src/ChannelPresetActions');f.state.fail=true;
    await f.render(<ChannelPresetActions key="admin" channel={1} name="Instrument A" model="XR18" online canWrite mode="simulation"/>);
    await f.click('Sauvegarder');await f.change('input','Keep this name');await f.click('Sauvegarder le preset');
    assert.match(f.dom.window.document.querySelector('[role=alert]')!.textContent!,/Connexion modifiée/);assert.equal(f.dom.window.document.querySelector('input').value,'Keep this name');
    f.state.admin=false;await f.render(<ChannelPresetActions key="guest" channel={1} name="Instrument A" model="XR18" online canWrite={false} mode="simulation"/>);
    assert.equal(f.dom.window.document.querySelector('button'),null);
  }finally{await f.close();}
});

test('library sections preserve scene drafts and older scenes, search presets without mixer writes',async()=>{
  const f=await fixture();try{
    f.state.entries.push({id:'legacy',kind:'scene',name:'Legacy scene',createdAt:'2025-01-01T12:00:00Z',data:{version:1}});
    const {ScenesPage}=await import('../src/ScenesPage');await f.render(<ScenesPage mode="simulation" canWrite/>);
    assert.match(f.dom.window.document.body.textContent!,/Legacy scene/);
    await f.change('fieldset.scene-save input','Keep my scene');
    await f.click('Presets par piste2');await f.change('input[type=search]','saved');
    assert.equal(f.dom.window.document.querySelectorAll('.preset-card').length,1);
    await f.click('Scènes complètes1');assert.equal(f.dom.window.document.querySelector('fieldset.scene-save input').value,'Keep my scene');
    assert.ok(!f.calls.some(call=>call.body));
  }finally{await f.close();}
});


test('an interrupted scene recall refreshes the recovery backup and exposes the history immediately',async()=>{
  const f=await fixture();try{
    f.state.entries=[{id:'scene',kind:'scene',name:'Saved scene',createdAt:'2026-01-01T12:00:00Z',data:{version:1}}];
    const {ScenesPage}=await import('../src/ScenesPage');await f.render(<ScenesPage mode="simulation" canWrite/>);
    await f.click('Rappeler…');f.state.fail=true;await f.click('Essayer en simulation');
    assert.match(f.dom.window.document.querySelector('[role=alert]')!.textContent!,/potentiellement partielle/);
    await f.click('Voir les sauvegardes automatiques');
    const history=f.dom.window.document.querySelector('.scene-autos');assert.ok(!history.closest('[hidden]'));
    assert.match(history.textContent,/Avant synchronisation PC → Table/);
    assert.equal(f.calls.filter(call=>call.path.endsWith('/apply')).length,1,'the failed recall is never replayed automatically');
  }finally{await f.close();}
});
