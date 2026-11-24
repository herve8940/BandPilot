/** Disposable simulation only: actual server, renderer, library and FX readback. */
module.exports=async(win,wait,screenshot)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const api=(path,data)=>js(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${data===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json'},body:${data===undefined?'undefined':JSON.stringify(JSON.stringify(data))}});const v=await r.json();if(!r.ok)throw Error(v.error);return v;})()`);
 if((await api('/api/status')).mode!=='simulation')throw Error('GEQ smoke requires simulation');
 const {defaultFxParameters}=await import('../dist/shared/fx-parameters.js');
 const original=await api('/api/console/fx?slot=1'),desired={slot:1,algorithm:27,parameters:defaultFxParameters(27)};
 desired.parameters[31].value=.4;desired.parameters[32].value=.6;desired.parameters[63].value=.7;
 const initial=await api('/api/library/fx-edit/preview',{data:desired,expected:original});const setup=await api('/api/library/fx-edit/apply',{token:initial.token,confirm:true});
 const button=(scope,label)=>js(`[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
 const input=(selector,value)=>js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 await button('.subnav','Mixage');await button('body','Expert');await wait(`!!document.querySelector('.xs2-tabs')`);await button('.xs2-tabs','Effets');await wait(`!!document.querySelector('.fx-editor')`);
 await js(`document.querySelector('.fx-editor').closest('details').open=true`);await button('.fx-editor','Lire le slot');await wait(`document.querySelectorAll('.fx-geq input[type=range]').length===31`);
 await input('.fx-geq-faders label:nth-child(18) input','-4.5');await button('.fx-geq','Côté B (droite)');await input('.fx-geq-detail select','30');await input('.fx-geq-detail label:nth-of-type(2) input','-6');
 if(JSON.stringify(await api('/api/console/fx?slot=1'))!==JSON.stringify(desired))throw Error('GEQ draft wrote audio');
 await input('.fx-preset-save input','DEV GEQ dual');await button('.fx-editor','Enregistrer ce preset');await wait(`document.querySelector('.fx-feedback.success')?.textContent.includes('Preset enregistré')`);
 if(JSON.stringify(await api('/api/console/fx?slot=1'))!==JSON.stringify(desired))throw Error('GEQ save wrote audio');
 await button('.fx-editor','Prévisualiser les changements');await wait(`!!document.querySelector('[aria-label="Prévisualisation FX"]')`);
 if(!await js(`(()=>{const t=document.querySelector('[aria-label="Prévisualisation FX"]').textContent;return t.includes('Côté A (gauche) · 1 kHz')&&t.includes('Côté B (droite) · 20 kHz');})()`))throw Error('GEQ preview does not identify both sides');
 await button('[aria-label="Prévisualisation FX"]','Annuler');
 const capture=async name=>{await js(`document.querySelector('.fx-geq').scrollIntoView({block:'center',behavior:'instant'})`);await new Promise(r=>setTimeout(r,300));await screenshot(name);};
 await capture('geq-dual.png');
 const size=win.getSize(),minimum=win.getMinimumSize();win.setMinimumSize(360,600);win.setSize(480,850);await capture('geq-small.png');console.log('GEQ layout',await js(`JSON.stringify({viewport:innerWidth,ancestors:(()=>{let e=document.querySelector('.fx-geq'),a=[];while(e){a.push([e.className,e.clientWidth,e.scrollWidth]);e=e.parentElement;}return a;})()})`));
 if(await js(`(()=>{const e=document.querySelector('.fx-geq');return e.scrollWidth>e.clientWidth+2||e.getBoundingClientRect().width>window.innerWidth;})()`))throw Error('GEQ overflows small panel');
 // The vertical faders must remain operable, with a separate internal horizontal scroll.
 if(!await js(`(()=>{const e=document.querySelector('.fx-geq-faders input');return getComputedStyle(e).writingMode==='vertical-lr'&&e.getBoundingClientRect().height>100;})()`))throw Error('GEQ faders lost vertical layout');
 win.setMinimumSize(...minimum);win.setSize(...size);
 await js(`window.__geqConfirm=window.confirm;window.confirm=()=>true;true`);
 try{
  await button('.fx-editor','Prévisualiser les changements');await wait(`!!document.querySelector('[aria-label="Prévisualisation FX"]')`);await button('.fx-editor','Confirmer et appliquer');await wait(`document.querySelector('.fx-feedback.success')?.textContent.includes('FX appliqué')`);
  const observed=await api('/api/console/fx?slot=1'),wanted=structuredClone(desired);wanted.parameters[17].value=.35;wanted.parameters[62].value=.3;
  if(JSON.stringify(observed)!==JSON.stringify(wanted))throw Error('GEQ apply changed unexpected values');
  await button('.fx-editor','Préparer l’annulation');await wait(`!!document.querySelector('[aria-label="Prévisualisation FX"]')`);await button('.fx-editor','Confirmer et appliquer');await wait(`document.querySelector('.fx-feedback.success')?.textContent.includes('FX appliqué')`);
  if(JSON.stringify(await api('/api/console/fx?slot=1'))!==JSON.stringify(desired))throw Error('GEQ undo did not restore both sides and gains');
 }finally{await js(`window.confirm=window.__geqConfirm;delete window.__geqConfirm`);}
 const restore=await api(`/api/library/${setup.backupId}/preview`,{});await api(`/api/library/${setup.backupId}/apply`,{token:restore.token,confirm:true});
 if(JSON.stringify(await api('/api/console/fx?slot=1'))!==JSON.stringify(original))throw Error('GEQ smoke did not restore original FX');
 console.log('GEQ: 31 vertical bands, independent sides/gains, draft/save/preview without writes, actual apply/readback/exact undo and small layout passed.');
};
