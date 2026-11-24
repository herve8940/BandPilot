import {BATCH_SETTINGS,type BatchSetting} from './batch-edit.js';
import {MIXER_MODELS,type MixerModelId} from './mixer-models.js';

export const SURFACE_COLUMNS=12,SURFACE_ROWS=10,SURFACE_LIMIT=12,WIDGET_LIMIT=30;
export const SURFACE_WIDGETS=['fader','mute','send','meter','channel','title','parameter','group','command'] as const;
export type SurfaceWidgetKind=typeof SURFACE_WIDGETS[number];
export type SurfaceWidget={
 id:string;kind:SurfaceWidgetKind;label:string;channel:number;bus:number;
 x:number;y:number;width:number;height:number;
 setting?:Exclude<BatchSetting,'tap'>;band?:number;members?:number[];mix?:number;
 strip?:string;commandId?:string;
};
export type ExpertSurface={id:string;name:string;widgets:SurfaceWidget[]};
export type ExpertSurfaces={model:MixerModelId;revision:number;surfaces:ExpertSurface[]};
export const SURFACE_INVALID='Surface invalide. Vérifie les dimensions, les canaux et les emplacements.';
export const SURFACE_CONFLICT='Une autre fenêtre a enregistré les surfaces. Recharge la liste avant de reprendre.';
export const SURFACE_OVERLAP='Deux éléments se chevauchent. Déplace ou redimensionne un élément.';
const integer=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isInteger(n)&&n>=min&&n<=max;
const validId=(v:unknown)=>typeof v==='string'&&/^[a-z0-9-]{1,64}$/.test(v);
export function surfaceModel(input:unknown){
 if(typeof input!=='string'||!Object.hasOwn(MIXER_MODELS,input)||MIXER_MODELS[input as MixerModelId].family!=='xair')throw Error(SURFACE_INVALID);
 return MIXER_MODELS[input as MixerModelId];
}
export function surfaceStripIds(model:string){
 const m=surfaceModel(model);
 return [...Array.from({length:m.channels},(_,i)=>'ch'+(i+1)),'aux',...Array.from({length:m.fxSlots},(_,i)=>'rtn'+(i+1)),...Array.from({length:m.buses},(_,i)=>'bus'+(i+1)),...Array.from({length:m.fxSlots},(_,i)=>'fxs'+(i+1)),...Array.from({length:m.dca},(_,i)=>'dca'+(i+1)),'lr'];
}
export function surfaceStripAllowed(model:string,kind:SurfaceWidgetKind,strip:string){
 if(!surfaceStripIds(model).includes(strip))return false;
 if(kind==='send')return /^(ch\d+|aux|rtn\d+)$/.test(strip);
 if(kind==='meter')return !strip.startsWith('dca');
 if(kind==='channel')return !/^(dca|fxs)/.test(strip);
 return kind==='fader'||kind==='mute';
}
export function widgetsOverlap(a:SurfaceWidget,b:SurfaceWidget){
 return a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
}

export function validateSurfaces(input:unknown):ExpertSurfaces{
 const v=input as ExpertSurfaces;
 if(!v||!Number.isSafeInteger(v.revision)||v.revision<0||!Array.isArray(v.surfaces)||v.surfaces.length>SURFACE_LIMIT)throw Error(SURFACE_INVALID);
 const model=surfaceModel(v.model);
 const surfaces=v.surfaces.map(surface=>{
  if(!surface||!validId(surface.id)||typeof surface.name!=='string'||!surface.name.trim()||surface.name.length>48||!Array.isArray(surface.widgets)||surface.widgets.length>WIDGET_LIMIT)throw Error(SURFACE_INVALID);
  const widgets=surface.widgets.map((w:SurfaceWidget)=>{
   if(!w||!validId(w.id)||!SURFACE_WIDGETS.includes(w.kind)||typeof w.label!=='string'||w.label.length>48||
     !integer(w.channel,0,model.channels)||!integer(w.bus,1,model.monitorOutputs)||
     (['send','channel','parameter','group'].includes(w.kind))&&w.channel===0||
     !integer(w.width,2,SURFACE_COLUMNS)||!integer(w.height,['fader','send','group'].includes(w.kind)?2:1,SURFACE_ROWS)||
     !integer(w.x,0,SURFACE_COLUMNS-w.width)||!integer(w.y,0,SURFACE_ROWS-w.height))throw Error(SURFACE_INVALID);
   if(w.kind==='parameter'&&(!w.setting||!Object.hasOwn(BATCH_SETTINGS,w.setting)||String(w.setting)==='tap'||!integer(w.band,1,4)))throw Error(SURFACE_INVALID);
   if(w.kind==='group'&&(!Array.isArray(w.members)||w.members.length<2||new Set(w.members).size!==w.members.length||w.members.some(c=>!integer(c,1,model.channels))||!integer(w.mix,0,model.monitorOutputs)))throw Error(SURFACE_INVALID);
   if(w.strip!==undefined&&(typeof w.strip!=='string'||!surfaceStripAllowed(model.id,w.kind,w.strip)))throw Error(SURFACE_INVALID);
   if(w.kind==='command'&&(typeof w.commandId!=='string'||!validId(w.commandId)))throw Error(SURFACE_INVALID);
   const {id,kind,label,channel,bus,x,y,width,height}=w;
   return {id,kind,label:label.trim(),channel,bus,x,y,width,height,...(w.strip!==undefined?{strip:w.strip}:{}),...(kind==='command'?{commandId:w.commandId!}:{}),...(kind==='parameter'?{setting:w.setting!,band:w.band!}:{}),...(kind==='group'?{members:[...w.members!].sort((a,b)=>a-b),mix:w.mix!}:{})};
  });
  if(new Set(widgets.map(w=>w.id)).size!==widgets.length)throw Error(SURFACE_INVALID);
  if(widgets.some((w,i)=>widgets.slice(0,i).some(other=>widgetsOverlap(w,other))))throw Error(SURFACE_OVERLAP);
  return {id:surface.id,name:surface.name.trim(),widgets};
 });
 if(new Set(surfaces.map(s=>s.id)).size!==surfaces.length)throw Error(SURFACE_INVALID);
 return {model:model.id,revision:v.revision,surfaces};
}

export const SURFACE_FILE_LIMIT=900000;
export function surfaceFile(input:ExpertSurfaces){const data=validateSurfaces(input);return {format:'bandpilot-surfaces',version:data.surfaces.some(s=>s.widgets.some(w=>w.strip!==undefined||w.kind==='command'))?2:1,model:data.model,surfaces:data.surfaces};}
export function parseSurfaceFile(text:string,model:string){
 if(text.length>SURFACE_FILE_LIMIT)throw Error(SURFACE_INVALID);
 let file;try{file=JSON.parse(text);}catch{throw Error(SURFACE_INVALID);}
 if(file?.format!=='bandpilot-surfaces'||![1,2].includes(file.version)||file.model!==model)throw Error(SURFACE_INVALID);
 return validateSurfaces({model,revision:0,surfaces:file.surfaces}).surfaces;
}
