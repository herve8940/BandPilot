/** X-Air native scene units → typed OSC values. Protocol ranges/enumerations checked
 * against XAirSetScene (XAir_fxparse1.c, Patrick-Gilles Maillot / Ken Mitchell).
 * This declarative codec is independent of that implementation. Unknown algorithms
 * remain archives; they must never be treated as already-normalized OSC values. */
import {FX_SCHEMAS, FX_NATIVE_OPTIONS, fxToWire} from '../shared/fx-parameters.js';
export function decodeNativeFx(slot:number,algorithm:number,tokens:string[]){
 const schema=FX_SCHEMAS[algorithm]?.parameters;
 if(!schema)throw Error(`FX ${slot} : cet algorithme .scn n’est pas encore pris en charge. Le fichier reste exportable pour X-AIR Edit.`);
 if(tokens.length<schema.length||tokens.length>64||tokens.slice(schema.length).some(t=>!/^[-+]?0+(?:\.0+)?$/.test(t)))throw Error(`FX ${slot} : nombre de paramètres ou remplissage .scn invalide.`);
 const parameters=schema.map((field,i):{type:'f'|'i';value:number}=>{
  const token=tokens[i]!;
  if(field.scale==='enum'){
   const word=token.toUpperCase(),options=FX_NATIVE_OPTIONS[`${algorithm}:${i}`]??field.options;
   const alias=algorithm===26&&i===8?({SML:'CLUB',LRG:'HALL'} as Record<string,string>)[word]:undefined;
   const value=options.map(o=>o.toUpperCase()).indexOf(field.aliases?.[word]??alias??word);
   if(value<0)throw Error(`FX ${slot}, paramètre ${i+1} : option inconnue (${token}).`);
   return {type:'i',value};
  }
  const text=/^\d+[kK]\d*$/.test(token)?String(Number(token.toLowerCase().replace('k','.'))*1000):token;
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))throw Error(`FX ${slot}, paramètre ${i+1} : nombre invalide.`);
  const v=Number(text);
  if(!Number.isFinite(v)||v<field.lo||v>field.hi)throw Error(`FX ${slot}, paramètre ${i+1} : valeur hors plage.`);
  return fxToWire(field,v);
 });
 return {slot,algorithm,parameters};
}
