import {test} from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {SceneRecall} from '../src/scene-recall.js';
import {captureChannelPreset,previewChannelPreset,validateChannelPreset} from '../src/channel-presets.js';
import {previewGroupedAdjustment,previewChannelBackup,previewChannelOperation} from '../src/channel-operations.js';
import {PARAMETERS,defaultWire,toWire,fromWire} from '../src/parameters.js';
import {decodeOsc,encodeOsc,oscFloat,type OutgoingOscArg} from '../src/osc.js';
import type {MixerModelId} from '../shared/mixer-models.js';

function fixture(model:MixerModelId='XR18'){
  const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,model});
  const library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
  return {xr,library,control,recall:new SceneRecall(xr,control,library),close(){xr.close();library.close();}};
}
test('linked stereo presets preserve asymmetric HPF/dynamics and shared EQ independently on every supported X-Air model',async()=>{
  for(const model of ['XR18','MR18','X18','XR12','MR12'] as const){const f=fixture(model);try{
    await f.xr.writeParameter('/config/chlink/1-2',1);await f.xr.writeParameter('/config/chlink/3-4',1);await f.xr.writeParameter('/config/chlink/5-6',1);
    await f.xr.writeParameter('/config/linkcfg/preamp',0);await f.xr.writeParameter('/config/linkcfg/eq',1);await f.xr.writeParameter('/config/linkcfg/dyn',0);
    const settings={'/ch/01/preamp/hpf':.2,'/ch/02/preamp/hpf':.8,'/ch/01/dyn/thr':.3,'/ch/02/dyn/thr':.7,'/ch/01/gate/thr':.25,'/ch/02/gate/thr':.65,'/ch/01/eq/1/g':.8,'/ch/02/eq/1/g':.8,'/ch/03/preamp/hpf':.1,'/ch/04/preamp/hpf':.6,'/ch/03/dyn/thr':.4,'/ch/04/dyn/thr':.9};
    for(const [a,v] of Object.entries(settings))await f.xr.writeParameter(a,v);
    const before=await f.control.capture(),p=await captureChannelPreset(f.xr,f.control,1,['eq','compressor','gate'],undefined,true);
    assert.deepEqual(await f.control.capture(),before,'capture writes no audio or global preferences');
    const imported=validateChannelPreset(JSON.parse(JSON.stringify(p)));
    const plan=await previewChannelPreset(f.xr,f.control,imported,3);
    assert.deepEqual(plan.stereoLink,{pairs:[3],independent:['preamp','dyn'],shared:['eq']});
    const result=await f.control.apply(plan.token),after=await f.control.capture();
    for(const [a,v] of Object.entries(settings).filter(([a])=>/^\/ch\/0[12]\//.test(a))){const target=a.replace('/ch/01/','/ch/03/').replace('/ch/02/','/ch/04/');assert.equal(after.values[target],v);}
    for(const c of plan.changes)after.values[c.address]=before.values[c.address]!;
    assert.deepEqual(after,before,'other pairs, listening mixes and all link preferences preserved');
    const restarted=new ConsoleControl(f.xr,f.library),undo=await previewChannelBackup(f.xr,restarted,f.library,result.backupId);await restarted.apply(undo.token);
    assert.deepEqual(await f.control.capture(),before,'undo restores both distinct sides after service restart');
  }finally{f.close();}}
});

test('each shared family rejects conflicting targets or a non-restorable current pair without changing global links',async()=>{
  for(const [flag,path] of [['preamp','preamp/hpf'],['eq','eq/2/g'],['dyn','dyn/thr'],['dyn','gate/thr'],['fdrmute','mix/fader'],['fdrmute','mix/03/level']]){
    const f=fixture();try{
      await f.xr.writeParameter('/config/chlink/1-2',1);await f.xr.writeParameter(`/config/linkcfg/${flag}`,1);
      const a=`/ch/01/${path}`,b=`/ch/02/${path}`,before=await f.control.capture();
      await assert.rejects(previewChannelOperation(f.xr,f.control,{[a]:.2,[b]:.8}),/partagé/);
      assert.deepEqual(await f.control.capture(),before);assert.equal(f.library.list('channel-operation-backup').length,0);
      await f.xr.writeParameter(a,.3);await f.xr.writeParameter(b,.7);
      await assert.rejects(previewChannelOperation(f.xr,f.control,{[a]:.5,[b]:.5}),/partagé/);
      await f.xr.writeParameter(`/config/linkcfg/${flag}`,0);
      const p=await previewChannelOperation(f.xr,f.control,{[a]:.2,[b]:.8});assert.ok(p.token);
      await f.xr.writeParameter(`/config/linkcfg/${flag}`,1);
      await assert.rejects(f.control.apply(p.token),/État modifié/);
    }finally{f.close();}
  }
});

test('grouped relative adjustments retain unequal linked channel levels, thresholds and monitor mixes, including silence',async()=>{
  const f=fixture();try{
    await f.xr.writeParameter('/config/chlink/1-2',1);await f.xr.writeParameter('/config/linkcfg/fdrmute',0);
    for(const [target,path,band] of [['fader','mix/fader',1],['eq','eq/2/g',2],['compressor','dyn/thr',1],['gate','gate/thr',1],['send','mix/03/level',1]] as const){
      const a=`/ch/01/${path}`,b=`/ch/02/${path}`;await f.xr.writeParameter(a,.3);await f.xr.writeParameter(b,.6);
      const left=Number(fromWire(a,.3)),right=Number(fromWire(b,.6));
      const p=await previewGroupedAdjustment(f.xr,f.control,{channels:[1,2],target,band,bus:3,delta:1});assert.ok(p.stereoLink?.independent.length);
      const result=await f.control.apply(p.token);
      assert.ok(Math.abs(Number(fromWire(a,await f.xr.readParameter(a)))-left-1)<1e-8);
      assert.ok(Math.abs(Number(fromWire(b,await f.xr.readParameter(b)))-right-1)<1e-8);
      const undo=await previewChannelBackup(f.xr,f.control,f.library,result.backupId);await f.control.apply(undo.token);
      assert.equal(await f.xr.readParameter(a),.3);assert.equal(await f.xr.readParameter(b),.6);
    }
    await f.xr.writeParameter('/config/buslink/1-2',1);
    for(const n of ['01','02']){await f.xr.writeParameter(`/ch/01/mix/${n}/level`,0);await f.xr.writeParameter(`/ch/02/mix/${n}/level`,.6);}
    const p=await previewGroupedAdjustment(f.xr,f.control,{channels:[1,2],target:'send',bus:1,delta:2});assert.equal(p.skippedSilent,2);assert.equal(p.changes.length,4);
    const applied=await f.control.apply(p.token);assert.equal(await f.xr.readParameter('/ch/01/mix/01/level'),0);
    assert.equal(await f.xr.readParameter('/ch/02/mix/01/level'),await f.xr.readParameter('/ch/02/mix/02/level'));
    const undo=await previewChannelBackup(f.xr,f.control,f.library,applied.backupId);await f.control.apply(undo.token);
    assert.equal(await f.xr.readParameter('/ch/02/mix/02/level'),.6);
  }finally{f.close();}
});

test('selective scenes restore asymmetric linked processing and levels; unchanged partner remains protected and restorable',async()=>{
  const f=fixture();try{
    await f.xr.writeParameter('/config/chlink/1-2',1);
    const saved=f.library.save('scene','Synthetic linked scene',await f.control.capture());
    await f.xr.writeParameter('/ch/02/eq/1/g',.8);await f.xr.writeParameter('/ch/02/dyn/thr',.2);await f.xr.writeParameter('/ch/01/mix/fader',.25);
    const before=await f.control.capture(),p=await f.recall.preview(saved.id,{channels:[1,2],sections:['eq','compressor','levels']});
    assert.ok(p.stereoLink?.independent.includes('eq'));assert.ok(p.changes.some(c=>c.address==='/ch/01/eq/1/g'));
    const result=await f.recall.apply(saved.id,p.token,true);
    const undo=await f.recall.previewBackup(result.backupId);await f.recall.apply(result.backupId,undo.token,true);assert.deepEqual(await f.control.capture(),before);
    const stale=await f.recall.preview(saved.id,{channels:[1,2],sections:['eq']});await f.xr.writeParameter('/ch/01/eq/1/g',.4);
    await assert.rejects(f.recall.apply(saved.id,stale.token,true),/État modifié/);
    await f.xr.writeParameter('/config/linkcfg/eq',1);await assert.rejects(f.recall.previewBackup(result.backupId),/liaisons ou les sources|partagé/);
  }finally{f.close();}
});

test('stereo capture aborts if a global link option changes during the read',async()=>{
  const f=fixture();try{
    await f.xr.writeParameter('/config/chlink/1-2',1);
    const read=f.xr.readParameter.bind(f.xr);let changed=false;
    f.xr.readParameter=async a=>{const v=await read(a);if(a==='/ch/02/eq/1/g'&&!changed){changed=true;await f.xr.writeParameter('/config/linkcfg/eq',1);}return v;};
    await assert.rejects(captureChannelPreset(f.xr,f.control,1,['eq'],undefined,true),/État modifié/);
  }finally{f.close();}
});

test('real OSC loopback verifies both final sides and retains recovery when a peer unexpectedly mirrors a later write',async()=>{
  const peer=dgram.createSocket('udp4');await new Promise<void>(resolve=>peer.bind(0,'127.0.0.1',resolve));
  const wire=new Map<string,string|number>([['/config/chlink/1-2',1],['/config/linkcfg/eq',0],['/ch/01/eq/1/g',.3],['/ch/02/eq/1/g',.6]]),writes:string[]=[];
  let unexpectedMirror=false;
  peer.on('message',(data,remote)=>{
    const m=decodeOsc(data),p=PARAMETERS[m.address];if(!p)return;
    if(m.args.length){
      wire.set(m.address,m.args[0] as number|string);writes.push(m.address);
      if(unexpectedMirror&&m.address==='/ch/02/eq/1/g')wire.set('/ch/01/eq/1/g',m.args[0] as number);
    }
    const v=wire.get(m.address)??defaultWire(p),args:OutgoingOscArg[]=[p.type==='f'?oscFloat(v as number):v];
    peer.send(encodeOsc(m.address,args),remote.port,remote.address);
  });
  const xr=new XR18({mode:'real',host:'127.0.0.1',port:peer.address().port,enableWrites:true,autoSync:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);
  try{
    await xr.start();for(let i=0;i<100&&!xr.status().connected;i++)await new Promise(r=>setTimeout(r,5));
    assert.ok(xr.status().connected);
    const p=await previewChannelOperation(xr,control,{'/ch/01/eq/1/g':.2,'/ch/02/eq/1/g':.8});assert.equal(writes.length,0);
    const applied=await control.apply(p.token);assert.equal(applied.ok,true);assert.ok(Math.abs(Number(wire.get('/ch/01/eq/1/g'))-.2)<1e-6);
    assert.deepEqual(writes,['/ch/01/eq/1/g','/ch/02/eq/1/g'],'no link, routing or unrelated write');
    const undo=await previewChannelBackup(xr,control,library,applied.backupId);await control.apply(undo.token);
    const fault=await previewChannelOperation(xr,control,{'/ch/01/eq/1/g':.1,'/ch/02/eq/1/g':.9});unexpectedMirror=true;
    let backupId='';await assert.rejects(control.apply(fault.token),(e:Error&{backupId?:string})=>{backupId=e.backupId??'';return /partielle.*gauche\/droite/.test(e.message);});assert.ok(backupId);
    const data=library.get(backupId).data as {values:Record<string,number>};assert.ok(Math.abs(data.values['/ch/01/eq/1/g']!-.3)<1e-6);assert.ok(Math.abs(data.values['/ch/02/eq/1/g']!-.6)<1e-6);
    unexpectedMirror=false;const recovery=await previewChannelBackup(xr,control,library,backupId);await control.apply(recovery.token);
    assert.ok(Math.abs(Number(wire.get('/ch/01/eq/1/g'))-.3)<1e-6);assert.ok(Math.abs(Number(wire.get('/ch/02/eq/1/g'))-.6)<1e-6);
  }finally{xr.close();library.close();peer.close();}
});
