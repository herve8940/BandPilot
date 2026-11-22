import {presetSection} from './channel-preset.js';

export const SCENE_RECALL_SECTIONS = ['eq', 'compressor', 'gate', 'levels', 'labels'] as const;
export type SceneRecallSection = typeof SCENE_RECALL_SECTIONS[number];
export type SceneChannelMapping = {source:number;target:number};
/** channels always names scene inputs; omitted mapping preserves their numbers. */
export type SceneRecallScope = {channels:number[];sections:SceneRecallSection[];mapping?:SceneChannelMapping[];perChannel?:Record<number,SceneRecallSection[]>};
export const SCENE_RECALL_LABELS:Record<SceneRecallSection,string> = {
  eq:'EQ et coupe-bas', compressor:'Compresseur', gate:'Gate / expandeur',
  levels:'Volumes et mutes des entrées', labels:'Noms et couleurs',
};
/** A closed allowlist: routing, preamps, sends, links and FX never belong to this recall. */
export function sceneRecallSection(path:string):SceneRecallSection|null {
  if (/^mix\/(fader|on)$/.test(path)) return 'levels';
  if (/^config\/(name|color)$/.test(path)) return 'labels';
  return presetSection(path);
}

export const SCENE_RECALL_NOTICE = 'Seules les entrées et les familles cochées seront rappelées. Gains, 48 V, routage, panoramas, envois, sorties et FX restent inchangés. Les traitements et les volumes peuvent aussi modifier le son des retours qui en dépendent.';
export const SCENE_MAPPING_NOTICE = 'La réaffectation copie les réglages sélectionnés vers les entrées choisies. Elle ne déplace ni les câbles ni le routage et ne modifie pas la scène enregistrée.';
export const SCENE_MAPPING_INVALID = 'Associe chaque entrée sélectionnée à une seule destination disponible, sans doublon.';
export const SCENE_MAPPING_STEREO = 'Sélectionne les deux entrées de chaque paire stéréo liée dans la scène et affecte-les à une paire complète, gauche puis droite.';
