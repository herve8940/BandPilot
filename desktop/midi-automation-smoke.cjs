/** Synthetic MIDI events are confined to --smoke-test and a disposable simulator profile. */
module.exports=async(win,wait,screenshot)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const api=(path,data)=>js(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${data===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json'},body:${data===undefined?'undefined':JSON.stringify(JSON.stringify(data))}});const v=await r.json();if(!r.ok)throw Error(v.error);return v;})()`);
 if((await api('/api/status')).mode!=='simulation')throw Error('MIDI automation smoke requires simulation');
 const button=async(scope,label)=>{const find=`[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>b.textContent.trim()===${JSON.stringify(label)})`;await wait(`!!(${find})&&!(${find}).matches(':disabled')`);await js(`(${find}).click()`);};
 const input=async(selector,value)=>{
  // Port and command options arrive asynchronously after the connecting click.
  await wait(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&(e.tagName!=='SELECT'||[...e.options].some(o=>o.value===${JSON.stringify(String(value))}));})()`);
  await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  await wait(`document.querySelector(${JSON.stringify(selector)})?.value===${JSON.stringify(String(value))}`);
 };
 const set=async values=>{const p=await api('/api/console/preview',{values});await api('/api/console/apply',{token:p.token,confirm:true});};
 const read=async address=>(await api('/api/console/parameters?prefix='+encodeURIComponent(address))).parameters.find(p=>p.address===address).state.value;
 const waitValue=(address,value)=>wait(`fetch('/api/console/parameters?prefix='+encodeURIComponent(${JSON.stringify(address)})).then(r=>r.json()).then(r=>Math.abs(r.parameters.find(p=>p.address===${JSON.stringify(address)}).state.value-${value})<.001)`);
 const shot=async name=>{await new Promise(r=>setTimeout(r,300));await screenshot(name);};
 await set({'/config/chlink/1-2':0,'/config/chlink/3-4':0,'/ch/01/mix/fader':-12,'/ch/03/mix/on':1});
 const command=await api('/api/library/commands',{name:'DEV delayed pedal',data:{version:1,model:'XR18',steps:[{channel:3,target:'mute',value:1}],delayMs:800}});
 // Header shortcut must reach the panel from Scenes without knowing its former nested location.
 await js("document.querySelector('.quick-tools:not([open]) summary')?.click()");
 await wait("!!document.querySelector('.quick-tools[open] .open-midi')?.getClientRects().length");
 await button('.quick-tools','MIDI');await wait(`document.querySelector('.xs2-tabs button[aria-current=page]')?.textContent==='MIDI'&&!!document.querySelector('.midi-controls[open]')`);
 await js(`(()=>{const port=new EventTarget();Object.assign(port,{id:'dev-synthetic-midi',name:'Contrôleur de test (simulation)',state:'connected',open:async()=>port,close:async()=>port});const output={id:'dev-synthetic-led',name:'Voyants de test (simulation)',state:'connected',send:bytes=>window.__midiOutput.push(bytes)};const access=new EventTarget();Object.assign(access,{inputs:new Map([[port.id,port]]),outputs:new Map([[output.id,output]])});window.__midiPort=port;window.__midiOutput=[];Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>access});})()`);
 const midi=bytes=>js(`(()=>{const e=new Event('midimessage');Object.defineProperty(e,'data',{value:new Uint8Array(${JSON.stringify(bytes)})});window.__midiPort.dispatchEvent(e);})()`);
 await button('.midi-controls','Connecter un périphérique MIDI');await input('.midi-controls>label:nth-of-type(1) select','dev-synthetic-midi');await input('.midi-controls>label:nth-of-type(3) select','twos');await button('.midi-controls','Apprendre la prochaine commande');await midi([0xb0,7,1]);await wait(`document.querySelector('.midi-bindings')?.textContent.includes('CC 1/7')`);
 if(Math.abs(await read('/ch/01/mix/fader')-.475)>.001)throw Error('Learning relative MIDI wrote audio');
 await button('.midi-controls','Activer le contrôle MIDI');await midi([0xb0,7,1]);await waitValue('/ch/01/mix/fader',.48125);await shot('midi-relative.png');await button('.midi-controls','Désactiver le contrôle MIDI');
 await input('.midi-controls>label:nth-of-type(2) select','command:'+command.id);await input('.midi-controls>label:nth-of-type(3) select','absolute');await button('.midi-controls','Apprendre la prochaine commande');await midi([0xc0,6]);await wait(`document.querySelector('.midi-bindings')?.textContent.includes('PROGRAM 1/6')`);
 if(await read('/ch/03/mix/on')!==1)throw Error('Learning program wrote audio');
 await button('.midi-controls','Activer le contrôle MIDI');await wait(`!!document.querySelector('.command-activation')`);await shot('midi-command-review.png');await button('.command-activation','Confirmer l’activation');await wait(`[...document.querySelectorAll('.midi-controls button')].some(b=>b.textContent==='Désactiver le contrôle MIDI')`);
 await midi([0xc0,6]);if(await read('/ch/03/mix/on')!==1)throw Error('Command ignored its delay');await waitValue('/ch/03/mix/on',0);await button('.midi-controls','Désactiver le contrôle MIDI');
 await button('.midi-controls','Annuler la dernière commande');await wait(`!!document.querySelector('.coach-dialog')`);await button('.coach-dialog','Essayer en simulation');await waitValue('/ch/03/mix/on',1);
 // Conditional macro is armed explicitly; a short crossing must be cancelled.
 const auto=await api('/api/library/commands',{name:'DEV conditional mute',data:{version:1,model:'XR18',steps:[{channel:3,target:'mute',value:1}],delayMs:1500,condition:{channel:1,target:'fader',comparison:'above',threshold:-10,hysteresis:.5}}});
 await button('.xs2-tabs','Mélangeur');await wait(`!!document.querySelector('.console-commands summary')`);await js(`document.querySelector('.console-commands summary').click()`);await wait(`[...document.querySelectorAll('.command-card')].some(e=>e.textContent.includes('DEV conditional mute'))`);
 await js(`[...document.querySelectorAll('.command-card')].find(e=>e.textContent.includes('DEV conditional mute')).querySelector('input[type=checkbox]').click()`);await button('.console-commands','Préparer les commandes automatiques');await wait(`!!document.querySelector('.command-activation')`);await button('.command-activation','Confirmer l’activation');await wait(`[...document.querySelectorAll('.console-commands button')].some(b=>b.textContent==='Arrêter les commandes actives')`);
 await set({'/ch/01/mix/fader':-5});await wait(`document.querySelector('.command-automation-actions')?.textContent.includes('Commandes en attente')`);await button('.console-commands','Arrêter les commandes actives');await new Promise(r=>setTimeout(r,1700));if(await read('/ch/03/mix/on')!==1)throw Error('Stopped condition fired later');
 await set({'/ch/01/mix/fader':-15});await button('.console-commands','Préparer les commandes automatiques');await wait(`!!document.querySelector('.command-activation')`);await button('.command-activation','Confirmer l’activation');await wait(`[...document.querySelectorAll('.console-commands button')].some(b=>b.textContent==='Arrêter les commandes actives')`);await set({'/ch/01/mix/fader':-5});await waitValue('/ch/03/mix/on',0);await button('.console-commands','Arrêter les commandes actives');await js(`document.querySelector('.command-automation-actions').scrollIntoView({block:'center'})`);await shot('conditional-command.png');
 await button('.console-commands','Annuler la dernière commande');await wait(`!!document.querySelector('.coach-dialog')`);await button('.coach-dialog','Essayer en simulation');await waitValue('/ch/03/mix/on',1);
 // The native menu emits the same event as the app shortcut.
 await js(`window.dispatchEvent(new Event('xr18-open-midi'))`);await wait(`document.querySelector('.xs2-tabs button[aria-current=page]')?.textContent==='MIDI'`);
 const size=win.getSize(),minimum=win.getMinimumSize();win.setMinimumSize(360,600);win.setSize(480,850);await shot('midi-small.png');if(await js(`(()=>{const e=document.querySelector('.midi-controls');return e.scrollWidth>e.clientWidth+2;})()`))throw Error('MIDI panel overflows');win.setMinimumSize(...minimum);win.setSize(...size);
 console.log('DEV13: header/native-menu MIDI navigation, synthetic relative CC, Program Change delayed command, activation review, conditional trigger, stop-before-delay, exact undo and small layout passed. No physical MIDI ports opened.');
};
