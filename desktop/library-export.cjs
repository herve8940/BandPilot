const path=require('node:path');
const {writeFile}=require('node:fs/promises');

/** The destination is chosen only by the native save dialog, never by the renderer. */
async function saveLibraryFile({input,dialog,win,documents,title}){
 if(!input||typeof input.filename!=='string'||typeof input.content!=='string'||Buffer.byteLength(input.content)>1000000)throw Error('Invalid export');
 const extension=path.extname(input.filename).toLowerCase();
 if(!['.json','.scn'].includes(extension))throw Error('Invalid export format');
 if(extension==='.json')JSON.parse(input.content);
 const filename=path.basename(input.filename).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,160);
 const result=await dialog.showSaveDialog(win,{title,defaultPath:path.join(documents,filename),filters:[{name:extension==='.json'?'BandPilot JSON':'X-AIR Scene',extensions:[extension.slice(1)]}]});
 if(result.canceled||!result.filePath)return {cancelled:true};
 await writeFile(result.filePath,input.content,'utf8');
 return {saved:true};
}
module.exports={saveLibraryFile};
