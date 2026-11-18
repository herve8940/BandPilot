/** End-to-end library checks in the smoke test's isolated simulation profile. */
module.exports=async(win,wait,screenshot)=>{
  const run=code=>win.webContents.executeJavaScript(code);
  await win.loadURL(win.webContents.getURL());
  await wait(`!!document.querySelector('button[title="Sauvegarder ou rappeler une scène"]')`);
  await run(`document.querySelector('button[title="Sauvegarder ou rappeler une scène"]').click()`);
  await wait(`!!document.querySelector('.preset-save:not([disabled])')`);
  await run(`[...document.querySelectorAll('.library-nav button')].find(b=>b.textContent.includes('Presets par piste')).click()`);
  const setInput=(selector,value)=>run(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await setInput('.preset-save input:not([type=checkbox])','Test — EQ instrument');
  await run(`(()=>{const boxes=[...document.querySelectorAll('.preset-save input[type=checkbox]')];boxes[1].click();boxes[2].click();})()`);
  await wait(`!document.querySelector('.preset-save button.primary').disabled`);
  await run(`document.querySelector('.preset-save button.primary').click()`);
  await wait(`document.querySelectorAll('.preset-row').length===1 && !document.querySelector('.preset-save').disabled`);
  const saved=await run(`fetch('/api/library').then(r=>r.json()).then(rows=>rows.find(e=>e.kind==='channel-preset'))`);
  if(saved?.data.sections.join(',')!=='eq')throw Error('Preset capture ignored selected sections');
  const imported={...saved,name:'Test — EQ importé'};
  await run(`(()=>{const input=document.querySelector('.scene-import-toolbar input');const data=new DataTransfer();data.items.add(new File([${JSON.stringify(JSON.stringify(imported))}],'preset.json',{type:'application/json'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelectorAll('.preset-row').length===2 && !document.querySelector('.preset-save').disabled`);
  await run(`document.querySelector('.channel-presets').scrollIntoView({block:'start'})`);
  await screenshot('presets-library.png');
  await run(`document.querySelector('.preset-card-actions > button').click()`);
  await run(`(()=>{const select=document.querySelector('.preset-row select');select.value='7';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await run(`document.querySelector('.preset-row button.primary').click()`);
  await wait(`!!document.querySelector('.coach-dialog[open]')`);
  if(!await run(`document.querySelector('.coach-dialog').textContent.includes('Canal 7')`))throw Error('Preset preview ignored target channel');
  await screenshot('preset-preview.png');
  await run(`document.querySelector('.coach-dialog button.primary').click()`);
  await wait(`!document.querySelector('.coach-dialog') && document.body.textContent.includes('Preset appliqué.')`);
  await run(`[...document.querySelectorAll('.library-nav button')].find(b=>b.textContent.includes('Scènes complètes')).click()`);
  await setInput('fieldset.scene-save input','Test — scène complète');
  await run(`document.querySelector('fieldset.scene-save > button.primary').click()`);
  await wait(`!document.querySelector('fieldset.scene-save').disabled && document.body.textContent.includes('Scène « Test — scène complète » sauvegardée.')`);
  const scene=await run(`fetch('/api/library').then(r=>r.json()).then(rows=>rows.find(e=>e.kind==='scene'&&e.name==='Test — scène complète'))`);
  if(scene?.data.version!==2)throw Error('Complete scene was not captured');
  await screenshot('scenes-and-presets.png');
  // Malformed imports must show an error and leave saved entries available.
  await run(`(()=>{const input=document.querySelector('.scene-import-toolbar input');const data=new DataTransfer();data.items.add(new File(['invalid JSON'],'bad.json',{type:'application/json'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`!!document.querySelector('.scene-msg[role=alert]')`);
  if(!await run(`document.querySelectorAll('.preset-row').length===2`))throw Error('Failed import removed saved presets');
  // Synthetic defaults only, confined to the isolated smoke profile. An optional
  // local fixture can be supplied without shipping personal rehearsal data.
  {
    const room='100 2.95 40 10k 50 +0 100 2k 1 25 125 50 600 600 0 0';
    const native=process.env.XR18_SMOKE_NATIVE_SCENE?require('node:fs').readFileSync(process.env.XR18_SMOKE_NATIVE_SCENE,'utf8'):
      '/ch/01/config "Smoke" 1 In01 U01\n/ch/01/mix OFF -20 ON +0\n/headamp/01 +0 ON\n'+[1,2,3,4].map(n=>`/fx/${n} ROOM ON\n/fx/${n}/par ${room}`).join('\n');
    const expected=(await import('../dist/src/native-scene-recall.js')).nativeSceneForRecall(native,'XR18');
    await run(`(()=>{const input=document.querySelector('.scene-import-toolbar input');const data=new DataTransfer();data.items.add(new File([${JSON.stringify(native)}],'Native test.scn',{type:'text/plain'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait(`!document.querySelector('fieldset.scene-save').disabled && [...document.querySelectorAll('.scene-row')].some(row=>row.querySelector('b')?.textContent==='Native test.scn')`);
    await run(`[...document.querySelectorAll('.scene-row')].find(row=>row.querySelector('b')?.textContent==='Native test.scn').querySelector('button.primary').click()`);
    await wait(`!!document.querySelector('.coach-dialog[open]')`,60000);
    if(!await run(`document.querySelector('.coach-dialog').textContent.includes('FX 1, FX 2, FX 3, FX 4')`))throw Error('Native preview omitted FX');
    await screenshot('native-scene-preview.png');
    await run(`document.querySelector('.coach-dialog button.primary').click()`);
    await wait(`!document.querySelector('.coach-dialog') && document.body.textContent.includes('Scène .scn rappelée, effets compris.')`,60000);
    const state=await run(`fetch('/api/library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'scene',name:'Native test result',complete:true})}).then(r=>r.json())`);
    if(JSON.stringify(state.data?.fx)!==JSON.stringify(expected.fx))throw Error('Native FX were not restored');
    if(Object.entries(state.data.values).some(([key,v])=>key.endsWith('/phantom')&&v!==0))throw Error('Native recall changed phantom power');
    console.log('Native library smoke: supplied .scn imported, previewed and recalled with 4 FX; 48V unchanged.');
  }
  console.log('Library smoke: channel capture, JSON import, selected recall, complete scene and invalid file verified.');
};
