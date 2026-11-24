// Exercise archive handling inside Electron, where node:fs virtualizes .asar files.
const {app}=require('electron');
const fs=require('original-fs').promises;
const {EventEmitter}=require('node:events');
const path=require('node:path');
const {prepareInstall,createUpdates,launchInstall}=require('../desktop/updates.cjs');
const {registerShutdown}=require('../desktop/shutdown.cjs');
async function main(){
 const request=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
 if(process.argv[3]==='quit'){
  const plan=JSON.parse(await fs.readFile(request.response,'utf8'));
  await app.whenReady();
  registerShutdown(app,{
   stopMeasurements:async()=>{},
   installUpdate:()=>launchInstall(plan,request.directory),
   diagnostic:(event,details)=>{console.error(event,details);app.exit(1);}
  });
  app.quit();
  return;
 }
 const installed=Object.assign(new EventEmitter(),{
  isPackaged:true,getVersion:()=>request.version,
  getAppPath:()=>path.join(request.target,'Contents/Resources/app.asar'),
 });
 if(process.argv[3]==='cleanup'){
  const errors=[];
  const updates=createUpdates({app:installed,dataPath:request.directory,diagnostic:(event,detail)=>errors.push({event,...detail})});
  try{await updates.markSuccessfulStart();if(errors.length)throw Error(JSON.stringify(errors));}
  finally{updates.dispose();}
 }else{
  const plan=await prepareInstall({...request,app:installed,platform:process.platform});
  await fs.writeFile(request.response,JSON.stringify(plan));
 }
}
main().then(()=>{if(process.argv[3]!=='quit')app.exit(0);},error=>{console.error(error);app.exit(1);});
