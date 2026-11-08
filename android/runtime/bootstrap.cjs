// Native launcher passes only private application paths and a per-process token.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const [root,token]=process.argv.slice(2);
if(!root||!path.isAbsolute(root)||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Invalid Android startup configuration');
const data=path.join(root,'data');fs.mkdirSync(data,{recursive:true});
let port=0;try{const saved=JSON.parse(fs.readFileSync(path.join(root,'port.json'),'utf8'));if(Number.isInteger(saved)&&saved>1024&&saved<65536)port=saved;}catch{}
const networkFile=path.join(root,'network.json');
const original=os.networkInterfaces;
// Android restricts getifaddrs on some versions. Java supplies Wi-Fi addresses
// from ConnectivityManager, including a real mask for broadcast discovery.
os.networkInterfaces=()=>{try{const info=JSON.parse(fs.readFileSync(networkFile,'utf8'));return info.interfaces??{};}catch{try{return original();}catch{return {};}}};
require('node:module').syncBuiltinESMExports();
Object.assign(process.env,{
 BANDPILOT_ANDROID:'1',BANDPILOT_NATIVE_TOKEN:token,BANDPILOT_READY_FILE:path.join(root,'ready.json'),
 XR18_HTTP_HOST:'127.0.0.1',HTTP_PORT:String(port),XR18_DB_PATH:path.join(data,'bandpilot.db'),
 XR18_CONNECTION_PATH:path.join(data,'connection.json'),XR18_WEB_DIST:path.join(__dirname,'web'),
 XR18_APP_VERSION:require('./version.json').version,XR18_APP_BUILD:require('./version.json').build,
 XR18_MODE:'simulation',XR18_ENABLE_WRITES:'false'
});
// Never resume writes automatically after Android killed the process.
const config=process.env.XR18_CONNECTION_PATH;
if(fs.existsSync(config)){try{const saved=JSON.parse(fs.readFileSync(config,'utf8'));saved.enableWrites=false;fs.writeFileSync(config,JSON.stringify(saved),{mode:0o600});}catch{fs.renameSync(config,config+'.invalid-'+Date.now());}}
process.on('uncaughtExceptionMonitor',error=>{try{fs.writeFileSync(path.join(root,'startup-error.txt'),String(error.stack||error),{mode:0o600});}catch{}});
import('./server.mjs').catch(error=>{fs.writeFileSync(path.join(root,'startup-error.txt'),String(error.stack||error),{mode:0o600});console.error(error);});
