import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeOsc} from '../src/osc.js';
import {readbackTolerance,PARAMETERS} from '../src/parameters.js';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';

// Behaviours found on a physical XR18 (firmware 1.x), not reproduced by the simulator.
test('a /node reply sent back as "node" (no leading slash) is accepted',()=>{
 const pad=(t:string)=>{const b=Buffer.from(t+'\0','latin1');return Buffer.concat([b,Buffer.alloc((4-b.length%4)%4)]);};
 const raw=Buffer.concat([pad('node'),pad(',s'),pad('/config/chlink OFF OFF')]);
 const m=decodeOsc(raw);assert.equal(m.address,'/node');assert.equal(m.args[0],'/config/chlink OFF OFF');
});
test('read-back tolerates one hardware step on log-scaled values (HPF, Q, times)',()=>{
 const hpf=Object.keys(PARAMETERS).find(a=>a.endsWith('/preamp/hpf'))!;
 const tol=readbackTolerance(hpf);assert.ok(tol>=.003);
 // The XR18 stores 35 Hz as the step just below (34.3 Hz): a difference of about one step must pass.
 assert.ok(tol>=1/200,'tolerance '+tol);
});
test('a full capture survives a few addresses the console never answers',async()=>{
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:');
 const silent=new Set(['/config/solo/dimpfl','/ch/16/automix/group']);
 const original=xr.readParameter.bind(xr);
 (xr as unknown as {readParameter:(a:string)=>Promise<unknown>}).readParameter=async(a:string)=>{if(silent.has(a))throw Error('Pas de réponse XR18 : '+a);return original(a);};
 try{
  const scene=await new ConsoleControl(xr,library).capture();
  assert.deepEqual([...(scene.missing??[])].sort(),[...silent].sort());
  assert.equal(Object.keys(scene.values).length,xr.parameterAddresses().length-silent.size);
 }finally{xr.close();library.close();}
});
test('a value outside the known range is skipped and listed, not fatal (ch 16 input source)',async()=>{
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:');
 const original=xr.readParameter.bind(xr);
 (xr as unknown as {readParameter:(a:string)=>Promise<unknown>}).readParameter=async(a:string)=>{if(a==='/ch/16/config/insrc')throw Error('Valeur OSC hors plage : /ch/16/config/insrc (reçu 18)');return original(a);};
 try{
  const scene=await new ConsoleControl(xr,library).capture();
  assert.deepEqual(scene.missing,['/ch/16/config/insrc']);assert.equal(scene.values['/ch/16/config/insrc'],undefined);
 }finally{xr.close();library.close();}
});
test('values read from a physical XR18 (diagnostic of 31/10/2026) are all accepted',async()=>{
 const {validateWire}=await import('../src/parameters.js');
 // /rtn/aux/config "" 0 U1718 → the console sends 8 (same list as the FX returns: U0102…U1718).
 assert.equal(validateWire('/rtn/aux/config/rtnsrc',8),8);
 assert.equal(PARAMETERS['/rtn/aux/config/rtnsrc']!.options![8],'U1718');
 // The insert slot leaf is "sel" (X-AIR Edit name), "fxslot" got no answer.
 for(const p of ['/ch/01','/ch/16','/bus/3','/lr'])assert.ok(PARAMETERS[p+'/insert/sel']&&!PARAMETERS[p+'/insert/fxslot'],p);
});
test('a preview left open several minutes can still be applied (but not after 10 minutes)',async()=>{
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
 const realNow=Date.now;let shift=0;Date.now=()=>realNow()+shift;
 try{
  const p=await control.preview({'/ch/05/mix/fader':.5},true);shift=5*60_000;
  assert.equal((await control.apply(p.token)).ok,true,'still valid after 5 minutes');
  const q=await control.preview({'/ch/05/mix/fader':.6},true);shift+=11*60_000;
  await assert.rejects(control.apply(q.token),/expirée/);
 }finally{Date.now=realNow;xr.close();library.close();}
});
