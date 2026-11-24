const fs=require('node:fs');
const path=require('node:path');

function createFixture(dataPath){
 const root=path.join(dataPath,'reaper-fixture'),mailbox=path.join(root,'XR18Studio');
 fs.mkdirSync(mailbox,{recursive:true});
 const tabs=['Fixture Intro','Fixture Refrain','Fixture Outro'].map((title,i)=>({title,id:'749ca10929964f299170435498204f79-'+(i+1),number:i+1,saved:true,current:i===0,duration:10+i}));
 const take={id:'cafecafecafecafecafecafecafecafe',number:1,stamp:1700000000,first:2,last:6,partial:false,channels:2};
 const track='{7B66BA3D-9500-4065-85E0-C530DC2027A3}';
 const marks=[{id:'m1',pos:2,name:'Début'},{id:'m2',pos:6,name:'Fin'},{id:'r7',pos:2,name:'Refrain'},{id:'e7',pos:6,name:'Refrain',ending:true},{id:'r8',pos:6,name:'Refrain'},{id:'e8',pos:10,name:'Refrain',ending:true}];
 let selectedTab=tabs[0].id;
 let active='',transport='idle',source='original',from=0,to=10,noticed,recorded,loopStart,leavingAt,ends=0;
 const calls=[],settings=new Map(),guideLevels=new Map();
 const guideId='{BD2C8018-5D5F-4ADC-8E3D-87474C58BF14}';
 const update=()=>{
  if(ends&&Date.now()>=ends){
   if(transport==='recording'){recorded=active;noticed={kind:'take',project:active,number:1};}
   transport='idle';active='';ends=0;
  }
 };
 const snapshot=(id,detail)=>{
  update();
  const selected=active||id||selectedTab;
  const prefs=settings.get(selected)??{armed:true,autoSave:false};
  return {tabs,active:active||undefined,transport,owned:!!active,notice:noticed,project:{
   id:selected,during:active?(transport==='recording'?'record':'play'):undefined,original:track,choices:[{id:track,name:'Original'}],marks,start:0,ending:10,endMarker:'',autoSave:prefs.autoSave,
   takes:recorded===selected?[take]:[],armed:prefs.armed?1:0,pos:from,loopStart,leavingAt,stopAt:active?to:undefined,source,dirty:!!recorded,
   guides:[{id:guideId,name:'Métronome',volume:guideLevels.get(selected)??1,mute:false}],
   inputs:2,recordTracks:[{id:track,name:'REC Voix',channels:[1],available:true,armed:prefs.armed}],
   ...(detail?{picture:{tracks:[{id:track,index:0,name:tabs.find(t=>t.id===selected).title+' · Entrée',rec:false,mute:false,solo:false,armed:false,
    items:[{pos:0,length:10,takes:[{index:0,name:'Original',file:'fixture',active:true}]}]}],regions:[{start:2,stop:6,name:'Refrain'}]}}:{}),
  }};
 };
 const answer=src=>{
  const fields=Object.fromEntries([...src.matchAll(/\["([a-z_]+)"\]="([^"]+)"/g)].map(m=>[m[1],m[2]]));
  const cmd=fields.cmd,read=field=>fields[field];
  const id=read('project'),action=read('action');
  if(cmd==='transport')return {playing:!!active,recording:transport==='recording',pos:from};
  if(cmd==='state')return {version:'1.5.2',project:'Concert test',concert:'Concert test',tracks:[],songs:[{title:'Ouverture',start:0,stop:90,countin:0},{title:'Rappel',start:90,stop:180,countin:90}],regions:[],playing:false,recording:false,pos:0,length:180,loop:{on:false,start:0,stop:0}};
  if(cmd==='rehearsal_state'){
   const data=snapshot(id,src.includes('["detail"]=true'));
   if(src.includes('["files"]=true'))data.tabs=data.tabs.map(t=>({...t,filePath:path.join(root,t.title+'.rpp')}));
   return data;
  }
  if(cmd==='rehearsal_peaks')return {peaks:Array.from({length:480},(_,i)=>Math.abs(Math.sin(i*.12)))};
  if(cmd!=='rehearsal_command')throw Error('Commande hors du test');
  calls.push({id,action,source:read('source'),a:read('a'),b:read('b')});
  if(action==='guideVolume'&&read('track')===guideId)guideLevels.set(id,Number(src.match(/\["volume"\]=([\d.e+-]+)/)?.[1]));
  if(action==='select')selectedTab=id;
  if(action==='play'||action==='record'){
   active=id;transport=action==='play'?'playing':'recording';source=read('source')||'backing';noticed=undefined;
   from=read('a')?2:0;to=read('b')?6:10;
   ends=Date.now()+(action==='record'?1100:650);
   leavingAt=undefined;loopStart=read('a')==='r7'?2:undefined;
   if(loopStart!==undefined)ends=0;
  }else if(action==='leaveLoop'){loopStart=undefined;leavingAt=6;to=10;ends=Date.now()+2000;}
  else if(action==='marker')noticed={kind:'marker',project:id};
  else if(action==='arm'||action==='setup'){
   const prefs=settings.get(id)??{armed:true,autoSave:false};
   if(action==='arm')prefs.armed=src.includes('["on"]=true');
   else prefs.autoSave=src.includes('["autoSave"]=true');
   settings.set(id,prefs);
  }
  return snapshot(id,src.includes('["detail"]=true'));
 };
 const pending=new Map(),blockedSince=new Map();
 const attempt=(key,operation)=>{
  try{operation();blockedSince.delete(key);return true;}
  catch(error){
   const since=blockedSince.get(key)??Date.now();
   if(!['EPERM','EACCES','EBUSY'].includes(error.code)||Date.now()-since>=5000)throw error;
   blockedSince.set(key,since);return false;
  }
 };
 const atomic=(dest,text)=>attempt(dest,()=>{fs.writeFileSync(dest+'.tmp',text);fs.renameSync(dest+'.tmp',dest);});
 const tick=()=>{
  update();
  const heartbeat=path.join(mailbox,'heartbeat.txt');
  atomic(heartbeat,'BandPilotBridge/2\n1.5.2\n1700000000\nrehearsal-tabs/3\nrehearsal-tabs/4\nrehearsal-tabs/5\nrehearsal-tabs/6\nrehearsal-tabs/7\nrehearsal-tabs/9\nrehearsal-tabs/10');
  for(const file of fs.readdirSync(mailbox)){
   const id=/^request-([a-f0-9-]+)\.lua$/.exec(file)?.[1];
   if(!id)continue;
   const req=path.join(mailbox,file);let src;
   if(!attempt(req,()=>{src=fs.readFileSync(req,'utf8');fs.unlinkSync(req);}))continue;
   let response;try{response={id,ok:true,result:answer(src)};}catch(e){response={id,ok:false,error:e.message};}
   const dest=path.join(mailbox,'response-'+id+'.json');
   pending.set(dest,JSON.stringify(response));
  }
  // Like the real Lua bridge, retry locked files without executing Rec twice.
  for(const [dest,text] of pending)if(atomic(dest,text))pending.delete(dest);
 };
 tick();
 const loop=setInterval(tick,80);
 loop.unref();
 return {root,calls,tabs,stop:()=>clearInterval(loop)};
}

async function verify({main,createWindow,screenshot,fixture,port}){
 const root='http://127.0.0.1:'+port;
 const api=async(path,data)=>{
  const response=await fetch(root+'/api/ears-share'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  const value=await response.json();if(!response.ok)throw Error(value.error);return value;
 };
 const wait=async(win,test)=>{
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){
   if(await win.webContents.executeJavaScript(test))return;
   await new Promise(r=>setTimeout(r,120));
  }
  throw Error('Rehearsal screen did not reach condition: '+test);
 };
 const click=async(win,scope,label)=>{
  const find=`[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>b.textContent.trim()===${JSON.stringify(label)})`;
  await wait(win,`!!(${find})&&!(${find}).disabled`);
  await win.webContents.executeJavaScript(`(${find}).click()`);
 };
 await main.webContents.executeJavaScript(`document.querySelector('button[title="Répéter"]').click()`);
 await wait(main,`document.querySelectorAll('.sh-songs .sh-song').length===3`);
 await main.webContents.executeJavaScript(`document.querySelectorAll('.sh-songs .sh-song')[1].click()`);
 await wait(main,`document.querySelector('.sh-transport-info b')?.textContent==='Fixture Refrain'&&document.querySelector('.sh-lane b')?.textContent==='Fixture Refrain · Entrée'`);
 await wait(main,`(()=>{
  const canvas=document.querySelector('.sh-lane + .sh-track canvas');
  if(!canvas||canvas.width<24||canvas.height<8)return false;
  const line=canvas.getContext('2d').getImageData(0,Math.floor(canvas.height/2),24,1).data;
  return [...line].some((value,i)=>i%4===3&&value>80);
 })()`);
 const initial=await main.webContents.executeJavaScript(`({
  modes:[...document.querySelectorAll('.sh-head .sh-seg button')].map(b=>b.textContent),
  ready:document.querySelector('.sh-transport-info small')?.textContent,
  sources:document.querySelectorAll('.bp-listen-sources button').length
 })`);
 if(initial.modes.join('|')!=='Avec mes morceaux|Groupe seul'||!initial.ready?.includes('Pistes d’accompagnement')||initial.sources)throw Error('Unexpected rehearsal entry choices');
 await screenshot('rehearsal-mac.png');

 await api('/start',{});
 await api('/musicians',{name:'Gestionnaire test',bus:1});
 const original=await api('/musicians',{name:'Autre musicien',bus:2});
 const share=original.shares.find(s=>s.name==='Gestionnaire test');
 const phone=createWindow(),other=createWindow();
 const js=script=>phone.webContents.executeJavaScript(script);
 const choose=(selector,value)=>js(`(()=>{const select=document.querySelector(${JSON.stringify(selector)});select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const button=label=>click(phone,'.ea-rehearse',label);
 const phoneURL=target=>`http://127.0.0.1:${original.port}/ears/${target.token}`;
 try{
  await phone.loadURL(phoneURL(share));
  await other.loadURL(phoneURL(original.shares.find(s=>s.name==='Autre musicien')));
  await wait(phone,`!!document.querySelector('.ea-master')&&![...document.querySelectorAll('.ea-page-switch button')].some(b=>b.textContent==='Répéter')`);
  await wait(other,`!!document.querySelector('.ea-master')&&![...document.querySelectorAll('.ea-page-switch button')].some(b=>b.textContent==='Répéter')`);
  await main.webContents.executeJavaScript(`document.querySelector('button[title="Console"]').click()`);
  await click(main,'.regie-pagehead .subnav','Retours');
  await click(main,'.returns-page .bp-section-tabs','Téléphones');
  await wait(main,`document.querySelectorAll('.es-card .es-qr svg path').length>=2&&document.querySelectorAll('.es-url code').length===2`);
  await main.webContents.executeJavaScript(`[...document.querySelectorAll('.es-card')].find(c=>c.textContent.includes('Gestionnaire test')).querySelector('.es-actions button').click()`);
  await wait(phone,`!![...document.querySelectorAll('.ea-page-switch button')].some(b=>b.textContent==='Répéter')`);
  if(await other.webContents.executeJavaScript(`!![...document.querySelectorAll('.ea-page-switch button')].some(b=>b.textContent==='Répéter')`))throw Error('An unassigned musician got rehearsal controls');
  if((await api('')).shares.find(s=>s.id===share.id).token!==share.token)throw Error('The existing QR was replaced');
  await click(phone,'.ea-page-switch','Répéter');
  await wait(phone,`document.querySelectorAll('.bp-phone-song option').length===3`);
  await choose('.bp-phone-song select',fixture.tabs[1].id);
  await wait(phone,`document.querySelector('.bp-phone-song select')?.selectedOptions[0]?.textContent.includes('Fixture Refrain')&&!document.querySelector('.bp-inputs input').disabled`);
  await js(`document.querySelector('.ea-rehearse .bp-inputs').open=true`);
  await js(`document.querySelector('.ea-rehearse .bp-inputs input').click()`);
  await wait(phone,`!document.querySelector('.ea-rehearse .bp-inputs input').checked&&!document.querySelector('.ea-rehearse .bp-inputs input').disabled`);
  await js(`document.querySelector('.ea-rehearse .bp-inputs input').click()`);
  await wait(phone,`document.querySelector('.ea-rehearse .bp-inputs input').checked&&!document.querySelector('.ea-rehearse .bp-inputs input').disabled`);
  await js(`document.querySelector('.ea-rehearse .bp-inputs').open=false`);
  for(const width of [320,390]){
   phone.setContentSize(width,730);
   await wait(phone,`innerWidth===${width}`);
   const fits=await js(`(()=>{
    const elements=[...document.querySelectorAll('.ea-rehearse button,.ea-rehearse select,.ea-rehearse summary')].filter(e=>e.checkVisibility());
    return document.documentElement.scrollWidth<=innerWidth&&elements.every(e=>{
     const box=e.getBoundingClientRect();
     return box.x>=0&&box.right<=innerWidth+1;
    });
   })()`);
   if(!fits)throw Error('Rehearsal controls outside phone at '+width);
  }
  await js("document.querySelector('.bp-section-strip button').click()");
  await wait(phone,`document.querySelector('.sh-transport-info small')?.textContent.startsWith('Lecture')`);
  await wait(phone,`document.querySelector('.bp-current-section')?.textContent==='Refrain 1'&&document.querySelector('.bp-loop-state')?.textContent==='En boucle'`);
  if(process.env.XR18_SMOKE_SCREENSHOTS)fs.writeFileSync(path.join(process.env.XR18_SMOKE_SCREENSHOTS,'manager-loop.png'),(await phone.webContents.capturePage()).toPNG());
  await js("document.querySelector('.ea-rehearse .bp-guides').open=true;document.querySelector('.ea-rehearse .bp-guide-fader input').focus()");
  phone.webContents.sendInputEvent({type:'keyDown',keyCode:'Left'});
  phone.webContents.sendInputEvent({type:'keyUp',keyCode:'Left'});
  await wait(phone,`document.querySelector('.bp-guide-fader output')?.textContent==='-0.5 dB'&&document.querySelector('.bp-loop-state')?.textContent==='En boucle'`);
  await js("document.querySelector('.ea-rehearse .bp-guides').open=false");
  await button('Sortir de la boucle');
  await wait(phone,`document.querySelector('.bp-loop-state')?.textContent==='Sortie en fin de section'&&document.querySelector('.sh-transport-info small')?.textContent.startsWith('Lecture')`);
  if(!fixture.calls.some(c=>c.action==='play'&&c.a==='r7'&&c.b==='e7'&&c.source==='backing'))throw Error('Section did not start backing playback');
  await wait(phone,`!document.querySelector('.bp-phone-song select').disabled`);
  await button('Entre deux repères');
  await choose('.bp-listening .bp-range select','m1');
  await choose('.bp-listening .bp-range label:nth-child(2) select','m2');
  await button('Lecture');
  await wait(phone,`document.querySelector('.sh-transport-info small')?.textContent.startsWith('Lecture')`);
  await wait(phone,`!document.querySelector('.bp-phone-song select').disabled`);
  await button('REC');
  await wait(phone,`document.querySelector('.sh-transport-info')?.textContent.includes('REC jusqu’à 00:06')`);
  await wait(phone,`document.querySelector('.sh-transport-info')?.textContent.includes('Prise 1')`);
  await button('Prises');
  await wait(phone,`[...document.querySelectorAll('.bp-listening option')].some(o=>o.textContent.includes('Prise 1'))`);
  await click(phone,'.ea-page-switch','Mon retour');
  await wait(phone,`!document.querySelector('.ea-monitor-page').hidden`);
  await click(phone,'.ea-page-switch','Répéter');
  await wait(phone,`document.querySelector('.bp-range-type button:nth-child(2)')?.getAttribute('aria-pressed')==='true'`);
  const selectedStyles=await js(`['.ea-page-switch','.bp-listen-sources'].map(selector=>{
    const group=document.querySelector(selector);
    const active=getComputedStyle(group.querySelector('button.on'));
    const idle=getComputedStyle(group.querySelector('button:not(.on)'));
    return {fill:active.backgroundColor,line:active.boxShadow,idle:idle.backgroundColor};
  })`);
  if(selectedStyles[0].fill!==selectedStyles[1].fill||selectedStyles[0].line!==selectedStyles[1].line||
    selectedStyles.some(style=>style.fill===style.idle||style.line==='none'))throw Error('Phone navigation and playback need the same visible selection accent');
  phone.setContentSize(320,730);
  await wait(phone,`innerWidth===320`);
  const sourcesFit=await js(`[...document.querySelectorAll('.bp-listen-sources button')].every(button=>{
   const text=document.createRange();text.selectNodeContents(button);
   const words=text.getBoundingClientRect(),box=button.getBoundingClientRect();
   return words.left>=box.left-1&&words.right<=box.right+1;
  })`);
  if(!sourcesFit)throw Error('A playback source label overflows its phone control');
  phone.setContentSize(390,730);
  await wait(phone,`innerWidth===390`);
  if(process.env.XR18_SMOKE_SCREENSHOTS)fs.writeFileSync(path.join(process.env.XR18_SMOKE_SCREENSHOTS,'rehearsal-phone.png'),(await phone.webContents.capturePage()).toPNG());
  const play=fixture.calls.find(c=>c.action==='play'&&c.a==='m1'),rec=fixture.calls.find(c=>c.action==='record');
  if(play?.source!=='backing'||play?.a!=='m1'||play?.b!=='m2'||play?.id!==fixture.tabs[1].id||rec?.id!==play.id)throw Error('Wrong project, source or marker range');
  await api('/manager',{id:null});
  await wait(phone,`![...document.querySelectorAll('.ea-page-switch button')].some(b=>b.textContent==='Répéter')&&!document.querySelector('.ea-monitor-page').hidden`);
 }finally{phone.destroy();other.destroy();}
 console.log('DEV19: desktop song column and scoped timeline, same QR with selected rehearsal role, playback/record/take, back to personal mix and role removal passed.');
}
module.exports={createFixture,verify};
