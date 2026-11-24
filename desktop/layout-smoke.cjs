// Read navigation and geometry in the disposable Electron simulator.
const fs=require('node:fs');
const path=require('node:path');

module.exports=async function checkLayout(win,wait){
 const output=process.env.BANDPILOT_LAYOUT_OUTPUT;
 const js=script=>win.webContents.executeJavaScript(script);
 const status=await js("fetch('/api/status').then(r=>r.json())");
 if(status.mode!=='simulation'||status.writesEnabled)throw Error('Layout audit requires simulation.');
 const click=async(selector,index=0)=>{
  const expression=`document.querySelectorAll(${JSON.stringify(selector)})[${index}]`;
  await wait(`!!${expression}`);
  await js(`${expression}.click()`);
 };
 const space=async id=>{
  if(await js('innerWidth>760'))return click('[data-workspace="'+id+'"]');
  if(id==='setup')return click('.mobile-settings');
  const main=['prep','play','mix','rehearse','show'];
  return click('.bottombar button',main.indexOf(id));
 };
 const results=[];
 const bounds=win.getBounds(),minimum=win.getMinimumSize();
 const measure=async name=>{
  await js('window.scrollTo(0,0);new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))');
  await new Promise(resolve=>setTimeout(resolve,140));
  const layout=await js(`(()=>{
   const box=el=>{const r=el.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]};
   const outside=[];
   for(const el of document.querySelectorAll('button,input:not([type=hidden]),select,textarea,summary,h1,h2,h3')){
    const r=el.getBoundingClientRect();
    if(el.closest('details:not([open])')&&!el.matches('summary')||!r.width||!r.height||r.left>=-1&&r.right<=innerWidth+1)continue;
    let p=el.parentElement,scroll=false;
    while(p&&p!==document.body){if(/auto|scroll/.test(getComputedStyle(p).overflowX)&&p.scrollWidth>p.clientWidth+1){scroll=true;break;}p=p.parentElement;}
    if(!scroll&&outside.length<9)outside.push([el.className,(el.innerText||el.getAttribute('aria-label')||'').slice(0,36),...box(el)]);
   }
   const boundsFor=selector=>{const el=document.querySelector(selector);return el?box(el):null};
   const openMenu=document.querySelector('.console-tools[open]>.studio-tabs,.quick-tools[open]>div');
   const obstructed=openMenu ? [...openMenu.querySelectorAll('button:not(:disabled)')].filter(el=>{
    const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    return !el.contains(document.elementFromPoint(x,y));
   }).map(el=>el.textContent.trim()) : [];
   return {obstructed,width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,outside,
     body:boundsFor('.xs-expert-desk .xs2-body'),footer:boundsFor('.bottombar'),menu:boundsFor('.console-tools[open]>.studio-tabs,.quick-tools[open]>div'),rail:boundsFor('.rail')};
  })()`);
  results.push({name,...layout});
  if(output){
   const photo=await win.webContents.capturePage();
   fs.writeFileSync(path.join(output,layout.width+'-'+name+'.jpg'),photo.resize({width:Math.min(layout.width,930)}).toJPEG(78));
  }
 };
 const navigate=async(button,name,index=0)=>{await click(button,index);await measure(name);};
 const save=()=>{if(output)fs.writeFileSync(path.join(output,'geometry.json'),JSON.stringify(results,null,2));};
 try{
  win.setMinimumSize(320,480);
  for(const [width,height] of [[1440,790],[900,620],[390,720],[320,568]]){
   win.setContentSize(width,height);await wait('innerWidth==='+width);
   await space('prep');await measure('repertoire');
   if(width===1440){
    await click('.import-projects-toggle');await wait("document.querySelectorAll('.concert-import input').length>=2");
    await js("document.querySelectorAll('.concert-import input')[0].click();document.querySelectorAll('.concert-import input')[1].click()");
    await click('.concert-import fieldset button');await wait("document.querySelectorAll('.setlist-row').length>=2");
   }
   for(const [i,name] of ['setlists','notes','scenes','rider'].entries()){
    if(!i)continue;
    await click('.regie-pagehead .subnav button',i);
    if(name==='rider')await wait("!!document.querySelector('.tech-rider[open]')");
    await measure(name);
    if(name==='rider')for(let tab=1;tab<4;tab++)await navigate('.rider-tabs button','rider-'+tab,tab);
    if(name==='scenes')for(let j=0;j<await js("document.querySelectorAll('.library-nav button').length");j++)await navigate('.library-nav button','library-'+j,j);
   }
   await space('play');await wait("!!document.querySelector('.balance-track button')");await measure('balance');
   const count=await js("document.querySelectorAll('.balance-track button').length");
   for(let i=0;i<count;i++){await navigate('.balance-track button','balance-step-'+i,i);await click('.balance-back');}
   await space('mix');
   const header=async(mode,index)=>{
    await click('.seg button',index);
    await wait(`document.querySelectorAll('.seg button')[${index}]?.getAttribute('aria-pressed')==='true'`);
    await measure(mode);
    return js(`(()=>{
     const metrics=selector=>{
      const element=document.querySelector(selector),style=getComputedStyle(element),rect=element.getBoundingClientRect();
      return {font:style.fontSize,line:style.lineHeight,weight:style.fontWeight,x:Math.round(rect.x),y:Math.round(rect.y)};
     };
     return Object.fromEntries(['.regie-session','.regie-device','.regie-pagehead h1','.seg','.subnav'].map(s=>[s,metrics(s)]));
    })()`);
   };
   const simple=await header('simple',0),expert=await header('expert',1),back=await header('simple-return',0);
   console.log('Console header',width,JSON.stringify({simple,expert,back}));
   for(const key of Object.keys(simple)){
    if(JSON.stringify(simple[key])!==JSON.stringify(expert[key])||JSON.stringify(simple[key])!==JSON.stringify(back[key]))
     throw Error('Console header changes with mode at '+width+' px: '+key);
   }
   // Exercise the focused mode switch through the native keyboard as well.
   await js("document.querySelectorAll('.seg button')[1].focus()");
   win.webContents.sendInputEvent({type:'keyDown',keyCode:'Space'});
   win.webContents.sendInputEvent({type:'keyUp',keyCode:'Space'});
   await wait("document.activeElement===document.querySelectorAll('.seg button')[1] && document.activeElement.getAttribute('aria-pressed')==='true'");
   await wait("!!document.querySelector('.xs2-tabs button')");
   for(let i=0;i<await js("document.querySelectorAll('.xs2-tabs button').length");i++){
    await navigate('.xs2-tabs button','expert-'+i,i);
    if(i===1)for(let j=0;j<await js("document.querySelectorAll('.visual-process-tabs button').length");j++)await navigate('.visual-process-tabs button','channel-'+j,j);
   }
   await js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))");
   await wait("!!document.querySelector('.desk-finder[open]')");await measure('expert-search');
   await js("document.querySelector('.desk-finder .finder-input button').click()");
   await wait("!document.querySelector('.desk-finder[open]')");
   await navigate('.quick-tools summary','quick-menu');await click('.quick-tools summary');
   await navigate('.console-tools summary','console-menu');
   for(const i of [1,2,3,0]){
    await navigate('.console-tools .studio-tabs button','console-tools-'+i,i);
    if(i!==0)await click('.console-tools summary');
   }
   await navigate('.regie-pagehead .subnav button','returns',1);
   await wait("!!document.querySelector('.monitor-tabs button')");
   for(let i=1;i<3;i++)await navigate('.monitor-tabs button','returns-'+i,i);
   await navigate('.bp-section-tabs button','phones',1);
   await space('rehearse');await click('.sh-head .sh-seg button');await wait("!!document.querySelector('.bp-transport')");await measure('rehearse');await navigate('.sh-head .sh-seg button','band',1);
   await navigate('.sh-head>.xs2-btn:not(.stand-switch)','workshop');
   await space('show');await wait("!!document.querySelector('.sh-concert')");await measure('concert');
   await navigate('.stand-switch','stand');await click('.stand-switch');
   await js("window.scrollTo(0,document.documentElement.scrollHeight)");
   await space('setup');await wait("document.querySelector('[data-page=settings]')&&scrollY===0");
   for(let i=0;i<3;i++)await navigate('.settings-jump button','settings-'+i,i);
   save();
  }
  const model=async id=>{
   await js(`fetch('/api/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'simulation',model:${JSON.stringify(id)}})}).then(r=>{if(!r.ok)throw Error('Simulated mixer change failed')})`);
   await wait(`document.querySelector('.regie-device')?.textContent.includes(${JSON.stringify(id)})`);
  };
  for(const width of [900,390]){
   win.setContentSize(width,700);await wait('innerWidth==='+width);
   await model('X32');await space('mix');await wait("!!document.querySelector('.x32-core')");await measure('x32');
   if(await js("!!document.querySelector('.mix-pagehead :is(.seg,.console-tools,.danger)')"))throw Error('X-Air tools exposed on the X32 mixer');
   await space('play');await wait("!!document.querySelector('.model-blocked')");await measure('x32-guide');
   await model('MR12');await space('mix');await navigate('.seg button','mr12-simple');
   await navigate('.regie-pagehead .subnav button','mr12-returns',1);
  }
  await model('XR18');
  // Reproduce startup with an outdated bridge without touching a REAPER installation.
  await js(`(()=>{const base=window.fetch;window.fetch=async(...args)=>{
    const response=await base(...args);const url=String(args[0]);
    if(url.startsWith('/api/rehearsal-desk/state')&&url.includes('files=1'))return Response.json({bridge:'offline',tabs:[],transport:'idle'});
    if(url.startsWith('/api/rehearsal-desk/state'))return Response.json({bridge:'update',tabs:[],transport:'idle'});
    if(url==='/api/show'){const show=await response.json();return Response.json({...show,version:'outdated',alive:true});}
    return response;
  }})()`);
  for(const width of [1440,320]){
   win.setContentSize(width,700);await wait('innerWidth==='+width);
   await space('rehearse');await click('.sh-head .sh-seg button');
   await wait("!!document.querySelector('.sh-install')&&!document.querySelector('.sh-songs')");await measure('reaper-setup');
   await space('show');await wait("document.querySelector('.concert-audio p')?.textContent.includes('REAPER')&&!document.querySelector('.sh-install')");await measure('concert-offline');
  }

 }finally{save();win.setBounds(bounds);win.setMinimumSize(...minimum);}
 const failures=results.filter(r=>r.pageWidth>r.width+1 || r.obstructed.length>0 || r.outside.length>0 || r.body&&r.width>=800&&r.body[3]<190 || r.menu&&(r.menu[0]<0||r.menu[0]+r.menu[2]>r.width+1) || r.rail&&r.width===900&&r.rail[2]>100);
 console.log('Layout audit:',results.length,'views;',failures.map(f=>f.width+'/'+f.name).join(', ')||'all pages fit.');
 if(failures.length)throw Error('Layout regressions: '+failures.map(f=>f.width+'/'+f.name+' '+JSON.stringify([f.outside.slice(0,2),f.obstructed])).join(', '));
};
