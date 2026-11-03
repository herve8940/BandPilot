import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync,readFileSync,rmSync,watch} from 'node:fs';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import dgram from 'node:dgram';
import {ReaperBridge,reaperResources,toLua} from '../src/reaper-bridge.js';
import {wavPeaks} from '../src/peaks.js';
import {ACTION,ReaperLink,planSession,presenceCommands,roleOf} from '../src/reaper.js';
import {decodeOsc,encodeOsc,oscFloat} from '../src/osc.js';

test('requests stay plain Lua data, quotes and accents included',()=>{
 assert.equal(toLua({a:'é"\\',b:[1,true]}),'{["a"]="é\\"\\\\",["b"]={1,true}}');
 assert.equal(toLua('x\ny'),'"x\\010y"');assert.equal(reaperResources({},'darwin','/h'),'/h/Library/Application Support/REAPER');
});
test('a dead bridge is reported, not waited for',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'xr18-bridge-'));
 await assert.rejects(new ReaperBridge(dir).state(),/ne répond pas/);
});
test('commands are exchanged one at a time and errors come back',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'xr18-bridge-')),box=join(dir,'XR18Studio');mkdirSync(box);writeFileSync(join(box,'heartbeat.txt'),'1');
 const seen:string[]=[];
 const w=watch(box,()=>{const r=join(box,'request.lua');if(!existsSync(r))return;let src='';try{src=readFileSync(r,'utf8');rmSync(r);}catch{return;}
  const id=/\["id"\]="([^"]+)"/.exec(src)![1],cmd=/\["cmd"\]="([^"]+)"/.exec(src)![1]!;seen.push(cmd);
  writeFileSync(join(box,'response.json'),JSON.stringify(cmd==='bad'?{id,ok:false,error:'Refusé'}:{id,ok:true,result:{cmd}}));});
 try{
  const b=new ReaperBridge(dir);
  const [one,two]=await Promise.all([b.call<{cmd:string}>('one'),b.call<{cmd:string}>('two')]);
  assert.equal(one.cmd,'one');assert.equal(two.cmd,'two');await assert.rejects(b.call('bad'),/Refusé/);assert.deepEqual(seen,['one','two','bad']);
 }finally{w.close();}
});
test('installing the bridge keeps the existing startup script and is idempotent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'xr18-bridge-'));await mkdir(join(dir,'Scripts'));await writeFile(join(dir,'Scripts','__startup.lua'),'-- ReaCue\ndofile("x")');
 const b=new ReaperBridge(dir);await b.install();await b.install();
 const text=readFileSync(join(dir,'Scripts','__startup.lua'),'utf8');
 assert.ok(text.startsWith('-- ReaCue\ndofile("x")\n'));assert.equal(text.split('XR18_Studio_Bridge.lua').length-1,1);
 assert.ok(existsSync(join(dir,'Scripts','XR18 Studio','XR18_Studio_Bridge.lua')));
});
function wav(samples:number[]){
 const data=Buffer.alloc(samples.length*3);samples.forEach((s,i)=>data.writeIntLE(Math.round(s*8388607),i*3,3));
 const head=Buffer.alloc(44);head.write('RIFF');head.writeUInt32LE(36+data.length,4);head.write('WAVEfmt ',8);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);head.writeUInt16LE(1,22);head.writeUInt32LE(48000,24);head.writeUInt32LE(144000,28);head.writeUInt16LE(3,32);head.writeUInt16LE(24,34);head.write('data',36);head.writeUInt32LE(data.length,40);
 return Buffer.concat([head,data]);
}
test('waveforms are read from 24-bit takes, other files are refused calmly',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'xr18-peaks-')),f=join(dir,'a.wav');
 await writeFile(f,wav([...Array(4800).fill(.5),...Array(4800).fill(0)]));
 const p=await wavPeaks(f,4);assert.equal(p!.length,4);assert.ok(Math.abs(p![0]!-.5)<.01);assert.equal(p![3],0);
 await writeFile(join(dir,'b.mp3'),Buffer.alloc(100));assert.equal(await wavPeaks(join(dir,'b.mp3')),null);
});
const plan=()=>planSession({values:{},instruments:[{channel:1,name:'E-drums',family:'edrums',source:'drum-module'},{channel:2,name:'Basse',family:'bass',source:'bass-di'},{channel:3,name:'Chant',family:'voice',source:'lead-rock'}] as never,sampleRate:48000,usbMode:'18x18',simulation:false});
test('present musicians are recorded and silence their stem, absent ones keep it',()=>{
 const tracks=plan().tracks.filter(t=>t.selected),c=presenceCommands(tracks,['usb1','usb2'],'darwin');
 assert.deepEqual(c.rec.map(r=>r.name),['REC E-drums','REC Basse']);assert.deepEqual(c.unarm,['REC Chant']);
 assert.deepEqual(c.roles,{drums:true,bass:true,vocals:false});assert.match(c.rec[0]!.chunk,/NAME "REC E-drums"/);assert.equal(roleOf(tracks[0]!),'drums');
});
async function fake(){
 const socket=dgram.createSocket('udp4');await new Promise<void>(r=>socket.bind(0,'127.0.0.1',()=>r()));
 const listen=(socket.address() as {port:number}).port,probe=dgram.createSocket('udp4');await new Promise<void>(r=>probe.bind(0,'127.0.0.1',()=>r()));
 const feedback=(probe.address() as {port:number}).port;await new Promise<void>(r=>probe.close(()=>r()));
 const f={actions:[] as number[],rec:false,time:0,timer:undefined as NodeJS.Timeout|undefined};
 const say=(a:string,v:number)=>socket.send(encodeOsc(a,[oscFloat(v)]),feedback,'127.0.0.1');
 socket.on('message',m=>{const id=Number(decodeOsc(m).address.split('/').at(-1));f.actions.push(id);if(id===ACTION.refreshSurfaces)say('/record',f.rec?1:0);if(id===ACTION.record){f.rec=true;say('/record',1);}if(id===ACTION.stopAndSave){f.rec=false;say('/record',0);}});
 f.timer=setInterval(()=>{if(f.rec){f.time+=.05;say('/time',f.time);}},10);
 return {f,link:new ReaperLink({listen,feedback},{pollMs:20,silenceMs:300,confirmMs:500,stoppedClockMs:200}),close(){clearInterval(f.timer);socket.close();}};
}
test('a song take starts where it is told, stops by itself after the tail, and can be prolonged',async()=>{
 const {f,link,close}=await fake();
 try{
  await link.record({atEnd:false});assert.ok(!f.actions.includes(ACTION.goToEnd),'stacked on the song');
  link.setAutoStop(f.time+.15,.1);await new Promise(r=>setTimeout(r,400));
  assert.equal(link.status().recording,false);assert.ok(f.actions.includes(ACTION.stopAndSave));assert.equal(link.status().alert,'');
  await link.record({atEnd:false});link.setAutoStop(f.time+.1,.1);link.cancelAutoStop();await new Promise(r=>setTimeout(r,250));
  assert.equal(link.status().recording,true,'Continuer keeps recording');
 }finally{link.close();close();}
});
test('plain Stop refuses to cut a take without saving it',async()=>{
 const {link,close}=await fake();
 try{await link.record();assert.throws(()=>link.halt(),/Enregistrement en cours/);}finally{link.close();close();}
});
