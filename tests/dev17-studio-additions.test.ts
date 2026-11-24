import assert from 'node:assert/strict';
import test from 'node:test';
import {acousticBins,acousticResponse,ACOUSTIC_BANDS,accumulateAcousticSpectrum} from '../shared/acoustic-measurement.js';
import {PORTABLE_FORMAT,validatePortableScene} from '../shared/portable-scene.js';
import {validateSurfaces,type ExpertSurfaces} from '../shared/expert-surfaces.js';
import {ConsoleControl} from '../src/console-control.js';
import {LibraryStore} from '../src/library-store.js';
import {capturePortable,portableFromEntry,previewPortable,previewPortableBackup} from '../src/portable-scenes.js';
import {fromWire,toWire,type Value} from '../src/parameters.js';
import {XR18} from '../src/xr18.js';

const fixture=(model:'XR18'|'MR12'|'X32')=>{
 const mixer=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false});
 const library=new LibraryStore(':memory:'),control=new ConsoleControl(mixer,library);
 return {mixer,library,control,set:(a:string,v:Value)=>mixer.writeParameter(a,toWire(a,v)),
  get:async(a:string)=>fromWire(a,await mixer.readParameter(a)),close(){mixer.close();library.close();}};
};

test('acoustic analysis uses band power and rejects responses with insufficient signal above ambient',()=>{
 const bins=acousticBins(48000,16384),sum=ACOUSTIC_BANDS.map(()=>0);
 const spectrum=new Float32Array(8192).fill(-100);
 const index=ACOUSTIC_BANDS.indexOf(1000),{start,end}=bins[index]!;
 spectrum.fill(-40,start,end+1);
 accumulateAcousticSpectrum(spectrum,bins,sum);
 assert.ok(Math.abs(sum[index]!-(end-start+1)*.0001)<1e-10);
 const floor=ACOUSTIC_BANDS.map(()=>.001);
 const signal=ACOUSTIC_BANDS.map(hz=>hz===1000?.101:.021);
 assert.deepEqual(acousticResponse(floor,signal).find(([hz])=>hz===1000),[1000,7]);
 const calibration=ACOUSTIC_BANDS.map((hz):[number,number]=>[hz,hz===1000?7:0]);
 assert.deepEqual(acousticResponse(floor,signal,calibration).find(([hz])=>hz===1000),[1000,0]);
 assert.throws(()=>acousticResponse(floor,floor.map(v=>v*2)),/bruit de fond/);
 assert.throws(()=>acousticResponse(floor,signal,[[900,0],[1100,0]]),/bruit de fond/);
});

test('surfaces are revisioned by model and reject overlaps and unavailable monitor buses',()=>{
 const library=new LibraryStore(':memory:');
 try{
  const data:ExpertSurfaces={model:'MR12',revision:0,surfaces:[{id:'main',name:' Practice ',widgets:[
   {id:'voice',kind:'send',channel:12,bus:2,label:'Vocal',x:0,y:0,width:2,height:3}
  ]}]};
  assert.deepEqual(library.surfaces('XR18').surfaces,[]);
  assert.equal(library.saveSurfaces(data).revision,1);
  assert.equal(library.surfaces('MR12').surfaces[0]?.name,'Practice');
  assert.deepEqual(library.surfaces('XR18').surfaces,[]);
  assert.throws(()=>library.saveSurfaces(data),/autre fenêtre/);
  const invalid=structuredClone(data);
  invalid.surfaces[0]!.widgets[0]!.bus=3;
  assert.throws(()=>validateSurfaces(invalid),/invalide/);
  invalid.surfaces[0]!.widgets=[data.surfaces[0]!.widgets[0]!,{...data.surfaces[0]!.widgets[0]!,id:'overlap'}];
  assert.throws(()=>validateSurfaces(invalid),/chevauchent/);
  assert.throws(()=>library.surfaces('X32'),/invalide/);
 }finally{library.close();}
});

