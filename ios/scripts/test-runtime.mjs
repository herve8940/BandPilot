import {build} from '../../node_modules/esbuild/lib/main.js';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),out=resolve(root,'ios/build/runtime-tests');
await mkdir(out,{recursive:true});
const names=['database','sound-coach','vocal-fx','access','console-control','blank-scene','instrument-validation'];
for(const name of names)await build({entryPoints:[`tests/${name}.test.ts`],outfile:resolve(out,name+'.test.mjs'),bundle:true,format:'esm',platform:'node',target:'node18',
 alias:{'better-sqlite3':resolve(root,'android/runtime/sqlite.mjs'),'sql.js':resolve(root,'ios/runtime/node_modules/sql.js/dist/sql-asm.js')},external:['bufferutil','utf-8-validate'],banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);import {fileURLToPath as __fileURLToPath} from 'node:url';import {dirname as __pathDirname} from 'node:path';const __filename=__fileURLToPath(import.meta.url),__dirname=__pathDirname(__filename);"}});
const result=spawnSync(process.execPath,['--jitless','--test','--test-concurrency=2',...names.map(n=>resolve(out,n+'.test.mjs'))],{stdio:'inherit'});
process.exitCode=result.status??1;
