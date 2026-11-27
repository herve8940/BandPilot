import {FX_NAMES} from '../../shared/fx-parameters';

type Layout = 'sliders' | 'display' | 'keys' | 'equalizer' | 'compressor' | 'knobs' | 'amp' | 'split';
type RackModel = {layout:Layout; metal:string; ink:string; accent:string; controls:number[]};
const model = (layout:Layout, metal:string, ink:string, accent:string, ...controls:number[]):RackModel =>
  ({layout, metal, ink, accent, controls});
const hall = model('sliders','#c6bb9e','#25221e','#ff755e',0,1,2,3,4,5);
const plate = model('display','#343d49','#f4f7fc','#87d7ff',0,1,2,3,4,7);
const delay = model('display','#343634','#f5f5e8','#97eab1',1,9,10,0,6,7);
const tape = model('display','#393f3a','#f4f6ee','#a9ed8b',0,3,6,9);
const eq = model('equalizer','#354241','#ebf9ec','#a4ecc3');
const deEss = model('knobs','#536979','#f2fbff','#ace4f0',0,1,2,3,4);
const program = model('knobs','#3e657b','#f8fcff','#cfefff',2,3,4,5,6,7,8,9);
const midrange = model('knobs','#395769','#f2f9ff','#b0e3e8',2,3,4,5,6,7);
const fair = model('compressor','#4e524a','#f6f2d8','#eac27a',1,2,3,4,5,6);
const leisure = model('compressor','#b0ac9f','#25231f','#ffdc94',1,2,3,4);
const ultimo = model('compressor','#343838','#f7f2e7','#ffce80',1,2,3,4,5);
const multi = model('split','#394557','#eef5ff','#88c8ed',2,3,4,10,11,12);
const enhancer = model('knobs','#494e59','#f3f7ff','#c3cfff',2,3,4,5,6,7);
const exciter = model('knobs','#563d47','#f9edf2','#ffbcce',0,1,2,3,4,5);
const amp = model('amp','#735234','#fff1ce','#ffd28b',0,2,3,4,5,6,7);
const tube = model('amp','#513f3a','#fff0de','#ffbb79',0,1,2,3,6,8);
const pitch = model('display','#384764','#eff7ff','#b4d6ff',0,1,2,3,4,5);
const combo = model('split','#384450','#f0f8ff','#99e2db',0,3,5,6,7,8);
const chorusReverb = model('split','#41465c','#edf0ff','#b8ccff',0,1,5,6,7,8);
const flangerReverb = model('split','#414858','#f2f4ff','#b4e3ee',0,1,5,6,7,8);
const catalog:Record<string,RackModel> = {
 HALL:hall, AMBI:hall, RPLT:hall, ROOM:hall, CHAM:hall, PLAT:plate,
 VREV:model('sliders','#585854','#fff6e8','#ffd3a2',0,1,8,9,2,5),
 VRM:model('display','#424142','#fff1e3','#ffa67d',0,1,2,3,4,5),
 GATE:model('display','#37454a','#ecffff','#a0f4db',0,1,2,3,4,5),
 RVRS:model('display','#4f424e','#fff0fb','#ffc3e6',0,1,2,3,4,5),
 DLY:delay, '3TAP':tape,'4TAP':model('display','#4e4644','#fff9e8','#ffca8a',0,2,6,8,10),
 CRS:model('knobs','#365965','#eafaff','#81dfee',0,1,2,3,4,5),
 FLNG:model('knobs','#4c4c67','#f3f2ff','#c0affe',0,1,2,3,4,11),
 PHAS:model('knobs','#774b31','#fff0d9','#ffd395',0,1,2,3,4,5),
 DIMC:model('keys','#333435','#f1eee4','#edd694',3,4,5,6,0,1,2),
 FILT:model('knobs','#454f3f','#edffe6','#c5ed95',0,1,2,3,4,5),
 ROTA:model('amp','#654d38','#fff1db','#efc07c',0,1,2,3,6,7),
 PAN:model('knobs','#425568','#eff8ff','#9bd9ff',0,1,2,3,4,5),
 SUB:model('knobs','#534750','#f7edf6','#eab0d9',0,1,2,3,4),
 'D/RV':combo,'CR/R':chorusReverb,'FL/R':flangerReverb,'D/CR':combo,'D/FL':combo,
 MODD:model('split','#343c3c','#f1f8f0','#a2ed9d',0,2,5,6,8,9),
 GEQ2:eq,GEQ:eq,TEQ2:eq,TEQ:eq,DES2:deEss,DES:deEss,
 P1A:program,P1A2:program,PQ5:midrange,PQ5S:midrange,
 WAVD:model('knobs','#52656b','#efffff','#b1e3e8',0,1,2),
 LIM:model('display','#37435a','#edf6ff','#91c7ff',0,1,2,3,4,5),
 CMB:multi,CMB2:multi,FAC:fair,FAC1M:fair,FAC2:fair,LEC:leisure,LEC2:leisure,
 ULC:ultimo,ULC2:ultimo,ENH2:enhancer,ENH:enhancer,EXC2:exciter,EXC:exciter,
 IMG:model('knobs','#405957','#f0fff8','#9ee4cc',0,1,2,3,4,5),
 EDI:model('knobs','#4d5362','#eaf2ff','#bcd5fd',1,2,3,4,5,6),
 SON:model('knobs','#6a4744','#fff1ea','#ffba9f',0,1,2,3),
 AMP2:amp,AMP:amp,DRV2:tube,DRV:tube,PIT2:pitch,PIT:pitch,
};
export const rackModel=(algorithm:number)=>catalog[FX_NAMES[algorithm]??''];
