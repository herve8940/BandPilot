import {test} from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {XR18} from '../src/xr18.js';
import {decodeOsc,encodeOsc,oscFloat,type OutgoingOscArg} from '../src/osc.js';
import {PARAMETERS,defaultWire} from '../src/parameters.js';

/** Local UDP peer only; these tests never connect to a physical console. */
async function fixture(address:string,behavior:'stale'|'wrong'|'missing'|'invalid'|'cancel'|'disconnect'='stale'){
  const peer=dgram.createSocket('udp4');await new Promise<void>(resolve=>peer.bind(0,'127.0.0.1',resolve));
  const writes:{address:string;value:unknown}[]=[];
  let reads=0,stored:OutgoingOscArg=0,previous:OutgoingOscArg=0;
  const timers:ReturnType<typeof setTimeout>[]=[];
  const xr=new XR18({mode:'real',host:'127.0.0.1',port:peer.address().port,enableWrites:true,autoSync:false});
  peer.on('message',(buffer,remote)=>{
    const message=decodeOsc(buffer),parameter=PARAMETERS[message.address];if(!parameter)return;
    const reply=(value:OutgoingOscArg)=>peer.send(encodeOsc(message.address,[value]),remote.port,remote.address);
    if(message.args.length){
      writes.push({address:message.address,value:message.args[0]});
      if(message.address===address){
        stored=parameter.type==='f'?oscFloat(Number(message.args[0])):message.args[0] as number|string;
        previous=parameter.type==='s'?'Old':parameter.type==='f'?oscFloat(0):0;
      }
      return;
    }
    if(message.address!==address||!writes.length){const value=defaultWire(parameter);reply(parameter.type==='f'?oscFloat(Number(value)):value);return;}
    reads++;
    if(behavior==='missing'&&reads===1)return;
    if(behavior==='invalid'){reply(999);return;}
    if(reads===1&&(behavior==='cancel'||behavior==='disconnect'))timers.push(setTimeout(()=>behavior==='cancel'?xr.cancelOperations():xr.close(),10));
    reply(behavior==='wrong'||reads===1&&behavior!=='missing'?previous:stored);
  });
  await xr.start();for(let i=0;i<100&&!xr.status().connected;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(xr.status().connected);
  // Drain the initial metadata requests before counting this write’s verification reads.
  await xr.readParameter('/headamp/16/gain');
  return {xr,writes,reads:()=>reads,close(){timers.forEach(clearTimeout);xr.close();peer.close();}};
}

test('old first replies are re-read for colours, names and audio values without resending writes',async()=>{
  for(const [address,value] of [['/ch/11/config/color',13],['/ch/02/config/name','Fixture'],['/ch/03/eq/1/g',.7]] as const){
    const f=await fixture(address);try{
      const result=await f.xr.writeParameter(address,value);
      if(typeof result==='number'&&typeof value==='number')assert.ok(Math.abs(result-value)<1e-6);else assert.equal(result,value);
      assert.equal(f.reads(),2);assert.equal(f.writes.length,1);assert.equal(f.writes[0]!.address,address);
      if(typeof value==='number')assert.ok(Math.abs(Number(f.writes[0]!.value)-value)<1e-6);else assert.equal(f.writes[0]!.value,value);
    }finally{f.close();}
  }
});
test('a missed first reply retries only the read, including separately confirmed phantom power',async()=>{
  const f=await fixture('/headamp/01/phantom','missing');try{
    assert.equal(await f.xr.writeParameter('/headamp/01/phantom',1,true),1);
    assert.equal(f.reads(),2);assert.equal(f.writes.length,1);
    await assert.rejects(f.xr.writeParameter('/headamp/02/phantom',1),/48 V/);assert.equal(f.writes.length,1);
  }finally{f.close();}
});
test('persistent differences stop a bulk recall after bounded reads and report expected and received values',async()=>{
  const f=await fixture('/ch/11/config/color','wrong');try{
    await assert.rejects(f.xr.applyParameters({'/ch/11/config/color':13,'/ch/12/config/color':5}),/Lecture différente.*attendu 13, reçu 0/);
    assert.equal(f.reads(),3);assert.deepEqual(f.writes,[{address:'/ch/11/config/color',value:13}]);
  }finally{f.close();}
});
test('invalid replies, cancellation and transport changes abort readback retries',async()=>{
  for(const behavior of ['invalid','cancel','disconnect'] as const){
    const f=await fixture('/ch/11/config/color',behavior);try{
      await assert.rejects(f.xr.writeParameter('/ch/11/config/color',13),behavior==='invalid'?/hors plage/:/interrompue|Connexion modifiée/);
      assert.equal(f.reads(),1,behavior);assert.equal(f.writes.length,1,behavior);
    }finally{f.close();}
  }
});