test('XR18 portable capture and legacy conversion recall to MR12 with explicit mapping, protection and guarded undo',async()=>{
 const source=fixture('XR18'),dest=fixture('MR12');
 try{
  await source.set('/ch/01/config/name','Lead');
  await source.set('/ch/01/mix/pan',-34);
  await source.set('/ch/01/mix/fader',-12);
  await source.set('/ch/01/eq/1/g',3);
  await source.set('/config/chlink/15-16',1);
  const original=await source.control.capture(),captured=await capturePortable(source.mixer,source.control,'XR18');
  assert.deepEqual(await source.control.capture(),original);
  const legacy=source.library.save('scene','legacy',{...original,model:undefined});
  assert.deepEqual(portableFromEntry(legacy,'XR18'),captured);
  const written=JSON.parse(JSON.stringify(captured));
  assert.equal(written.format,PORTABLE_FORMAT);
  assert.equal(written.tracks.length,16);
  assert.equal(written.tracks[14].linked,true);
  assert.throws(()=>validatePortableScene({...written,tracks:[{...written.tracks[0],phantom:true}]}),/invalide/);
  const scene=dest.library.save('portable-scene','Exchange',validatePortableScene(written)),before=await dest.control.capture();
  const selection={model:'MR12',mapping:[{source:1,target:3}],sections:['eq','levels','labels']};
  const prepare=(body:Record<string,unknown>)=>previewPortable(dest.mixer,dest.control,dest.library,scene,body);
  await assert.rejects(prepare({...selection,mapping:[{source:1,target:13}]}),/destinations/);
  await assert.rejects(prepare({...selection,mapping:[{source:15,target:3}]}),/paire stéréo/);
  await assert.rejects(prepare({...selection,mapping:[{source:1,target:3},{source:2,target:3}]}),/destinations/);
  const plan=await prepare(selection);
  assert.equal(await dest.get('/ch/03/mix/pan'),0);
  assert.deepEqual(await dest.control.capture(),before);
  await dest.library.saveProtections({model:'MR12',revision:0,rules:[{channel:3,sections:['levels']}]});
  await assert.rejects(dest.control.apply(plan.token),/protections/);
  const guarded=await prepare(selection);
  assert.deepEqual(guarded.excluded,[{channel:3,sections:['levels']}]);
  const result=await dest.control.apply(guarded.token);
  assert.equal(await dest.get('/ch/03/config/name'),'Lead');
  assert.equal(await dest.get('/ch/03/eq/1/g'),3);
  assert.equal(await dest.get('/ch/03/mix/pan'),0);
  assert.equal(await dest.get('/ch/01/config/name'),before.values['/ch/01/config/name']);
  const backup=dest.library.get(result.backupId);
  await dest.set('/config/chlink/3-4',1);
  await assert.rejects(previewPortableBackup(dest.mixer,dest.control,dest.library,backup),/paire stéréo/);
  await dest.set('/config/chlink/3-4',0);
  await dest.set('/ch/03/config/insrc',4);
  await assert.rejects(previewPortableBackup(dest.mixer,dest.control,dest.library,backup),/sources ont changé/);
  await dest.mixer.writeParameter('/ch/03/config/insrc',before.values['/ch/03/config/insrc']!);
  const restore=await previewPortableBackup(dest.mixer,dest.control,dest.library,backup);
  await dest.control.apply(restore.token);
  assert.deepEqual(await dest.control.capture(),before);
 }finally{source.close();dest.close();}
});

test('native scene conversion preserves portable values and ignores sources, route and phantom power',()=>{
 const library=new LibraryStore(':memory:');
 try{
  const native=library.save('native-scene','Native fixture',[
   '/config/chlink '+Array(8).fill('OFF').join(' '),
   '/ch/01/config "Lead" 9 In01 U01',
   '/ch/01/mix OFF -10 ON +0',
   '/headamp/01 +0 ON',
  ].join('\n'));
  const data=portableFromEntry(native,'MR18');
  assert.deepEqual(data.tracks,[{channel:1,linked:false,name:'Lead',color:9,levelDb:-10,muted:true,pan:0}]);
  assert.throws(()=>portableFromEntry(native,'X32'),/disponibles/);
 }finally{library.close();}
});
