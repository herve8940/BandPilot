import {LibraryStore} from '../src/library-store.js';
import {ConsoleControl} from '../src/console-control.js';
import {MixerSync} from '../src/mixer-sync.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {MIXER_MODELS,identifyMixer} from '../shared/mixer-models.js';
import {supportsMixerAddress,toMixerAddress,fromMixerAddress} from '../src/mixer-capabilities.js';
import {XR18} from '../src/xr18.js';
import {AIR_PARAMETER_ADDRESSES} from '../src/parameters.js';
import {parseIdentity,discoverXR18} from '../src/discovery.js';
import {encodeOsc,decodeOsc,oscFloat} from '../src/osc.js';
test('model identities preserve Midas, hardware revision and X32 variants',()=>{
 for(const raw of ['XR12','MR12','XR18V2','MR18V2','X32','X32RACK','X32 Compact']){
  const model=identifyMixer(raw)!;assert.ok(model);const found=parseIdentity(encodeOsc('/info',['V','Ma table',raw,'4.13']),'127.0.0.1',model.port)!;
  assert.equal(found.model,model.id);assert.equal(found.profile.brand,model.brand);assert.equal(found.firmware,'4.13');
 }
 for(const raw of ['','X32-MYSTERY','XR18V3','X32<script>'])assert.equal(identifyMixer(raw),null);
 assert.equal(MIXER_MODELS.XR12.usbChannels,0);assert.equal(MIXER_MODELS.MR12.monitorOutputs,2);assert.equal(MIXER_MODELS.MR18.usbChannels,18);assert.equal(MIXER_MODELS.X32.channels,32);
});
test('model guards reject channels and functions absent from the detected protocol',async()=>{
 const small=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,model:'MR12'});
 const legacy=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});
 try{
  assert.equal(small.listChannels().length,12);assert.throws(()=>small.setFader(13,.5));assert.throws(()=>small.liveSet('/ch/13/mix/fader',.5),/indisponible/);
  await assert.rejects(()=>small.writeParameter('/headamp/05/phantom',1,true),/indisponible/);
  await assert.rejects(()=>small.readParameter('/routing/usb/01/src'),/indisponible/);
  assert.deepEqual(new Set(legacy.parameterAddresses()),AIR_PARAMETER_ADDRESSES);
  await small.reconnect({mode:'simulation',host:'127.0.0.1',port:10023,enableWrites:false,model:'X32'});
  assert.equal(small.listChannels().length,32);small.liveSet('/ch/32/mix/fader',.7);assert.equal(small.listChannels()[31]!.fader,.7);
  const library=new LibraryStore(':memory:');try{const draft=await new MixerSync(small,new ConsoleControl(small,library),library).savePc();assert.equal(library.get(draft.id).kind,'mixer-draft');assert.equal(library.list('mixer-workspace').length,0);}finally{library.close();}
  assert.throws(()=>small.liveSet('/rtn/1/mix/fader',.4),/indisponible/);await assert.rejects(()=>small.readFx(1),/adaptateur/);await assert.rejects(()=>small.applyNative([]),/incompatible/);
  await small.reconnect({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,model:'XR12'});assert.equal(small.listChannels().length,12);
 }finally{small.close();legacy.close();}
});
test('X32 adapter maps stereo main and padded buses without changing X-Air addresses',()=>{
 for(const address of ['/lr/mix/fader','/bus/1/mix/on','/bus/16/eq/1/g','/ch/32/mix/lr']){
  assert.equal(fromMixerAddress(MIXER_MODELS.X32,toMixerAddress(MIXER_MODELS.X32,address)),address);
  assert.equal(toMixerAddress(MIXER_MODELS.XR18,address),address);
 }
 assert.equal(toMixerAddress(MIXER_MODELS.X32,'/lr/mix/on'),'/main/st/mix/on');
 assert.equal(supportsMixerAddress(MIXER_MODELS.X32,'/headamp/01/phantom'),false);
 assert.equal(supportsMixerAddress(MIXER_MODELS.X32,'/fx/1/type'),false);
});
test('X32 UDP core sends native addresses and validates writes by readback',async()=>{
 const peer=dgram.createSocket('udp4');await new Promise<void>(resolve=>peer.bind(0,'127.0.0.1',resolve));
 const port=peer.address().port,seen:string[]=[],state=new Map<string,number>([['/main/st/mix/fader',.4],['/main/st/mix/on',1],['/ch/32/mix/fader',.6],['/bus/16/mix/fader',.5]]);
 peer.on('message',(packet,remote)=>{const m=decodeOsc(packet);seen.push(m.address);if(m.args.length&&typeof m.args[0]==='number')state.set(m.address,m.args[0]);if(state.has(m.address))peer.send(encodeOsc(m.address,[oscFloat(state.get(m.address)!)]),remote.port,remote.address);});
 const mixer=new XR18({mode:'real',host:'127.0.0.1',port,enableWrites:true,autoSync:false,model:'X32'});
 const connected=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No fake mixer reply')),3000);mixer.once('connection',()=>{clearTimeout(timer);resolve();});});
 try{await mixer.start();await connected;assert.equal(mixer.status().connected,true);assert.equal(await mixer.readParameter('/ch/32/mix/fader'),.6000000238418579);await mixer.writeParameter('/bus/16/mix/fader',.25);await mixer.writeParameter('/lr/mix/fader',.75);assert.equal(state.get('/bus/16/mix/fader'),.25);assert.equal(state.get('/main/st/mix/fader'),.75);assert.equal(seen.includes('/lr/mix/fader'),false);assert.equal(seen.includes('/meters'),false);}finally{mixer.close();peer.close();}
});
