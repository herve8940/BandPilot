const { app, BrowserWindow, dialog, shell, Menu, ipcMain, safeStorage } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { mkdirSync, readFileSync, writeFileSync, renameSync } = require("node:fs");
const net = require("node:net");
const {loadAI,saveAI}=require("./ai-config.cjs");
// Keep the existing data/profile directory across the display-name change.
if(!process.argv.includes('--smoke-test')){
  const legacyData=path.join(app.getPath('appData'),'xr18-studio');
  mkdirSync(legacyData,{recursive:true});app.setPath('userData',legacyData);
}
let win;
const {languageCodes,normalizeLanguage,label:languageLabel}=require("./languages.cjs");
let language="fr";
const label=(fr,en)=>languageLabel(language,fr,en);
function updateMenu(){Menu.setApplicationMenu(Menu.buildFromTemplate([{label:label("Connexion","Connection"),submenu:[
 {label:label("Détecter et connecter ma console","Detect and connect my mixer"),click:()=>{if(win)void win.webContents.executeJavaScript("window.dispatchEvent(new Event('xr18-open-connection'))");}},
 {type:"separator"},{role:"about",label:label("À propos de BandPilot","About BandPilot")},{type:"separator"},{role:"quit",label:label("Quitter","Quit")}
]},{label:label("Affichage","View"),submenu:[{role:"reload",label:label("Actualiser","Reload")},{role:"togglefullscreen",label:label("Plein écran","Toggle full screen")}]}]));}

app.whenReady().then(async () => {
  try {
    const smoke=process.argv.includes("--smoke-test");
    if(smoke&&process.env.XR18_SMOKE_DATA)app.setPath("userData",process.env.XR18_SMOKE_DATA);
    const dataPath=app.getPath("userData");
    mkdirSync(dataPath,{recursive:true});
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
    process.env.HTTP_PORT=String(port);
    process.env.XR18_DB_PATH=path.join(dataPath,"xr18-studio.db");
    process.env.XR18_WEB_DIST=app.isPackaged
      ?path.join(process.resourcesPath,"web-dist")
      :path.join(app.getAppPath(),"web","dist");
    const backend=path.join(app.getAppPath(),"dist","src","server.js");
    await import(pathToFileURL(backend).href);
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
    const appIcon=path.join(__dirname,"icon.png");
    const fromWindow=(event)=>event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame;
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
      await new Promise(resolve=>setTimeout(resolve,1000));
      const rendered=await win.webContents.executeJavaScript('document.body.textContent.includes("BandPilot")');
      if(!rendered)throw Error("Interface BandPilot non rendue");
      // Exercise the actual connection screen, not only the first rendered page.
      await win.webContents.executeJavaScript("window.dispatchEvent(new Event('xr18-open-connection'))");
      let connectionReady=false;
      for(let attempt=0;attempt<25;attempt++){
        const check=await win.webContents.executeJavaScript(`({panels:[...document.querySelectorAll('h2')].filter(e=>e.textContent==='Connexion à ma console').length,controls:[...document.querySelectorAll('button')].filter(e=>e.textContent==='Détecter et connecter ma console').length})`);
        if(check.panels>1||check.controls>1)throw Error("Panneau de connexion dupliqué");
        if(check.panels===1&&check.controls===1){connectionReady=true;break;}
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      if(!connectionReady)throw Error("Connexion locale : commandes administrateur non disponibles");
      const waitForRenderer=async(predicate)=>{
        for(let attempt=0;attempt<40;attempt++){
          if(await win.webContents.executeJavaScript(predicate))return;
          await new Promise(resolve=>setTimeout(resolve,150));
        }
        throw Error('Language smoke test: renderer did not become ready');
      };
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



