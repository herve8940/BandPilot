export const CONNECTION_TYPES=['micro','di','line'] as const;
export type TechInput={connection?:typeof CONNECTION_TYPES[number];phantom?:boolean;stereoWith?:number};
export type StagePosition={column:number;row:number};
export type TechRider={inputs?:Record<string,TechInput>;positions?:Record<string,StagePosition>};
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
