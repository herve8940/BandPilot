// Exercise both soundcheck entry points using the desktop smoke suite's disposable mixer.
module.exports=async function balanceEffects(win,wait,capture){
 const js=source=>win.webContents.executeJavaScript(source);
 const status=await js("fetch('/api/status').then(r=>r.json())");
 if(status.mode!=='simulation'||status.writesEnabled)throw Error('Requires a simulated mixer');
 const click=async(selector,text)=>{
  const target='[...document.querySelectorAll('+JSON.stringify(selector)+')].find(el=>el.getClientRects().length&&!el.disabled&&el.textContent.trim()==='+JSON.stringify(text)+')';
  await wait('(()=>{const el='+target+';if(!el)return false;el.click();return true;})()');
 };
 const value=async(selector,next)=>{
  await wait('!!document.querySelector('+JSON.stringify(selector)+')');
  await js('(()=>{const el=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),"value").set.call(el,'+JSON.stringify(next)+');el.dispatchEvent(new Event(el.tagName==="SELECT"?"change":"input",{bubbles:true}));})()');
 };
 const next=async(step)=>{
  await wait('(()=>{const el=document.querySelector(".coach-bottom button.primary");if(!el||el.disabled||!el.textContent.includes('+JSON.stringify(step)+'))return false;el.click();return true;})()');
 };
 const selectFx=async(source,style,level,total)=>{
  await value('[aria-label="Source à traiter"]',source);
  await click('.vocal-styles button b',style);
  await value('[aria-label="Dosage en façade"]',level);
  await click('.vocal-kit button','Préparer mon ambiance');
  await click('.vocal-preview button','Essayer en simulation');
  await click('.vocal-current button','Garder cette ambiance');
  await wait("document.querySelectorAll('.balance-fx-rack button').length==="+total+"&&document.querySelector('.vocal-current')?.textContent.includes('ambiance conservée')");
 };
 const save=async(name)=>{
  await value('.coach-section .coach-channel input[maxlength="120"]',name);
  await click('.coach-section button','Sauvegarder ma balance');
  await wait("document.querySelector('.coach-toast')?.textContent.includes("+JSON.stringify(name)+")");
  const scene=await js("fetch('/api/library').then(r=>r.json()).then(rows=>rows.find(s=>s.kind==='scene'&&s.name==="+JSON.stringify(name)+")?.data)");
  if(scene?.fx?.length!==4||scene.fx[0].algorithm!==0||scene.fx[1].algorithm!==5||scene.fx[2].algorithm!==10)throw Error('Missing FX in saved scene '+name);
  for(const address of ['/ch/01/mix/07/level','/ch/02/mix/08/level','/ch/01/mix/09/level'])if(!(scene.values[address]>0))throw Error('Missing send '+address);
  for(const address of ['/ch/02/mix/07/level','/ch/01/mix/08/level','/ch/02/mix/09/level'])if(scene.values[address]!==0)throw Error('An effect reached the wrong instrument at '+address);
 };
 await js('document.querySelector(\'button[title="Balance"]\').click()');
 await wait("!!document.querySelector('.balance-start')");
 await click('.balance-start strong','Partir d’une scène vierge');
 await click('.coach-dialog button','Essayer en simulation');
 await wait("!!document.querySelector('.coach-inputs')");
 await click('.coach-actions button','Ajouter un instrument');
 await click('.coach-actions button','Ajouter un instrument');
 await value('.coach-input2:nth-child(1) input','Voix');
 await js("(()=>{const s=document.querySelectorAll('.coach-input2')[1].querySelectorAll('select')[1];s.value='snare';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
 await next('Préparer les instruments');
 await click('.coach-dialog button','Essayer en simulation');
 await wait("!!document.querySelector('.in-step .gain-picker')");
 await next('Écoute');
 await click('.coach-actions button','Effets par instrument');
 await js('window.__balanceConfirm=window.confirm;window.confirm=()=>true;true');
 try{
  await selectFx('1','Naturelle','-18',1);
  // Move straight to the snare while the vocal FX card is still selected.
  await selectFx('2','Plaque caisse claire','-12',2);
  await js("document.querySelectorAll('.balance-fx-rack button')[0].click()");
  await wait("document.querySelector('[aria-label=\"Dosage en façade\"]').value==='-18'");
  await click('.vocal-kit button','Ajouter un effet');
  await selectFx('1','Écho court','-24',3);
  await js("document.querySelectorAll('.balance-fx-rack button')[2].click()");
  await wait("document.querySelector('[aria-label=\"Dosage en façade\"]').value==='-24'");
  await js("document.querySelector('.vocal-kit').scrollIntoView({block:'start'})");
  await capture('effets-balance.png');
  const bounds=win.getBounds(),minimum=win.getMinimumSize();
  try{
   win.setMinimumSize(320,480);win.setSize(390,760);
   await wait("innerWidth<=420&&document.querySelector('.balance-fx-rack')&&document.documentElement.scrollWidth<=innerWidth+1");
   await capture('effets-balance-mobile.png');
  }finally{win.setBounds(bounds);win.setMinimumSize(...minimum);}
 }finally{await js('window.confirm=window.__balanceConfirm;delete window.__balanceConfirm');}
 await next('Retours');
 await click('.coach-section button','Proposer les musiciens d’après mon groupe');
 await wait("document.querySelectorAll('.coach-musician').length>=1");
 await click('.coach-musician button','Préparer les réglages');
 await click('.coach-dialog button','Essayer en simulation');
 await next('Sauvegarde');
 await save('Test effets scène vierge');
 await click('.balance-back','Vue d’ensemble');
 await click('.balance-start strong','Reprendre le mélangeur actuel');
 await wait("document.querySelectorAll('.balance-pick input').length>=2");
 await js("document.querySelectorAll('.balance-pick input')[0].click()");
 await js("document.querySelectorAll('.balance-pick input')[1].click()");
 await next('Continuer avec la sélection');
 await wait("!!document.querySelector('.in-step .gain-picker')");
 await next('Écoute');
 await click('.coach-actions button','Effets par instrument');
 await wait("document.querySelectorAll('.balance-fx-rack button').length===3");
 await next('Retours');
 await wait("!!document.querySelector('.balance-monitor-step')");
 await next('Sauvegarde');
 await save('Test effets reprise');
 console.log('Balance validated: vocals on FX1, direct switch to snare on FX2, second vocal FX on FX3; saved routing in both journeys.');
};
