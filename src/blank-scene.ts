import {PARAMETERS,AIR_PARAMETER_ADDRESSES,type Value} from './parameters.js';

/**
 * "Start from a blank scene": every mixing setting back to neutral, in OSC wire values.
 *
 * Deliberately NOT touched (safety and wiring):
 *  - 48 V phantom power and preamp gains (/headamp/...): switching phantom can damage a mic or pop the PA;
 *  - routing, input sources and stereo links (/routing, /config/insrc, /config/chlink...): the cables stay valid;
 *  - effect engines (/fx/...): type and settings are kept; only their insert mode is switched off,
 *    so FX 1-4 work as send/return again (channel inserts are switched off too);
 *  - network and console setup.
 * Every level starts fully down so nothing comes out loud: the user brings the faders up.
 */
const STRIPS='ch\\/\\d\\d|rtn\\/(?:aux|[1-4])|bus\\/[1-6]';
const PROCESSED=`${STRIPS}|lr`;
const RULES:[RegExp,Value][]=[
 [new RegExp(`^\\/(?:${STRIPS}|dca\\/[1-4]|fxsend\\/[1-4])\\/config\\/name$`),''],
 [new RegExp(`^\\/(?:${STRIPS}|dca\\/[1-4]|fxsend\\/[1-4])\\/config\\/color$`),0],
 [/^\/ch\/\d\d\/preamp\/(?:hpon|invert)$/,0],
 [/^\/ch\/\d\d\/(?:gate|dyn)\/on$/,0],
 [/^\/(?:bus\/[1-6]|lr)\/dyn\/on$/,0],
 [new RegExp(`^\\/(?:${PROCESSED})\\/insert\\/on$`),0],
 [new RegExp(`^\\/(?:${PROCESSED})\\/eq\\/on$`),1],
 [new RegExp(`^\\/(?:${PROCESSED})\\/eq\\/[1-6]\\/g$`),.5],
 [new RegExp(`^\\/(?:${PROCESSED}|fxsend\\/[1-4])\\/mix\\/on$`),1],
 [/^\/dca\/[1-4]\/on$/,1],
 [new RegExp(`^\\/(?:${PROCESSED})\\/mix\\/fader$`),0],
 [/^\/fxsend\/[1-4]\/mix\/fader$/,.75],
 [/^\/dca\/[1-4]\/fader$/,.75],
 [/^\/(?:ch\/\d\d|rtn\/(?:aux|[1-4]))\/mix\/lr$/,1],
 [/^\/bus\/[1-6]\/mix\/lr$/,0],
 [new RegExp(`^\\/(?:${PROCESSED})\\/mix\\/pan$`),.5],
 [/^\/(?:ch\/\d\d|rtn\/(?:aux|[1-4]))\/mix\/\d\d\/(?:level|pan)$/,NaN],
 [new RegExp(`^\\/(?:${STRIPS}|fxsend\\/[1-4])\\/grp\\/(?:dca|mute)$`),0],
 [/^\/ch\/\d\d\/automix\/group$/,0],
 [/^\/config\/mute\/[1-4]$/,0],
 [/^\/fx\/[1-4]\/insert$/,0]
];
export function blankSceneValues():Record<string,Value>{
 const values:Record<string,Value>={};
 for(const address of [...AIR_PARAMETER_ADDRESSES]){
  if((/^\/(?:headamp|routing|fx)\//.test(address)&&!/^\/fx\/[1-4]\/insert$/.test(address))||/\/(?:phantom|insrc|rtnsrc)$/.test(address))continue;
  const rule=RULES.find(([r])=>r.test(address));if(!rule)continue;
  // Sends: level fully down, pan centred.
  values[address]=Number.isNaN(rule[1])?(address.endsWith('/pan')?.5:0):rule[1];
 }
 return values;
}
export const BLANK_SCENE_TEXT={
 title:'Partir d’une scène vierge',
 explanation:'Toute la console revient à neutre : noms et couleurs effacés, coupe-bas, compresseurs, gates et inserts coupés, égaliseurs à plat, pan au centre, mutes enlevés, envois vers les retours et les effets fermés. Tous les volumes (canaux, retours, master) partent tout en bas : rien ne sort fort, c’est toi qui remontes. Les 4 effets repassent en départ/retour (leur type et leurs réglages sont gardés). Le 48 V, les gains des préamplis et le routage des entrées/sorties ne sont pas touchés. Une sauvegarde est faite juste avant.'
};
