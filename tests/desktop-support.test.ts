import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sanitizeDiagnostic} from '../shared/diagnostic-report.js';
const {registerSupport}=createRequire(import.meta.url)('../desktop/support.cjs');
test('native support isolates credentials, restricts IPC and deduplicates simultaneous issue creation',async()=>{
 const path=mkdtempSync(join(tmpdir(),'bandpilot-support-')),handlers=new Map<string,any>(),originalFetch=globalThis.fetch;let role='admin',posts=0;
 const frame={url:'http://127.0.0.1:1234/'},webContents={mainFrame:frame,session:{cookies:{get:async()=>[]}},on:()=>{}};
 const event={sender:webContents,senderFrame:frame};
 let keychainChecks=0;
 const storage={isEncryptionAvailable:()=>{keychainChecks++;return true;},getSelectedStorageBackend:()=> 'test',encryptString:(s:string)=>Buffer.from(s).map(b=>b^165),decryptString:(b:Buffer)=>Buffer.from(b).map(v=>v^165).toString()};
 const fetcher=async(url:any,init:any={})=>{
  if(String(url).endsWith('/api/auth'))return new Response(JSON.stringify({user:{role}}));
  if(String(url).endsWith('/api/diagnostics/report'))return new Response(JSON.stringify({app:{version:'2.3.2'},events:[]}));
  if(String(url).endsWith('/issues')&&init.method==='POST'){posts++;await new Promise(r=>setTimeout(r,10));return new Response(JSON.stringify({number:7,html_url:'https://github.com/herve8940/BandPilot/issues/7'}));}
  return new Response('{}');
 };
 globalThis.fetch=fetcher;
 const oldMonitors=process.listeners('uncaughtExceptionMonitor');
 try{
  registerSupport({app:{getPath:()=>path,getVersion:()=> '2.3.2'},win:{webContents},ipcMain:{handle:(name:string,fn:any)=>handlers.set(name,fn)},dialog:{showSaveDialog:async()=>({canceled:true})},shell:{openExternal:async()=>{}},safeStorage:storage,port:1234,dataPath:path,sanitize:sanitizeDiagnostic,diagnostic:()=>{},smoke:true});
  assert.equal(keychainChecks,0,'opening a fresh profile never prompts for the OS keychain');
  const call=(name:string,input?:any)=>handlers.get('bandpilot-'+name)(event,input);
  assert.ok((await handlers.get('bandpilot-support-status')({...event,sender:{}})).error);
  role='musician';assert.ok((await call('report-prepare',{})).error);role='admin';
  const token='github_pat_'+'a'.repeat(50);assert.equal((await call('github-connect',token)).configured,true);assert.ok(!readFileSync(join(path,'github-credentials.json'),'utf8').includes(token));
  const report=await call('report-prepare',{summary:'Ajout',description:'Erreur à 192.0.2.1'});assert.ok(report.id);assert.ok(!report.content.includes('192.0.2.1'));assert.equal(readdirSync(join(path,'reports')).length,1);
  const [a,b]=await Promise.all([call('report-send',report.id),call('report-send',report.id)]);assert.equal(a.number,7);assert.deepEqual(a,b);assert.equal(posts,1);
  assert.equal((await call('report-send',report.id)).number,7);assert.equal(posts,1);
  assert.equal((await call('github-connect',null)).configured,false);
 }finally{globalThis.fetch=originalFetch;for(const listener of process.listeners('uncaughtExceptionMonitor'))if(!oldMonitors.includes(listener))process.off('uncaughtExceptionMonitor',listener);rmSync(path,{recursive:true,force:true});}
});
