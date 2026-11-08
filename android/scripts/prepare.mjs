import {build} from '../../node_modules/esbuild/lib/main.js';
import {cp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,'android/app/src/main/assets/runtime');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const bundled=await build({entryPoints:[resolve(root,'src/server.ts')],outfile:resolve(out,'server.mjs'),bundle:true,platform:'node',target:'node18',format:'esm',metafile:true,
 alias:{'better-sqlite3':resolve(root,'android/runtime/sqlite.mjs')},external:['sql.js','bufferutil','utf-8-validate'],
 banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);"}});
await cp(resolve(root,'android/runtime/bootstrap.cjs'),resolve(out,'bootstrap.cjs'));
await cp(resolve(root,'web/dist'),resolve(out,'web'),{recursive:true});
await mkdir(resolve(out,'node_modules/sql.js/dist'),{recursive:true});
for(const name of ['package.json','LICENSE','dist/sql-wasm.js','dist/sql-wasm.wasm'])await cp(resolve(root,'android/runtime/node_modules/sql.js',name),resolve(out,'node_modules/sql.js',name));
const version=JSON.parse(await readFile(resolve(root,'android/runtime/package.json'),'utf8')).version;
let commit='source';try{commit=execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}
const revision=createHash('sha256').update(commit).update(await readFile(resolve(out,'server.mjs'))).update(await readFile(resolve(out,'bootstrap.cjs'))).update(await readFile(resolve(out,'web/index.html'))).digest('hex').slice(0,16);
await writeFile(resolve(out,'version.json'),JSON.stringify({version,build:commit+' · Android '+revision,revision}));
await mkdir(resolve(out,'licenses'),{recursive:true});
await cp(resolve(root,'android/licenses/nodejs-mobile.txt'),resolve(out,'licenses/nodejs-mobile.txt'));
await cp(resolve(root,'LICENSE'),resolve(out,'licenses/BandPilot.txt'));
await cp(resolve(root,'THIRD_PARTY_NOTICES.txt'),resolve(out,'licenses/THIRD_PARTY_NOTICES.txt'));
const packages=new Set(['web/node_modules/react','web/node_modules/react-dom','web/node_modules/lucide-react','web/node_modules/scheduler','android/runtime/node_modules/sql.js']);
for(const input of Object.keys(bundled.metafile.inputs)){const match=/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)/.exec(input);if(match)packages.add(match[1]);}
for(const location of packages){const dir=resolve(root,location);let names=[];try{names=await readdir(dir);}catch{continue;}
 for(const name of names.filter(n=>/^(?:licen[sc]e|copying|notice)(?:\.|$)/i.test(n)))try{await cp(resolve(dir,name),resolve(out,'licenses',location.replaceAll('/','_')+'_'+name));}catch{}
}
console.log('Android runtime prepared:',version);
