import {MIXER_MODELS,type MixerModelId} from './mixer-models.js';
import {SCENE_RECALL_SECTIONS,type SceneRecallSection} from './scene-recall.js';

export type SceneProtection={channel:number;sections:SceneRecallSection[]};
export type SceneProtections={model:MixerModelId;revision:number;rules:SceneProtection[]};
export const PROTECTION_CONFLICT='Les protections ont changé. Recharge-les puis recommence.';
export const PROTECTION_INVALID='Protections invalides pour ce modèle de console.';
export const PROTECTION_FULL='Des protections de scène sont actives. Utilise le rappel sélectif ou retire explicitement les protections avant un rappel complet, ReaCue ou PC → Table.';
export const PROTECTION_NOTICE='Les cases cochées conservent les réglages actuels des entrées de destination lors des rappels sélectifs et de leur annulation. Sur une paire liée, la famille est protégée des deux côtés. Les rappels complets (y compris les scènes ReaCue) et PC → Table sont bloqués tant qu’une protection est active.';
export const PROTECTION_SCOPE='Ces choix sont mémorisés pour ce modèle dans cette installation de BandPilot, en réel comme en simulation. Ils ne verrouillent pas les réglages manuels, les presets, les réglages groupés ou les autres applications.';
export function protectionModel(model:unknown){
 const m=typeof model==='string'&&Object.hasOwn(MIXER_MODELS,model)?MIXER_MODELS[model as MixerModelId]:undefined;
 if(!m||m.family!=='xair')throw Error(PROTECTION_INVALID);return m;
}
export function protectionRules(model:unknown,input:unknown):SceneProtection[]{
 const m=protectionModel(model),rules=input as SceneProtection[];
 if(!Array.isArray(rules)||rules.length>m.channels||rules.some(r=>!r||typeof r!=='object'||Object.keys(r).some(k=>!['channel','sections'].includes(k))||!Number.isInteger(r.channel)||r.channel<1||r.channel>m.channels||!Array.isArray(r.sections)||!r.sections.length||r.sections.some(s=>!SCENE_RECALL_SECTIONS.includes(s))||new Set(r.sections).size!==r.sections.length)||new Set(rules.map(r=>r.channel)).size!==rules.length)throw Error(PROTECTION_INVALID);
 return rules.map(r=>({channel:r.channel,sections:SCENE_RECALL_SECTIONS.filter(s=>r.sections.includes(s))})).sort((a,b)=>a.channel-b.channel);
}
