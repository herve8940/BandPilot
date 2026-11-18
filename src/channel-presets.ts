import {MIXER_MODELS, type MixerModelId} from '../shared/mixer-models.js';
import {PRESET_SECTIONS, presetSection, type ChannelPreset, type PresetSection} from '../shared/channel-preset.js';
import {supportsMixerAddress} from './mixer-capabilities.js';
import {validateWire, type Value} from './parameters.js';
import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';

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
  if (!p || p.format !== 'bandpilot-channel-preset' || p.version !== 1 || typeof p.model !== 'string' || !Object.hasOwn(MIXER_MODELS, p.model)) throw Error('Preset de canal BandPilot invalide.');
  const model = MIXER_MODELS[p.model as MixerModelId];
  validateChannel(p.sourceChannel, model.channels);
  const sections = validateSections(p.sections);
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

export async function captureChannelPreset(xr: XR18, control: ConsoleControl, channel: unknown, selected: unknown, sceneValues?: Record<string, Value>): Promise<ChannelPreset> {
  validateChannel(channel, xr.model().channels);
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
  return Object.fromEntries(Object.entries(p.values).filter(([path]) => sections.includes(presetSection(path)!)).map(([path, value]) => {
    const address = prefix(channel) + path;
    if (!xr.supports(address)) throw Error('Paramètre absent sur ce modèle : ' + address);
    return [address, value];
  }));
}

export async function previewChannelPreset(xr:XR18,control:ConsoleControl,input:unknown,channel:unknown,selected?:unknown){
  const values=channelPresetValues(xr,input,channel,selected),guards:Record<string,Value>={};
  if(xr.model().family==='xair'){
    const first=Number(channel)%2?Number(channel):Number(channel)-1;
    const address=`/config/chlink/${first}-${first+1}`;
    if(await xr.readParameter(address)!==0)throw Error('Canal lié en stéréo : utilise une scène complète pour conserver la paire.');
    guards[address]=0;
  }
  return control.preview(values,true,guards);
}
