import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

test('scene protections save metadata explicitly, discard drafts, detect conflicts and reload in five languages',async()=>{
 const f=await fixture();const i18n=await import('../src/i18n');try{
  const {SceneProtectionsPanel}=await import('../src/SceneProtectionsPanel'),shared=await import('../../shared/scene-protections');let saved=0;
  await f.render(<SceneProtectionsPanel onSaved={()=>{saved++;}}/>);
  await f.React.act(async()=>{f.dom.window.document.querySelector('summary').click();});await f.flush();
  await f.toggle(0);assert.ok(!f.calls.some(c=>c.body));assert.match(f.dom.window.document.querySelector('[role=status]').textContent,/non enregistrées/);
  await f.click('Annuler les modifications');assert.equal(f.dom.window.document.querySelector('input').checked,false);
  await f.toggle(5);await f.click('Enregistrer les protections');assert.equal(saved,1);assert.deepEqual(f.calls.filter(c=>c.body),[{path:'/api/library/scene-protections',body:{model:'XR18',revision:0,rules:[{channel:7,sections:['eq']}]}}]);
  assert.match(f.dom.window.document.querySelector('summary').textContent,/1 entrée/);
  await f.click('Retirer toutes les protections');assert.equal(f.state.protections.rules.length,1,'clearing requires explicit save');await f.click('Annuler les modifications');
  await f.toggle(6);f.state.protectionConflict=true;await f.click('Enregistrer les protections');assert.match(f.dom.window.document.querySelector('[role=alert]').textContent,/protections ont changé/);assert.equal(saved,1);
  f.state.protectionConflict=false;f.state.protections={model:'XR18',revision:2,rules:[]};await f.click('Recharger les protections');assert.ok([...f.dom.window.document.querySelectorAll('input')].every((x:any)=>!x.checked));
  for(const language of ['fr','en','it','es','de'] as const){
   i18n.setLanguage(language);await f.render(<SceneProtectionsPanel key={language} onSaved={()=>{}}/>);await f.React.act(async()=>f.dom.window.document.querySelector('summary').click());await f.flush();
   const text=f.dom.window.document.querySelector('.scene-protections').textContent;
   assert.ok(text.includes(i18n.translate('Protections des scènes',language)));assert.ok(text.includes('Instrument B'));
   for(const key of [shared.PROTECTION_NOTICE,shared.PROTECTION_SCOPE,shared.PROTECTION_FULL,shared.PROTECTION_INVALID,shared.PROTECTION_CONFLICT,'Enregistrer les protections','Conservés par les protections'])if(language!=='fr')assert.notEqual(i18n.translate(key,language),key);
  }
  assert.ok(f.calls.filter(c=>c.body).every(c=>c.path==='/api/library/scene-protections'),'no audio request');
 }finally{i18n.setLanguage('fr');await f.close();}
});

test('recall preview identifies protected destination families before applying and in undo',async()=>{
 const f=await fixture();try{
  const {SceneRecallPanel}=await import('../src/SceneRecallPanel');f.state.excluded=[{channel:7,section:'eq'}];
  const scene={id:'scene',kind:'scene',name:'Synthetic scene',createdAt:'2026-01-01',data:{version:2,model:'XR18',values:{'/ch/01/eq/on':1}}};
  await f.render(<SceneRecallPanel entry={scene} mode="simulation" canWrite onClose={()=>{}} onUpdated={async()=>{}}/>);
  await f.toggle(0);await f.change('.scene-mapping-rows select','7');await f.click('Prévisualiser la sélection');
  assert.match(f.dom.window.document.querySelector('dialog .scene-protected-summary').textContent,/Canal 7 · EQ et coupe-bas/);
  await f.click('Annuler, ne rien changer');assert.ok(!f.calls.some(c=>c.path.endsWith('/apply')||c.path.endsWith('/selective-apply')));
  await f.change('.scene-mapping-rows select','1');assert.equal(f.dom.window.document.querySelector('.scene-protected-summary'),null,'changing destinations clears the previous exclusion summary');
 }finally{await f.close();}
});

