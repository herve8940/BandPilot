import test from 'node:test';
import assert from 'node:assert/strict';
import {FX_SCHEMAS,FX_NATIVE_OPTIONS,defaultFxParameters,canEditFx,fxFromWire} from '../shared/fx-parameters.js';
import {decodeNativeFx} from '../src/native-fx.js';
// OSC signatures independently transcribed from XAir_fxparse(1).c.
const signatures:Record<number,string>={6:'fffiifffff',7:'ffffffffffffi',8:'ffffffffff',9:'fffffffff',11:'ffffffiffiffiii',12:'ffffffifififiii',13:'fffffffffff',14:'ffffffffffff',15:'ffffffffffff',16:'iiiiiii',17:'ffffififffffii',18:'ffffffii',19:'fffffffff',20:'iifffiifff',21:'fiffffffffff',22:'ffffffffffff',23:'ffffffffffff',24:'fiffffffffff',25:'fiffffffffff',31:'ffffii',32:'ffffii',33:'iffifffifii',34:'iffifffifii'.repeat(2),35:'ififififi',36:'ififififi'.repeat(2),37:'ffffff',38:'ffffffii',39:'iifffififiiffffiffiffiffiffii',40:'iifffififiiffffiffiffiffiffii'.repeat(2),41:'iffffff',42:'iffffff'.repeat(2),43:'iffffff'.repeat(2),44:'iffif',45:'iffif'.repeat(2),46:'iffffi',47:'iffffi'.repeat(2),48:'ffffffffi'.repeat(2),49:'ffffffffi',50:'ffffffi'.repeat(2),51:'ffffffi',52:'fffffff',53:'iiifffff',54:'ifffifff',55:'ffffffffi'.repeat(2),56:'ffffffffi',57:'ffffffffff'.repeat(2),58:'ffffffffff',59:'ffffff'.repeat(2),60:'ffffff'};
test('all 61 algorithms have valid controls and extended wire signatures match the protocol',()=>{
 assert.equal(Object.keys(FX_SCHEMAS).length,61);
 for(const [algorithm,signature] of Object.entries(signatures))assert.equal(defaultFxParameters(Number(algorithm)).map(p=>p.type).join(''),signature,algorithm);
 for(const [id,s] of Object.entries(FX_SCHEMAS)){
  const algorithm=Number(id),initial=defaultFxParameters(algorithm);assert.ok(canEditFx({slot:1,algorithm,parameters:initial}),id);
  for(const end of [0,1]){
   const tokens=s.parameters.map((p,i)=>p.scale==='enum'?(FX_NATIVE_OPTIONS[`${id}:${i}`]??p.options)[end?p.options.length-1:0]!:String(end?p.hi:p.lo));
   const decoded=decodeNativeFx(1,algorithm,tokens);assert.ok(canEditFx(decoded),id);
   decoded.parameters.forEach((p,i)=>assert.ok(Math.abs(fxFromWire(s.parameters[i]!,p.value)-(s.parameters[i]!.scale==='enum'?end?(s.parameters[i] as {options:string[]}).options.length-1:0:Number(tokens[i])))<1e-6,id+':'+i));
   assert.throws(()=>decodeNativeFx(1,algorithm,[...tokens,'1']),/nombre|remplissage/);
  }
 }
});
test('native aliases cover X-Air Edit conventions without accepting unknown enum tokens',()=>{
 const tokens=(id:number)=>FX_SCHEMAS[id]!.parameters.map(p=>p.scale==='enum'?p.options[0]!:String(p.lo));
 let t=tokens(33);t[3]='0';assert.equal(decodeNativeFx(1,33,t).parameters[3]!.value,0);
 t=tokens(35);t[2]='1000';assert.equal(decodeNativeFx(1,35,t).parameters[2]!.value,4);
 t=tokens(17);t[12]='ON';assert.equal(decodeNativeFx(1,17,t).parameters[12]!.value,1);
 t=tokens(32);t[5]='MALE';assert.equal(decodeNativeFx(1,32,t).parameters[5]!.value,1);
 t=tokens(39);t[28]='GRB';assert.equal(decodeNativeFx(1,39,t).parameters[28]!.value,1);
 t[28]='UNKNOWN';assert.throws(()=>decodeNativeFx(1,39,t),/option inconnue/);
});
