import {MIXER_MODELS, type MixerModelId} from '../shared/mixer-models.js';
import {PRESET_SECTIONS, presetSection, type ChannelPreset, type PresetSection} from '../shared/channel-preset.js';
import {supportsMixerAddress} from './mixer-capabilities.js';
import {validateWire, type Value} from './parameters.js';
import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import {channelLink,channelReader,previewChannelOperation} from './channel-operations.js';
import {STEREO_LINK_GROUPS} from '../shared/stereo-link.js';

const prefix = (channel: number) => `/ch/${String(channel).padStart(2, '0')}/`;
export function validateSections(input: unknown): PresetSection[] {
  if (!Array.isArray(input) || !input.length || input.length > 3 || new Set(input).size !== input.length || input.some(s => !PRESET_SECTIONS.includes(s))) throw Error('Choisis au moins un traitement : EQ, compresseur ou gate.');
  return PRESET_SECTIONS.filter(s => input.includes(s));
}
function validateChannel(channel: unknown, count: number): asserts channel is number {
  if (typeof channel !== 'number' || !Number.isInteger(channel) || channel < 1 || channel > count) throw Error('Canal absent sur ce modèle.');
}
export function validateChannelPreset(input: unknown): ChannelPreset {
  const p = input as ChannelPreset;
  if (!p || p.format !== 'bandpilot-channel-preset' || ![1,2].includes(p.version) || typeof p.model !== 'string' || !Object.hasOwn(MIXER_MODELS, p.model)) throw Error('Preset de canal BandPilot invalide.');
  const model = MIXER_MODELS[p.model as MixerModelId];
  validateChannel(p.sourceChannel, model.channels);
  const sections = validateSections(p.sections);
  if(p.version===2){
    if(p.stereo!==true||typeof p.linked!=='boolean'||model.family!=='xair'||p.sourceChannel%2!==1||p.sourceChannel+1>model.channels)throw Error('Paire stéréo invalide pour ce modèle.');
    const left=validateChannelPreset({...p,version:1}),right=validateChannelPreset({...p,version:1,sourceChannel:p.sourceChannel+1,values:p.rightValues});
    if(Object.keys(left.values).sort().join('|')!==Object.keys(right.values).sort().join('|'))throw Error('Les deux côtés du preset doivent contenir les mêmes paramètres.');
    return {...left,version:2,stereo:true,linked:p.linked,rightValues:right.values};
  }
  if (!p.values || typeof p.values !== 'object' || Array.isArray(p.values) || !Object.keys(p.values).length || Object.keys(p.values).length > 100) throw Error('Réglages du preset invalides.');
  const values: Record<string, Value> = {};
  for (const [path, value] of Object.entries(p.values)) {
    const section = presetSection(path), address = prefix(p.sourceChannel) + path;
    if (!section || !sections.includes(section) || !supportsMixerAddress(model, address)) throw Error('Réglage non transportable dans ce preset : ' + path);
    validateWire(address, value);
    // A sidechain from another channel cannot follow a portable instrument preset.
    if (path.endsWith('/keysrc') && value !== 0) throw Error('Ce traitement utilise une sidechain externe. Retire-le de la sélection.');
    values[path] = value;
  }
  if (sections.some(s => !Object.keys(values).some(p => presetSection(p) === s))) throw Error('Traitement sélectionné absent du preset.');
  return {format: 'bandpilot-channel-preset', version: 1, model: p.model, sourceChannel: p.sourceChannel, sections, values};
}

