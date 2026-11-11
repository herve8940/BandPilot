import {build} from '../../node_modules/esbuild/lib/main.js';
import {mkdir,symlink,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),out=resolve(root,'android/build/runtime-tests');
await mkdir(out,{recursive:true});
await rm(resolve(out,'node_modules'),{recursive:true,force:true});
await symlink(resolve(root,'android/runtime/node_modules'),resolve(out,'node_modules'),'dir');
const names=['database','sound-coach','vocal-fx','access','console-control','blank-scene','instrument-validation','android-updates','android-platform','diagnostics'];
for(const name of names)await build({entryPoints:[`tests/${name}.test.ts`],outfile:resolve(out,name+'.test.mjs'),bundle:true,format:'esm',platform:'node',target:'node18',
 alias:{'better-sqlite3':resolve(root,'android/runtime/sqlite.mjs')},external:['sql.js','bufferutil','utf-8-validate'],banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);"}});
const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...names.map(n=>resolve(out,n+'.test.mjs'))],{stdio:'inherit'});
process.exitCode=result.status??1;
