/** Real renderer against an isolated simulator; never uses a physical mixer or MIDI. */
module.exports=async(win,wait,screenshot)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const api=(path,data)=>js(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${data===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json'},body:${data===undefined?'undefined':JSON.stringify(JSON.stringify(data))}});const result=await r.json();if(!r.ok)throw Error(result.error);return result;})()`);
 if((await api('/api/status')).mode!=='simulation')throw Error('Mix completion smoke requires simulation');
 const button=async(scope,label)=>{const find=`[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>b.textContent.trim()===${JSON.stringify(label)})`;await wait(`!!(${find})&&!(${find}).matches(':disabled')`);await js(`(${find}).click()`);};
 const input=async(selector,value)=>{await wait(`!!document.querySelector(${JSON.stringify(selector)})&&!document.querySelector(${JSON.stringify(selector)}).matches(':disabled')`);await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);};
 const set=async values=>{const p=await api('/api/console/preview',{values});await api('/api/console/apply',{token:p.token,confirm:true});};
 const read=async address=>(await api('/api/console/parameters?prefix='+encodeURIComponent(address))).parameters.find(p=>p.address===address).state?.value;
 const waitValue=(address,value)=>wait(`fetch('/api/console/parameters?prefix='+encodeURIComponent(${JSON.stringify(address)})).then(r=>r.json()).then(v=>Math.abs(v.parameters.find(p=>p.address===${JSON.stringify(address)}).state.value-${value})<.003)`);
 const initialTopology=Object.fromEntries((await Promise.all(['/config/chlink/1-2','/config/chlink/3-4'].map(async a=>[a,await read(a)]))).filter(([,v])=>v!==undefined));
 await set({'/config/chlink/1-2':0,'/config/chlink/3-4':0,'/config/buslink/1-2':0,'/ch/01/mix/fader':-15,'/ch/02/mix/fader':-15,'/ch/01/mix/02/level':-20,'/ch/02/mix/02/level':-20,'/ch/01/mix/02/tap':3,'/ch/02/mix/02/tap':3,'/ch/01/preamp/hpon':0,'/ch/03/preamp/hpon':0});
 await api('/api/rehearsal',{on:false});
 const definitions=await api('/api/library/parameter-links');await api('/api/library/parameter-links',{...definitions,links:[{channels:[1,3],setting:'hpon',band:1}]});
 const library=await api('/api/expert-surfaces?model=XR18'),widget={label:'',channel:1,bus:1,y:0,width:4,height:4};
 await api('/api/expert-surfaces',{...library,surfaces:[{id:'mixing-completion',name:'Groupes et traitements',widgets:[
  {...widget,id:'main',kind:'group',label:'Groupe façade',x:0,members:[1,2],mix:0},
  {...widget,id:'monitor',kind:'group',label:'Groupe retour 2',x:4,members:[1,2],mix:2},
  {...widget,id:'hpf-one',kind:'parameter',label:'Entrée 1',x:8,height:2,setting:'hpon',band:1},
  {...widget,id:'hpf-three',kind:'parameter',label:'Entrée 3',channel:3,x:8,y:2,height:2,setting:'hpon',band:1}
 ]}]});
 // Metadata was replaced through the API, as if from another screen. Reload
 // before arming so a previous suite's cached revision cannot be used.
 await win.loadURL(win.webContents.getURL());
 await wait(`!!document.querySelector('button[title="Console"]')`);
 await js(`document.querySelector('button[title="Console"]').click()`);await button('.subnav','Mixage');await button('body','Expert');await button('.xs2-tabs','Surfaces');
 for(let round=0;round<3;round++)for(const view of ['Canal','Mélangeur','Surfaces']){
  await button('.xs2-tabs',view);
  await wait(`document.querySelectorAll('.channel-preset-tools').length===${view==='Surfaces'?0:1}`);
 }
 await screenshot('mixing-surfaces-no-duplicate-presets.png');
 await wait(`document.querySelectorAll('.bank-group-fader button').length===2`);
 const originalConfirm=await js(`Boolean(window.__mixOriginalConfirm)`);if(originalConfirm)throw Error('Leaked confirmation stub');
 await js(`window.__mixOriginalConfirm=window.confirm;window.confirm=()=>true;Object.defineProperty(document,'hidden',{configurable:true,value:false});true;`);
 try{
  await button('.bank-group-fader','Activer le fader continu');await wait(`document.querySelectorAll('.bank-group-fader input[type=range]').length===1`);
  await button('.bank-group-fader','Activer le fader continu');await wait(`document.querySelectorAll('.bank-group-fader input[type=range]').length===2`);
  await input('.surface-widget:nth-child(1) input[type=range]',2);await waitValue('/ch/01/mix/fader',.4625);
  await input('.surface-widget:nth-child(2) input[type=range]',-3);await waitValue('/ch/01/mix/02/level',.3375);
  if(Math.abs(await read('/ch/01/mix/fader')-.4625)>.003)throw Error('Monitor group modified the main mix');
  await screenshot('mixing-surface-groups.png');
  await button('.bank-group-fader','Arrêter le fader continu');await button('.bank-group-fader','Arrêter le fader continu');
  await button('.parameter-links-switch','Activer les liens de pistes');
  await wait(`document.querySelector('.parameter-links-switch [aria-pressed=true]')!==null`);
  await js(`document.querySelector('.surface-widget:nth-child(3) button[aria-label="Coupe-bas actif"]').click()`);await waitValue('/ch/01/preamp/hpon',1);await waitValue('/ch/03/preamp/hpon',1);
  await button('.xs2-tabs','Mélangeur');await wait(`!!document.querySelector('.parameter-links-switch [aria-pressed=true]')`);
  await screenshot('mixing-links-all-views.png');await button('.parameter-links-switch','Désactiver les liens de pistes');
  await require('./mixing-controls-smoke.cjs')({js,api,set,read,wait,waitValue,button,input,screenshot});
 }finally{await js(`window.confirm=window.__mixOriginalConfirm;delete window.__mixOriginalConfirm;delete document.hidden;`);}
 // Exercise a stereo pair in the shipped portable mapping interface.
 await set({'/config/chlink/1-2':1,'/config/chlink/3-4':1,'/config/linkcfg/fdrmute':1,'/ch/01/mix/on':1,'/ch/02/mix/on':1,'/ch/03/mix/on':1,'/ch/04/mix/on':1,'/ch/01/mix/fader':-12,'/ch/02/mix/fader':-12,'/ch/03/mix/fader':-18,'/ch/04/mix/fader':-18});
 await js(`document.querySelector('button[title="Sauvegarder ou rappeler une scène"]').click()`);await wait(`[...document.querySelectorAll('.library-nav button')].some(b=>b.textContent.includes('Scènes portables'))`);await js(`[...document.querySelectorAll('.library-nav button')].find(b=>b.textContent.includes('Scènes portables')).click()`);
 await input('.portable-scenes input[maxlength="120"]','Stereo integration');await button('.portable-scenes','Créer une scène portable');
 await input('.portable-mapping select','3');
 const pairValue=await js(`document.querySelector('.portable-mapping select').selectedOptions[0].textContent`);if(!pairValue.includes('3 / 4'))throw Error('Stereo mapping did not offer pairs');
 await js(`document.querySelectorAll('.portable-scenes .portable-toggle input')[1].click()`);await button('.portable-scenes','Prévisualiser le rappel portable');
 if(Math.abs(await read('/ch/03/mix/fader')-.4)>.003)throw Error('Stereo preview wrote audio');
 await screenshot('mixing-portable-stereo.png');await button('.coach-dialog','Essayer en simulation');await wait(`!document.querySelector('.coach-dialog')`);await waitValue('/ch/03/mix/fader',.475);
 const backup=(await api('/api/library')).find(e=>e.kind==='portable-scene-backup');const undo=await api('/api/library/'+backup.id+'/preview',{});await api('/api/library/'+backup.id+'/apply',{token:undo.token,confirm:true});await waitValue('/ch/03/mix/fader',.4);
 // The next rehearsal fixture expects its original mono/stereo input topology.
 if(Object.keys(initialTopology).length)await set(initialTopology);
 console.log('Mix completion: two surface groups, linked controls across views, stereo portable mapping/apply/undo passed in the packaged renderer.');
};
