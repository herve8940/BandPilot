import {batchPath,batchUsesBand,BATCH_SETTINGS,type BatchSetting} from './batch-edit.js';
import {surfaceModel} from './expert-surfaces.js';
export type ParameterLink={channels:number[];setting:Exclude<BatchSetting,'tap'>;band:number};
export type ParameterLinksDefinition={model:string;revision:number;links:ParameterLink[]};
export const LINKS_INVALID='Définition des liens de pistes invalide.';
export const LINKS_CONFLICT='Les liens ont été modifiés sur un autre écran. Recharge-les avant de les enregistrer.';
export const LINKS_EXPIRED='Liens désactivés ou connexion modifiée. Réactive-les explicitement.';
export function validateParameterLinks(input:unknown):ParameterLinksDefinition{
 const d=input as ParameterLinksDefinition;
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!['model','revision','links'].includes(k))||!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.links)||d.links.length>32)throw Error(LINKS_INVALID);
 const model=surfaceModel(d.model),used=new Set<string>();
 const links=d.links.map(link=>{
  if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(k=>!['channels','setting','band'].includes(k))||!Object.hasOwn(BATCH_SETTINGS,link.setting)||String(link.setting)==='tap'||!Number.isInteger(link.band)||link.band<1||link.band>4||!Array.isArray(link.channels)||link.channels.length<2||new Set(link.channels).size!==link.channels.length||link.channels.some(c=>!Number.isInteger(c)||c<1||c>model.channels))throw Error(LINKS_INVALID);
  const channels=[...link.channels].sort((a,b)=>a-b);
  for(const c of channels){const key=c+'/'+batchPath(link.setting,1,link.band);if(used.has(key))throw Error(LINKS_INVALID);used.add(key);}
  return {channels,setting:link.setting,band:link.band};
 });
 return {model:model.id,revision:d.revision,links};
}

/** Temporary relative edits share the controller lease, never the saved definitions. */
export const QUICK_SCOPES={eq:'Égaliseur',thresholds:'Seuils de dynamique',pan:'Position stéréo',hpf:'Coupe-bas (Hz)'} as const;
export type QuickScope=keyof typeof QUICK_SCOPES;
export type QuickSelection={scope:QuickScope;channels:number[]};
export function quickDefinition(model:string,revision:number,quick:QuickSelection):ParameterLinksDefinition{
 if(!quick||!Object.hasOwn(QUICK_SCOPES,quick.scope))throw Error(LINKS_INVALID);
 const settings:ParameterLink['setting'][]=quick.scope==='eq'?['eqGain','eqFrequency','eqQ']:quick.scope==='thresholds'?['gateThreshold','compressorThreshold']:[quick.scope];
 const links=settings.flatMap(setting=>(batchUsesBand(setting)?[1,2,3,4]:[1]).map(band=>({channels:quick.channels,setting,band})));
 return validateParameterLinks({model,revision,links});
}
