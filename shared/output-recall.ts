import {MIXER_MODELS} from './mixer-models.js';
import {presetSection} from './channel-preset.js';
export const OUTPUT_SECTIONS=['eq','compressor','levels','labels'] as const;
export type OutputSection=typeof OUTPUT_SECTIONS[number];
export const OUTPUT_LABELS:Record<OutputSection,string>={eq:'Égaliseur de sortie',compressor:'Compresseur',levels:'Volumes et mutes',labels:'Noms et couleurs'};
export type OutputScope={targets:string[];sections:OutputSection[];fxSlots:number[];perTarget?:Record<string,OutputSection[]>};
export type OutputRule={target:string;sections:(OutputSection|'fx')[]};
export type OutputProtections={model:string;revision:number;rules:OutputRule[]};
export function outputTargets(model:string){
 const m=MIXER_MODELS[model as keyof typeof MIXER_MODELS];if(!m||m.family!=='xair')throw Error('Cette opération nécessite une console X-Air / M-Air.');
 return [...Array.from({length:m.monitorOutputs},(_,i)=>({id:`/bus/${i+1}`,label:`Bus ${i+1}`})),{id:'/lr',label:'Main'},...Array.from({length:4},(_,i)=>({id:`/rtn/${i+1}`,label:`Retour FX ${i+1}`}))];
}
export function outputSection(path:string):OutputSection|null{
 if(/^eq\/(on|mode|[1-6]\/(type|f|g|q))$/.test(path)||/^geq\/[^/]+$/.test(path))return 'eq';
 if(presetSection(path)==='compressor')return 'compressor';
 if(/^mix\/(on|fader)$/.test(path))return 'levels';
 if(/^config\/(name|color)$/.test(path))return 'labels';return null;
}
export function outputRules(model:string,input:unknown):OutputRule[]{
 const ids=[...outputTargets(model).map(t=>t.id),...Array.from({length:4},(_,i)=>`fx:${i+1}`)],v=input as OutputRule[];
 if(!Array.isArray(v)||v.length>ids.length||new Set(v.map(r=>r?.target)).size!==v.length||v.some(r=>!r||!ids.includes(r.target)||!Array.isArray(r.sections)||!r.sections.length||new Set(r.sections).size!==r.sections.length||r.sections.some(s=>!(r.target.startsWith('fx:')?['fx']:OUTPUT_SECTIONS as readonly string[]).includes(s))))throw Error('Protections des sorties invalides.');
 return ids.flatMap(target=>{const r=v.find(r=>r.target===target);return r?[{target,sections:(target.startsWith('fx:')?['fx'] as const:OUTPUT_SECTIONS).filter(s=>r.sections.includes(s))}]:[];});
}
