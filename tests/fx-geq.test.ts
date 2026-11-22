import test from 'node:test';
import assert from 'node:assert/strict';
import {FX_SCHEMAS,defaultFxParameters,canEditFx,fxFromWire,fxToWire} from '../shared/fx-parameters.js';
import {decodeNativeFx} from '../src/native-fx.js';
import {XR18} from '../src/xr18.js';
import {LibraryStore} from '../src/library-store.js';
import {ConsoleControl} from '../src/console-control.js';
import {FxPresets} from '../src/fx-presets.js';

test('GEQ/TEQ native vectors decode signed dB, channel boundary and output gains independently',()=>{
 for(const algorithm of [27,28,29,30]){
  const dual=algorithm===27||algorithm===29,length=dual?64:32;
  const tokens=Array(length).fill('0');tokens[0]='-15';tokens[17]='-6';tokens[30]='+15';tokens[31]='-3';
  if(dual){tokens[32]='+3';tokens[62]='-12';tokens[63]='+6';}
  const fx=decodeNativeFx(2,algorithm,tokens),schema=FX_SCHEMAS[algorithm]!;
  assert.equal(fx.parameters.length,length);assert.ok(canEditFx(fx));
  assert.equal(schema.parameters[0]!.frequency,20);assert.equal(schema.parameters[17]!.frequency,1000);assert.equal(schema.parameters[30]!.frequency,20000);
  assert.equal(schema.parameters[31]!.label,'Niveau de sortie');assert.equal(schema.parameters[31]!.frequency,undefined);
  assert.equal(fx.parameters[0]!.value,0);assert.equal(fx.parameters[30]!.value,1);assert.equal(fx.parameters[31]!.value,.4);
  assert.deepEqual(fx.parameters.map(p=>p.type),Array(length).fill('f'));
  fx.parameters.forEach((p,i)=>assert.ok(Math.abs(fxFromWire(schema.parameters[i]!,p.value)-Number(tokens[i]))<1e-6));
  if(dual){assert.equal(schema.parameters[32]!.side,'B');assert.equal(schema.parameters[32]!.frequency,20);assert.equal(fx.parameters[63]!.value,.7);}
  assert.throws(()=>decodeNativeFx(2,algorithm,['15.1',...tokens.slice(1)]),/hors plage/);
  assert.throws(()=>decodeNativeFx(2,algorithm,tokens.slice(1)),/nombre de paramètres/);
  assert.ok(!canEditFx({...fx,parameters:fx.parameters.slice(1)}));
  assert.ok(!canEditFx({...fx,parameters:fx.parameters.map((p,i)=>i===0?{type:'i',value:0}:p)}));
 }
 const padded=decodeNativeFx(1,28,Array(64).fill('0'));assert.equal(padded.parameters.length,32);
 assert.throws(()=>decodeNativeFx(1,28,[...Array(63).fill('0'),'1']),/remplissage/);
});

test('64-parameter GEQ previews and saved presets do not write, apply preserves the other side, undo is exact across X-Air models',async()=>{
 for(const model of ['XR18','MR18','XR12','MR12','X18'] as const){
  const xr=new XR18({mode:'simulation',model,host:'127.0.0.1',port:10024,enableWrites:false}),library=new LibraryStore(':memory:'),control=new ConsoleControl(xr,library),service=new FxPresets(xr,control,library);
  try{
   const original={slot:4,algorithm:27,parameters:defaultFxParameters(27)};
   original.parameters[31]={type:'f',value:.4};original.parameters[32]={type:'f',value:.6};original.parameters[63]={type:'f',value:.7};
   await xr.applyFx(original);const before=await xr.readFx(4),other=await xr.readFx(1);
   const desired=structuredClone(before);desired.parameters[17]=fxToWire(FX_SCHEMAS[27]!.parameters[17]!,-4.5);
   const saved=library.save('fx','Synthetic GEQ',desired),plan=await service.preview(saved.id,saved.data,undefined,before);
   assert.deepEqual(await xr.readFx(4),before);
   const result=await service.apply(saved.id,plan.token);assert.deepEqual(await xr.readFx(4),desired);assert.deepEqual(await xr.readFx(1),other);
   assert.deepEqual((await xr.readFx(4)).parameters.slice(31),before.parameters.slice(31));
   const undo=await service.preview(result.backupId,library.get(result.backupId).data);await service.apply(result.backupId,undo.token);assert.deepEqual(await xr.readFx(4),before);
   const stale=await service.preview('edit',desired,undefined,before);await xr.applyFx({...before,parameters:before.parameters.map((p,i)=>i===63?{...p,value:.3}:p)});
   await assert.rejects(service.apply('edit',stale.token),/État modifié/);
  }finally{xr.close();library.close();}
 }
});

test('GEQ support does not enable the distinct X32 FX protocol',async()=>{
 const xr=new XR18({mode:'simulation',model:'X32',host:'127.0.0.1',port:10023,enableWrites:false}),library=new LibraryStore(':memory:');
 try{const service=new FxPresets(xr,new ConsoleControl(xr,library),library);await assert.rejects(service.preview('edit',{slot:1,algorithm:27,parameters:defaultFxParameters(27)}),/uniquement/);}finally{xr.close();library.close();}
});
