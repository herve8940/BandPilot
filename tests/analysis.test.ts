import {test} from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {recommend,bandFreq,level,familyFromName,type Instrument} from '../src/analysis.js';
import {XR18} from '../src/xr18.js';
import {encodeOsc,decodeOsc} from '../src/osc.js';
import type {Value} from '../src/parameters.js';

/** Spectrum (100 bands) from a function of frequency. */
const spec=(fn:(f:number)=>number)=>Array.from({length:100},(_,i)=>fn(bandFreq(i)));
const bump=(f:number,c:number,width:number,gain:number)=>gain*Math.exp(-Math.pow(Math.log2(f/c)/width,2));
const flatEq:Record<string,Value>={};
for(const ch of ['01','02','03','04'])for(let b=1;b<=4;b++){flatEq[`/ch/${ch}/eq/${b}/type`]=2;flatEq[`/ch/${ch}/eq/${b}/g`]=0;flatEq[`/ch/${ch}/eq/${b}/f`]=[100,500,2000,8000][b-1]!;}
const params=(extra:Record<string,Value>={})=>(a:string)=>({...flatEq,...extra})[a];
const base={compGr:{},busPeak:{},busNames:{},usedBuses:[] as number[]};

test('analysis: names give a family when the coach does not know the source',()=>{
 assert.equal(familyFromName('Chant'),'voice');assert.equal(familyFromName('Choeurs'),'backing');assert.equal(familyFromName('E-drums'),'edrums');
 assert.equal(familyFromName('Basse'),'bass');assert.equal(familyFromName('Guitare 1'),'guitar');assert.equal(familyFromName('Kick'),'kick');assert.equal(familyFromName('Ambiance'),null);
});

test('analysis: rumble under a vocal mic → high-pass at 100 Hz, never on bass',()=>{
 const instruments:Instrument[]=[{channel:1,name:'Chant',family:'voice'},{channel:4,name:'Basse',family:'bass'}];
 const rumble=spec(f=>-40+bump(f,60,0.6,12)+bump(f,1000,1.5,6));
 const recos=recommend({...base,instruments,spectra:{1:rumble,4:rumble},params:params({'/ch/01/preamp/hpon':0,'/ch/01/preamp/hpf':40})});
 const hpf=recos.find(r=>r.id==='hpf-1');assert.ok(hpf,'high-pass proposed on the voice');
 assert.deepEqual(hpf!.changes,{'/ch/01/preamp/hpon':1,'/ch/01/preamp/hpf':100});
 assert.ok(!recos.some(r=>r.id==='hpf-4'),'never on the bass');
 // Already filtered: nothing to say.
 assert.ok(!recommend({...base,instruments,spectra:{1:rumble},params:params({'/ch/01/preamp/hpon':1,'/ch/01/preamp/hpf':100})}).some(r=>r.id==='hpf-1'));
});

test('analysis: kick and bass piled up → cut the bass at the kick frequency',()=>{
 const instruments:Instrument[]=[{channel:2,name:'E-drums',family:'edrums'},{channel:4,name:'Basse',family:'bass'}];
 const kick=spec(f=>-60+bump(f,65,0.4,30)+bump(f,3000,1,10));
 const bass=spec(f=>-60+bump(f,70,0.8,26)+bump(f,300,1,10));
 const r=recommend({...base,instruments,spectra:{2:kick,4:bass},params:params()}).find(r=>r.id==='mask-kick-bass-4');
 assert.ok(r,'masking found');
 const f=Number(Object.entries(r!.changes).find(([a])=>a.endsWith('/f'))![1]);assert.ok(f>=55&&f<=80,'cut near the kick: '+f);
 assert.equal(Object.entries(r!.changes).find(([a])=>a.endsWith('/g'))![1],-3);
 assert.ok(Object.keys(r!.changes).every(a=>a.startsWith('/ch/04/')),'only the bass is touched');
});

test('analysis: guitar in the voice presence → small cut on the guitar only',()=>{
 const instruments:Instrument[]=[{channel:1,name:'Chant',family:'voice'},{channel:3,name:'Guitare',family:'guitar'}];
 const voice=spec(f=>-60+bump(f,3000,0.5,28)+bump(f,300,1,20));
 const gtr=spec(f=>-60+bump(f,2800,1,30)+bump(f,400,1,20));
 const r=recommend({...base,instruments,spectra:{1:voice,3:gtr},params:params({'/ch/01/preamp/hpon':1,'/ch/01/preamp/hpf':100})}).find(r=>r.id==='mask-voice-3');
 assert.ok(r);assert.ok(Object.keys(r!.changes).every(a=>a.startsWith('/ch/03/')));
});

