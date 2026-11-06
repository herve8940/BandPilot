export const CONNECTION_TYPES=['micro','di','line'] as const;
export const STAND_TYPES=['none','short','tall','clip'] as const;
export const EQUIPMENT_PROVIDERS=['band','venue'] as const;
export type TechInput={connection?:typeof CONNECTION_TYPES[number];phantom?:boolean;stereoWith?:number;microphone?:string;stand?:typeof STAND_TYPES[number];provider?:typeof EQUIPMENT_PROVIDERS[number];notes?:string};
// Keep row/column for existing riders; x/y allow free placement in the stage area.
export type StagePosition={column:number;row:number;x?:number;y?:number};
export type TechMonitor={kind?:'in-ear'|'wedge';mode?:'mono'|'stereo';equipment?:string;notes?:string;power?:boolean};
export type TechRider={
 inputs?:Record<string,TechInput>;positions?:Record<string,StagePosition>;monitors?:Record<string,TechMonitor>;
 bandName?:string;contactName?:string;contactEmail?:string;contactPhone?:string;
 eventName?:string;eventDate?:string;stageSize?:string;providedEquipment?:string;requestedEquipment?:string;notes?:string;updatedAt?:string;
};
export const TECH_TEXT_LIMITS={bandName:100,contactName:100,contactEmail:160,contactPhone:60,eventName:160,stageSize:120,providedEquipment:1200,requestedEquipment:1200,notes:1600} as const;
export function stageCoordinates(position:StagePosition|undefined,index:number){
 const row=position?.row??Math.floor(index/3),column=position?.column??index%3;
 return {x:position?.x??(column+.5)*100/3,y:position?.y??20+row*30};
}
export function stagePosition(x:number,y:number):StagePosition{
 // Leave enough space for the complete card at the edge of the stage.
 x=Math.round(Math.max(16,Math.min(84,x))*10)/10;y=Math.round(Math.max(20,Math.min(80,y))*10)/10;
 return {x,y,column:Math.min(2,Math.floor(x*3/100)),row:Math.min(2,Math.floor(y*3/100))};
}
export function validateTechRider(value:unknown,channels:Set<number>,buses:Set<number>):TechRider{
 const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const text=(v:unknown,max:number)=>{
  if(v===undefined)return undefined;
  if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v))throw Error('Texte de fiche technique invalide');
  return v.trim()||undefined;
 };
 const choice=<T extends string>(v:unknown,values:readonly T[]):T|undefined=>{
  if(v===undefined)return undefined;
  if(typeof v!=='string'||!values.includes(v as T))throw Error('Option de fiche technique invalide');
  return v as T;
 };
 const bool=(v:unknown)=>{if(v!==undefined&&typeof v!=='boolean')throw Error('Indication de fiche technique invalide');return v as boolean|undefined;};
 if(!record(value))throw Error('Fiche technique invalide');
 for(const k of ['inputs','positions','monitors'])if(value[k]!==undefined&&!record(value[k]))throw Error('Fiche technique invalide');
 const result:TechRider={inputs:{},positions:{},monitors:{}};
 for(const [key,max] of Object.entries(TECH_TEXT_LIMITS))result[key as keyof typeof TECH_TEXT_LIMITS]=text(value[key],max);
 const date=text(value.eventDate,10);
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error('Date de concert invalide');
 result.eventDate=date;
 const updated=text(value.updatedAt,30);
 if(updated&&!Number.isFinite(Date.parse(updated)))throw Error('Date de mise à jour invalide');
 result.updatedAt=updated;
 const pairs=new Set<number>();
 for(const [channel,d] of Object.entries(value.inputs??{})){
  const n=Number(channel);if(!channels.has(n)||String(n)!==channel)continue;
  if(!record(d))throw Error('Branchement invalide');
  const partner=d.stereoWith;
  if(partner!==undefined&&(!Number.isInteger(partner)||partner!==n+1))throw Error('Paire stéréo invalide');
  if(typeof partner==='number'&&channels.has(partner)){
   if(pairs.has(n)||pairs.has(partner))throw Error('Paire stéréo utilisée deux fois');
   pairs.add(n);pairs.add(partner);
  }
  result.inputs![channel]={connection:choice(d.connection,CONNECTION_TYPES),phantom:bool(d.phantom),stereoWith:typeof partner==='number'&&channels.has(partner)?partner:undefined,
   microphone:text(d.microphone,120),stand:choice(d.stand,STAND_TYPES),provider:choice(d.provider,EQUIPMENT_PROVIDERS),notes:text(d.notes,300)};
 }
 for(const [bus,p] of Object.entries(value.positions??{})){
  if(!buses.has(Number(bus))||String(Number(bus))!==bus)continue;
  if(!record(p)||!Number.isInteger(p.row)||!Number.isInteger(p.column)||Number(p.row)<0||Number(p.row)>2||Number(p.column)<0||Number(p.column)>2)throw Error('Position de scène invalide');
  if((p.x===undefined)!==(p.y===undefined)||[p.x,p.y].some(v=>v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)))throw Error('Position de scène invalide');
  result.positions![bus]={row:p.row as number,column:p.column as number,...(p.x!==undefined?{x:p.x as number,y:p.y as number}:{})};
 }
 for(const [bus,m] of Object.entries(value.monitors??{})){
  if(!buses.has(Number(bus))||String(Number(bus))!==bus)continue;
  if(!record(m))throw Error('Retour de scène invalide');
  result.monitors![bus]={kind:choice(m.kind,['in-ear','wedge']),mode:choice(m.mode,['mono','stereo']),equipment:text(m.equipment,120),notes:text(m.notes,300),power:bool(m.power)};
 }
 return result;
}
type PatchProfile={inputs:{channel:number;name:string;source:string}[];musicians?:{bus:number;name:string;channels:number[]}[];tech?:TechRider};

export function patchSignature(profile:PatchProfile){
 return JSON.stringify([
  profile.inputs.map(i=>[i.channel,i.source]).sort((a,b)=>Number(a[0])-Number(b[0])),
  (profile.musicians??[]).map(m=>[m.bus,m.name,[...new Set(m.channels)].sort((a,b)=>a-b)]).sort((a,b)=>Number(a[0])-Number(b[0])),
 ]);
}

export type PersonalPatchInput=TechInput&{channel:number;name:string};

export function personalPatch(profile:PatchProfile,bus:number,name:string):PersonalPatchInput[]{
 const musician=profile.musicians?.find(m=>m.bus===bus&&m.name===name);
 return musician?profile.inputs.filter(i=>musician.channels.includes(i.channel)).sort((a,b)=>a.channel-b.channel)
  .map(i=>({channel:i.channel,name:i.name,...profile.tech?.inputs?.[i.channel]})):[];
}
