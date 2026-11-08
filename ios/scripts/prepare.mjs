import {build} from '../../node_modules/esbuild/lib/main.js';
import {cp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(root,'ios/BandPilot/Runtime');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
// iOS NodeMobile has no JIT. Use SQLite's asm.js build, not WebAssembly.
await build({entryPoints:[resolve(root,'src/server.ts')],outfile:resolve(out,'server.mjs'),bundle:true,platform:'node',target:'node18',format:'esm',
 alias:{'better-sqlite3':resolve(root,'android/runtime/sqlite.mjs'),'sql.js':resolve(root,'ios/runtime/node_modules/sql.js/dist/sql-asm.js')},external:['bufferutil','utf-8-validate'],
 banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);import {fileURLToPath as __fileURLToPath} from 'node:url';import {dirname as __pathDirname} from 'node:path';const __filename=__fileURLToPath(import.meta.url),__dirname=__pathDirname(__filename);"}});
await cp(resolve(root,'ios/runtime/bootstrap.cjs'),resolve(out,'bootstrap.cjs'));
await cp(resolve(root,'web/dist'),resolve(out,'web'),{recursive:true});
const version=JSON.parse(await readFile(resolve(root,'ios/runtime/package.json'),'utf8')).version;
let commit='source';try{commit=execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}
await writeFile(resolve(out,'version.json'),JSON.stringify({version,build:commit+' · iPad'}));
await mkdir(resolve(out,'licenses'),{recursive:true});
for(const [from,to] of [['LICENSE','BandPilot.txt'],['THIRD_PARTY_NOTICES.txt','THIRD_PARTY_NOTICES.txt'],['android/licenses/nodejs-mobile.txt','nodejs-mobile.txt'],['ios/runtime/node_modules/sql.js/LICENSE','sql.js.txt'],['web/node_modules/react/LICENSE','react.txt'],['web/node_modules/react-dom/LICENSE','react-dom.txt'],['web/node_modules/lucide-react/LICENSE','lucide-react.txt']])await cp(resolve(root,from),resolve(out,'licenses',to));
await cp(resolve(root,'build/icon.png'),resolve(root,'ios/BandPilot/Assets.xcassets/AppIcon.appiconset/icon.png'));
console.log('Prepared embedded iPad runtime:',version);
