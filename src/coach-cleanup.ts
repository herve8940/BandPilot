import {busLinkAddress} from '../shared/monitor-pairs.js';
import {stereoConflict, stereoLinkGroup} from '../shared/stereo-link.js';
import {blankSceneValues} from './blank-scene.js';
import {channelLink, channelPrefix, channelReader} from './channel-operations.js';
import type {ConsoleControl} from './console-control.js';
import {fromWire, toWire, type Value} from './parameters.js';
import type {XR18} from './xr18.js';

type Values = Record<string, Value>;
const pad = (n:number) => String(n).padStart(2, '0');

export function unusedInputValues(xr:XR18, used:Set<number>) {
  const values:Values = {};
  const blank = blankSceneValues();
  for (let ch = 1; ch <= xr.model().channels; ch++) {
    if (used.has(ch)) continue;
    const prefix = channelPrefix(ch);
    // Silence the paths before changing processing or clearing mute-group membership.
    values[prefix+'mix/fader'] = -90;
    for (let bus = 1; bus <= xr.model().buses + xr.model().fxSlots; bus++) {
      const send = prefix+'mix/'+pad(bus)+'/';
      if (xr.supports(send+'level')) values[send+'level'] = -90;
      if (xr.supports(send+'grpon')) values[send+'grpon'] = 0;
    }
    for (const [address, neutral] of Object.entries(blank)) {
      if (!address.startsWith(prefix) || !xr.supports(address)) continue;
      if (address === prefix+'mix/on' || address === prefix+'mix/lr') continue;
      values[address] = fromWire(address, neutral);
    }
  }
  return values;
}

/** A musician on a linked bus uses both outputs. Keep both sides in the preview and backup. */
export async function cleanMonitorValues(xr:XR18, control:ConsoleControl, mix:Values, assigned:Set<number>, onlyBus?:number) {
  const reader = channelReader(xr, control);
  const guards:Values = {}, sends:Values = {}, outputs:Values = {};
  const silentBuses:number[] = [], activeBuses:number[] = [];
  const model = xr.model();
  const sources = [...Array.from({length:model.channels}, (_,i)=>'/ch/'+pad(i+1)), '/rtn/aux',
    ...Array.from({length:model.fxSlots}, (_,i)=>'/rtn/'+(i+1))];
  for (let bus = 1; bus <= model.monitorOutputs; bus++) {
    const link = busLinkAddress(bus);
    if (onlyBus !== undefined && link !== busLinkAddress(onlyBus)) continue;
    guards[link] ??= await reader.read(link);
    const partner = bus % 2 ? bus + 1 : bus - 1;
    const stereo = guards[link] === 1;
    if (onlyBus !== undefined && onlyBus !== bus && !stereo) continue;
    if (stereo && assigned.has(bus) && assigned.has(partner)) throw Error('Deux musiciens occupent la même paire de retours stéréo. Vérifie leurs sorties.');
    const owner = assigned.has(bus) ? bus : stereo && assigned.has(partner) ? partner : undefined;
    const output = '/bus/'+bus+'/';
    if (owner === undefined) {
      silentBuses.push(bus);
      outputs[output+'mix/fader'] = -90;
      outputs[output+'config/name'] = '';
      outputs[output+'config/color'] = 0;
    } else {
      activeBuses.push(bus);
      for (const leaf of ['config/name','config/color','mix/lr','mix/fader','mix/on']) {
        outputs[output+leaf] = mix['/bus/'+owner+'/'+leaf]!;
      }
    }

    for (const source of sources) {
      const dest = source+'/mix/'+pad(bus)+'/';
      if (!xr.supports(dest+'level')) continue;
      const src = owner === undefined ? undefined : source+'/mix/'+pad(owner)+'/';
      sends[dest+'level'] = src ? mix[src+'level'] ?? -90 : -90;
      if (xr.supports(dest+'grpon')) sends[dest+'grpon'] = 0;
      if (src && mix[src+'tap'] !== undefined) sends[dest+'tap'] = mix[src+'tap']!;
    }
  }
  return {values:{...sends, ...outputs}, guards, silentBuses, activeBuses};
}

export async function previewCleanMix(xr:XR18, control:ConsoleControl, values:Values, guards:Values, identity:string, usedInputs?:Set<number>) {
  const model = xr.model();
  const reader = channelReader(xr, control);
  const before:Values = {};
  // Linked writes must be reversible on the physical desk. Validate the old pair as well as the new one.
  const checkPair = async (a:string, b:string, message:string) => {
    if (values[b] === undefined || toWire(a,values[a]!) !== toWire(b,values[b])) throw Error(message);
    before[a] ??= await reader.read(a);
    before[b] ??= await reader.read(b);
    if (before[a] !== before[b]) throw Error(message);
  };
  for (const address of Object.keys(values)) {
    const send = /\/mix\/(\d{2})\/(level|grpon|tap)$/.exec(address);
    if (!send) continue;
    const bus = Number(send[1]);
    if (bus % 2 === 0 || bus > model.buses) continue;
    const link = busLinkAddress(bus);
    guards[link] ??= await reader.read(link);
    if (guards[link] === 1) {
      const partner = address.replace('/mix/'+pad(bus)+'/', '/mix/'+pad(bus+1)+'/');
      await checkPair(address, partner, 'Les niveaux des deux bus du retour stéréo lié diffèrent. Cette opération exige un niveau commun pour cet envoi.');
    }
  }
  for (let left = 1; left < model.channels; left += 2) {
    const link = channelLink(left);
    guards[link] = await reader.read(link);
    if (guards[link] !== 1) continue;
    if (usedInputs && usedInputs.has(left) !== usedInputs.has(left+1)) throw Error('Sélectionne les deux entrées de chaque paire stéréo liée.');
    const prefix = channelPrefix(left), other = channelPrefix(left+1);
    for (const address of Object.keys(values)) {
      if (!address.startsWith(prefix) && !address.startsWith(other)) continue;
      const path = address.slice(prefix.length);
      const group = stereoLinkGroup(path);
      if (!group) continue;
      const option = '/config/linkcfg/'+group;
      guards[option] ??= await reader.read(option);
      if (guards[option] !== 1) continue;
      const partner = (address.startsWith(prefix) ? other : prefix)+path;
      await checkPair(address,partner,stereoConflict(path));
    }
  }
  return control.preview(values, false, guards, 'mix-preparation-backup', before, undefined, identity);
}
