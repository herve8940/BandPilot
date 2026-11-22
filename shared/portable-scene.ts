import {MIXER_MODELS,type MixerModelId} from './mixer-models.js';

export const PORTABLE_FORMAT='bandpilot-portable-scene';
export const PORTABLE_SECTIONS=['labels','levels','eq'] as const;
export type PortableSection=typeof PORTABLE_SECTIONS[number];
export const PORTABLE_LABELS:Record<PortableSection,string>={labels:'Noms et couleurs',levels:'Faders, mutes et panoramas',eq:'EQ et coupe-bas'};
export const PORTABLE_INVALID='Scène portable invalide ou format non reconnu.';
export const PORTABLE_MODEL='Les scènes portables sont disponibles pour Behringer X-Air et Midas M-Air.';
export const PORTABLE_LINKED='Le rappel portable exige des pistes mono indépendantes à la source et à destination.';
export const PORTABLE_CHANGED='Les liaisons ou les sources ont changé. Prépare à nouveau le rappel ou la restauration.';
export const PORTABLE_SCOPE='Choisis des familles de réglages et des destinations distinctes.';
export type PortableEqBand={type:typeof FILTER_TYPES[number];hz:number;db:number;q:number};
export type PortableTrack={
 channel:number;linked:boolean;name?:string;color?:number;levelDb?:number;muted?:boolean;pan?:number;
 highPass?:{enabled:boolean;hz:number};eq?:{enabled:boolean;bands:PortableEqBand[]};
};
export type PortableScene={format:typeof PORTABLE_FORMAT;version:1;source:MixerModelId;tracks:PortableTrack[]};
const FILTER_TYPES=['low-cut','low-shelf','bell','vintage-bell','high-shelf','high-cut'] as const;
export const PORTABLE_FILTERS=FILTER_TYPES;
type Plain=Record<string,unknown>;
const object=(v:unknown,fields:readonly string[]):v is Plain=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>fields.includes(k));
const between=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const optional=(v:unknown,check:(x:unknown)=>boolean)=>v===undefined||check(v);

export function portableModel(input:unknown){
 const model=typeof input==='string'&&Object.hasOwn(MIXER_MODELS,input)?MIXER_MODELS[input as MixerModelId]:undefined;
 if(model?.family!=='xair')throw Error(PORTABLE_MODEL);
 return model;
}

export function validatePortableScene(input:unknown):PortableScene{
 if(!object(input,['format','version','source','tracks'])||input.format!==PORTABLE_FORMAT||input.version!==1||!Array.isArray(input.tracks))throw Error(PORTABLE_INVALID);
 const source=portableModel(input.source);
 if(!input.tracks.length||input.tracks.length>source.channels)throw Error(PORTABLE_INVALID);
 const tracks:PortableTrack[]=input.tracks.map((row:unknown)=>{
  if(!object(row,['channel','linked','name','color','levelDb','muted','pan','highPass','eq'])||
    !between(row.channel,1,source.channels)||!Number.isInteger(row.channel)||typeof row.linked!=='boolean'||
    !optional(row.name,n=>typeof n==='string'&&new TextEncoder().encode(n).length<=12&&!/[\x00-\x1f\x7f]/.test(n))||
    !optional(row.color,n=>between(n,0,15)&&Number.isInteger(n))||
    !optional(row.levelDb,n=>between(n,-90,10))||!optional(row.pan,n=>between(n,-100,100))||
    !optional(row.muted,n=>typeof n==='boolean')||
    !optional(row.highPass,n=>object(n,['enabled','hz'])&&typeof n.enabled==='boolean'&&between(n.hz,20,400))||
    !optional(row.eq,n=>object(n,['enabled','bands'])&&typeof n.enabled==='boolean'&&Array.isArray(n.bands)&&n.bands.length===4&&n.bands.every(b=>
     object(b,['type','hz','db','q'])&&FILTER_TYPES.includes(b.type as PortableEqBand['type'])&&between(b.hz,20,20000)&&between(b.db,-15,15)&&between(b.q,.3,10)))||
    !['name','color','levelDb','muted','pan','highPass','eq'].some(key=>row[key]!==undefined))throw Error(PORTABLE_INVALID);
   return structuredClone(row) as PortableTrack;
 });
 if(new Set(tracks.map(track=>track.channel)).size!==tracks.length)throw Error(PORTABLE_INVALID);
 return {format:PORTABLE_FORMAT,version:1,source:source.id,tracks:tracks.sort((a,b)=>a.channel-b.channel)};
}
