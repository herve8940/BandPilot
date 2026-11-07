const {randomUUID}=require('node:crypto');
const {join}=require('node:path');
const {mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,readdirSync,statSync}=require('node:fs');
const {WEB,github,checkUpdate,createIssue,findIssue,issueContent}=require('./github-support.cjs');
function registerSupport({app,win,ipcMain,dialog,shell,safeStorage,port,dataPath,sanitize,diagnostic,smoke}){
 const reports=new Map(),inflight=new Map(),directory=join(dataPath,'reports'),credentialPath=join(dataPath,'github-credentials.json');
 let token=null,updatePromise=null,updateState=null;
 const encrypted=()=>safeStorage.isEncryptionAvailable()&&safeStorage.getSelectedStorageBackend?.()!=='basic_text';
 try{if(encrypted())token=safeStorage.decryptString(Buffer.from(JSON.parse(readFileSync(credentialPath,'utf8')).encrypted,'base64'));}catch{}
 const base=`http://127.0.0.1:${port}`;
 const local=async(path)=>{const cookies=await win.webContents.session.cookies.get({url:base});const r=await fetch(base+path,{headers:{Cookie:cookies.map(c=>c.name+'='+c.value).join(';')},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Diagnostic local indisponible.');return r.json();};
 const authorized=async(event)=>{
  if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!event.senderFrame.url.startsWith(base+'/'))throw Error('Fenêtre non autorisée');
  if((await local('/api/auth')).user?.role!=='admin')throw Error('Administrateur requis');
 };
 const handle=(name,fn)=>ipcMain.handle(name,async(event,input)=>{try{await authorized(event);return await fn(input);}catch(error){return {error:error instanceof Error?error.message:'Action indisponible'};}});
 const write=(name,value)=>{mkdirSync(directory,{recursive:true,mode:0o700});const path=join(directory,name);writeFileSync(path+'.tmp',JSON.stringify(value,null,2),{mode:0o600});renameSync(path+'.tmp',path);return path;};
 const get=(id)=>{if(typeof id!=='string'||!reports.has(id))throw Error('Prépare le rapport avant de l’envoyer.');return reports.get(id);};
 const save=(record)=>write(`bandpilot-debug-${record.report.id}.json`,record.report);
 const receipt=(id,value)=>write(`sent-${id}.json`,value);
 handle('bandpilot-support-status',()=>({configured:!!token,repository:WEB}));
 handle('bandpilot-github-connect',async(input)=>{
  if(input===null){token=null;rmSync(credentialPath,{force:true});return {configured:false};}
  if(typeof input!=='string'||! /^(?:github_pat_|ghp_)[A-Za-z0-9_]{20,250}$/.test(input.trim()))throw Error('Jeton GitHub personnel invalide.');
  if(!encrypted())throw Error('Le coffre chiffré du système est indisponible. Utilise la création dans le navigateur.');
  const next=input.trim();await github(fetch,'',{token:next});
  writeFileSync(credentialPath+'.tmp',JSON.stringify({encrypted:safeStorage.encryptString(next).toString('base64')}),{mode:0o600});renameSync(credentialPath+'.tmp',credentialPath);token=next;return {configured:true};
 });
 handle('bandpilot-report-prepare',async(input)=>{
  const report=await local('/api/diagnostics/report');
  report.id=randomUUID();report.summary=String(sanitize(String(input?.summary??'Rapport de problème').slice(0,140)));report.description=String(sanitize(String(input?.description??'').slice(0,1500)));
  const content=JSON.stringify(report,null,2);if(content.length>45000)throw Error('Rapport trop volumineux. Télécharge le journal de diagnostic.');
  const record={report};reports.set(report.id,record);if(reports.size>10)reports.delete(reports.keys().next().value);
  save(record);
  // Keep the most recent twenty reports, including their send receipts.
  const old=readdirSync(directory).filter(f=>/^bandpilot-debug-[a-f0-9-]{36}\.json$/.test(f)).sort((a,b)=>statSync(join(directory,b)).mtimeMs-statSync(join(directory,a)).mtimeMs).slice(20);
  for(const file of old){rmSync(join(directory,file),{force:true});rmSync(join(directory,'sent-'+file.slice('bandpilot-debug-'.length)),{force:true});}
  return {id:report.id,content};
 });
 handle('bandpilot-report-export',async(id)=>{const record=get(id);const result=await dialog.showSaveDialog(win,{title:'Rapport de diagnostic BandPilot',defaultPath:join(app.getPath('downloads'),`BandPilot-debug-${record.report.id}.json`),filters:[{name:'Diagnostic JSON',extensions:['json']}]});if(result.canceled||!result.filePath)return {cancelled:true};writeFileSync(result.filePath,JSON.stringify(record.report,null,2),{mode:0o600});return {saved:true};});
 handle('bandpilot-report-send',async(id)=>{
  const record=get(id);if(!token)throw Error('Connecte GitHub ou utilise Créer dans le navigateur.');
  if(inflight.has(id))return inflight.get(id);
  const operation=(async()=>{
   let previous;try{previous=JSON.parse(readFileSync(join(directory,`sent-${id}.json`),'utf8'));}catch{}
   if(previous?.url)return previous;
   if(previous?.attempted){const found=await findIssue(fetch,token,id);if(found){receipt(id,found);return found;}throw Error('Un envoi précédent reste non confirmé. Vérifie les issues GitHub avant tout nouvel envoi ; le rapport est conservé.');}
   receipt(id,{attempted:true});
   try{const result=await createIssue(fetch,token,record.report);receipt(id,result);diagnostic('desktop.issue_created',{number:result.number});return result;}
   catch(error){if(error.status>=400&&error.status<500){rmSync(join(directory,`sent-${id}.json`),{force:true});throw error;}throw Error('Création non confirmée. Le rapport est conservé ; vérifie GitHub et réessaie pour rechercher une issue déjà créée.');}
  })();inflight.set(id,operation);try{return await operation;}finally{inflight.delete(id);}
 });
 handle('bandpilot-report-browser',async(id)=>{
  const record=get(id),{title}=issueContent(record.report);
  // The full report is on the clipboard, not in a query string or browser history.
  const {clipboard}=require('electron');clipboard.writeText(issueContent(record.report).body);
  await shell.openExternal(`${WEB}/issues/new?title=${encodeURIComponent(title)}`);return {copied:true};
 });
 handle('bandpilot-update-check',async(force)=>{
  if(smoke)return {available:false,current:app.getVersion()};
  if(!force&&updateState)return updateState;
  updatePromise??=checkUpdate(fetch,app.getVersion(),process.platform,process.arch).then(s=>(updateState=s)).finally(()=>{updatePromise=null;});return updatePromise;
 });
 handle('bandpilot-update-open',async()=>{if(!updateState?.available)throw Error('Vérifie les mises à jour avant de télécharger.');await shell.openExternal(updateState.downloadURL);return {opened:true};});
 win.webContents.on('render-process-gone',(_event,details)=>diagnostic('desktop.renderer_exit',{reason:details.reason,exitCode:details.exitCode}));
 process.on('uncaughtExceptionMonitor',error=>diagnostic('desktop.uncaught',{message:error.message,stack:error.stack}));
}
module.exports={registerSupport};
