import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {encodeOsc,decodeOsc,oscFloat} from '../src/osc.js';
import {ACTION,ReaperLink,createSession,openInReaper,planSession,readOsc,renderRpp,safeName,type Wire} from '../src/reaper.js';

const base=(values:Wire={},extra={})=>({values,instruments:[{channel:1,name:'Voix',family:'voice'},{channel:3,name:'Clavier',family:'keys'},{channel:5,name:'Kick',family:'kick'},{channel:6,name:'Snare',family:'snare'}] as never,sampleRate:48000,usbMode:'18x18' as const,simulation:false,...extra});
const trackBlocks=(rpp:string)=>rpp.split('  <TRACK ').slice(1);
const field=(block:string,name:string)=>new RegExp(`^\\s*${name} (.*)$`,'m').exec(block)?.[1];

test('a USB input is named after the source the console really routes to it',()=>{
 const plan=planSession(base({'/routing/usb/01/src':4,'/ch/05/config/name':'Kick'}));
 const first=plan.tracks[0]!;assert.equal(first.usb,1);assert.equal(first.source,'Ch05');assert.equal(first.name,'Kick');
});
test('linked channels on neighbouring USB inputs become one stereo track',()=>{
 const plan=planSession(base({'/config/chlink/3-4':1}));
 const keys=plan.tracks.find(t=>t.usb===3)!;assert.equal(keys.stereo,true);
 assert.equal(plan.tracks.some(t=>t.usb===4),false);
 const rpp=renderRpp(plan,'darwin');
 assert.equal(field(trackBlocks(rpp).find(b=>b.includes('"Clavier"'))!,'REC'),`1 ${2+1024} 0 0 0 0 0`);
});
test('linked channels away from each other stay mono and say so',()=>{
 const t=planSession(base({'/config/chlink/1-2':1,'/routing/usb/02/src':9})).tracks[0]!;
 assert.equal(t.stereo,false);assert.match(t.warning!,/mono/);
});
test('processed, mute-following and USB-return channels are flagged',()=>{
 const taps=planSession(base({'/routing/usb/01/pos':10,'/routing/usb/03/pos':1,'/ch/05/preamp/rtnsw':1})).tracks;
 assert.match(taps[0]!.warning!,/traitements/);
 assert.match(taps.find(t=>t.usb===3)!.warning!,/muette/);
 assert.match(taps.find(t=>t.usb===5)!.warning!,/retour USB/);
 assert.equal(planSession(base({})).tracks[0]!.warning,undefined);
});
test('a console in 2x2 USB or with unread settings is reported, never guessed silently',()=>{
 assert.ok(planSession(base({},{usbMode:'2x2'})).warnings.some(w=>/2×2/.test(w)));
 const unknown=planSession(base({},{usbMode:null,sampleRate:null}));
 assert.equal(unknown.sampleRate,48000);assert.equal(unknown.warnings.length,2);
});
test('project: raw takes, monitoring off, armed tracks, console balance as a pre-mix',()=>{
 const plan=planSession(base({'/ch/01/mix/fader':.75,'/ch/01/mix/pan':.25,'/ch/01/mix/on':0,'/ch/01/preamp/invert':1}));
 const rpp=renderRpp(plan,'darwin'),voice=trackBlocks(rpp).find(b=>b.includes('"Voix"')&&b.includes('REC 1'))!;
 assert.match(rpp,/SAMPLERATE 48000 1 0/);assert.match(rpp,/RECORD_PATH "Audio" ""/);
 assert.equal(Buffer.from('ZXZhdxgAAQ==','base64').subarray(0,5).toString('latin1'),'evaw\x18');
 assert.equal(field(voice,'REC'),'1 0 0 0 0 0 0');
 assert.equal(field(voice,'VOLPAN'),'1 -0.5 -1 -1 1');assert.equal(field(voice,'MUTESOLO'),'1 0 0');assert.equal(field(voice,'IPHASE'),'1');
});
test('a channel at -infinity stays silent in the pre-mix',()=>{
 const t=planSession(base({'/ch/01/mix/fader':0})).tracks[0]!;assert.equal(t.volume,0);
});
test('family folders open and close, and only real tracks are armed',()=>{
 const blocks=trackBlocks(renderRpp(planSession(base()),'darwin'));
 assert.deepEqual(blocks.map(b=>[field(b,'NAME'),field(b,'ISBUS')]),[['"Batterie"','1 1'],['"Kick"','0 0'],['"Snare"','2 -1'],['"Voix"','0 0'],['"Clavier"','0 0']]);
 assert.equal(field(blocks[0]!,'REC'),'0 0 0 0 0 0 0');
 assert.deepEqual(blocks.slice(1).map(b=>field(b,'REC')!.split(' ')[1]),['4','5','0','2']);
});
test('colors follow the byte order of each system',()=>{
 const plan=planSession(base({'/ch/01/config/color':1}));
 const peak=(os:string)=>Number(field(trackBlocks(renderRpp(plan,os)).find(b=>b.includes('"Voix"'))!,'PEAKCOL'));
 assert.equal(peak('darwin'),0x1dc3c3c);assert.equal(peak('win32'),0x13c3cdc);
});
test('names with quotes cannot break the project file',()=>{
 const plan=planSession(base({'/ch/01/config/name':'Rock"n\'Roll'}));
 const rpp=renderRpp(plan,'darwin');assert.match(rpp,/NAME `Rock"n'Roll`/);
 assert.equal(safeName('../..//évil:name'),'évil name');
 assert.ok(!safeName('a/b\\c').match(/[\/\\]/));assert.equal(safeName(''),'Répétition');
});
test('an existing session is never overwritten',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'xr18-reaper-')),plan=planSession(base());
 const a=await createSession(plan,{name:'Répète',folder}),b=await createSession(plan,{name:'Répète',folder});
 assert.notEqual(a.file,b.file);assert.equal((await readdir(folder)).length,2);
 assert.ok((await readdir(a.folder)).includes('Audio'));assert.match(await readFile(a.file,'utf8'),/^<REAPER_PROJECT/);
 await assert.rejects(createSession(plan,{folder:'relatif/dossier'}),/chemin complet/);
 const none=planSession(base());none.tracks.forEach(t=>{t.selected=false;});
 await assert.rejects(createSession(none,{folder}),/au moins une piste/);
});
test('Reaper opens with the session on each system, with the file as a plain argument',async()=>{
 const calls:string[][]=[];
 const run=((cmd:string,args:string[],cb:(e:Error|null)=>void)=>{calls.push([cmd,...args]);cb(calls.length===1&&cmd==='open'?Error('no app'):null);}) as never;
 await openInReaper('/a b/c.rpp','darwin',run);
 assert.deepEqual(calls,[['open','-a','REAPER','/a b/c.rpp'],['open','/a b/c.rpp']]);
});
test('OSC bundles from Reaper are read',()=>{
 const one=encodeOsc('/record',[oscFloat(1)]),size=Buffer.alloc(4);size.writeInt32BE(one.length);
 const bundle=Buffer.concat([Buffer.from('#bundle\0','latin1'),Buffer.alloc(8),size,one]);
 assert.equal(readOsc(bundle)[0]!.address,'/record');
});

