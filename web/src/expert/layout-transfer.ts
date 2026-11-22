import {validMix} from './fader-banks';
import {MIXER_MODELS,type MixerModelId} from '../../../shared/mixer-models';
import type {Layout} from './desk-layout';
export const LAYOUT_FILE_LIMIT=128*1024;
export const INVALID_LAYOUT='Disposition invalide, trop volumineuse ou incompatible avec ce modèle.';
export function layoutFile(model:string,screen:string,layout:Layout){return {format:'bandpilot-layout',version:1,model,screen,layout:structuredClone(layout)};}
export function parseLayoutFile(text:string,model:string,allowed:string[]):{layout:Layout;screen:string}{
 if(text.length>LAYOUT_FILE_LIMIT)throw Error(INVALID_LAYOUT);
 let input;try{input=JSON.parse(text);}catch{throw Error(INVALID_LAYOUT);}
 const l=input?.layout,ids=new Set(allowed),banks=l?.banks;
 const validIds=(value:unknown):value is string[]=>Array.isArray(value)&&value.length<=80&&new Set(value).size===value.length&&value.every(id=>typeof id==='string'&&ids.has(id));
 if(!input||input.format!=='bandpilot-layout'||input.version!==1||input.model!==model||!['small','medium','wide'].includes(input.screen)||!l||typeof l!=='object'||Array.isArray(l)||Object.keys(l).some(k=>!['hidden','outputs','density','banks','activeBank'].includes(k))||!validIds(l.hidden)||typeof l.outputs!=='boolean'||!['compact','comfortable'].includes(l.density)||!Array.isArray(banks)||banks.length>12||new Set(banks.map(b=>b?.id)).size!==banks.length||banks.some(b=>!b||typeof b.id!=='string'||!/^bank-[\w-]{1,72}$/.test(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>40||/[\x00-\x1f]/.test(b.name)||!validIds(b.strips)||!b.strips.length||b.mix!==undefined&&(!validMix(b.mix)||b.mix>(MIXER_MODELS[model as MixerModelId]?.monitorOutputs??0))||b.compactStrips!==undefined&&typeof b.compactStrips!=='boolean')||!['inputs','returns',...banks.map(b=>b.id)].includes(l.activeBank))throw Error(INVALID_LAYOUT);
 return {layout:{hidden:l.hidden,outputs:l.outputs,density:l.density,banks:banks.map(b=>({id:b.id,name:b.name,strips:b.strips,...(b.mix!==undefined?{mix:b.mix}:{}),...(b.compactStrips?{compactStrips:true}:{})})),activeBank:l.activeBank},screen:input.screen};
}
