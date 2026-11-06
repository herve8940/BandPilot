/** Creative starting points, not corrections inferred from a recording. */
export const VOCAL_AMBIENCES=[
 {id:'natural',name:'Naturelle',style:'Acoustique · répétition',description:'Un espace court autour de la voix, pour garder les paroles proches.',algorithm:0,preDelayMs:12,decaySeconds:.7,size:25,highCutHz:7500},
 {id:'pop',name:'Pop',style:'Pop · variété',description:'Une réverbération lumineuse et discrète, séparée de l’attaque des mots.',algorithm:5,preDelayMs:35,decaySeconds:1.4,size:35,highCutHz:7000},
 {id:'rock',name:'Rock',style:'Rock · groupe dense',description:'Une réverbération courte qui laisse la voix devant les guitares.',algorithm:5,preDelayMs:25,decaySeconds:1,size:25,highCutHz:6500},
 {id:'ballad',name:'Ample',style:'Ballade · passages calmes',description:'Une queue plus longue ; commence avec peu d’effet dans les oreilles.',algorithm:0,preDelayMs:45,decaySeconds:2,size:45,highCutHz:6500},
 {id:'slap',name:'Écho court',style:'Rockabilly · vintage',description:'Un écho de 110 ms, avec très peu de répétitions.',algorithm:10,preDelayMs:0,decaySeconds:0,size:0,highCutHz:6000}
] as const;
export const INSTRUMENT_AMBIENCES=[
 {id:'backing-stage',name:'Scène courte',style:'Chœurs',description:'Donne une place aux harmonies en gardant les consonnes lisibles.',algorithm:0,preDelayMs:18,decaySeconds:.85,size:28,highCutHz:6200},
 {id:'acoustic-plate',name:'Plaque acoustique',style:'Guitare acoustique',description:'Ajoute de la profondeur aux notes sans noyer le jeu rythmique.',algorithm:5,preDelayMs:20,decaySeconds:1.3,size:28,highCutHz:6500},
 {id:'solo-space',name:'Espace pour solo',style:'Guitare solo',description:'Une réverbération courte pour une guitare sèche. Vérifie d’abord les effets du pédalier.',algorithm:0,preDelayMs:24,decaySeconds:.8,size:26,highCutHz:5800},
 {id:'drum-space',name:'Petite salle',style:'Caisse claire · toms',description:'Écoute si les frappes restent nettes dans les retours.',algorithm:0,preDelayMs:20,decaySeconds:.65,size:23,highCutHz:5800},
 {id:'snare-plate',name:'Plaque caisse claire',style:'Caisse claire',description:'Une queue plus dense pour les morceaux espacés.',algorithm:5,preDelayMs:16,decaySeconds:1.05,size:30,highCutHz:6200},
 {id:'piano-hall',name:'Petit hall',style:'Clavier · piano',description:'Donne de la profondeur à un clavier sec. Écoute les accords tenus avant de garder.',algorithm:0,preDelayMs:16,decaySeconds:1.15,size:32,highCutHz:6500}
] as const;

export const GUIDED_AMBIENCES=[...VOCAL_AMBIENCES,...INSTRUMENT_AMBIENCES];
export function ambiencesForSource(source:string|undefined){
 switch(source){
  case undefined: case 'lead-rock': return [...VOCAL_AMBIENCES];
  case 'backing-vocal': return [INSTRUMENT_AMBIENCES[0],...VOCAL_AMBIENCES];
  case 'acoustic-guitar': return [INSTRUMENT_AMBIENCES[1]];
  case 'electric-solo': return [INSTRUMENT_AMBIENCES[2]];
  case 'snare': return [INSTRUMENT_AMBIENCES[3],INSTRUMENT_AMBIENCES[4]];
  case 'tom1': case 'tom2': case 'tom3': case 'toms': return [INSTRUMENT_AMBIENCES[3]];
  case 'keys': return [INSTRUMENT_AMBIENCES[5]];
  default: return [];
 }
}
export const VOCAL_DOSES=[{db:-90,name:'Sec'},{db:-24,name:'Très discret'},{db:-18,name:'Discret'},{db:-12,name:'Présent'},{db:-6,name:'Ample'}] as const;