/** A stand-in for Reaper: answers on the feedback port like its OSC surface. */
async function fakeReaper(options:{refuseRecord?:boolean;frozenClock?:boolean;ignoreStop?:boolean}={}){
 const socket=dgram.createSocket('udp4');await new Promise<void>(r=>socket.bind(0,'127.0.0.1',()=>r()));
 const listen=(socket.address() as {port:number}).port,probe=dgram.createSocket('udp4');
 await new Promise<void>(r=>probe.bind(0,'127.0.0.1',()=>r()));
 const feedback=(probe.address() as {port:number}).port;await new Promise<void>(r=>probe.close(()=>r()));
 const fake={actions:[] as number[],recording:false,alive:true,time:0,timer:undefined as NodeJS.Timeout|undefined,
  say(address:string,value:number){socket.send(encodeOsc(address,[oscFloat(value)]),feedback,'127.0.0.1');},
  close(){clearInterval(fake.timer);socket.close();}};
 socket.on('message',packet=>{
  if(!fake.alive)return;
  const id=Number(decodeOsc(packet).address.split('/').at(-1));fake.actions.push(id);
  if(id===ACTION.refreshSurfaces)fake.say('/record',fake.recording?1:0);
  if(id===ACTION.record&&!options.refuseRecord){fake.recording=true;fake.say('/record',1);}
  if(id===ACTION.stopAndSave&&!options.ignoreStop){fake.recording=false;fake.say('/record',0);}
 });
 fake.timer=setInterval(()=>{if(fake.alive&&fake.recording){fake.time+=options.frozenClock?0:.05;fake.say('/time',fake.time);}},20);
 const link=new ReaperLink({listen,feedback},{pollMs:30,silenceMs:250,confirmMs:400,stoppedClockMs:200});
 return {fake,link};
}
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

