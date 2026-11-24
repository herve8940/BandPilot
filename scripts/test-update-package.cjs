// Exercise the real update payload in an isolated installation, never the user's app.
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {prepareInstall}=require('../desktop/updates.cjs');
const exec=promisify(execFile);
async function main(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'bandpilot update test '));
 const version=require('../package.json').version;
 const platform=process.platform,arch=process.arch;
 try{
  const target=path.join(root,platform==='darwin'?'BandPilot.app':platform==='win32'?'installed':'BandPilot.AppImage');
  const name=platform==='darwin'?`BandPilot-macOS-${version}-${arch}.zip`:platform==='win32'?`BandPilot-Windows-${version}.exe`:`BandPilot-Linux-${version}-${arch==='x64'?'x86_64':arch}.AppImage`;
  const downloaded=path.resolve('release',name);
  if(platform==='linux')await fs.writeFile(target,'previous application');else await fs.mkdir(target);
  const app={isPackaged:true,getAppPath:()=>path.join(target,'Contents/Resources/app.asar'),getPath:()=>path.join(target,'BandPilot.exe')};
  const request=path.join(root,'request.json'),response=path.join(root,'plan.json');
  await fs.writeFile(request,JSON.stringify({target,downloaded,version,directory:root,response}));
  let plan;
  if(platform==='darwin'){
   await exec(require('electron'),[path.resolve('scripts/test-update-electron.cjs'),request],{timeout:120000});
   plan=JSON.parse(await fs.readFile(response,'utf8'));
   // Include a real archive in the previous version, so cleanup is tested too.
   await fs.mkdir(path.join(target,'Contents/Resources'),{recursive:true});
   await fs.copyFile(path.join(plan.staged,'Contents/Resources/app.asar'),path.join(target,'Contents/Resources/app.asar'));
   if((await fs.readdir(root)).some(name=>name.startsWith('unpack-')))throw Error('Temporary app was not removed');
  }else plan=await prepareInstall({app,platform,env:{APPIMAGE:target},downloaded,version,directory:root});
  if(platform==='darwin'||platform==='win32'){
   if(platform==='win32')await fs.writeFile(response,JSON.stringify(plan));
   await exec(require('electron'),[path.resolve('scripts/test-update-electron.cjs'),request,'quit'],{timeout:120000});
  }
  if(platform==='win32'){
   const executable=path.join(target,'BandPilot.exe');let installed=false;
   for(let attempt=0;attempt<120;attempt++){
    try{await fs.access(executable);installed=true;break;}catch{}await new Promise(r=>setTimeout(r,1000));
   }
   if(!installed)throw Error('Silent update did not install into its expected directory');
   await new Promise(r=>setTimeout(r,3000));
   const result=await exec(process.execPath,['desktop/smoke.cjs',executable],{timeout:120000});console.log(result.stdout);
  }else{
   if(platform==='darwin'){
    for(let attempt=0;attempt<60;attempt++){
     try{await fs.access(plan.marker);break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}
    }
   }else await exec('/bin/sh',[path.resolve('desktop/install-update.sh'),'999999999',plan.staged,plan.target,plan.backup,plan.identity,plan.marker]);
   await fs.access(plan.backup);await fs.access(plan.marker);
   if(platform==='darwin'){
    await exec('/usr/bin/codesign',['--verify','--deep','--strict',target]);
    const result=await exec(process.execPath,['desktop/smoke.cjs',path.join(target,'Contents/MacOS/BandPilot')],{timeout:120000});console.log(result.stdout);
    await fs.mkdir(path.join(root,'updates'));
    await fs.writeFile(path.join(root,'updates/install.json'),JSON.stringify({version,target,backup:plan.backup}));
    await exec(require('electron'),[path.resolve('scripts/test-update-electron.cjs'),request,'cleanup'],{timeout:120000});
    for(const removed of [plan.backup,path.join(root,'updates/install.json')]){
     try{await fs.access(removed);}catch(error){if(error.code==='ENOENT')continue;throw error;}
     throw Error('Successful startup did not remove '+removed);
    }
   }else if(!(await fs.readFile(target)).equals(await fs.readFile(downloaded)))throw Error('Installed AppImage differs from the verified payload');
  }
  console.log(`Automatic ${platform} update: staged, installed and verified in an isolated path.`);
 }finally{await fs.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:500});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
