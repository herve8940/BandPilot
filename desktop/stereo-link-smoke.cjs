/** Linked stereo L/R regression in the disposable Mac simulation profile. */
module.exports=async(win,wait,screenshot)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 const api=(path,data)=>js(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${data===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json'},body:${data===undefined?'undefined':JSON.stringify(JSON.stringify(data))}});const v=await r.json();if(!r.ok)throw Error(v.error);return v;})()`);
 if((await api('/api/status')).mode!=='simulation')throw Error('Linked stereo smoke requires simulation');
 const set=async values=>{const p=await api('/api/console/preview',{values});return api('/api/console/apply',{token:p.token,confirm:true});};
 const read=async a=>(await api('/api/console/parameters?prefix='+encodeURIComponent(a))).parameters.find(p=>p.address===a).state.value;
 await set({'/config/chlink/1-2':1,'/config/chlink/3-4':1,'/config/linkcfg/preamp':1,'/config/linkcfg/eq':0,'/config/linkcfg/dyn':0,'/config/linkcfg/fdrmute':0,'/ch/01/preamp/hpf':50,'/ch/02/preamp/hpf':50,'/ch/03/preamp/hpf':50,'/ch/04/preamp/hpf':50,'/ch/01/preamp/hpon':0,'/ch/02/preamp/hpon':0,'/ch/03/preamp/hpon':0,'/ch/04/preamp/hpon':0,'/ch/01/eq/1/g':4,'/ch/02/eq/1/g':-2,'/ch/03/eq/1/g':1,'/ch/04/eq/1/g':-3});
 const before=[await read('/ch/03/eq/1/g'),await read('/ch/04/eq/1/g')];
 const preset=await api('/api/library/capture-channel',{name:'DEV linked L/R',channel:1,sections:['eq'],stereo:true});
 if(!preset.data.linked)throw Error('Linked source metadata lost');
 await win.loadURL(win.webContents.getURL());await wait(`!!document.querySelector('button[title="Sauvegarder ou rappeler une scène"]')`);
 await js(`document.querySelector('button[title="Sauvegarder ou rappeler une scène"]').click()`);await wait(`!!document.querySelector('.preset-save:not([disabled])')`);
 await js(`[...document.querySelectorAll('.library-nav button')].find(b=>b.textContent.includes('Presets par piste')).click()`);
 await js(`[...document.querySelectorAll('.preset-row')].find(e=>e.textContent.includes('DEV linked L/R')).id='smoke-linked';document.querySelector('#smoke-linked .preset-card-actions>button').click();(()=>{const e=document.querySelector('#smoke-linked select');e.value='3';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await js(`document.querySelector('#smoke-linked button.primary').click()`);await wait(`!!document.querySelector('.coach-dialog[open] .coach-stereo-summary')`);
 if(!await js(`(()=>{const e=document.querySelector('.coach-stereo-summary');return e.textContent.includes('Indépendants gauche/droite :')&&e.textContent.includes('Égaliseur');})()`))throw Error('Independent EQ missing from stereo summary');
 await js(`document.querySelector('.coach-dialog details').open=true`);await screenshot('linked-stereo-preview.png');
 await js(`document.querySelector('.coach-dialog .coach-dialog-foot button').click()`);
 if(await read('/ch/03/eq/1/g')!==before[0]||await read('/ch/04/eq/1/g')!==before[1])throw Error('Cancelled linked preview wrote audio');
 await js(`document.querySelector('#smoke-linked button.primary').click()`);await wait(`!!document.querySelector('.coach-dialog[open]')`);
 await js(`document.querySelector('.coach-dialog button.primary').click()`);await wait(`!document.querySelector('.coach-dialog')&&document.querySelector('.scene-msg')?.textContent.includes('Preset appliqué')`);
 if(await read('/ch/03/eq/1/g')!==await read('/ch/01/eq/1/g')||await read('/ch/04/eq/1/g')!==await read('/ch/02/eq/1/g'))throw Error('Linked recall lost the independent sides');
 const backups=(await api('/api/library')).filter(e=>e.kind==='channel-operation-backup').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),backup=backups[0];
 const undo=await api(`/api/library/${backup.id}/preview`,{});await api(`/api/library/${backup.id}/apply`,{token:undo.token,confirm:true});
 if(await read('/ch/03/eq/1/g')!==before[0]||await read('/ch/04/eq/1/g')!==before[1])throw Error('Linked undo lost distinct prior values');
 // Sharing a family makes this preset incompatible; the UI must explain rather than change the global option.
 await set({'/config/linkcfg/eq':1});await js(`document.querySelector('#smoke-linked button.primary').click()`);
 await wait(`document.querySelector('.scene-msg[role=alert]')?.textContent.includes('égaliseur est partagé')`);
 if(await read('/config/linkcfg/eq')!==1||await read('/ch/03/eq/1/g')!==before[0])throw Error('Conflict changed the console');
 await screenshot('linked-stereo-conflict.png');await set({'/config/linkcfg/eq':0});
 // The same relative EQ change preserves the distinct sides of the linked pair.
 const pair=await api('/api/library/group-adjust/preview',{channels:[3,4],target:'eq',band:1,delta:-1});
 if(!pair.stereoLink?.independent.includes('eq'))throw Error('Grouped preview lost independence metadata');
 const applied=await api('/api/library/group-adjust/apply',{token:pair.token,confirm:true});
 const restore=await api(`/api/library/${applied.backupId}/preview`,{});await api(`/api/library/${applied.backupId}/apply`,{token:restore.token,confirm:true});
 await js(`document.querySelector('#smoke-linked button.primary').click()`);await wait(`!!document.querySelector('.coach-dialog[open]')`);
 const size=win.getSize(),minimum=win.getMinimumSize();win.setMinimumSize(360,600);win.setSize(420,860);await new Promise(r=>setTimeout(r,300));
 if(await js(`(()=>{const e=document.querySelector('.coach-stereo-summary');return e.scrollWidth>e.clientWidth+2;})()`))throw Error('Stereo summary overflows');
 await screenshot('linked-stereo-small.png');await js(`document.querySelector('.coach-dialog .coach-dialog-foot button').click()`);win.setMinimumSize(...minimum);win.setSize(...size);
 if(await read('/config/chlink/3-4')!==1||await read('/config/linkcfg/preamp')!==1||await read('/config/linkcfg/eq')!==0)throw Error('Link preferences altered by recall or grouped adjustment');
 console.log('Linked stereo: asymmetric L/R capture, preview, cancel, apply/undo, shared-family conflict, relative group adjustment and narrow preview passed.');
};
