/** Exercise the renderer and isolated console, with synthetic microphone frames only. */
module.exports=async(win,wait,screenshot)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const api=(path,data)=>js(`(async()=>{
  const r=await fetch(${JSON.stringify(path)},{method:${data===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json'},body:${data===undefined?'undefined':JSON.stringify(JSON.stringify(data))}});
  const result=await r.json();if(!r.ok)throw Error(result.error);return result;
 })()`);
 const button=async(scope,label)=>{
  const found=`[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(el=>el.textContent.trim()===${JSON.stringify(label)})`;
  await wait(`!!(${found})&&!(${found}).matches(':disabled')`);
  await js(`(${found}).click()`);
 };
 const input=(selector,value)=>js(`(()=>{
  const field=document.querySelector(${JSON.stringify(selector)});
  const prop=Object.getOwnPropertyDescriptor(field.constructor.prototype,'value');
  prop.set.call(field,${JSON.stringify(value)});
  field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));
 })()`);
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
 if((await api('/api/status')).mode!=='simulation')throw Error('DEV17 smoke requires simulation');
 await button('.xs2-tabs','Surfaces');
 await button('.surface-editor','Nouvelle surface');
 await input('.surface-editor input[maxlength="48"]','DEV17 Test Surface');
 await button('.surface-editor','Ajouter un élément');
 await input('.surface-inspector input[maxlength="48"]','Test lead');
 await input('.surface-inspector input[type=number]',3);
 await input('.surface-inspector select','mute');
 await button('.surface-editor','Ajouter un élément');
 const faderBefore=await read('/ch/01/mix/fader');
 await screenshot('surface-editor.png');
 await button('.surface-editor','Enregistrer la surface');
 await wait(`!!document.querySelector('.surface-editor [role=slider]:not([aria-disabled=true])')`);
 if(await read('/ch/01/mix/fader')!==faderBefore)throw Error('Surface editor wrote a console setting');
 const surfaces=await api('/api/expert-surfaces?model=XR18');
 if(surfaces.surfaces[0]?.widgets[0]?.x!==2||surfaces.surfaces[0]?.widgets[1]?.kind!=='mute')throw Error('Surface failed to persist position and controls');
 await js(`document.querySelector('.surface-editor [role=slider]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);
 await wait(`fetch('/api/console/parameters?prefix=/ch/01/mix/fader').then(r=>r.json()).then(v=>v.parameters[0]?.state.value!==${faderBefore})`);
 await button('.xs2-tabs','Analyse');
 await wait(`!!document.querySelector('.mix-preparation')`);
 await js(`document.querySelector('.mix-preparation').open=true`);
 await wait(`!!document.querySelector('.acoustic-capture')`);
 await set({'/lr/eq/mode':1,'/lr/eq/on':1,'/lr/geq/1k':0});
 const original=await read('/lr/geq/1k');
 await js(`(()=>{
  const originalContext=window.AudioContext,originalGetUserMedia=navigator.mediaDevices.getUserMedia;
  const hidden=Object.getOwnPropertyDescriptor(document,'hidden');
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  let captures=0,stopped=0,closed=0;
  window.__bp17Fixture={
   counts:()=>({captures,stopped,closed}),restore:()=>{
    window.AudioContext=originalContext;navigator.mediaDevices.getUserMedia=originalGetUserMedia;
    if(hidden)Object.defineProperty(document,'hidden',hidden);else delete document.hidden;
   }
  };
  navigator.mediaDevices.getUserMedia=async()=>{
   captures++;
   const track={getSettings:()=>({deviceId:'synthetic'}),addEventListener(){},stop(){stopped++;}};
   return {getTracks:()=>[track],getAudioTracks:()=>[track]};
  };
  window.AudioContext=class {
   sampleRate=48000;
   start=performance.now();
   get currentTime(){return (performance.now()-this.start)/140;}
   createMediaStreamSource(){return {connect(){}};}
   createAnalyser(){
    return {fftSize:16384,frequencyBinCount:8192,smoothingTimeConstant:0,
     getFloatTimeDomainData(buffer){buffer.fill(.04);},
     getFloatFrequencyData(buffer){
      for(let i=0;i<buffer.length;i++){
       const hz=Math.max(40,i*48000/16384);
       buffer[i]=(captures%2===1?-95:-45)-10*Math.log10(hz/1000)+(captures%2===0&&hz>=895&&hz<=1120?12:0);
      }
     }
    };
   }
   async resume(){}
   async close(){closed++;}
  };
 })()`);
 try{
  await button('.acoustic-capture','Mesurer le bruit de fond');
  await button('.acoustic-capture','Mesurer le bruit rose');
  await wait(`!!document.querySelector('.acoustic-curve polyline')`);
  if(await read('/lr/geq/1k')!==original)throw Error('Acoustic capture wrote EQ');
  const counts=await js('window.__bp17Fixture.counts()');
  if(counts.captures!==2||counts.stopped!==2||counts.closed!==2)throw Error('Microphone capture did not release its resources');
  await js(`document.querySelector('.acoustic-curve').scrollIntoView({block:'center'})`);
  await screenshot('acoustic-curve.png');
  await button('.mix-preparation','Prévisualiser la sélection');
  if(await read('/lr/geq/1k')!==original)throw Error('Acoustic preview wrote EQ');
  await confirm();
  if(await read('/lr/geq/1k')>=original)throw Error('Expected acoustic cut at 1 kHz');
  await button('.mix-preparation','Annuler la dernière commande');
  await confirm();
 }finally{await js('window.__bp17Fixture.restore();delete window.__bp17Fixture');}

 await set({'/config/chlink/1-2':0,'/config/chlink/3-4':0,'/ch/01/config/name':'Dev source','/ch/03/config/name':'Dev target'});
 await js(`document.querySelector('button[title="Sauvegarder ou rappeler une scène"]').click()`);
 await wait(`[...document.querySelectorAll('.library-nav button')].some(b=>b.textContent.includes('Scènes portables'))`);
 await js(`[...document.querySelectorAll('.library-nav button')].find(b=>b.textContent.includes('Scènes portables')).click()`);
 await input('.portable-scenes input[maxlength="120"]','DEV17 Portable');
 await button('.portable-scenes','Créer une scène portable');
 await wait(`document.querySelectorAll('.portable-mapping select').length>0`);
 await input('.portable-mapping select','3');
 await js(`document.querySelector('.portable-scenes .portable-toggle input').click()`);
 await screenshot('portable-mapping.png');
 await button('.portable-scenes','Prévisualiser le rappel portable');
 if(await read('/ch/03/config/name')!=='Dev target')throw Error('Portable preview wrote console data');
 await confirm();
 if(await read('/ch/03/config/name')!=='Dev source')throw Error('Portable recall missed its mapped target');
 const entries=await api('/api/library'),backup=entries.find(e=>e.kind==='portable-scene-backup');
 if(!backup)throw Error('Portable recall did not create its backup');
 const undo=await api('/api/library/'+backup.id+'/preview',{});
 await api('/api/library/'+backup.id+'/apply',{token:undo.token,confirm:true});
 if(await read('/ch/03/config/name')!=='Dev target')throw Error('Portable undo failed');
 console.log('DEV17: surfaces persisted and controlled simulated fader, synthetic two-stage acoustic measurement preview/apply/undo, portable scene capture/mapping/recall/undo passed.');
};
