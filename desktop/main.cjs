const { app, BrowserWindow, dialog, shell, Menu, ipcMain, safeStorage, systemPreferences } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { mkdirSync, readFileSync, writeFileSync, renameSync } = require("node:fs");
const net = require("node:net");
const {loadAI,saveAI}=require("./ai-config.cjs");
if(process.argv.includes('--smoke-test')&&process.env.XR18_SMOKE_DATA)app.setPath('userData',process.env.XR18_SMOKE_DATA);
// Keep the existing data/profile directory across the display-name change.
if(!process.argv.includes('--smoke-test')){
  const legacyData=path.join(app.getPath('appData'),app.getVersion().includes('-dev.')?'bandpilot-dev':'xr18-studio');
  mkdirSync(legacyData,{recursive:true});app.setPath('userData',legacyData);
}
let win;
// A single installed instance owns the staged application update.
if(!process.argv.includes('--smoke-test')&&!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
const {languageCodes,normalizeLanguage,label:languageLabel}=require("./languages.cjs");
let language="fr";
const label=(fr,en)=>languageLabel(language,fr,en);
function updateMenu(){Menu.setApplicationMenu(Menu.buildFromTemplate([{label:label("Connexion","Connection"),submenu:[
 {label:label("Détecter et connecter ma console","Detect and connect my mixer"),click:()=>{if(win)void win.webContents.executeJavaScript("window.dispatchEvent(new Event('xr18-open-connection'))");}},
 {type:"separator"},{role:"about",label:label("À propos de BandPilot","About BandPilot")},{type:"separator"},{role:"quit",label:label("Quitter","Quit")}
]},{label:"MIDI",submenu:[{label:label("Contrôleurs et pédaliers","Controllers and pedals"),click:()=>{if(win)void win.webContents.executeJavaScript("window.dispatchEvent(new Event('xr18-open-midi'))");}}]},{label:label("Affichage","View"),submenu:[{role:"reload",label:label("Actualiser","Reload")},{role:"togglefullscreen",label:label("Plein écran","Toggle full screen")}]}]));}

app.whenReady().then(async () => {
  try {
    const smoke=process.argv.includes("--smoke-test");
    if(smoke&&process.env.XR18_SMOKE_DATA)app.setPath("userData",process.env.XR18_SMOKE_DATA);
    const dataPath=app.getPath("userData");
    mkdirSync(dataPath,{recursive:true});
    const rehearsalSmoke=smoke?require('./dev19-rehearsal-smoke.cjs').createFixture(dataPath):null;
    if(rehearsalSmoke)process.env.REAPER_RESOURCE_PATH=rehearsalSmoke.root;
    const aiPath=path.join(dataPath,"ai-credentials.json");
    if(!smoke&&!process.env.XR18_OPENAI_API_KEY){const saved=loadAI(aiPath,safeStorage);if(saved){process.env.XR18_OPENAI_API_KEY=saved.apiKey;process.env.XR18_OPENAI_MODEL=saved.model;}}
    const configPath=path.join(dataPath,smoke?"smoke-connection.json":"connection.json");
    let config={mode:"simulation",host:"192.168.1.1",enableWrites:false};
    try { const saved=JSON.parse(readFileSync(configPath,"utf8")); if(saved.mode==="real" && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(saved.host)) config={mode:"real",host:saved.host,enableWrites:saved.enableWrites===true}; } catch {}
    if(smoke)config={mode:"simulation",host:"127.0.0.1",enableWrites:false};
    if(smoke)writeFileSync(configPath,JSON.stringify(config));
    process.env.XR18_CONNECTION_PATH=configPath;
    process.env.XR18_MODE=config.mode;
    process.env.XR18_HOST=config.host;
    process.env.XR18_ENABLE_WRITES=String(config.enableWrites);
    const languagePath=path.join(dataPath,"language.json");
    try{language=normalizeLanguage(JSON.parse(readFileSync(languagePath,"utf8")).language);}catch{}
    updateMenu();
    const port = await new Promise((resolve,reject)=>{
      const probe=net.createServer();
      probe.once("error",reject);
      probe.listen(0,"127.0.0.1",()=>{const address=probe.address();const freePort=typeof address==="object"?address.port:0;probe.close(()=>resolve(freePort));});
    });
    process.env.XR18_APP_VERSION=app.getVersion();
    let build;try{build=JSON.parse(readFileSync(path.join(__dirname,'build-info.json'),'utf8'));}catch{}
    process.env.XR18_APP_BUILD=build?.commit?`${build.commit.slice(0,12)} · ${build.builtAt}`:'source';
    process.env.HTTP_PORT=String(port);
    process.env.XR18_DB_PATH=path.join(dataPath,"xr18-studio.db");
    process.env.XR18_WEB_DIST=app.isPackaged
      ?path.join(process.resourcesPath,"web-dist")
      :path.join(app.getAppPath(),"web","dist");
    const backend=path.join(app.getAppPath(),"dist","src","server.js");
    const runtime=await import(pathToFileURL(backend).href);
    let measurementsClosed=false;
    app.on('before-quit',event=>{if(measurementsClosed)return;event.preventDefault();measurementsClosed=true;void runtime.stopMeasurements().finally(()=>app.quit());});
    let ready=false;
    for(let i=0;i<80;i++){
      try{const response=await fetch(`http://127.0.0.1:${port}/api/auth`);if(response.ok){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!ready)throw Error(label("Le serveur local BandPilot n'a pas démarré.","The local BandPilot server did not start."));
    win=new BrowserWindow({
      show:!smoke,
      width:1440,height:900,minWidth:800,minHeight:600,
      icon:path.join(__dirname,"icon.png"),
      backgroundColor:"#0d1621",
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,"preload.cjs")}
    });
    const origin=`http://127.0.0.1:${port}`;
    const trusted=(contents,requestUrl,isMainFrame)=>{
      if(!win||contents!==win.webContents||!isMainFrame)return false;
      try{return new URL(requestUrl).origin===origin;}catch{return false;}
    };
    win.webContents.session.setPermissionCheckHandler((contents,permission,url,details)=>
      trusted(contents,details.requestingUrl||url,details.isMainFrame)&&
      (permission==='media'?details.mediaType==='audio':permission!=='display-capture'));
    win.webContents.session.setPermissionRequestHandler((contents,permission,respond,details)=>{
      if(!trusted(contents,details.requestingUrl||contents?.getURL(),details.isMainFrame)||permission==='display-capture')return respond(false);
      if(permission!=='media')return respond(true);
      if(details.mediaTypes?.length!==1||details.mediaTypes[0]!=='audio')return respond(false);
      respond(smoke||process.platform!=='darwin'||systemPreferences.getMediaAccessStatus('microphone')==='granted');
    });
    ipcMain.handle('bandpilot-acoustic-mic',async event=>{
      if(event.senderFrame!==win.webContents.mainFrame||!trusted(event.sender,event.senderFrame?.url,true))return false;
      return smoke||process.platform!=='darwin'||await systemPreferences.askForMediaAccess('microphone').catch(()=>false);
    });
    const {sanitizeDiagnostic}=await import(pathToFileURL(path.join(app.getAppPath(),'dist/shared/diagnostic-report.js')).href);
    const {diagnostic}=await import(pathToFileURL(path.join(app.getAppPath(),'dist/src/diagnostics.js')).href);
    require('./support.cjs').registerSupport({app,win,ipcMain,dialog,shell,safeStorage,port,dataPath,sanitize:sanitizeDiagnostic,diagnostic,smoke});
    const appIcon=path.join(__dirname,"icon.png");
    const fromWindow=(event)=>event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame;
    const controllerMappings=require('./controller-mappings.cjs').controllerMappingsStore(dataPath);
    ipcMain.on('bandpilot-midi-get',event=>{event.returnValue=fromWindow(event)?controllerMappings.get():null;});
    ipcMain.on('bandpilot-midi-set',(event,value)=>{event.returnValue=fromWindow(event)&&controllerMappings.set(value);});
    const metering=require('./metering.cjs').meteringStore(dataPath);
    ipcMain.on('bandpilot-metering-get',event=>{event.returnValue=fromWindow(event)?metering.get():null;});
    ipcMain.on('bandpilot-metering-set',(event,value)=>{event.returnValue=fromWindow(event)&&metering.set(value);});
    const workspaces=require('./workspaces.cjs').workspaceStore(dataPath);
    ipcMain.on('bandpilot-workspaces-get',event=>{event.returnValue=fromWindow(event)?workspaces.get():null;});
    ipcMain.on('bandpilot-workspaces-set',(event,value)=>{event.returnValue=fromWindow(event)&&workspaces.set(value);});
    let exportingLibrary=false;
    ipcMain.handle('bandpilot-library-export',async(event,input)=>{
      if(!fromWindow(event)||exportingLibrary)return {error:label('Export indisponible.','Export unavailable.')};
      exportingLibrary=true;
      try{return await require('./library-export.cjs').saveLibraryFile({input,dialog,win,documents:app.getPath('documents'),title:label('Exporter','Export')});}
      catch{return {error:label('Impossible d’enregistrer le fichier.','Unable to save the file.')};}
      finally{exportingLibrary=false;}
    });
    let exportingRider=false;
    ipcMain.handle('bandpilot-tech-rider-pdf',async(event,input)=>{
      if(!fromWindow(event)||exportingRider)return {error:label('Export PDF indisponible.','PDF export unavailable.')};
      exportingRider=true;
      try{
        const {renderTechRiderPDF}=require('./tech-rider-pdf.cjs');
        const pdf=await renderTechRiderPDF(input?.html);
        const filename=typeof input?.filename==='string'?path.basename(input.filename).replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,160):'BandPilot-fiche-technique.pdf';
        const target=await dialog.showSaveDialog(win,{title:label('Exporter la fiche technique','Export technical rider'),defaultPath:path.join(app.getPath('documents'),filename),filters:[{name:'PDF',extensions:['pdf']}]});
        if(target.canceled||!target.filePath)return {cancelled:true};
        await require('node:fs/promises').writeFile(target.filePath,pdf);
        return {saved:true};
      }catch(error){console.error('Technical rider PDF export failed',error);return {error:label('Impossible d’enregistrer le PDF. Réessaie ou utilise Imprimer.','Unable to save the PDF. Try again or use Print.')};}
      finally{exportingRider=false;}
    });
    ipcMain.on('bandpilot-language-get',event=>{event.returnValue=fromWindow(event)?language:'fr';});
    ipcMain.on('bandpilot-language-set',(event,next)=>{
      event.returnValue=false;
      if(!fromWindow(event)||!languageCodes.includes(next))return;
      try{writeFileSync(languagePath+'.tmp',JSON.stringify({language:next}));renameSync(languagePath+'.tmp',languagePath);language=next;updateMenu();event.returnValue=true;}catch(error){console.error('Language preference could not be saved',error);}
    });
    ipcMain.on('xr18-confirm',(event,message)=>{
      if(!fromWindow(event)){event.returnValue=false;return;}
      event.returnValue=dialog.showMessageBoxSync(win,{type:"question",icon:appIcon,title:"BandPilot",message:String(message).slice(0,2000),buttons:[label("Annuler","Cancel"),label("Confirmer","Confirm")],defaultId:1,cancelId:0,noLink:true})===1;
    });
    ipcMain.on('xr18-alert',(event,message)=>{
      if(fromWindow(event))dialog.showMessageBoxSync(win,{type:"info",icon:appIcon,title:"BandPilot",message:String(message).slice(0,2000),buttons:["OK"],noLink:true});
      event.returnValue=null;
    });
    ipcMain.handle('xr18-ai-configure',async(event,input)=>{
      try{
        if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!event.senderFrame.url.startsWith(`http://127.0.0.1:${port}/`))throw Error('Fenêtre non autorisée');
        const cookies=await win.webContents.session.cookies.get({url:`http://127.0.0.1:${port}`});
        const auth=await fetch(`http://127.0.0.1:${port}/api/auth`,{headers:{Cookie:cookies.map(c=>c.name+'='+c.value).join(';')}});
        if(!auth.ok||(await auth.json()).user?.role!=='admin')throw Error('Administrateur requis pour configurer l’IA');
        const saved=saveAI(aiPath,safeStorage,input);
        if(saved){process.env.XR18_OPENAI_API_KEY=saved.apiKey;process.env.XR18_OPENAI_MODEL=saved.model;}
        else{delete process.env.XR18_OPENAI_API_KEY;delete process.env.XR18_OPENAI_MODEL;}
        return {configured:Boolean(saved)};
      }catch(error){return {configured:false,error:error instanceof Error?error.message:'Configuration refusée'};}
    });
    win.webContents.setWindowOpenHandler(({url})=>{
      if(url.startsWith("https://"))void shell.openExternal(url);
      return {action:"deny"};
    });
    win.webContents.on("will-navigate",(event,url)=>{
      if(!url.startsWith(`http://127.0.0.1:${port}/`))event.preventDefault();
    });
    await win.loadURL(`http://127.0.0.1:${port}/`);
    if(smoke){
      const execute=win.webContents.executeJavaScript.bind(win.webContents);
      win.webContents.executeJavaScript=async(code,...args)=>{try{return await execute(code,...args);}catch(error){console.error('Smoke script failed:',code);throw error;}};

      await new Promise(resolve=>setTimeout(resolve,1000));
      const rendered=await win.webContents.executeJavaScript('document.body.textContent.includes("BandPilot")');
      if(!rendered)throw Error("Interface BandPilot non rendue");
      // Exercise the actual connection screen, not only the first rendered page.
      await win.webContents.executeJavaScript("window.dispatchEvent(new Event('xr18-open-connection'))");
      let connectionReady=false;
      for(let attempt=0;attempt<150;attempt++){
        const check=await win.webContents.executeJavaScript(`({panels:[...document.querySelectorAll('h2')].filter(e=>e.textContent==='Connexion à ma console').length,controls:[...document.querySelectorAll('button')].filter(e=>e.textContent==='Détecter et connecter ma console').length})`);
        if(check.panels===0)await win.webContents.executeJavaScript("window.dispatchEvent(new Event('xr18-open-connection'))");
        if(check.panels>1||check.controls>1)throw Error("Panneau de connexion dupliqué");
        if(check.panels===1&&check.controls===1){connectionReady=true;break;}
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      if(!connectionReady)throw Error("Connexion locale : commandes administrateur non disponibles");
      const waitForRenderer=async(predicate,timeoutMs=30000)=>{
        const deadline=Date.now()+timeoutMs;
        while(Date.now()<deadline){
          if(await win.webContents.executeJavaScript(predicate))return;
          await new Promise(resolve=>setTimeout(resolve,150));
        }
        const state=await win.webContents.executeJavaScript(`JSON.stringify({midiSelects:[...document.querySelectorAll('.midi-controls select')].map(e=>({value:e.value,options:e.options.length})),alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),commands:document.querySelector('.console-commands')?.textContent,commandButtons:[...document.querySelectorAll('.console-commands button')].map(b=>[b.textContent,b.matches(':disabled')]),group:document.querySelector('.group-adjustments')?.textContent,disabled:[...document.querySelectorAll('.group-adjustments button')].map(b=>[b.textContent,b.disabled]),tail:document.body.textContent.slice(-4000)})`);
        throw Error('Native smoke test: renderer did not become ready: '+predicate+'\n'+state);
      };
      const screenshot=async(name)=>{if(process.env.XR18_SMOKE_SCREENSHOTS){mkdirSync(process.env.XR18_SMOKE_SCREENSHOTS,{recursive:true});writeFileSync(path.join(process.env.XR18_SMOKE_SCREENSHOTS,name),(await win.webContents.capturePage()).toPNG());}};
      const checkRehearsal=()=>require('./dev19-rehearsal-smoke.cjs').verify({
        main:win,createWindow:()=>new BrowserWindow({show:false,width:390,height:730,webPreferences:{sandbox:true,contextIsolation:true}}),
        screenshot,fixture:rehearsalSmoke,port
      });
      if(process.argv.includes('--smoke-rehearsal-only')){
        await checkRehearsal();rehearsalSmoke.stop();app.exit(0);return;
      }
      // Exercise the same language selector shipped to users, including native persistence.
      for(const next of ['en','it','es','de','fr']){
        await win.webContents.executeJavaScript(`(()=>{const select=document.querySelector('.bandpilot-language select');if(!select)throw Error('Missing language selector');select.value=${JSON.stringify(next)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
        await waitForRenderer(`document.documentElement.lang===${JSON.stringify(next)} && document.querySelector('.bandpilot-language select')?.value===${JSON.stringify(next)}`);
        if(JSON.parse(readFileSync(languagePath,'utf8')).language!==next||!Menu.getApplicationMenu().items.some(item=>item.label===languageLabel(next,'Connexion','Connection')))throw Error('Native language preference/menu not updated');
        await win.webContents.executeJavaScript('localStorage.clear()');
        await win.loadURL(`http://127.0.0.1:${port}/`);
        await waitForRenderer(`document.documentElement.lang===${JSON.stringify(next)} && !!document.querySelector('.studio')`);
        await win.webContents.executeJavaScript("window.dispatchEvent(new Event('xr18-open-connection'))");
        await waitForRenderer(`document.querySelector('.bandpilot-language select')?.value===${JSON.stringify(next)}`);
      }
      // Exercise the shipped rider and diagnostic bridge with an isolated simulation
      // profile. No GitHub issue or hardware command is sent by this smoke test.
      await win.webContents.executeJavaScript(`document.querySelector('button[title="Régler le son"]').click()`);
      await waitForRenderer(`!!document.querySelector('.coach-shortcuts')`);
      await require('./coach-smoke.cjs')(win,waitForRenderer);
      await win.webContents.executeJavaScript(`document.querySelector('.coach-shortcuts button').click()`);
      await waitForRenderer(`!!document.querySelector('.tech-rider[open]')`);
      await screenshot('technical-rider.png');
      await win.webContents.executeJavaScript(`document.querySelector('.support-open').click()`);
      await waitForRenderer(`!!document.querySelector('.support-dialog[open]')`);
      await win.webContents.executeJavaScript(`(()=>{const input=document.querySelector('.support-dialog input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Vérification de démarrage');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await waitForRenderer(`!document.querySelector('.support-advanced button.primary').disabled`);
      await win.webContents.executeJavaScript(`document.querySelector('.support-advanced').open=true;document.querySelector('.support-advanced button.primary').click()`);
      await waitForRenderer(`!!document.querySelector('.support-dialog pre')`);
      const report=await win.webContents.executeJavaScript(`JSON.parse(document.querySelector('.support-dialog pre').textContent)`);
      if(report.app.version!==app.getVersion()||report.console.mode!=='simulation'||!report.id||!report.app.build)throw Error('Diagnostic bridge returned an invalid report');
      await screenshot('debug-report.png');
      await require('./library-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./live-console-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./scene-recall-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./stereo-groups-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./stereo-link-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./measurement-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./saved-groups-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./geq-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./scene-mapping-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./scene-protections-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./dev-completion-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./midi-automation-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./group-features-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./midi-scenes-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./dev16-mix-tools-smoke.cjs')(win,waitForRenderer,screenshot);
      await require('./dev17-studio-additions-smoke.cjs')(win,waitForRenderer,screenshot);
      await checkRehearsal();
      rehearsalSmoke.stop();
      const mixerStatus=await (await fetch(`http://127.0.0.1:${port}/api/status`)).json();
      if(mixerStatus.mode!=='simulation'||mixerStatus.writesEnabled)throw Error('Language test changed mixer connection');
      const auth=await fetch(`http://127.0.0.1:${port}/api/auth`);
      if(!auth.ok)throw Error("Authentification locale indisponible");
      app.exit(0);
    }
  } catch(error) {
    if(process.argv.includes("--smoke-test")){console.error(error);app.exit(1);return;}
    dialog.showErrorBox(label("BandPilot — démarrage impossible","BandPilot — unable to start"),String(error));
    app.quit();
  }
});
app.on("window-all-closed",()=>app.quit());