const entry=(id:string,model='XR18')=>({id,kind:'channel-preset',name:`Instrument ${id}`,createdAt:'2026-01-01T12:00:00Z',data:{model,sourceChannel:1,sections:['eq','compressor','gate'],format:'bandpilot-channel-preset',version:1,values:{'eq/on':1}}});
async function fixture(){
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),originals=new Map();
  const calls:{path:string;body:any}[]=[];
  const state={admin:true,fail:false,protectionConflict:false,protections:{model:"XR18",revision:0,rules:[]} as any,excluded:[] as any[],presetOptions:{model:'XR18',family:'xair',monitorOutputs:6,channels:[{channel:1,name:'Instrument A'},{channel:7,name:'Instrument B'}]},entries:[entry('saved'),entry('other','XR12')] as any[]};
  const install=(key:string,value:unknown)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))install(key,value);
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  install('fetch',async(path:string,options?:RequestInit)=>{
    const body=options?.body?JSON.parse(String(options.body)):undefined;calls.push({path,body});
    let result:unknown={};let status=200;
    if(path==='/api/auth')result={user:{role:state.admin?'admin':'musician'}};
    else if(path.startsWith('/api/adjustment-groups'))result=[];
    else if(path==='/api/library/scene-protections'){if(body){if(state.protectionConflict){status=400;result={error:'Les protections ont changé. Recharge-les puis recommence.'};}else{state.protections={...body,revision:state.protections.revision+1};result=state.protections;}}else result=state.protections;}
    else if(path==='/api/library')result=state.entries;
    else if(path==='/api/library/preset-options')result=state.presetOptions;
    else if(path.endsWith('/selective-options'))result={model:'XR18',family:'xair',channels:[{channel:1,name:'Current input',savedName:'File input'}],destinations:[{channel:1,name:'Current input'},{channel:7,name:'Current monitor'}]};
    else if(path==='/api/console/restore'||path.endsWith('/preview')||path.endsWith('/selective-preview'))result={excluded:state.excluded,skippedSilent:1,buses:[1,2],token:'preview-token',title:'Restore',explanation:'',inputs:[],changes:[{address:'/ch/07/eq/on',before:0,after:1}]};
    else if(path.endsWith('/selective-apply'))result={ok:true,backupId:'selective-backup'};
    else if(path.endsWith('/apply')){if(state.fail){state.entries.push({id:'recovery',kind:'scene',name:'Avant synchronisation PC → Table',createdAt:'2026-01-02T12:00:00Z',data:{version:2}});status=400;result={backupId:'recovery',error:'Synchronisation potentiellement partielle ; sauvegarde recovery : Lecture différente : /ch/11/config/color'};}else result={ok:true,backupId:'backup'};}
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

test('stereo capture from the right input selects its pair explicitly and stereo restore previews both destinations',async()=>{
  const f=await fixture();try{
    const {ChannelPresetActions}=await import('../src/ChannelPresetActions');
    await f.render(<ChannelPresetActions channel={8} name="Right instrument" model="XR18" online canWrite mode="simulation"/>);
    await f.click('Sauvegarder');await f.change('select','stereo');await f.change('input:not([type=checkbox])','Stereo instrument');
    await f.click('Sauvegarder le preset');
    assert.deepEqual(f.calls.find(c=>c.path==='/api/library/capture-channel')?.body,{name:'Stereo instrument',channel:7,sections:['eq','compressor','gate'],stereo:true});
    assert.ok(!f.calls.some(c=>c.path.endsWith('/apply')));
    f.state.entries=[{...entry('stereo'),data:{...entry('stereo').data,version:2,stereo:true,linked:false,rightValues:{'eq/on':1}}}];
    await f.click('Restaurer');await f.change('select','stereo');await f.click('Prévisualiser le preset…');
    assert.equal(f.calls.at(-1)?.body.channel,7);assert.match(f.dom.window.document.querySelector('dialog').textContent,/Paire stéréo 7–8/);
    await f.click('Annuler, ne rien changer');assert.ok(!f.calls.some(c=>c.path.endsWith('/apply')));
  }finally{await f.close();}
});

test('stereo preview distinguishes independent and shared families in all five languages without translating user names',async()=>{
  const f=await fixture(),i18n=await import('../src/i18n');try{
    const {PlanDialog}=await import('../src/SoundCoach'),{STEREO_LINK_NOTICE,STEREO_LINK_LABELS}=await import('../../shared/stereo-link');
    for(const language of ['fr','en','it','es','de'] as const){
      i18n.setLanguage(language);
      await f.render(<PlanDialog key={language} mode="simulation" busy={false} canApply onClose={()=>{}} onApply={()=>{}} plan={{token:'test',title:'User $& Stereo',explanation:'',inputs:['Input Müller'],changes:[{address:'/ch/01/eq/1/g',before:0,after:3},{address:'/ch/02/eq/1/g',before:0,after:-2}],stereoLink:{pairs:[1,5],independent:['eq','dyn'],shared:['preamp']}}}/>);
      const panel=f.dom.window.document.querySelector('.coach-stereo-summary');assert.ok(panel);
      for(const key of ['Liaison stéréo vérifiée','Indépendants gauche/droite :','Partagés sur la paire :',STEREO_LINK_LABELS.eq,STEREO_LINK_LABELS.dyn,STEREO_LINK_LABELS.preamp,STEREO_LINK_NOTICE])assert.ok(panel.textContent.includes(i18n.translate(key,language)),`${language}: ${key}`);
      assert.match(panel.textContent,/1–2, 5–6/);assert.ok(f.dom.window.document.body.textContent.includes('User $& Stereo'));assert.ok(f.dom.window.document.body.textContent.includes('Input Müller'));
      const partial='Modification potentiellement partielle ; sauvegarde recovery-id : La console n’a pas conservé les valeurs gauche/droite demandées. Vérifie les options de liaison avant de restaurer la sauvegarde.';
      const translated=i18n.translate(partial,language);assert.ok(translated.includes('recovery-id'));if(language!=='fr')assert.ok(!translated.includes('La console n’a pas conservé'));
    }
    assert.equal(f.calls.length,0,'displaying the link summary does not change preferences or audio');
  }finally{i18n.setLanguage('fr');await f.close();}
});

test('group adjustments require an explicit selection, preserve the draft on cancel, apply and undo through guarded history',async()=>{
  const f=await fixture();try{
    const {GroupedAdjustments}=await import('../src/GroupedAdjustments');
    await f.render(<GroupedAdjustments model="XR18" canWrite mode="simulation"/>);
    await f.click('Réglages groupés');assert.ok(f.dom.window.document.querySelector('button[type=submit]').disabled);
    await f.toggle(0);await f.toggle(1);await f.change('.group-adjust-fields select','send');await f.change('input[type=number]','-2');
    assert.ok(!f.calls.some(c=>c.body));
    await f.click('Prévisualiser les réglages…');
    assert.deepEqual(f.calls.at(-1),{path:'/api/library/group-adjust/preview',body:{model:'XR18',channels:[1,7],target:'send',delta:-2,bus:1}});
    assert.match(f.dom.window.document.querySelector('dialog').textContent,/Bus 1–2/);
    await f.click('Annuler, ne rien changer');assert.ok(!f.calls.some(c=>c.path.endsWith('/apply')));
    assert.ok(f.dom.window.document.querySelector('.group-adjust-channels input').checked);
    await f.click('Prévisualiser les réglages…');await f.click('Essayer en simulation');
    assert.deepEqual(f.calls.at(-1),{path:'/api/library/group-adjust/apply',body:{token:'preview-token',confirm:true}});
    await f.click('Revenir au réglage précédent');assert.equal(f.calls.at(-1)?.path,'/api/library/backup/preview');
    await f.click('Essayer en simulation');assert.equal(f.calls.at(-1)?.path,'/api/library/backup/apply');
  }finally{await f.close();}
});

test('grouped controls respect read-only access and all five languages without changing saved input names',async()=>{
  const f=await fixture(),i18n=await import('../src/i18n');try{
    const {GroupedAdjustments}=await import('../src/GroupedAdjustments');
    for(const language of ['fr','en','it','es','de'] as const){
      i18n.setLanguage(language);await f.render(<GroupedAdjustments key={language} model="XR18" canWrite={false} mode="real"/>);
      await f.click(i18n.translate('Réglages groupés',language));
      assert.ok(f.dom.window.document.body.textContent.includes('Instrument A'));
      await f.toggle(0);await f.toggle(1);assert.ok(f.dom.window.document.querySelector('button[type=submit]').disabled);
      assert.ok(f.dom.window.document.body.textContent.includes(i18n.translate('Décalage (dB)',language)));
    }
    assert.ok(!f.calls.some(c=>c.body));
    f.state.admin=false;await f.render(<GroupedAdjustments key="guest" model="XR18" canWrite mode="simulation"/>);assert.equal(f.dom.window.document.querySelector('.group-adjustments'),null);
  }finally{i18n.setLanguage('fr');await f.close();}
});

test('a partial grouped write retains its recovery action after closing the failed preview',async()=>{
  const f=await fixture();try{
    const {GroupedAdjustments}=await import('../src/GroupedAdjustments');
    await f.render(<GroupedAdjustments model="XR18" canWrite mode="simulation"/>);
    await f.click('Réglages groupés');await f.toggle(0);await f.toggle(1);await f.click('Prévisualiser les réglages…');
    f.state.fail=true;await f.click('Essayer en simulation');assert.ok(f.dom.window.document.querySelector('dialog button.primary').disabled);
    await f.click('Fermer');await f.click('Revenir au réglage précédent');assert.equal(f.calls.at(-1)?.path,'/api/library/recovery/preview');
    f.state.fail=false;await f.click('Essayer en simulation');assert.equal(f.calls.at(-1)?.path,'/api/library/recovery/apply');
  }finally{await f.close();}
});

test('selective scene recall keeps legacy recall, previews an explicit selection, cancels without writes and restores its own backup',async()=>{
  const f=await fixture();try{
    f.state.entries=[{id:'complete',kind:'scene',name:'Complete',createdAt:'2026-01-01T12:00:00Z',data:{version:2,model:'XR18',values:{'/ch/01/eq/on':1,'/ch/07/eq/on':1}}},{id:'legacy',kind:'scene',name:'Legacy',createdAt:'2026-01-01T12:00:00Z',data:{version:1}}];
    const {ScenesPage}=await import('../src/ScenesPage');await f.render(<ScenesPage mode="simulation" canWrite/>);
    assert.equal([...f.dom.window.document.querySelectorAll('button')].filter((b:any)=>b.textContent==='Rappel sélectif…').length,1);
    await f.click('Rappel sélectif…');
    assert.ok(!f.calls.some(c=>c.body),'opening the selector reads metadata only');
    assert.ok(f.dom.window.document.querySelector('.scene-recall-panel button[type=submit]').disabled);
    await f.toggle(1); // channel 7; processing groups start enabled, volume and labels disabled.
    await f.toggle(3);await f.toggle(4);
    assert.ok(!f.calls.some(c=>c.body),'choosing fields sends nothing');
    await f.click('Prévisualiser la sélection');
    assert.deepEqual(f.calls.at(-1),{path:'/api/library/complete/selective-preview',body:{scope:{channels:[7],sections:['eq']}}});
    await f.click('Annuler, ne rien changer');assert.ok(!f.calls.some(c=>c.path.endsWith('apply')));
    assert.ok(f.dom.window.document.querySelectorAll('.scene-recall-channels input')[1].checked,'draft preserved after cancellation');
    await f.click('Prévisualiser la sélection');await f.click('Essayer en simulation');
    assert.ok(f.calls.some(c=>c.path==='/api/library/complete/selective-apply'&&c.body.confirm===true));
    await f.click('Annuler le rappel sélectif');assert.equal(f.calls.at(-1)!.path,'/api/library/selective-backup/preview');
    await f.click('Essayer en simulation');assert.ok(f.calls.some(c=>c.path==='/api/library/selective-backup/apply'));
  }finally{await f.close();}
});

test('selective recall validates selection and permissions, preserves user names in all five languages',async()=>{
  const f=await fixture();const i18n=await import('../src/i18n');try{
    const {SceneRecallPanel}=await import('../src/SceneRecallPanel');
    const scene={id:'complete',kind:'scene',name:'User $& Name',createdAt:'2026-01-01T12:00:00Z',data:{version:2,model:'XR18',values:{'/ch/01/config/name':'Ma voix','/ch/01/eq/on':1}}};
    for(const language of ['fr','en','it','es','de'] as const){
      i18n.setLanguage(language);
      await f.render(<SceneRecallPanel key={language} entry={scene} mode="real" canWrite={false} onClose={()=>{}} onUpdated={async()=>{}}/>);
      assert.ok(f.dom.window.document.body.textContent.includes('User $& Name'));
      assert.ok(f.dom.window.document.body.textContent.includes('Ma voix'));
      assert.ok(f.dom.window.document.body.textContent.includes(i18n.translate('Prévisualiser la sélection',language)));
      await f.toggle(0);assert.ok(f.dom.window.document.querySelector('button[type=submit]').disabled);
      assert.ok(!f.calls.some(c=>c.body));
    }
    i18n.setLanguage('fr');
    await f.render(<SceneRecallPanel key="incompatible" entry={{...scene,data:{...scene.data,model:'XR12'}}} mode="simulation" canWrite onClose={()=>{}} onUpdated={async()=>{}}/>);
    assert.match(f.dom.window.document.querySelector('[role=status]').textContent,/modèle actuel/);
    assert.equal(f.dom.window.document.querySelector('button[type=submit]'),null);
  }finally{i18n.setLanguage('fr');await f.close();}
});

test('native selective recall reads file channel metadata without treating the SCN text as JSON',async()=>{
  const f=await fixture();try{
    f.state.entries=[{id:'native',kind:'native-scene',name:'Imported.scn',createdAt:'2026-01-01T12:00:00Z',data:'/ch/01/config "File input" 1 In01 U01'}];
    const {ScenesPage}=await import('../src/ScenesPage');await f.render(<ScenesPage mode="real" canWrite/>);
    await f.click('Rappel sélectif…');assert.ok(f.calls.some(c=>c.path==='/api/library/native/selective-options'));
    assert.match(f.dom.window.document.querySelector('.scene-recall-panel').textContent,/File input/);
    assert.match(f.dom.window.document.querySelector('.scene-recall-panel').textContent,/Current input/);
    assert.equal(f.dom.window.document.querySelectorAll('.scene-recall-channels input').length,1);
    await f.toggle(0);await f.click('Prévisualiser la sélection');
    assert.equal(f.calls.at(-1)!.path,'/api/library/native/selective-preview');
    await f.click('Annuler, ne rien changer');assert.ok(!f.calls.some(c=>c.path.endsWith('apply')));
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
    await f.click('Revenir au réglage précédent');assert.deepEqual(f.calls.at(-1),{path:'/api/library/backup/preview',body:{}});
    await f.click('Essayer en simulation');assert.equal(f.calls.at(-1)!.path,'/api/library/backup/apply');
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

test('selective remapping shows source and destination names, blocks duplicates, preserves draft after cancellation and explicitly applies/undoes',async()=>{
 const f=await fixture();try{
  const {SceneRecallPanel}=await import('../src/SceneRecallPanel');
  const scene={id:'mapped',kind:'scene',name:'Mapped fixture',createdAt:'2026-01-01T12:00:00Z',data:{version:2,model:'XR18',values:{'/ch/01/config/name':'Saved voice','/ch/07/config/name':'Saved keys'}}};
  await f.render(<SceneRecallPanel entry={scene} mode="simulation" canWrite onClose={()=>{}} onUpdated={async()=>{}}/>);
  await f.toggle(0);await f.change('.scene-mapping-rows select','7');await f.toggle(1);
  assert.equal(f.dom.window.document.querySelector('button[type=submit]').disabled,true);assert.match(f.dom.window.document.querySelector('[role=alert]').textContent,/sans doublon/);
  assert.ok(!f.calls.some(c=>c.body),'choosing destinations sends no request');
  await f.change('.scene-mapping-rows label:nth-child(2) select','1');
  await f.click('Prévisualiser la sélection');assert.deepEqual(f.calls.at(-1)!.body.scope,{channels:[1,7],sections:['eq','compressor','gate'],mapping:[{source:1,target:7},{source:7,target:1}]});
  const dialog=f.dom.window.document.querySelector('dialog').textContent;
  assert.ok(dialog.includes('Dans la scène : Canal 1 · Saved voice → Sur la console : Canal 7 · Instrument B'));
  assert.ok(dialog.includes('Dans la scène : Canal 7 · Saved keys → Sur la console : Canal 1 · Instrument A'));
  await f.click('Annuler, ne rien changer');assert.equal(f.dom.window.document.querySelector('.scene-mapping-rows select').value,'7');assert.ok(!f.calls.some(c=>c.path.endsWith('apply')));
  await f.click('Prévisualiser la sélection');await f.click('Essayer en simulation');assert.ok(f.calls.some(c=>c.path==='/api/library/mapped/selective-apply'&&c.body.confirm));
  await f.click('Annuler le rappel sélectif');assert.deepEqual(f.calls.at(-1),{path:'/api/library/selective-backup/preview',body:{}});
  await f.click('Annuler, ne rien changer');await f.click('Garder les numéros de la scène');await f.click('Prévisualiser la sélection');assert.equal(f.calls.at(-1)!.body.scope.mapping,undefined,'identity mapping keeps the original API shape');
 }finally{await f.close();}
});

test('native mapping offers inputs absent from the file, works in five languages and keeps user names intact',async()=>{
 const f=await fixture(),i18n=await import('../src/i18n');try{
  const {SceneRecallPanel}=await import('../src/SceneRecallPanel'),shared=await import('../../shared/scene-recall');
  const scene={id:'native-map',kind:'native-scene',name:'Ma scène $&',createdAt:'2026-01-01T12:00:00Z',data:'/ch/01/config "File input" 1 In01 U01'};
  const keys=[shared.SCENE_MAPPING_NOTICE,shared.SCENE_MAPPING_INVALID,shared.SCENE_MAPPING_STEREO,'Dans la scène','Sur la console','Destinations du rappel','3. Vérifier les destinations','Garder les numéros de la scène','Destination pour l’entrée {{0}}'];
  for(const language of ['fr','en','it','es','de'] as const){
   i18n.setLanguage(language);await f.render(<SceneRecallPanel key={language} entry={scene} mode="simulation" canWrite onClose={()=>{}} onUpdated={async()=>{}}/>);
   await f.toggle(0);assert.equal(f.dom.window.document.querySelectorAll('.scene-mapping-rows select option').length,2);
   await f.change('.scene-mapping-rows select','7');assert.ok(f.dom.window.document.body.textContent.includes('Ma scène $&'));
   await f.click(i18n.translate('Prévisualiser la sélection',language));assert.deepEqual(f.calls.at(-1)!.body.scope.mapping,[{source:1,target:7}]);
   const text=f.dom.window.document.querySelector('dialog').textContent;assert.ok(text.includes('File input'));assert.ok(text.includes('Current monitor'));assert.ok(text.includes(i18n.translate('Sur la console',language)));
   await f.click(i18n.translate('Annuler, ne rien changer',language));
   if(language!=='fr'){const catalog=(await import(`../src/i18n/${language}.json`)).default;for(const key of keys)assert.ok(catalog[key],language+': '+key);}
  }
  assert.ok(!f.calls.some(c=>c.path.endsWith('apply')));
 }finally{i18n.setLanguage('fr');await f.close();}
});
