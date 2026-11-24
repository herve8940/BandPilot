export const GEQ_KEYS='20 25 31.5 40 50 63 80 100 125 160 200 250 315 400 500 630 800 1k 1k25 1k6 2k 2k5 3k15 4k 5k 6k3 8k 10k 12k5 16k 20k'.split(' ');
export const ROOM_FREQUENCIES=[20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000];
type Sample=[number,number];
export type RoomTarget={lowDb:number;highDb:number};
export type RoomEstimate={hz:number;measured:number;target:number;estimated:number}[];
const targetError='Courbe cible invalide. Choisis des écarts de −6 à +6 dB par pas de 0,5 dB.';
export function roomTarget(raw:unknown):RoomTarget{
 if(raw===undefined)return {lowDb:0,highDb:0};
 const d=raw as RoomTarget;
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!['lowDb','highDb'].includes(k))||[d.lowDb,d.highDb].some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>6||!Number.isInteger(v*2)))throw Error(targetError);
 return {lowDb:d.lowDb,highDb:d.highDb};
}
export function roomTargetDb(hz:number,target:RoomTarget){
 return hz<=1000?target.lowDb*Math.min(1,Math.max(0,Math.log(1000/hz)/Math.log(1000/80))):target.highDb*Math.min(1,Math.max(0,Math.log(hz/1000)/Math.log(8000/1000)));
}
const frequencies=ROOM_FREQUENCIES;
const error='Mesure invalide. Fournis une courbe de réponse avec les fréquences en Hz et les niveaux en dB.';
const median=(values:number[])=>{
 const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
 return (sorted[Math.floor((n-1)/2)]!+sorted[Math.floor(n/2)]!)/2;
};
export function parseRoomCurve(text:string):Sample[]{
 if(text.length>200000)throw Error(error);
 const rows:Sample[]=[];
 for(const line of text.split(/\r?\n/)){
  const trimmed=line.trim();
  if(!/^[+\-\d.]/.test(trimmed))continue;
  const [f,v]=trimmed.split(/[\s,;]+/);
  const hz=Number(f),db=Number(v);
  if(!Number.isFinite(hz)||!Number.isFinite(db))throw Error(error);
  if(hz>=20&&hz<=20000)rows.push([hz,db]);
 }
 if(rows.length<12||rows.length>6000)throw Error(error);
 return rows;
}
export function roomCorrections(raw:unknown,peak:unknown,maxCut:number,target?:unknown){
 roomTarget(target);
 if(!Number.isFinite(maxCut)||maxCut<.5||maxCut>6||!Number.isInteger(maxCut*2))throw Error(error);
 if(peak!==undefined){
  if(raw!==undefined||target!==undefined||typeof peak!=='number'||!Number.isFinite(peak)||peak<40||peak>12500||maxCut>3)throw Error(error);
  let index=0;
  for(let i=1;i<frequencies.length;i++)if(Math.abs(Math.log(frequencies[i]!/peak))<Math.abs(Math.log(frequencies[index]!/peak)))index=i;
  return [{index,db:-maxCut}];
 }
 const {centres,baseline}=roomAnalysis(raw,target);
 return centres.flatMap(({index,db,target})=>{
  const cut=Math.min(maxCut,Math.max(0,Math.floor((db-target-baseline-2)*2)/2));
  return cut>=.5?[{index,db:-cut}]:[];
 });
}
export function roomAnalysis(raw:unknown,target?:unknown){
 const desired=roomTarget(target);
 if(!Array.isArray(raw)||raw.length<12||raw.length>6000||raw.some(row=>!Array.isArray(row)||row.length!==2||!row.every(Number.isFinite)||row[0]<20||row[0]>20000||row[1]<-160||row[1]>160))throw Error(error);
 const curve=raw as Sample[];
 const centres=frequencies.flatMap((hz,index)=>{
  if(hz<40||hz>12500)return [];
  const nearby=curve.filter(([f])=>Math.abs(Math.log2(f/hz))<=1/6).map(([,db])=>db);
  return nearby.length?[{index,hz,db:median(nearby),target:roomTargetDb(hz,desired)}]:[];
 });
 const midrange=centres.filter(({hz})=>hz>=250&&hz<=2000).map(({db,target})=>db-target);
 if(centres.length<12||midrange.length<5)throw Error(error);
 return {centres,baseline:median(midrange)};
}
