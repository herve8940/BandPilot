/** Full scene-pedal workflow on the disposable simulator. No physical MIDI port is opened. */
module.exports=async(win,wait,screenshot)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const api=(path,data)=>js(`(async()=>{
  const response=await fetch(${JSON.stringify(path)},{method:${data===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json'},body:${data===undefined?'undefined':JSON.stringify(JSON.stringify(data))}});
  const result=await response.json();
  if(!response.ok)throw Error(result.error);
  return result;
 })()`);
 if((await api('/api/status')).mode!=='simulation')throw Error('MIDI scene test requires simulation');
 const button=async(scope,label)=>{
  const find=`[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>b.textContent.trim()===${JSON.stringify(label)})`;
  await wait(`!!(${find})&&!(${find}).matches(':disabled')`);
  await js(`(${find}).click()`);
 };
 const select=async(selector,value)=>{
  const find=`document.querySelector(${JSON.stringify(selector)})`;
  await wait(`!!(${find})&&[...(${find}).options].some(option=>option.value===${JSON.stringify(value)})`);
  await js(`(()=>{const select=${find};select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 };
 const set=async values=>{
  const plan=await api('/api/console/preview',{values});
  await api('/api/console/apply',{token:plan.token,confirm:true});
 };
 const address='/ch/13/mix/fader',other='/ch/14/mix/fader';
 const parameters=channel=>'/api/console/parameters?prefix='+encodeURIComponent(channel);
 const read=async channel=>(await api(parameters(channel))).parameters.find(p=>p.address===channel).state.value;
 await set({'/config/chlink/13-14':0,[address]:-8,[other]:-11});
 const scene=await api('/api/library',{kind:'scene',name:'DEV MIDI scene',complete:true});
 const desired=await read(address);
 await set({[address]:-19,[other]:-23});
 const original=await read(address),otherBefore=await read(other);
 await js(`document.querySelector('button[title="Sauvegarder ou rappeler une scène"]').click()`);
 const row=`[...document.querySelectorAll('.scene-row')].find(row=>row.textContent.includes('DEV MIDI scene'))`;
 await wait(`!!(${row})`);
 await js(`(${row}).querySelector('button:nth-child(2)').click()`);
 await wait(`document.querySelectorAll('.scene-recall-channels input').length===16`);
 await js(`document.querySelectorAll('.scene-recall-channels input')[12].click();
  const checks=document.querySelectorAll('.scene-recall-sections input');
  for(let i=0;i<checks.length;i++)if(checks[i].checked!==(i===3))checks[i].click();
  document.querySelector('.scene-midi-setup summary').click();`);
 await button('.scene-midi-setup','Enregistrer la sélection MIDI');
 await wait(`[...document.querySelectorAll('.scene-recall-panel [role=status]')].some(p=>p.textContent.includes('Sélection MIDI enregistrée'))`);
 const cue=(await api('/api/library/midi-scenes')).find(item=>item.data.sourceId===scene.id);
 if(!cue||await read(address)!==original)throw Error('Saving the MIDI selection changed the console or did not save');
 await button('.topbar','MIDI');
 await wait(`!!document.querySelector('.midi-controls[open]')`);
 await js(`(()=>{
  const port=new EventTarget();
  Object.assign(port,{id:'scene-test-pedal',name:'Pédale de test',state:'connected',open:async()=>port,close:async()=>port});
  const access=new EventTarget();
  Object.assign(access,{inputs:new Map([[port.id,port]]),outputs:new Map()});
  Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>access});
  window.bandpilotTestScenePedal=pressed=>{
   const event=new Event('midimessage');
   Object.defineProperty(event,'data',{value:new Uint8Array([pressed?0x90:0x80,36,pressed?100:0])});
   port.dispatchEvent(event);
  };
 })()`);
 await button('.midi-controls','Connecter un périphérique MIDI');
 await select('.midi-controls>label:nth-of-type(1) select','scene-test-pedal');
 await select('.midi-controls>label:nth-of-type(2) select','command:'+cue.id);
 await button('.midi-controls','Apprendre la prochaine commande');
 await js('window.bandpilotTestScenePedal(true);window.bandpilotTestScenePedal(false)');
 await wait(`document.querySelector('.midi-bindings').textContent.includes('NOTE 1/36')`);
 await button('.midi-controls','Activer le contrôle MIDI');
 await wait(`document.querySelector('.command-activation[open]')?.textContent.includes('Valeurs cibles de la scène')`);
 await js(`document.querySelector('.command-activation-list details').open=true`);
 await new Promise(resolve=>setTimeout(resolve,300));
 await screenshot('midi-scene-review.png');
 if(await read(address)!==original)throw Error('MIDI learning or review changed the mixer');
 await button('.command-activation','Confirmer l’activation');
 await wait(`[...document.querySelectorAll('.midi-controls button')].some(b=>b.textContent==='Désactiver le contrôle MIDI')`);
 if(await read(address)!==original)throw Error('Arming without a MIDI event changed the mixer');
 await js('window.bandpilotTestScenePedal(true);window.bandpilotTestScenePedal(false)');
 const waitLevel=value=>wait(`fetch(${JSON.stringify(parameters(address))}).then(r=>r.json()).then(r=>r.parameters[0]?.state.value===${value})`);
 await waitLevel(desired);
 if(await read(other)!==otherBefore)throw Error('MIDI selective recall changed an unselected channel');
 await button('.midi-controls','Annuler la dernière commande');
 await wait(`!!document.querySelector('.coach-dialog[open]')`);
 await button('.coach-dialog','Essayer en simulation');
 await waitLevel(original);
 await wait(`!document.querySelector('.coach-dialog')`);
 await js('window.bandpilotTestScenePedal(true);window.bandpilotTestScenePedal(false)');
 await new Promise(resolve=>setTimeout(resolve,500));
 if(await read(address)!==original)throw Error('Scene recalled after MIDI was stopped');
 console.log('DEV15: saved a scoped scene through the UI, learned a synthetic MIDI note, reviewed and armed without writes, recalled only the selected input, restored previous values and verified disarm.');
};