export async function captureChannelPreset(xr: XR18, control: ConsoleControl, channel: unknown, selected: unknown, sceneValues?: Record<string, Value>,stereo=false): Promise<ChannelPreset> {
  validateChannel(channel, xr.model().channels);
  if(stereo){
    if(xr.model().family!=='xair'||channel%2!==1||channel+1>xr.model().channels)throw Error('Paire stéréo invalide pour ce modèle.');
    const reader=channelReader(xr,control),link=channelLink(channel);
    if(sceneValues&&!Object.hasOwn(sceneValues,link))throw Error('La scène ne précise pas la liaison de cette paire stéréo.');
    const linked=sceneValues?sceneValues[link]:await reader.read(link);
    if(linked!==0&&linked!==1)throw Error('Paire stéréo invalide pour ce modèle.');
    const preferences:Record<string,Value>={};
    if(!sceneValues&&linked===1)for(const group of STEREO_LINK_GROUPS){const address=`/config/linkcfg/${group}`;preferences[address]=await reader.read(address);}
    const left=await captureChannelPreset(xr,control,channel,selected,sceneValues),right=await captureChannelPreset(xr,control,channel+1,selected,sceneValues);
    if(!sceneValues&&await reader.read(link)!==linked)throw Error('État modifié : prévisualiser à nouveau');
    for(const [address,value] of Object.entries(preferences))if(await reader.read(address)!==value)throw Error('État modifié : prévisualiser à nouveau');
    reader.check();
    return validateChannelPreset({...left,version:2,stereo:true,linked:linked===1,rightValues:right.values});
  }
  const sections = validateSections(selected), start = prefix(channel);
  const addresses = xr.parameterAddresses().filter(a => a.startsWith(start) && sections.includes(presetSection(a.slice(start.length))!));
  const identity = control.identity(), operation = xr.operationId(), values: Record<string, Value> = {};
  for (const address of addresses) {
    if (sceneValues && !Object.hasOwn(sceneValues, address)) throw Error('Scène incomplète pour ce traitement : ' + address);
    values[address.slice(start.length)] = sceneValues ? sceneValues[address]! : await xr.readParameter(address);
    if (identity !== control.identity() || operation !== xr.operationId()) throw Error('Connexion modifiée pendant la sauvegarde.');
  }
  return validateChannelPreset({format: 'bandpilot-channel-preset', version: 1, model: xr.model().id, sourceChannel: channel, sections, values});
}

export function channelPresetValues(xr: XR18, input: unknown, channel: unknown, selected?: unknown): Record<string, Value> {
  const p = validateChannelPreset(input);
  validateChannel(channel, xr.model().channels);
  // Keep compatibility explicit; a future converter can opt into other models.
  if (p.model !== xr.model().id) throw Error('Preset créé pour un autre modèle : conversion explicite nécessaire.');
  const sections = selected === undefined ? p.sections : validateSections(selected);
  if (sections.some(s => !p.sections.includes(s))) throw Error('Traitement sélectionné absent du preset.');
  if(p.version===2&&(channel%2!==1||channel+1>xr.model().channels))throw Error('Paire stéréo invalide pour ce modèle.');
  const sides=p.version===2?[p.values,p.rightValues]:[p.values];
  return Object.fromEntries(sides.flatMap((values,index)=>Object.entries(values).filter(([path]) => sections.includes(presetSection(path)!)).map(([path, value]) => {
    const address = prefix(channel+index) + path;
    if (!xr.supports(address)) throw Error('Paramètre absent sur ce modèle : ' + address);
    return [address, value];
  })));
}

export async function previewChannelPreset(xr:XR18,control:ConsoleControl,input:unknown,channel:unknown,selected?:unknown){
  const p=validateChannelPreset(input);
  const values=channelPresetValues(xr,input,channel,selected),guards:Record<string,Value>={};
  if(p.version===2)return previewChannelOperation(xr,control,values,{[channelLink(Number(channel))]:p.linked?1:0});
  if(xr.model().family==='xair'){
    const first=Number(channel)%2?Number(channel):Number(channel)-1;
    const address=`/config/chlink/${first}-${first+1}`;
    if(await xr.readParameter(address)!==0)throw Error('Canal lié en stéréo : utilise un preset stéréo pour conserver la paire.');
    guards[address]=0;
  }
  return {...await control.preview(values,true,guards),stereoLink:undefined};
}

/** Explicit copy between consoles sharing the X-Air parameter definitions.
 * No fields are dropped, no routing/gain is added, and the original stays intact. */
export function convertChannelPreset(input:unknown,targetModel:unknown,referenceChannel:unknown):ChannelPreset{
 const p=validateChannelPreset(input),source=MIXER_MODELS[p.model as MixerModelId];
 const target=typeof targetModel==='string'&&Object.hasOwn(MIXER_MODELS,targetModel)?MIXER_MODELS[targetModel as MixerModelId]:undefined;
 if(source.family!=='xair'||target?.family!=='xair')throw Error('Conversion disponible entre les modèles X-Air / M-Air pris en charge uniquement.');
 validateChannel(referenceChannel,target.channels);
 return validateChannelPreset({...p,model:target.id,sourceChannel:referenceChannel});
}
