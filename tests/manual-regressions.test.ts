import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {StudioDatabase} from '../src/database.js';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleControl} from '../src/console-control.js';
import {localSessionDate} from '../src/reaper.js';
test('production Lua bridge handles empty takes, original restoration, loops and project/record guards',()=>{
 const require=createRequire(import.meta.url);
 const r=spawnSync(process.execPath,[require.resolve('fengari-node-cli/src/lua-cli.js'),'tests/reaper-bridge-regressions.lua'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/regressions passed/);
});
test('workspace notes and active setlist survive database reopen independently of HTTP port',()=>{
 const file=join(mkdtempSync(join(tmpdir(),'bandpilot-draft-')),'db.sqlite');
 let db=new StudioDatabase(file);assert.equal(db.workspace(),null);
 db.saveWorkspace({notes:'Refrain à revoir',setlist:['song-1','song-1']});db.close();
 db=new StudioDatabase(file);assert.deepEqual(db.workspace(),{notes:'Refrain à revoir',setlist:['song-1','song-1']});
 assert.throws(()=>db.saveWorkspace({notes:'x',setlist:[42]}));db.saveWorkspace({notes:'',setlist:[]});assert.deepEqual(db.workspace(),{notes:'',setlist:[]});db.close();
});
test('full scene recall can explicitly exclude phantom without weakening the default confirmation guard',async()=>{
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});const lib=new LibraryStore(':memory:');const cc=new ConsoleControl(xr,lib);
 try{const scene=await cc.capture();scene.values['/headamp/01/phantom']=1;scene.values['/ch/01/mix/fader']=.3;
 await assert.rejects(cc.recall(scene),/48 V/);await cc.recall(scene,false,true);assert.equal(await xr.readParameter('/headamp/01/phantom'),0);assert.equal(await xr.readParameter('/ch/01/mix/fader'),.3);
 await cc.recall(scene,true);assert.equal(await xr.readParameter('/headamp/01/phantom'),1);
 }finally{xr.close();lib.close();}
});
test('session dates use local calendar fields rather than UTC date',()=>{
 const previous=process.env.TZ;try{process.env.TZ='Europe/Brussels';const date=new Date(2026,10,4,0,5);assert.equal(date.toISOString().slice(0,10),'2026-11-03');assert.equal(localSessionDate(date),'2026-11-04');}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('simulation analog and USB routing default to distinct inputs',async()=>{
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});
 try{await xr.syncLiveView();assert.equal(await xr.readParameter('/ch/05/config/insrc'),4);assert.equal(await xr.readParameter('/routing/usb/05/src'),4);}finally{xr.close();}
});

test('production bridge retains Rec response across Windows file locks without rerunning the action',()=>{
 const require=createRequire(import.meta.url);
 for(const platform of ['native','windows']){
 const r=spawnSync(process.execPath,[require.resolve('fengari-node-cli/src/lua-cli.js'),'tests/reaper-bridge-io.lua',platform],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/I\/O regressions passed/);
 }
});
