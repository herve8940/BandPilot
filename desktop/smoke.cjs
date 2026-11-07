const {spawnSync}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const data=mkdtempSync(join(tmpdir(),'xr18-desktop-smoke-'));
try {
 const executable=process.argv[2]||require('electron');
 const args=process.argv[2]?['--smoke-test']:['.','--smoke-test'];
 if(process.platform==='linux'&&process.env.CI)args.push('--no-sandbox');
 const result=spawnSync(executable,args,{env:{...process.env,XR18_SMOKE_DATA:data},timeout:90000,killSignal:'SIGKILL',stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Échec démarrage XR18 : '+result.status);
 console.log('XR18 : backend, SQLite et interface démarrés.');
}finally{rmSync(data,{recursive:true,force:true});}