test('analysis: narrow resonance → narrow cut; compressor squashing → higher threshold',()=>{
 const instruments:Instrument[]=[{channel:2,name:'Choeurs',family:'backing'}];
 const ring=spec(f=>-50+bump(f,1000,2,6)+bump(f,315,0.12,18));
 const recos=recommend({...base,instruments,spectra:{2:ring},compGr:{2:-10},params:params({'/ch/02/preamp/hpon':1,'/ch/02/preamp/hpf':120,'/ch/02/dyn/on':1,'/ch/02/dyn/thr':-24})});
 const res=recos.find(r=>r.id==='res-2');assert.ok(res,'resonance found');
 const f=Number(Object.entries(res!.changes).find(([a])=>a.endsWith('/f'))![1]);assert.ok(f>270&&f<370,'at the ring: '+f);
 const comp=recos.find(r=>r.id==='comp-2');assert.deepEqual(comp?.changes,{'/ch/02/dyn/thr':-18});
});

test('analysis: a monitor mix near clipping → limiter first, then −3 dB',()=>{
 const p=params({'/bus/3/dyn/on':0,'/bus/3/mix/fader':0});
 const first=recommend({...base,instruments:[],spectra:{},params:p,busPeak:{3:-1.5},busNames:{3:'Batterie'},usedBuses:[3]});
 assert.equal(first[0]?.id,'limit-3');assert.equal(first[0]?.severity,'securite');assert.equal(first[0]?.changes['/bus/3/dyn/thr'],-6);
 const then=recommend({...base,instruments:[],spectra:{},params:params({'/bus/3/dyn/on':1,'/bus/3/mix/fader':-2}),busPeak:{3:-1.5},busNames:{3:'Batterie'},usedBuses:[3]});
 assert.deepEqual(then[0]?.changes,{'/bus/3/mix/fader':-5});
 assert.equal(recommend({...base,instruments:[],spectra:{},params:p,busPeak:{3:-8},busNames:{},usedBuses:[3]}).length,0,'quiet mix: nothing');
});

test('analysis: level() averages power over a frequency range',()=>{
 const s=spec(()=>-30);assert.ok(Math.abs(level(s,100,1000)+30)<0.01);
});

test('rehearsal: the Main cannot be reopened, and a scene recall leaves it muted',async()=>{
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});
 try{
  xr.setRehearsal(true);
  await assert.rejects(xr.writeParameter('/lr/mix/on',1),/Ears seulement/);
  assert.throws(()=>xr.setMainOn(true),/Ears seulement/);
  await xr.writeParameter('/lr/mix/on',0);
  await xr.applyParameters({'/lr/mix/on':1,'/ch/01/mix/fader':.5});
  assert.equal(await xr.readParameter('/lr/mix/on'),0,'Main still muted');
  assert.equal(await xr.readParameter('/ch/01/mix/fader'),.5,'the rest is applied');
  xr.setRehearsal(false);await xr.writeParameter('/lr/mix/on',1);assert.equal(await xr.readParameter('/lr/mix/on'),1);
 }finally{xr.close();}
});

test('analysis meters: spectrum (/meters/4) and gain reduction (/meters/6) are decoded from the console',async()=>{
 const peer=dgram.createSocket('udp4');await new Promise<void>(r=>peer.bind(0,'127.0.0.1',r));
 const sent:string[]=[];
 peer.on('message',(packet,from)=>{const m=decodeOsc(packet);sent.push(m.address+(m.args[0]!==undefined?' '+String(m.args[0]):''));
  if(m.address==='/lr/mix/fader'){peer.send(encodeOsc(m.address,[{oscType:'f',value:.5}] as never),from.port,from.address);return;}
  if(m.address==='/meters'&&m.args[0]==='/meters/4'){const b=Buffer.alloc(4+200);b.writeUInt32LE(100,0);for(let i=0;i<100;i++)b.writeInt16LE(Math.round(-40*256),4+i*2);peer.send(encodeOsc('/meters/4',[b]),from.port,from.address);}
  if(m.address==='/meters'&&m.args[0]==='/meters/6'){const b=Buffer.alloc(4+78);b.writeUInt32LE(39,0);b.writeInt16LE(-6*256,4+16*2);peer.send(encodeOsc('/meters/6',[b]),from.port,from.address);}
 });
 const xr=new XR18({mode:'real',host:'127.0.0.1',port:peer.address().port,enableWrites:false});
 try{
  const rta=new Promise<{bands:number[]}>(r=>xr.once('rta',r)),dyn=new Promise<{comp:number[]}>(r=>xr.once('dynamics',r));
  await xr.start();xr.setRtaSource(XR18.RTA.bus(3));xr.subscribeAnalysis();
  const [s,g]=await Promise.all([rta,dyn]);
  assert.equal(s.bands.length,100);assert.equal(s.bands[0],-40);assert.equal(g.comp[0],-6);
  assert.ok(sent.includes('/-stat/rta/source 23'),'bus 3 = analyser source 23 (checked on a physical XR18)');
 }finally{xr.close();peer.close();}
});
