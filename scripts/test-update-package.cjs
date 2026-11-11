// Exercise the real update payload in an isolated installation, never the user's app.
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {prepareInstall,launchInstall}=require('../desktop/updates.cjs');
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
  const plan=await prepareInstall({app,platform,env:{APPIMAGE:target},downloaded,version,directory:root});
  if(platform==='win32'){
   await launchInstall(plan,root);
   const executable=path.join(target,'BandPilot.exe');let installed=false;
   for(let attempt=0;attempt<120;attempt++){
    try{await fs.access(executable);installed=true;break;}catch{}await new Promise(r=>setTimeout(r,1000));
   }
   if(!installed)throw Error('Silent update did not install into its expected directory');
   await new Promise(r=>setTimeout(r,3000));
   const result=await exec(process.execPath,['desktop/smoke.cjs',executable],{timeout:120000});console.log(result.stdout);
  }else{
   await exec('/bin/sh',[path.resolve('desktop/install-update.sh'),'999999999',plan.staged,plan.target,plan.backup,plan.identity,plan.marker]);
   await fs.access(plan.backup);await fs.access(plan.marker);
   if(platform==='darwin'){
    await exec('/usr/bin/codesign',['--verify','--deep','--strict',target]);
    const result=await exec(process.execPath,['desktop/smoke.cjs',path.join(target,'Contents/MacOS/BandPilot')],{timeout:120000});console.log(result.stdout);
   }else if(!(await fs.readFile(target)).equals(await fs.readFile(downloaded)))throw Error('Installed AppImage differs from the verified payload');
  }
  console.log(`Automatic ${platform} update: staged, installed and verified in an isolated path.`);
 }finally{await fs.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:500});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
