import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {loadAI,saveAI}=createRequire(import.meta.url)('../desktop/ai-config.cjs');
test('desktop credentials delegate to OS encryption, refuse plaintext backend, and can be removed',()=>{
 const directory=mkdtempSync(join(tmpdir(),'xr18-ai-store-')),file=join(directory,'secret.json');
 let keychainRequests=0;
 assert.equal(loadAI(file,{isEncryptionAvailable(){keychainRequests++;return true;}}),null);
 assert.equal(keychainRequests,0);
 // Fixture codec only: production supplies Electron safeStorage.
 const storage={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'test-encrypted',encryptString:(s:string)=>Buffer.from(s).map(v=>v^165),decryptString:(b:Buffer)=>Buffer.from(b).map(v=>v^165).toString()};
 try{
  const config={apiKey:'test-private-key',model:'account-model'};saveAI(file,storage,config);assert.ok(!readFileSync(file,'utf8').includes(config.apiKey));assert.deepEqual(loadAI(file,storage),config);
  const plaintext={...storage,getSelectedStorageBackend:()=> 'basic_text'};assert.throws(()=>saveAI(file,plaintext,config),/coffre chiffré/);assert.equal(loadAI(file,plaintext),null);
  assert.throws(()=>saveAI(file,{...storage,isEncryptionAvailable:()=>false},config),/Aucune clé/);assert.throws(()=>saveAI(file,storage,{apiKey:'x',model:'m'}));
  saveAI(file,storage,null);assert.equal(existsSync(file),false);assert.equal(loadAI(file,storage),null);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
