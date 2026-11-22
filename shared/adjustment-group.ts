import {MIXER_MODELS,type MixerModelId} from './mixer-models.js';

export const GROUP_TARGETS={fader:'Faders de façade',send:'Niveaux vers un retour',eq:'Gain d’une bande EQ',compressor:'Seuil du compresseur',gate:'Seuil du gate'} as const;
export type GroupSelection={channels:number[];target:keyof typeof GROUP_TARGETS;bus?:number;band?:number};
export type AdjustmentGroup=GroupSelection&{id:string;model:MixerModelId;name:string;revision:number};
export const GROUP_CONFLICT='Ce groupe a changé ailleurs. Recharge la liste avant de l’enregistrer ou de le supprimer.';
export function groupModel(value:unknown){
 const model=typeof value==='string'?MIXER_MODELS[value as MixerModelId]:undefined;
 if(!model||model.family!=='xair')throw Error('Les groupes mémorisés nécessitent un modèle X-Air / M-Air pris en charge.');
 return model;
}
/** Describes a reusable selection, never saved audio values or a gain offset. */
export function groupSelection(model:unknown,input:unknown):GroupSelection{
 const m=groupModel(model),v=input as GroupSelection;
 if(!v||!Array.isArray(v.channels)||v.channels.length<2||v.channels.length>m.channels||new Set(v.channels).size!==v.channels.length||v.channels.some(n=>!Number.isInteger(n)||n<1||n>m.channels))throw Error('Choisis au moins deux entrées disponibles.');
 if(!Object.hasOwn(GROUP_TARGETS,v.target))throw Error('Réglage de groupe invalide.');
 if(v.target==='send'&&(!Number.isInteger(v.bus)||v.bus!<1||v.bus!>m.monitorOutputs))throw Error('Sortie de retour absente sur ce modèle');
 if(v.target==='eq'&&(!Number.isInteger(v.band)||v.band!<1||v.band!>4))throw Error('Choisis une bande EQ de 1 à 4.');
 return {channels:[...v.channels].sort((a,b)=>a-b),target:v.target,...(v.target==='send'?{bus:v.bus}:{}),...(v.target==='eq'?{band:v.band}:{})};
}
