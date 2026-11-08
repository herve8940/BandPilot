// Packaged JavaScript only. No code is downloaded or evaluated from the network.
const fs=require('node:fs'),path=require('node:path');
const [root,token]=process.argv.slice(2);
if(!root||!path.isAbsolute(root)||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Invalid iPad startup configuration');
const data=path.join(root,'data');fs.mkdirSync(data,{recursive:true,mode:0o700});
let port=0;try{const saved=JSON.parse(fs.readFileSync(path.join(root,'port.json'),'utf8'));if(Number.isInteger(saved)&&saved>1024&&saved<65536)port=saved;}catch{}
Object.assign(process.env,{
 BANDPILOT_IOS:'1',BANDPILOT_NATIVE_TOKEN:token,BANDPILOT_READY_FILE:path.join(root,'ready.json'),
 XR18_HTTP_HOST:'127.0.0.1',HTTP_PORT:String(port),XR18_DB_PATH:path.join(data,'bandpilot.db'),
 XR18_CONNECTION_PATH:path.join(data,'connection.json'),XR18_WEB_DIST:path.join(__dirname,'web'),
 XR18_APP_VERSION:require('./version.json').version,XR18_APP_BUILD:require('./version.json').build,
 XR18_MODE:'simulation',XR18_ENABLE_WRITES:'false'
});
// A process restart must never restore permission to alter the console.
const config=process.env.XR18_CONNECTION_PATH;
if(fs.existsSync(config)){try{const saved=JSON.parse(fs.readFileSync(config,'utf8'));saved.enableWrites=false;fs.writeFileSync(config,JSON.stringify(saved),{mode:0o600});}catch{fs.renameSync(config,config+'.invalid-'+Date.now());}}
function failed(error){try{fs.writeFileSync(path.join(root,'startup-error.txt'),String(error.stack||error),{mode:0o600});}catch{}}
process.on('uncaughtExceptionMonitor',failed);
import('./server.mjs').catch(failed);
