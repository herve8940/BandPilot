import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankSceneValues} from '../src/blank-scene.js';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
test('blank scene: neutral mix, levels down, never phantom, gains, routing or effect settings (FX back to send/return)',async()=>{
 const v=blankSceneValues(),keys=Object.keys(v);
 assert.ok(keys.length>300&&keys.length<=1024,'size '+keys.length);
 for(const a of keys)if(!/^\/fx\/[1-4]\/insert$/.test(a))assert.doesNotMatch(a,/headamp|phantom|routing|^\/fx\/|insrc|rtnsrc|chlink/);
 assert.equal(blankSceneValues(true)['/lr/mix/on'],0);
 assert.equal(v['/ch/05/mix/04/grpon'],0);assert.equal(v['/rtn/aux/mix/04/grpon'],0);
 assert.ok(keys.indexOf('/ch/05/mix/04/level')<keys.indexOf('/ch/05/mix/on'));
 assert.equal(v['/fx/2/insert'],0);assert.equal(v['/fx/2/type'],undefined);
 assert.equal(v['/ch/01/config/name'],'');assert.equal(v['/ch/01/mix/fader'],0);assert.equal(v['/lr/mix/fader'],0);assert.equal(v['/bus/3/mix/fader'],0);
 assert.equal(v['/ch/05/mix/04/level'],0);assert.equal(v['/ch/01/mix/01/pan'],.5);assert.equal(v['/ch/16/eq/2/g'],.5);assert.equal(v['/ch/02/gate/on'],0);assert.equal(v['/ch/02/dyn/on'],0);
 assert.equal(v['/bus/2/mix/lr'],0);assert.equal(v['/ch/07/mix/on'],1);assert.equal(v['/dca/1/fader'],.75);assert.equal(v['/fxsend/1/mix/fader'],.75);
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
 try{
  await xr.writeParameter('/headamp/03/phantom',1,true);await xr.writeParameter('/headamp/03/gain',.5);await xr.writeParameter('/ch/03/config/name','Voix');
  const plan=await control.preview(v,true);const r=await control.apply(plan.token,false,true);assert.equal(r.ok,true);
  assert.equal(await xr.readParameter('/ch/03/config/name'),'');assert.equal(await xr.readParameter('/headamp/03/phantom'),1);assert.equal(await xr.readParameter('/headamp/03/gain'),.5);
  const back=await control.preview(library.get(r.backupId).data,true);await control.apply(back.token,false,true);assert.equal(await xr.readParameter('/ch/03/config/name'),'Voix');
 }finally{xr.close();library.close();}
});
