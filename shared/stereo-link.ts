/** X-Air Link Preferences (Audio/MIDI): these switches are global, not per pair.
 * Scope deliberately excludes preamp gain, polarity, pan and routing.
 * Reference: X AIR User Manual, sections 5.14, 6.14 and 7.11.
 */
export const STEREO_LINK_GROUPS=['preamp','eq','dyn','fdrmute'] as const;
export type StereoLinkGroup=typeof STEREO_LINK_GROUPS[number];
export type StereoLinkSummary={pairs:number[];independent:StereoLinkGroup[];shared:StereoLinkGroup[]};
export const STEREO_LINK_LABELS:Record<StereoLinkGroup,string>={preamp:'Coupe-bas',eq:'Égaliseur',dyn:'Compresseur et gate',fdrmute:'Volumes, mutes et envois'};
export const STEREO_LINK_NOTICE='Les différences gauche/droite sont conservées pour les réglages indépendants. Les options globales de liaison ne sont pas modifiées.';
export function stereoLinkGroup(path:string):StereoLinkGroup|null{
  if(/^preamp\/(hpon|hpf)$/.test(path))return 'preamp';
  if(path.startsWith('eq/'))return 'eq';
  if(/^(dyn|gate)\//.test(path))return 'dyn';
  if(/^mix\/(on|fader|\d{2}\/level)$/.test(path))return 'fdrmute';
  return null;
}
/** Unknown settings stay conservative. An unread/malformed option is never OFF. */
export function stereoSettingShared(path:string,guards:Record<string,string|number>){
  const group=stereoLinkGroup(path);return group===null||guards[`/config/linkcfg/${group}`]!==0;
}
export function stereoConflict(path:string){
  switch(stereoLinkGroup(path)){
    case 'preamp':return 'Le coupe-bas est partagé sur cette paire liée. Des valeurs gauche/droite différentes empêchent le rappel et son annulation. Aucune option globale n’a été modifiée.';
    case 'eq':return 'L’égaliseur est partagé sur cette paire liée. Des valeurs gauche/droite différentes empêchent le rappel et son annulation. Aucune option globale n’a été modifiée.';
    case 'dyn':return 'Le compresseur et le gate sont partagés sur cette paire liée. Des valeurs gauche/droite différentes empêchent le rappel et son annulation. Aucune option globale n’a été modifiée.';
    case 'fdrmute':return 'Les volumes, mutes et envois sont partagés sur cette paire liée. Des valeurs gauche/droite différentes empêchent le rappel et son annulation. Aucune option globale n’a été modifiée.';
    default:return 'Les réglages sélectionnés diffèrent entre les deux côtés liés. Cette configuration ne permet pas encore un rappel sélectif.';
  }
}
export function stereoLinkSummary(addresses:string[],guards:Record<string,string|number>):StereoLinkSummary|undefined{
  const pairs=new Set<number>(),groups=new Set<StereoLinkGroup>();
  for(const a of addresses){
    const m=/^\/ch\/(\d+)\/(.+)$/.exec(a);if(!m)continue;
    const ch=Number(m[1]),first=ch%2?ch:ch-1;
    if(guards[`/config/chlink/${first}-${first+1}`]!==1)continue;
    pairs.add(first);const group=stereoLinkGroup(m[2]!);if(group)groups.add(group);
  }
  if(!pairs.size||!groups.size)return undefined;
  const relevant=STEREO_LINK_GROUPS.filter(g=>groups.has(g));
  return {pairs:[...pairs].sort((a,b)=>a-b),independent:relevant.filter(g=>guards[`/config/linkcfg/${g}`]===0),shared:relevant.filter(g=>guards[`/config/linkcfg/${g}`]!==0)};
}
