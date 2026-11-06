const {BrowserWindow,session}=require('electron');

async function renderTechRiderPDF(html){
 if(typeof html!=='string'||Buffer.byteLength(html)>1_000_000||!html.includes('class="tech-document"'))throw Error('Fiche technique invalide');
 // A dedicated, scriptless document. No app credentials or network access.
 const isolated=session.fromPartition('bandpilot-rider-pdf');
 isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:')}));
 const documentWindow=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,javascript:false,session:isolated}});
 documentWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 documentWindow.webContents.on('will-navigate',event=>event.preventDefault());
 try{
  await documentWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  return await documentWindow.webContents.printToPDF({pageSize:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
 }finally{documentWindow.destroy();}
}
module.exports={renderTechRiderPDF};
