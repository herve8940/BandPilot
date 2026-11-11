import {DEFAULT_MIXER} from '../shared/mixer-models.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SoundCoach,SOURCES,gainProposal,thresholdsFrom,GROUP_TEMPLATE,TEMPLATES,DRUM_KIT,MONITOR_RECIPES,OWN_LEVEL,suggestMusicians,consoleName,validateProfile,identifySymptom,levelReport} from '../src/sound-coach.js';
import {XR18} from '../src/xr18.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {fromWire} from '../src/parameters.js';
import {EventEmitter} from 'node:events';
const setup=()=>{const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library);return {xr,library,control,coach:new SoundCoach(xr,control,library)};};
test('beginner group validates wiring and persists progress without changing console',()=>{
 const {xr,library,coach}=setup();try{
  const before=xr.parameterState();const saved=coach.saveProfile({version:1,inputs:GROUP_TEMPLATE,completed:['inputs']});assert.equal(saved.inputs.length,6);assert.deepEqual(coach.profile().completed,['inputs']);assert.deepEqual(xr.parameterState(),before);
  for(const inputs of [[GROUP_TEMPLATE[0],GROUP_TEMPLATE[0]],[{channel:17,source:'lead-rock',name:'chant'}],[{channel:1,source:'unknown',name:'x'}],[{channel:1,source:'lead-rock',name:'a very long instrument'}]])assert.throws(()=>validateProfile({version:1,inputs,completed:[]}));
 }finally{xr.close();library.close();}
});
test('full group plan configures every instrument completely, never gain, phantom, levels, mutes or routing',async()=>{
 const {xr,library,coach}=setup();try{
  const initial=xr.parameterState();const plan=await coach.prepare();assert.equal(plan.inputs.length,6);assert.deepEqual(xr.parameterState(),initial);
  for(const c of plan.changes){assert.match(c.address,/^\/ch\/0[1-6]\//);assert.doesNotMatch(c.address,/headamp|phantom|routing|fader|mix\/on|\/mix\/\d/);}
  for(let ch=1;ch<=6;ch++)assert.ok(plan.changes.some(c=>c.address===`/ch/0${ch}/config/name`),'channel '+ch+' in plan');
  await assert.rejects(coach.apply(plan.token,false),/Confirmation/);const r=await coach.apply(plan.token,true);assert.equal(r.ok,true);assert.deepEqual(r.failed,[]);
  assert.equal(await xr.readParameter('/ch/01/config/name'),'Chant');assert.equal(await xr.readParameter('/ch/04/config/name'),'Basse');assert.equal(await xr.readParameter('/ch/06/config/name'),'TD27 R');
  assert.equal(await xr.readParameter('/ch/01/dyn/on'),1);assert.equal(fromWire('/ch/01/dyn/thr',await xr.readParameter('/ch/01/dyn/thr')),-20);
  assert.equal(await xr.readParameter('/ch/06/dyn/on'),0);assert.equal(fromWire('/ch/06/mix/pan',await xr.readParameter('/ch/06/mix/pan')),100);
  assert.ok(Math.abs(Number(fromWire('/ch/01/eq/1/g',await xr.readParameter('/ch/01/eq/1/g')))+3)<.3);assert.equal(xr.listChannels()[0]?.fader,.5);
  const undo=await coach.undo();await coach.apply(undo.token,true);assert.equal(await xr.readParameter('/ch/01/config/name'),'');assert.equal(await xr.readParameter('/ch/01/gate/on'),1);
 }finally{xr.close();library.close();}
});
test('detailed drum kit: kick, snare, three toms and two overheads get gate, compressor and stereo placement',async()=>{
 const {xr,library,coach}=setup();try{
  const inputs=TEMPLATES.find(t=>t.id==='rock-drums')!.inputs;assert.deepEqual(inputs.slice(5).map(i=>i.source),DRUM_KIT);
  coach.saveProfile({version:1,inputs,completed:[]});const plan=await coach.prepare();assert.equal(plan.inputs.length,12);await coach.apply(plan.token,true);
  const read=async(a:string)=>fromWire(a,await xr.readParameter(a));
  for(const ch of [6,7,8,9,10])assert.equal(await xr.readParameter(`/ch/${String(ch).padStart(2,'0')}/gate/on`),1);
  assert.deepEqual([await read('/ch/08/config/name'),await read('/ch/09/config/name'),await read('/ch/10/config/name'),await read('/ch/11/config/name'),await read('/ch/12/config/name')],['Tom 1','Tom 2','Tom 3','OH 1','OH 2']);
  assert.ok(Number(await read('/ch/11/mix/pan'))<-50&&Number(await read('/ch/12/mix/pan'))>50);assert.ok(Number(await read('/ch/10/preamp/hpf'))<Number(await read('/ch/08/preamp/hpf')));
  assert.equal(await read('/ch/03/config/name'),'Guit rythm');assert.equal(await read('/ch/04/config/name'),'Guit solo');
  const single=await coach.prepare(7);assert.ok(single.changes.every(c=>c.address.startsWith('/ch/07/')));assert.match(single.title,/Snare/);
 }finally{xr.close();library.close();}
});
test('monitor mixes: one bus per musician, pre-fader, own instrument in front, bus kept out of the PA',async()=>{
 const {xr,library,coach}=setup();try{
  const inputs=TEMPLATES.find(t=>t.id==='rock-drums')!.inputs,musicians=suggestMusicians(inputs);
  assert.deepEqual(musicians.map(m=>m.role),['chant','guitare','guitare','basse','batterie']);assert.deepEqual(musicians.at(-1)!.channels,[6,7,8,9,10,11,12]);
  coach.saveProfile({version:1,inputs,completed:[],musicians});assert.equal(coach.profile().musicians!.length,5);
  const plan=await coach.prepareEars();await coach.apply(plan.token,true);const read=async(a:string)=>fromWire(a,await xr.readParameter(a));
  assert.equal(await read('/bus/4/config/name'),'Basse');assert.equal(await xr.readParameter('/bus/4/mix/lr'),0);assert.equal(await read('/bus/4/mix/fader'),-10);
  assert.equal(await read('/ch/05/mix/04/level'),OWN_LEVEL);assert.equal(await read('/ch/06/mix/04/level'),MONITOR_RECIPES.basse.kick);assert.equal(await xr.readParameter('/ch/01/mix/04/tap'),3);
  assert.ok(Number(await read('/ch/11/mix/05/level'))<=-89);
  const one=await coach.prepareEars(2);assert.ok(one.changes.every(c=>/\/(mix\/02|bus\/2)\//.test(c.address)));
  assert.throws(()=>validateProfile({version:1,inputs,completed:[],musicians:[musicians[0],{...musicians[1],bus:1}]}),/bus/);
  assert.equal(consoleName('Chœurs été'),'Choeurs ete');
 }finally{xr.close();library.close();}
});
test('symptom suggestions are contextual, reversible, bounded and never invent feedback frequency or gate threshold',async()=>{
 const {xr,library,coach}=setup();try{
  await coach.apply((await coach.prepare(1)).token,true);
  const feedback=await coach.suggest(1,'feedback');assert.equal(feedback.proposal,null);assert.equal(feedback.advice.measuredAudio,false);assert.match(feedback.advice.check,/seuls vumètres/);
  const uneven=await coach.suggest(1,'uneven');assert.equal(uneven.proposal,null);
  const r=await coach.suggest(1,'muddy');assert.ok(r.proposal);for(const c of r.proposal.changes)assert.match(c.address,/^\/ch\/01\/eq\/1\//);await coach.apply(r.proposal.token,true);
  assert.ok(Number(fromWire('/ch/01/eq/1/g',await xr.readParameter('/ch/01/eq/1/g')))>=-6);
  await xr.writeParameter('/ch/01/gate/on',1);const cut=await coach.suggest(1,'cutoff');assert.deepEqual(cut.proposal?.changes.map(c=>c.address),['/ch/01/gate/on']);
  await xr.writeParameter('/ch/01/eq/1/type',0);assert.equal((await coach.suggest(1,'muddy')).proposal,null);
  assert.equal(identifySymptom('ma voix est étouffée'),'muddy');assert.equal(identifySymptom('ça siffle très fort'),'feedback');assert.equal(identifySymptom('les fins de mots sont coupées'),'cutoff');assert.equal(identifySymptom('bonjour'),null);
 }finally{xr.close();library.close();}
});
test('signal checks reject missing, duplicated or old samples and simulation never fabricates audio',async()=>{
 const now=Date.now(),sample=(age:number,level:number)=>({updatedAt:new Date(now-age).toISOString(),available:true,channels:[level]});
 assert.equal(levelReport(1,[],now).available,false);assert.equal(levelReport(1,[sample(0,-10),sample(0,-10),sample(0,-10)],now).available,false);assert.equal(levelReport(1,[sample(20000,-10),sample(21000,-10),sample(22000,-10)],now).available,false);
 assert.equal(levelReport(1,[sample(0,-.5),sample(100,-1),sample(200,-2)],now).state,'high');assert.equal(levelReport(1,[sample(0,-60),sample(100,-65),sample(200,-64)],now).state,'low');
 const {xr,library,coach}=setup();try{const report=await coach.measure(1);assert.equal(report.available,false);assert.match(report.message,/ne simule pas/);}finally{xr.close();library.close();}
});

test('level observation collects fresh distinct events, cleans listeners and rejects a changed connection',async()=>{
 const stream=Object.assign(new EventEmitter(),{mode:'real',status:()=>({connected:true})});let identity='console-A';
 const control={identity:()=>identity} as ConsoleControl;const library=new LibraryStore(':memory:');
 const coach=new SoundCoach(stream as unknown as XR18,control,library);
 const measurement=coach.measure(1,250);const now=Date.now();
 for(let n=0;n<3;n++)stream.emit('meters',{available:true,updatedAt:new Date(now-n).toISOString(),channels:[-20]});
 try{const report=await measurement;assert.equal(report.available,true);assert.equal(report.state,'present');assert.equal(stream.listenerCount('meters'),0);
  const pending=coach.measure(1,250);identity='console-B';await assert.rejects(pending,/Connexion modifiée/);assert.equal(stream.listenerCount('meters'),0);
 }finally{library.close();}
});

test('gain proposal aims at -6 dBFS peaks, in safe steps, never blind',()=>{
 assert.equal(gainProposal(-7,20).state,'ok');assert.equal(gainProposal(-4,20).state,'ok');
 const up=gainProposal(-20,20);assert.equal(up.state,'raise');assert.equal(up.targetGainDb,26);assert.equal(up.deltaDb,6);
 const down=gainProposal(-2,30);assert.equal(down.state,'lower');assert.equal(down.targetGainDb,26);
 assert.equal(gainProposal(-.5,30).state,'clip');assert.equal(gainProposal(-.5,30).targetGainDb,24);
 assert.equal(gainProposal(-70,30).state,'none');assert.equal(gainProposal(-70,30).targetGainDb,null);
 assert.equal(gainProposal(-20,60,-12,60).state,'limit');assert.equal(gainProposal(-20,null).targetGainDb,null);
 const kick=SOURCES.find(s=>s.id==='kick')!,voice=SOURCES.find(s=>s.id==='lead-rock')!,bass=SOURCES.find(s=>s.id==='bass-di')!;
 assert.deepEqual(thresholdsFrom(voice,-6),{compThrDb:-14,gateThrDb:null,note:''});
 assert.equal(thresholdsFrom(kick,-6).gateThrDb,-30);assert.equal(thresholdsFrom(kick,-6,-40).gateThrDb,-36);
 assert.match(thresholdsFrom(kick,-6,-20).note,/rapproche le micro/);assert.equal(thresholdsFrom(bass,-8).compThrDb,-16);
});
test('guided gain staging: measure, raise the preamp, re-measure, then thresholds follow the real signal',async()=>{
 const values=new Map<string,unknown>([['/ch/06/preamp/rtnsw',0],['/ch/06/config/insrc',5],['/headamp/06/gain',(20+12)/72]]);
 let level=-18;const xr=Object.assign(new EventEmitter(),{mode:'real',model:()=>DEFAULT_MIXER,status:()=>({connected:true}),readParameter:async(a:string)=>values.get(a)??0});
 const previews:Record<string,unknown>[]=[];
 const control={identity:()=>'A',preview:async(v:Record<string,unknown>)=>{previews.push(v);return {token:'t',changes:Object.entries(v).map(([address,after])=>({address,before:0,after}))};}} as unknown as ConsoleControl;
 const library=new LibraryStore(':memory:'),coach=new SoundCoach(xr as unknown as XR18,control,library);
 const pump=setInterval(()=>{const now=new Date().toISOString();xr.emit('meters',{available:true,updatedAt:now,channels:Array.from({length:16},(_,i)=>i===5?level-Math.random():-80)});},20);
 try{
  coach.saveProfile({version:1,inputs:[{channel:6,source:'kick',name:'Kick'}],completed:[]});
  const first=await coach.gainCheck(6,200);assert.equal(first.decision?.state,'raise');assert.deepEqual(previews.at(-1),{'/headamp/06/gain':26});assert.match(first.proposal!.title,/Kick : \+6/);
  assert.equal((await coach.calibrationStatus())[0]!.state,'todo');
  values.set('/headamp/06/gain',(26+12)/72);level=-7;
  const second=await coach.gainCheck(6,200);assert.equal(second.decision?.state,'ok');assert.equal(second.proposal,null);
  let st=(await coach.calibrationStatus())[0]!;assert.equal(st.state,'ok');assert.ok(Math.abs(st.gainDb!-26)<.01);assert.equal(st.thresholds!.compThrDb,st.thresholds!.compThrDb);
  await assert.rejects(coach.bleedCheck(6,200).then(r=>{if(!r.thresholds)throw Error(r.message);}),/se taire/);
  level=-38;const bleed=await coach.bleedCheck(6,200);assert.ok(bleed.thresholds);assert.ok(bleed.thresholds!.gateThrDb!>-38&&bleed.thresholds!.gateThrDb!<-30);
  // The browser saving the group never erases measurements.
  coach.saveProfile({version:1,inputs:[{channel:6,source:'kick',name:'Kick'}],completed:[]});st=(await coach.calibrationStatus())[0]!;assert.equal(st.state,'ok');assert.ok(st.bleedDb!<-37);
  const plan=await coach.prepare(6);assert.match(plan.explanation,/calés sur ton signal/);const gateThr=previews.at(-1)!['/ch/06/gate/thr'];assert.equal(gateThr,st.thresholds!.gateThrDb);
  // A gain changed elsewhere makes the measure stale: thresholds go back to defaults with a warning.
  values.set('/headamp/06/gain',(32+12)/72);st=(await coach.calibrationStatus())[0]!;assert.equal(st.state,'stale');
  assert.match((await coach.prepare(6)).explanation,/étape 3/);
 }finally{clearInterval(pump);library.close();}
});

test('natural processing persists without console writes and produces a conservative reversible proposal',async()=>{
 const {xr,library,coach}=setup();try{
  const inputs=[{channel:1,source:'lead-rock',name:'Chant'},{channel:2,source:'snare',name:'Snare'},{channel:3,source:'tom1',name:'Tom 1'},{channel:4,source:'electric-solo',name:'Guitare'},{channel:5,source:'oh-left',name:'OH 1'}];
  const before=xr.parameterState();
  coach.saveProfile({version:1,inputs,completed:[],sound:'natural',headroom:'extra'});
  assert.equal(coach.profile().sound,'natural');assert.deepEqual(xr.parameterState(),before);
  assert.throws(()=>coach.saveProfile({version:1,inputs,completed:[],sound:'invented'}),/Profil sonore/);
  const catalog=coach.catalog();assert.match(catalog.presets['tom1']!.lines.join(' '),/non activé/);
  assert.ok(catalog.presetsBySound['live-rock']!['tom1']!.lines.some(l=>/Gate à/.test(l)));
  const proposal=await coach.prepare();assert.deepEqual(xr.parameterState(),before);
  for(const c of proposal.changes)assert.doesNotMatch(c.address,/headamp|phantom|routing|fader|mix\/on|\/mix\/\d/);
  await coach.apply(proposal.token,true);
  const read=async(a:string)=>fromWire(a,await xr.readParameter(a));
  for(let c=1;c<=5;c++){
   assert.equal(await read(`/ch/0${c}/gate/on`),0);
   for(let b=1;b<=4;b++)assert.equal(await read(`/ch/0${c}/eq/${b}/g`),0);
   assert.equal(await read(`/ch/0${c}/dyn/mgain`),0);
  }
  assert.equal(await read('/ch/01/dyn/thr'),-14);
  assert.equal(await read('/ch/03/gate/mode'),1);assert.equal(await read('/ch/03/gate/range'),9);
  assert.equal(await read('/ch/04/dyn/on'),0);assert.equal(await read('/ch/05/dyn/on'),0);
  const undo=await coach.undo();await coach.apply(undo.token,true);
  assert.equal(await read('/ch/01/config/name'),'');assert.equal(await read('/ch/03/gate/on'),1);
  // Selecting the new sound must not mutate shared presets used by legacy profiles.
  const legacy=SoundCoach.channelValues(inputs[2]!);assert.equal(legacy['/ch/03/gate/on'],1);assert.equal(legacy['/ch/03/eq/1/g'],2);
 }finally{xr.close();library.close();}
});
test('extra headroom is independent of processing, which never derives a natural gate from a loud peak and leaves disabled compressors off',()=>{
 const voice=SOURCES.find(s=>s.id==='lead-rock')!,tom=SOURCES.find(s=>s.id==='tom1')!,guitar=SOURCES.find(s=>s.id==='electric-solo')!;
 assert.equal(gainProposal(-4,20).state,'ok');
 assert.equal(gainProposal(-4,20,-12,60,'extra').targetGainDb,15);
 for(const peak of [-12,-9,-6])assert.equal(gainProposal(peak,20,-12,60,'extra').state,'ok');
 assert.equal(gainProposal(-70,20,-12,60,'extra').targetGainDb,null);
 assert.equal(gainProposal(-20,null,-12,60,'extra').targetGainDb,null);
 assert.equal(thresholdsFrom(voice,-9,undefined,'natural').compThrDb,-14);
 for(const bleed of [undefined,-60,-25,-10])assert.equal(thresholdsFrom(tom,-9,bleed,'natural').gateThrDb,null);
 assert.equal(thresholdsFrom(guitar,-9,undefined,'natural').compThrDb,null);
});
test('listening type controls each monitor mix independently of sound and headroom',()=>{
 const inputs=TEMPLATES.find(t=>t.id==='rock-drums')!.inputs,musicians=suggestMusicians(inputs),profile={version:1 as const,inputs,musicians,completed:[]};
 const legacy=SoundCoach.earsValues(profile).values;
 assert.deepEqual(SoundCoach.earsValues({...profile,sound:'natural',headroom:'extra'}).values,legacy);
 const personal={...profile,tech:{monitors:Object.fromEntries(musicians.map(m=>[m.bus,{kind:m.role==='batterie'?'in-ear' as const:'wedge' as const}]))}};
 const natural=SoundCoach.earsValues(personal).values;
 for(const sound of ['live-rock','natural'] as const)for(const headroom of ['standard','extra'] as const)assert.deepEqual(SoundCoach.earsValues({...personal,sound,headroom}).values,natural);
 const headphones=SoundCoach.earsValues({...personal,tech:{monitors:Object.fromEntries(musicians.map(m=>[m.bus,{kind:'headphones' as const}]))}}).values;
 assert.equal(headphones['/ch/11/mix/05/level'],-26);
 // Wedge musicians retain every send when another musician chooses in-ears.
 for(const [a,v] of Object.entries(legacy))if(!a.includes('/mix/05/'))assert.equal(natural[a],v,a);
 assert.equal(legacy['/ch/11/mix/05/level'],-90);assert.equal(natural['/ch/11/mix/05/level'],-26);
 assert.equal(natural['/ch/08/mix/05/level'],-18);assert.equal(natural['/ch/11/mix/05/tap'],'PRE');
 assert.equal(natural['/bus/5/mix/lr'],0);
});

test('draft headroom rechecks the peak independently of style without saving or losing calibration',async()=>{
 const {xr,library,coach}=setup();try{
  const inputs=[{channel:1,source:'snare',name:'Snare'}];
  coach.saveProfile({version:1,inputs,completed:[],calibration:{'1':{peakDb:-4,gainDb:12,at:new Date().toISOString()}}},true);
  (coach as any).currentGain=async()=>({gainDb:12});
  assert.equal((await coach.calibrationStatus())[0]!.valid,true);
  assert.equal((await coach.calibrationStatus({sound:'natural',headroom:'extra'}))[0]!.state,'stale');
  assert.equal((await coach.calibrationStatus({sound:'natural',headroom:'standard'}))[0]!.valid,true);
  assert.equal((await coach.calibrationStatus({sound:'live-rock',headroom:'extra'}))[0]!.state,'stale');
  assert.equal(coach.profile().sound,undefined);assert.equal(coach.profile().headroom,undefined);
  await assert.rejects(coach.calibrationStatus({headroom:'unknown'}),/Marge/);
  await assert.rejects(coach.calibrationStatus({sound:'unknown'}),/Profil sonore/);
  coach.saveProfile({...coach.profile(),calibration:{'1':{peakDb:-9,gainDb:12,bleedDb:-35,at:new Date().toISOString()}}},true);
  const status=(await coach.calibrationStatus({sound:'natural',headroom:'extra'}))[0]!;assert.equal(status.valid,true);assert.equal(status.thresholds!.gateThrDb,null);
  coach.saveProfile({...coach.profile(),sound:'natural',headroom:'extra'});assert.equal(coach.profile().calibration!['1']!.bleedDb,-35);
 }finally{xr.close();library.close();}
});


test('old DEV sound migrates explicitly, while existing and new independent preferences survive saving',()=>{
 const {xr,library,coach}=setup();try{
  const inputs=TEMPLATES.find(t=>t.id==='rock-drums')!.inputs,musicians=suggestMusicians(inputs);
  const profile={version:1 as const,inputs,musicians,completed:[]};
  assert.deepEqual(validateProfile(profile),profile);
  const legacy={...profile,sound:'inears-natural',tech:{monitors:{1:{kind:'wedge',equipment:'Mon retour'}}}};
  library.save('coach-profile','Legacy DEV',legacy);
  const before=xr.parameterState(),migrated=coach.profile();
  assert.equal(migrated.sound,'natural');assert.equal(migrated.headroom,'extra');
  assert.equal(migrated.tech!.monitors![1]!.kind,'wedge');assert.equal(migrated.tech!.monitors![5]!.kind,'in-ear');
  assert.equal(validateProfile({...legacy,headroom:'standard'}).headroom,'standard');
  assert.equal(validateProfile({...legacy,musicians:undefined}).tech!.monitors![5]!.kind,'in-ear');
  coach.saveProfile({...migrated,sound:'live-rock',headroom:'extra'});
  assert.equal(coach.profile().headroom,'extra');assert.deepEqual(coach.profile().musicians,migrated.musicians);assert.equal(coach.profile().tech!.monitors![1]!.equipment,'Mon retour');assert.equal(coach.profile().tech!.monitors![5]!.kind,'in-ear');
  assert.deepEqual(xr.parameterState(),before);
  assert.throws(()=>validateProfile({...profile,headroom:'invented'}),/Marge/);
  assert.throws(()=>validateProfile({...profile,tech:{monitors:{1:{kind:'invented'}}}}),/Option/);
  coach.saveProfile({...profile,tech:{monitors:{5:{kind:'headphones',mode:'mono',notes:'Casque du batteur'}}}});
  assert.equal(coach.profile().tech!.monitors![5]!.kind,'headphones');
  assert.equal(SoundCoach.earsValues(coach.profile()).values['/ch/11/mix/05/level'],-26);
 }finally{xr.close();library.close();}
});
