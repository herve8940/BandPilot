export type FaderBank={id:string;name:string;strips:string[];mix?:number;compactStrips?:boolean};
export function cleanBanks(value:unknown):FaderBank[]{
 if(!Array.isArray(value))return [];
 const ids=new Set<string>();return value.slice(0,12).flatMap(b=>{
  if(!b||typeof b.id!=='string'||!b.id.startsWith('bank-')||ids.has(b.id)||typeof b.name!=='string'||!b.name.trim()||!Array.isArray(b.strips))return [];
  ids.add(b.id);return [{id:b.id,name:b.name.trim().slice(0,40),strips:[...new Set<string>(b.strips.filter((s:unknown)=>typeof s==='string'))].slice(0,80),...(validMix(b.mix)?{mix:b.mix}:{}),...(b.compactStrips===true?{compactStrips:true}:{})}];
 });
}
export function moveStrip(bank:FaderBank,id:string,offset:number):FaderBank{
 const strips=[...bank.strips],i=strips.indexOf(id),j=i+offset;if(i<0||j<0||j>=strips.length)return bank;
 [strips[i],strips[j]]=[strips[j]!,strips[i]!];return {...bank,strips};
}

export function validMix(value:unknown):value is number{return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=6;}
