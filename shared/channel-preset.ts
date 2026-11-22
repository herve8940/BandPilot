/** Portable channel processing only; routing, preamp gain and monitor mixes are separate. */
export const PRESET_SECTIONS = ['eq', 'compressor', 'gate'] as const;
export type PresetSection = typeof PRESET_SECTIONS[number];
type PresetBase = {
  format: 'bandpilot-channel-preset';
  model: string;
  sourceChannel: number;
  sections: PresetSection[];
  values: Record<string, string | number>;
};
export type ChannelPreset = PresetBase & ({version:1}|{version:2;stereo:true;linked:boolean;rightValues:Record<string,string|number>});
export function presetSection(path: string): PresetSection | null {
  if (/^(eq\/(on|[1-4]\/(type|f|g|q))|preamp\/(hpon|hpf))$/.test(path)) return 'eq';
  if (/^dyn\/(on|mode|det|env|thr|ratio|knee|mgain|attack|hold|release|mix|auto|keysrc|filter\/(on|type|f))$/.test(path)) return 'compressor';
  if (/^gate\/(on|mode|thr|range|attack|hold|release|keysrc|filter\/(on|type|f))$/.test(path)) return 'gate';
  return null;
}
