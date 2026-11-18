/** X-Air native scene units → typed OSC values. Protocol ranges/enumerations checked
 * against XAirSetScene (XAir_fxparse1.c, Patrick-Gilles Maillot / Ken Mitchell).
 * This declarative codec is independent of that implementation. Unknown algorithms
 * remain archives; they must never be treated as already-normalized OSC values. */
type Field={scale:'linear'|'log';lo:number;hi:number}|{scale:'enum';options:string[];aliases?:Record<string,string>};
const lin=(lo:number,hi:number):Field=>({scale:'linear',lo,hi});
const log=(lo:number,hi:number):Field=>({scale:'log',lo,hi});
const list=(options:string[],aliases?:Record<string,string>):Field=>({scale:'enum',options,aliases});
const factor=list(['1/4','3/8','1/2','2/3','1','4/3','3/2','2','3']);
const reverb=(size:number,shape:number,reflection=false):Field[]=>[
 lin(0,200),log(.3,29),lin(4,size),log(1000,20000),lin(0,100),lin(-12,12),
 log(10,500),log(200,20000),log(.25,4),lin(0,50),lin(0,shape),lin(0,100),
 lin(0,reflection?500:1200),lin(0,reflection?500:1200),lin(reflection?0:-100,100),lin(reflection?0:-100,100),
];
const hallPlate=(plate:boolean):Field[]=>[
 lin(0,200),log(plate?.5:.2,plate?10:5),lin(2,100),log(1000,20000),lin(1,30),lin(-12,12),
 log(10,500),log(200,20000),log(.5,2),plate?log(10,500):lin(0,50),lin(0,plate?50:250),lin(0,100),
];
const fields:Record<number,Field[]>={
 0:hallPlate(false),
 1:[lin(0,200),log(.2,7.3),lin(2,100),log(1000,20000),lin(1,30),lin(-12,12),log(10,500),log(200,20000),lin(0,100),lin(0,100)],
 2:reverb(39,100),3:reverb(76,250),4:reverb(76,250,true),5:hallPlate(true),
 10:[lin(0,100),lin(1,3000),list(['ST','X','M']),factor,factor,lin(-100,100),log(10,500),log(200,20000),log(10,500),lin(0,100),lin(0,100),log(200,20000)],
 26:[lin(1,3000),list(['1','1/2','2/3','3/2']),lin(0,100),log(10,500),log(200,20000),lin(0,100),log(.05,10),list(['PAR','SER']),list(['AMB','CLUB','HALL'],{SML:'CLUB',LRG:'HALL'}),lin(1,10),log(1000,20000),lin(-100,100),lin(0,100)],
};
export function decodeNativeFx(slot:number,algorithm:number,tokens:string[]){
 const schema=fields[algorithm];
 if(!schema)throw Error(`FX ${slot} : cet algorithme .scn n’est pas encore pris en charge. Le fichier reste exportable pour X-AIR Edit.`);
 if(tokens.length<schema.length||tokens.length>64||tokens.slice(schema.length).some(t=>!/^[-+]?0+(?:\.0+)?$/.test(t)))throw Error(`FX ${slot} : nombre de paramètres ou remplissage .scn invalide.`);
 const parameters=schema.map((field,i):{type:'f'|'i';value:number}=>{
  const token=tokens[i]!;
  if(field.scale==='enum'){
   const word=token.toUpperCase(),value=field.options.indexOf(field.aliases?.[word]??word);
   if(value<0)throw Error(`FX ${slot}, paramètre ${i+1} : option inconnue (${token}).`);
   return {type:'i',value};
  }
  const text=/^\d+[kK]\d*$/.test(token)?String(Number(token.toLowerCase().replace('k','.'))*1000):token;
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))throw Error(`FX ${slot}, paramètre ${i+1} : nombre invalide.`);
  const v=Number(text);
  if(!Number.isFinite(v)||v<field.lo||v>field.hi)throw Error(`FX ${slot}, paramètre ${i+1} : valeur hors plage.`);
  return {type:'f',value:field.scale==='log'?Math.log(v/field.lo)/Math.log(field.hi/field.lo):(v-field.lo)/(field.hi-field.lo)};
 });
 return {slot,algorithm,parameters};
}