test('recording is only reported once Reaper confirmed it and its clock runs',async()=>{
 const {fake,link}=await fakeReaper();
 try{
  await link.watch();await wait(60);assert.equal(link.status().state,'ready');assert.equal(link.status().recording,false);
  const started=await link.record();assert.equal(started.recording,true);assert.ok(fake.actions.includes(ACTION.record));
  assert.equal(link.marker().markers,1);await wait(30);assert.ok(fake.actions.includes(ACTION.marker));
  const stopped=await link.stop();assert.equal(stopped.recording,false);assert.equal(stopped.state,'ready');
  assert.ok(fake.actions.includes(ACTION.stopAndSave));assert.ok(!fake.actions.includes(40668));
 }finally{link.close();fake.close();}
});
test('a Rec that Reaper refuses shows an error, never a recording',async()=>{
 const {fake,link}=await fakeReaper({refuseRecord:true});
 try{await assert.rejects(link.record(),/Rien n’est enregistré/);assert.equal(link.status().recording,false);assert.match(link.status().alert,/Rien/);}
 finally{link.close();fake.close();}
});
test('Rec announced with a frozen counter is not a recording',async()=>{
 const {fake,link}=await fakeReaper({frozenClock:true});
 try{await assert.rejects(link.record(),/compteur/);assert.equal(link.status().recording,false);}
 finally{link.close();fake.close();}
});
test('Reaper closed: Rec fails clearly',async()=>{
 const {fake,link}=await fakeReaper();fake.alive=false;
 try{await assert.rejects(link.record(),/ne répond pas/);assert.equal(link.status().state,'offline');}
 finally{link.close();fake.close();}
});
test('silence during a take raises an alert and stops claiming to record',async()=>{
 const {fake,link}=await fakeReaper();
 try{await link.record();fake.alive=false;await wait(350);const s=link.status();assert.equal(s.state,'lost');assert.equal(s.recording,false);assert.match(s.alert,/ne répond plus/);}
 finally{link.close();fake.close();}
});
test('a stop made in Reaper itself is reported',async()=>{
 const {fake,link}=await fakeReaper();
 try{await link.record();fake.recording=false;fake.say('/record',0);await wait(50);assert.equal(link.status().recording,false);assert.match(link.status().alert,/sans que tu aies appuyé/);}
 finally{link.close();fake.close();}
});
test('an unconfirmed stop stays an error, markers need a confirmed take',async()=>{
 const {fake,link}=await fakeReaper({ignoreStop:true});
 try{assert.throws(()=>link.marker(),/confirmé/);await link.record();await assert.rejects(link.stop(),/n’a pas confirmé/);assert.equal(link.status().recording,true);}
 finally{link.close();fake.close();}
});
