import {compileNativeScene} from './native-scene.js';
import {decodeNativeFx} from './native-fx.js';
import {validateWire,type Value} from './parameters.js';

export function nativeSceneSettings(text:unknown,model:string){
 if(!['XR18','MR18','X18'].includes(model))throw Error('Rappel .scn disponible pour XR18, MR18 et X18 uniquement.');
 const plan=compileNativeScene(text),values:Record<string,Value>={},omitted:string[]=[];
 for(const c of plan.commands){
  // X-AIR Edit includes eight placeholder gains with no physical control on these
  // models. Preserve them in the original file and report the omission in preview.
  if(/^\/headamp\/(1[7-9]|2[0-4])\/gain$/.test(c.address)){omitted.push(c.address);continue;}
  values[c.address]=validateWire(c.address,c.value);
 }
 return {plan,values,omitted};
}
export function nativeSceneForRecall(text:unknown,model:string){
 const {plan,values,omitted}=nativeSceneSettings(text,model);
 const fx=plan.opaqueFx.map(node=>{
  const slot=Number(node.address.split('/')[2]),algorithm=values[`/fx/${slot}/type`];
  if(typeof algorithm!=='number')throw Error(`FX ${slot} : type d’effet absent du fichier .scn.`);
  return decodeNativeFx(slot,algorithm,node.tokens);
 }).sort((a,b)=>a.slot-b.slot);
 for(let slot=1;slot<=4;slot++)if(Object.hasOwn(values,`/fx/${slot}/type`)&&!fx.some(f=>f.slot===slot))throw Error(`FX ${slot} : paramètres absents du fichier .scn.`);
 if(!Object.keys(values).length)throw Error('Aucun réglage .scn applicable à ce modèle.');
 return {values,fx,omitted};
}
