/** Exercise the new console entry points on the disposable simulator. */
module.exports=async(win,wait,screenshot)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const api=(path,data)=>js(`(async()=>{
  const r=await fetch(${JSON.stringify(path)},{method:${data===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json'},body:${data===undefined?'undefined':JSON.stringify(JSON.stringify(data))}});
  const result=await r.json();
  if(!r.ok)throw Error(result.error);
  return result;
 })()`);
 if((await api('/api/status')).mode!=='simulation')throw Error('DEV16 smoke requires simulation');
 const button=async(scope,label)=>{
  const found=`[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(el=>el.textContent.trim()===${JSON.stringify(label)})`;
  await wait(`!!(${found})&&!(${found}).matches(':disabled')`);
  await js(`(${found}).click()`);
 };
 const read=async address=>(await api('/api/console/parameters?prefix='+encodeURIComponent(address))).parameters.find(p=>p.address===address).state.value;
 const set=async values=>{
  const p=await api('/api/console/preview',{values});
  await api('/api/console/apply',{token:p.token,confirm:true});
 };
 const confirm=async()=>{
  await wait(`!!document.querySelector('.coach-dialog[open]')`);
  await button('.coach-dialog','Essayer en simulation');
  await wait(`!document.querySelector('.coach-dialog')`);
 };
 const shot=async name=>{await new Promise(resolve=>setTimeout(resolve,300));await screenshot(name);};
 await set({'/config/chlink/1-2':0,'/config/chlink/3-4':0,'/ch/01/preamp/hpon':0,'/ch/02/preamp/hpon':0,'/ch/03/preamp/hpon':0,'/lr/eq/mode':1,'/lr/eq/on':1,'/lr/geq/1k':0});
 await api('/api/adjustment-groups',{model:'XR18',name:'DEV16 voices',target:'fader',channels:[1,2]});
 await button('.xs2-tabs','Mélangeur');
 await button('.expert-bankbar','Groupes logiciels');
 await wait(`[...document.querySelectorAll('.bank-group-strip')].some(e=>e.textContent.includes('DEV16 voices'))`);
 await js(`document.querySelector('.bank-group-strip').scrollIntoView({block:'center'})`);
 await shot('group-bank.png');
 await button('.bank-group-strip','DEV16 voices ↓');
 await wait(`document.querySelectorAll('.expert-console .main>.xs2-strips>.xs2-strip').length===2`);
 await button('.group-spill-notice','Quitter la vue du groupe');
 await button('.expert-bankbar','Entrées 1–16');
 await js(`document.querySelector('.batch-edit summary').click()`);
 await wait(`document.querySelectorAll('.batch-edit[open] .batch-choices input').length===16`);
 await js(`(()=>{const inputs=document.querySelectorAll('.batch-edit .batch-choices input');inputs[0].click();inputs[1].click();})()`);
 await button('.batch-edit','Prévisualiser la sélection');
 await wait(`!!document.querySelector('.coach-dialog[open]')`);
 if(await read('/ch/01/preamp/hpon')!==0)throw Error('Batch preview wrote audio');
 await confirm();
 if(await read('/ch/01/preamp/hpon')!==1||await read('/ch/02/preamp/hpon')!==1||await read('/ch/03/preamp/hpon')!==0)throw Error('Batch edit affected the wrong channels');
 await button('.batch-edit','Mémoriser un lien de pistes');
 await button('.parameter-links-switch','Activer les liens de pistes');
 await button('.xs2-tabs','Canal');
 await wait(`!!document.querySelector('.parameter-links-switch button[aria-pressed=true]')`);
 await button('.visual-bank-select','Canaux');
 await wait(`document.querySelector('.visual-channel-title strong')?.textContent.startsWith('01')`);
 const preamp=`[...document.querySelectorAll('.visual-process-tabs button')].find(b=>b.textContent.includes('Préampli'))`;
 await wait(`!!(${preamp})`);
 await js(`(${preamp}).click()`);
 await button('.processor-input','Low Cut actif');
 await wait(`Promise.all([1,2].map(n=>fetch('/api/console/parameters?prefix=/ch/0'+n+'/preamp/hpon').then(r=>r.json()).then(r=>r.parameters[0]?.state.value))).then(values=>values.every(v=>v===0))`);
 await button('.parameter-links-switch','Désactiver les liens de pistes');

 // Store a scene scope via the normal editor; returning to the scene can load it.
 const saved=await api('/api/library',{kind:'scene',name:'DEV16 scoped scene',complete:true});
 await js(`document.querySelector('button[title="Sauvegarder ou rappeler une scène"]').click()`);
 const scene=`[...document.querySelectorAll('.scene-row')].find(row=>row.textContent.includes('DEV16 scoped scene'))`;
 await wait(`!!(${scene})`);
 await js(`(${scene}).querySelector('button:nth-child(2)').click()`);
 await wait(`document.querySelectorAll('.scene-recall-channels input').length===16`);
 await js(`document.querySelectorAll('.scene-recall-channels input')[0].click();
  document.querySelectorAll('.scene-recall-channels input')[1].click();`);
 await wait(`!!document.querySelector('.scope-matrix summary')`);
 await js(`document.querySelector('.scope-matrix summary').click()`);
 await wait(`document.querySelectorAll('.scope-matrix tbody tr').length===2`);
 await js(`document.querySelector('.scope-matrix tbody tr input').click()`);
 await button('.scope-actions','Mémoriser ce périmètre');
 await wait(`[...document.querySelectorAll('.scene-recall-panel [role=status]')].some(p=>p.textContent.includes('Périmètre de rappel mémorisé'))`);
 const scope=await api('/api/library/'+saved.id+'/recall-scope/inputs');
 if(scope.perChannel['1'].includes('eq')||scope.channels.length!==2)throw Error('Scene per-input scope not retained');
 await button('.scope-actions','Charger le périmètre mémorisé');
 await js(`document.querySelector('.scope-matrix').scrollIntoView({block:'center'})`);
 await shot('scene-scope.png');

 await button('.topbar','MIDI');
 await button('.xs2-tabs','Analyse');
 await js(`document.querySelector('.mix-preparation summary').click()`);
 await js(`(()=>{const curve=[40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000].map(f=>f+' '+(f===1000?88:76)+' 0').join(String.fromCharCode(10));
  const files=new DataTransfer();
  files.items.add(new File([curve],'simulation.txt',{type:'text/plain'}));
  const field=document.querySelector('.mix-preparation input[type=file]');
  field.files=files.files;field.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await button('.mix-preparation','Prévisualiser la sélection');
 await wait(`!!document.querySelector('.coach-dialog[open]')`);
 if(await read('/lr/geq/1k')!==.5)throw Error('Room EQ preview changed a band');
 await shot('room-eq-review.png');
 await confirm();
 if(Math.abs(await read('/lr/geq/1k')-.4)>1e-6)throw Error('Room EQ calculation was not applied');
 await button('.mix-preparation','Annuler la dernière commande');
 await confirm();
 if(await read('/lr/geq/1k')!==.5)throw Error('Room EQ undo failed');
 console.log('DEV16: group bank and spill, batch preview and scoped apply, explicit link activation, stored per-channel scene scope and imported room EQ preview/apply/undo passed.');
};
