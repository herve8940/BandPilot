import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url),fs=require('node:fs');
const {createFixture}=require('../desktop/dev19-rehearsal-smoke.cjs');

test('REAPER smoke fixture retries locked heartbeat, request and response without replaying a command',async()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'bandpilot-fixture-'));
 const rename=fs.renameSync,unlink=fs.unlinkSync,failures=new Set<string>();
 const locked=(key:string)=>{if(failures.has(key))return;failures.add(key);throw Object.assign(Error('Simulated Windows file lock'),{code:'EPERM'});};
 let fixture:any;
 try{
  fs.renameSync=(from:string,to:string)=>{if(to.startsWith(dir))locked(to);return rename(from,to);};
  fs.unlinkSync=(file:string)=>{if(file.startsWith(dir)&&file.endsWith('.lua'))locked(file);return unlink(file);};
  fixture=createFixture(dir);
  const mailbox=join(fixture.root,'XR18Studio'),response=join(mailbox,'response-a1.json');
  fs.writeFileSync(join(mailbox,'request-a1.lua'),'return { ["cmd"]="rehearsal_command", ["action"]="record", ["project"]="'+fixture.tabs[0].id+'" }');
  const deadline=Date.now()+3000;
  while(!fs.existsSync(response)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,40));
  assert.ok(fs.existsSync(response),'The response must survive a transient rename failure');
  assert.match(fs.readFileSync(join(mailbox,'heartbeat.txt'),'utf8'),/^BandPilotBridge\/2/);
  assert.equal(JSON.parse(fs.readFileSync(response,'utf8')).ok,true);
  assert.equal(fixture.calls.length,1,'Retrying the response must not replay recording');
  assert.equal(fixture.calls[0].action,'record');
  assert.equal(failures.size,3,'All three transient file locks were exercised');
 }finally{fixture?.stop();fs.renameSync=rename;fs.unlinkSync=unlink;fs.rmSync(dir,{recursive:true,force:true});}
});
