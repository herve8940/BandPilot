// Rebuild explicitly: electron-rebuild's cached marker can survive a later Node
// rebuild of the same module. A marker alone does not prove the current ABI.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=require('../package.json');
if(process.platform!=='darwin'||!pkg.version.includes('-dev.'))throw Error('This command requires macOS and a DEV version.');
const run=(command,args,env=process.env)=>{const result=spawnSync(command,args,{cwd:root,env,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error(`${path.basename(command)} exited with ${result.status}`);};
const electron=require('electron'),electronVersion=require('electron/package.json').version;
const output='release/dev-controls-xair';
const app=path.join(root,output,process.arch==='arm64'?'mac-arm64':'mac','BandPilot DEV.app');
const packagedSQLite=path.join(app,'Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3');
const verifySQLite=target=>run(electron,['-e',"const Database=require(process.argv[1]); const db=new Database(':memory:'); if(db.prepare('SELECT 42 AS answer').get().answer!==42)throw Error('SQLite check failed');db.close(); console.log('SQLite verified for Electron ABI '+process.versions.modules);",target],{...process.env,ELECTRON_RUN_AS_NODE:'1'});
run('npm',['run','build:all']);
try{
 run(path.join(root,'node_modules/.bin/electron-rebuild'),['--force','--which-module','better-sqlite3','--version',electronVersion,'--arch',process.arch]);
 verifySQLite(path.join(root,'node_modules/better-sqlite3'));
 run(path.join(root,'node_modules/.bin/electron-builder'),['--mac',`--${process.arch}`,'--dir','--publish','never','--config.appId=be.bandpilot.dev','--config.productName=BandPilot DEV',`--config.directories.output=${output}`,'--config.npmRebuild=false']);
 verifySQLite(packagedSQLite);
}finally{
 // The editable project uses normal Node; the application owns its separate copy.
 run('npm',['rebuild','better-sqlite3']);
}
verifySQLite(packagedSQLite);
run(process.execPath,['-e',"const Database=require('better-sqlite3');new Database(':memory:').close();console.log('Editable project verified for Node ABI '+process.versions.modules);"]);
run('/usr/bin/codesign',['--verify','--deep','--strict',app]);
console.log('DEV app ready: '+app);
