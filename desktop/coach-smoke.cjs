// Runs only from --smoke-test, against the disposable simulation profile.
module.exports=async function coachSmoke(win,wait){
 const js=source=>win.webContents.executeJavaScript(source);
 const click=async(selector,label)=>{
   const target=`[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim().endsWith(${JSON.stringify(label)})&&!b.disabled)`;
   // The coach can refresh between frames when the simulator reconnects.
   await wait(`(()=>{const button=${target};if(!button)return false;button.click();return true;})()`);
 };
 const status=await js(`fetch('/api/status').then(r=>r.json())`);
 if(status.mode!=='simulation'||status.writesEnabled)throw Error('Coach smoke requires simulation');
 // The preceding mixer-resume scenario has its own input selector. Start the
 // blank-scene journey to exercise adding and saving a new instrument.
 await click('.balance-blank strong','Partir d’une scène vierge');
 await click('.coach-dialog button','Essayer en simulation');
 await wait(`!!document.querySelector('.coach-inputs')`);
 const before=await js(`document.querySelectorAll('.coach-input2').length`);
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
 await js(`document.querySelector('button[title="Balance"]').click()`);
 await wait(`!!document.querySelector('.coach-shortcuts')`);
 await click('.coach-journey button','Instruments');
 await wait(`[...document.querySelectorAll('.coach-input2 input')].some(i=>i.value==='Basse Éric')`);
 // Read-only preview also exercises the source ambience screen in the native build.
 await js(`document.querySelector('.balance-tools summary').click()`);
 await click('.coach-shortcuts button','Effets par instrument');
 await wait(`!!document.querySelector('.vocal-kit fieldset')`);
 await js(`(()=>{const level=document.querySelector('[aria-label="Dosage en façade"]');level.value='-18';level.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await click('.vocal-kit button','Préparer mon ambiance');
 await wait(`!!document.querySelector('.vocal-preview')`);
 console.log('Coach : ajout, nom accentué, validation, persistance et aperçu ambiance vérifiés.');
};
