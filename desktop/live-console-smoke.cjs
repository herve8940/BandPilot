/** Runs inside the disposable --smoke-test profile, with no physical mixer. */
module.exports=async(win,wait,screenshot)=>{
 const bounded=async(promise,label)=>{
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Live console smoke timed out: '+label)),30000);})]);}
  finally{clearTimeout(timer);}
 };
 const js=code=>win.webContents.executeJavaScript(code);
 const api=(path,data)=>js(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${data===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json'},body:${data===undefined?'undefined':JSON.stringify(JSON.stringify(data))}});const value=await r.json();if(!r.ok)throw Error(value.error);return value;})()`);
 if((await api('/api/status')).mode!=='simulation')throw Error('DEV smoke requires simulation');
 const {defaultFxParameters}=await import('../dist/shared/fx-parameters.js');
 const before=await api('/api/console/fx?slot=1'),desired={slot:1,algorithm:10,parameters:defaultFxParameters(10)};
 const plan=await api('/api/library/fx-edit/preview',{data:desired,expected:before});
 const applied=await api('/api/library/fx-edit/apply',{token:plan.token,confirm:true});
 if((await api('/api/console/fx?slot=1')).algorithm!==10)throw Error('Delay recall failed');
 await js(`localStorage.setItem('xr18-console-mode','expert');localStorage.setItem('xr18-expert-view','fx')`);
 await bounded(win.loadURL(win.webContents.getURL()),'reload console');
 await wait(`!!document.querySelector('button[title="Console"]')`);
 await js(`document.querySelector('button[title="Console"]').click()`);
 await wait(`!!document.querySelector('.subnav')`);
 await js(`[...document.querySelectorAll('.subnav button')].find(b=>b.textContent.trim()==='Mixage').click()`);
 const button=label=>js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
 await wait(`document.body.textContent.includes('Lire le slot')`);await js(`document.querySelector('.studio-control').closest('details').open=true`);await button('Lire le slot');await wait(`!!document.querySelector('.fx-tempo')`);
 for(const [lang,expected] of [['en','Delay time'],['it','Tempo di delay'],['es','Tiempo de retardo'],['de','Verzögerungszeit'],['fr','Durée du délai']]){
  await js(`window.dispatchEvent(new Event('xr18-open-connection'))`);await wait(`!!document.querySelector('.bandpilot-language select')`);
  await js(`(()=>{const s=document.querySelector('.bandpilot-language select');s.value=${JSON.stringify(lang)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.documentElement.lang===${JSON.stringify(lang)}`);
  await js(`document.querySelector('[data-workspace=mix]').click()`);await wait(`document.querySelectorAll('.subnav button').length===2`);
  await js(`document.querySelector('.subnav button').click()`);await wait(`!!document.querySelector('.fx-editor > fieldset button')`);
  await js(`document.querySelector('.fx-editor').closest('details').open=true;document.querySelector('.fx-editor > fieldset button').click()`);
  await wait(`document.querySelector('.fx-editor .fx-hardware')?.dataset.algorithm==='10' && document.querySelector('.fx-editor .parameter-grid')?.textContent.includes(${JSON.stringify(expected)})`);
 }
 await js(`document.querySelector('.fx-editor .fx-hw-precise').open=true`);
 await js(`(()=>{const s=document.querySelector('.fx-tempo select');s.value='0.75';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await button('Préparer cette durée');await wait(`Number(document.querySelectorAll('.parameter-card input')[1].value)===375`);
 if(JSON.stringify(await api('/api/console/fx?slot=1'))!==JSON.stringify(desired))throw Error('Preparing tempo wrote audio');
 await button('Prévisualiser les changements');await wait(`!!document.querySelector('[aria-label="Prévisualisation FX"]')`);await js(`document.querySelector('.studio-control').scrollIntoView({block:'start'})`);await screenshot('dev-fx-tap.png');
 const undo=await api(`/api/library/${applied.backupId}/preview`,{});await api(`/api/library/${applied.backupId}/apply`,{token:undo.token,confirm:true});
 await button('Mélangeur');await wait(`!!document.querySelector('.desk-customize-open')`);
 await button('Personnaliser');await wait(`!!document.querySelector('.desk-customize-dialog[open]')`);
 await js(`(()=>{const i=document.querySelector('.desk-view-name input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'DEV bank');i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await js(`document.querySelector('.desk-strip-choice').click()`);await wait(`document.querySelectorAll('.desk-selected-list li').length===1`);
 await screenshot('dev-custom-bank.png');await button('Enregistrer la vue');await wait(`!document.querySelector('.desk-customize-dialog')`);
 // A new desktop launch has a new origin. Remove the browser copy to check native storage.
 await js(`localStorage.removeItem('bandpilot-workspaces-v1')`);
 await bounded(win.loadURL(win.webContents.getURL()),'reload console');await wait(`!!document.querySelector('.studio')`);
 if(!await js(`JSON.stringify(window.bandpilotWorkspaces.get()).includes('DEV bank')`))throw Error('Custom bank not persisted natively');
 const copy=await api('/api/monitor/copy/preview',{source:1,target:3});const result=await api('/api/monitor/copy/apply',{token:copy.token,confirm:true});
 const restore=await api(`/api/library/${result.backupId}/preview`,{});await api(`/api/library/${result.backupId}/apply`,{token:restore.token,confirm:true});
 console.log('DEV smoke: FX units in 5 languages, tempo preparation, guarded apply/undo, bank persistence and monitor copy/undo passed.');
};
