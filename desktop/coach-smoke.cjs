// Runs only from --smoke-test, against the disposable simulation profile.
module.exports=async function coachSmoke(win,wait){
 const js=source=>win.webContents.executeJavaScript(source);
 const click=async(selector,label)=>js(`(()=>{const button=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim().endsWith(${JSON.stringify(label)}));if(!button||button.disabled)throw Error('Commande indisponible : '+${JSON.stringify(label)});button.click();})()`);
 const status=await js(`fetch('/api/status').then(r=>r.json())`);
 if(status.mode!=='simulation'||status.writesEnabled)throw Error('Coach smoke requires simulation');
 await click('.coach-journey button','Dire qui est branché où');
 await wait(`!!document.querySelector('.coach-inputs')`);
 const before=await js(`fetch('/api/coach').then(r=>r.json()).then(d=>d.profile.inputs.length)`);
 await click('.coach-actions button','Ajouter un instrument');
 await wait(`document.querySelectorAll('.coach-input2').length===${before+1}`);
 await js(`(()=>{const row=[...document.querySelectorAll('.coach-input2')].at(-1),select=row.querySelectorAll('select')[1];select.value='bass-di';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`document.querySelectorAll('.coach-input2 select')[${before*2+1}]?.value==='bass-di'`);
 await js(`(()=>{const input=[...document.querySelectorAll('.coach-input2 input')].at(-1);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Basse Éric');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await wait(`[...document.querySelectorAll('.coach-input2 input')].at(-1)?.value==='Basse Éric'`);
 await js(`[...document.querySelectorAll('.coach-input2 .apply')].at(-1).click()`);
 await wait(`!!document.querySelector('.coach-dialog[open]')`);
 await click('.coach-dialog button','Essayer en simulation');
 await wait(`!document.querySelector('.coach-dialog')&&!!document.querySelector('.coach-toast [role=status]')`);
 const saved=await js(`fetch('/api/coach').then(r=>r.json()).then(d=>d.profile.inputs.find(i=>i.name==='Basse Éric'))`);
 if(!saved||saved.source!=='bass-di')throw Error('Instrument was not saved');
 const channel=String(saved.channel).padStart(2,'0');
 const named=await js(`fetch('/api/console/parameters?prefix=/ch/${channel}').then(r=>r.json()).then(d=>d.parameters.find(p=>p.address==='/ch/${channel}/config/name')?.state?.value)`);
 if(named!=='Basse Eric')throw Error('Instrument validation did not reach the simulated mixer');
 await win.loadURL(win.webContents.getURL());
 await wait(`!!document.querySelector('.studio')`);
 await js(`document.querySelector('button[title="Régler le son"]').click()`);
 await wait(`!!document.querySelector('.coach-shortcuts')`);
 await click('.coach-journey button','Dire qui est branché où');
 await wait(`[...document.querySelectorAll('.coach-input2 input')].some(i=>i.value==='Basse Éric')`);
 // Read-only preview also exercises the source ambience screen in the native build.
 await click('.coach-shortcuts button','Ambiances des sources');
 await wait(`!!document.querySelector('.vocal-kit fieldset')`);
 await click('.vocal-kit button','Préparer mon ambiance');
 await wait(`!!document.querySelector('.vocal-preview')`);
 console.log('Coach : ajout, nom accentué, validation, persistance et aperçu ambiance vérifiés.');
};
