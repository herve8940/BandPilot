const {contextBridge,ipcRenderer}=require('electron');
// Narrow API only; no arbitrary IPC, filesystem, environment or credential reads.
contextBridge.exposeInMainWorld('xr18DesktopAI',{
 configure:(input)=>ipcRenderer.invoke('xr18-ai-configure',input)
});
// Native confirmation windows follow the saved app language and use the app icon.
contextBridge.exposeInMainWorld('xr18DesktopDialog',{
 confirm:(message)=>ipcRenderer.sendSync('xr18-confirm',String(message??'')),
 alert:(message)=>{ipcRenderer.sendSync('xr18-alert',String(message??''));}
});

// Language preference only; no access to mixer settings or profile data.
contextBridge.exposeInMainWorld('bandpilotLanguage',{
 get:()=>ipcRenderer.sendSync('bandpilot-language-get'),
 set:language=>ipcRenderer.sendSync('bandpilot-language-set',language)
});

contextBridge.exposeInMainWorld('bandpilotDocuments',{
 saveTechRiderPDF:input=>ipcRenderer.invoke('bandpilot-tech-rider-pdf',input)
});

contextBridge.exposeInMainWorld('bandpilotSupport',{
 status:()=>ipcRenderer.invoke('bandpilot-support-status'),
 connect:token=>ipcRenderer.invoke('bandpilot-github-connect',token),
 prepare:input=>ipcRenderer.invoke('bandpilot-report-prepare',input),
 export:id=>ipcRenderer.invoke('bandpilot-report-export',id),
 send:id=>ipcRenderer.invoke('bandpilot-report-send',id),
 browser:id=>ipcRenderer.invoke('bandpilot-report-browser',id),
 checkUpdate:force=>ipcRenderer.invoke('bandpilot-update-check',force===true),
 openUpdate:()=>ipcRenderer.invoke('bandpilot-update-open'),
 setAutomaticUpdates:value=>ipcRenderer.invoke('bandpilot-update-automatic',value),
 onUpdate:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('bandpilot-update-state',listener);return()=>ipcRenderer.removeListener('bandpilot-update-state',listener);}
});
