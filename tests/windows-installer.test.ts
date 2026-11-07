import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const {patchTemplate}=require('../scripts/patch-nsis.cjs');
test('Windows installer backport preserves existing destinations and refuses unknown templates',()=>{
 const source=readFileSync(join(dirname(require.resolve('app-builder-lib/package.json')),'templates/nsis/multiUser.nsh'),'utf8').replace(/\r\n/g,'\n');
 const patched=patchTemplate(source);
 assert.equal(patchTemplate(patched),patched);
 assert.ok(!patched.includes("System::Call '*$2(&w${NSIS_MAX_STRLEN} .s)'"));
 const prefix='      StrCpy $0 "$LocalAppData\\Programs"';
 const suffix='      StrCpy $INSTDIR "$0\\${APP_FILENAME}"';
 assert.equal(patched.slice(0,patched.indexOf(prefix)),source.slice(0,source.indexOf(prefix)));
 assert.equal(patched.slice(patched.indexOf(suffix)),source.slice(source.indexOf(suffix)));
 assert.throws(()=>patchTemplate('unexpected template'),/NSIS inattendu/);
});
