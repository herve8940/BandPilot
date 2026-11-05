/** Creative starting points, not corrections inferred from a recording. */
export const VOCAL_AMBIENCES=[
 {id:'natural',name:'Naturelle',style:'Acoustique · répétition',description:'Un espace court autour de la voix, pour garder les paroles proches.',algorithm:0,preDelayMs:12,decaySeconds:.7,size:25,highCutHz:7500},
 {id:'pop',name:'Pop',style:'Pop · variété',description:'Une réverbération lumineuse et discrète, séparée de l’attaque des mots.',algorithm:5,preDelayMs:35,decaySeconds:1.4,size:35,highCutHz:7000},
 {id:'rock',name:'Rock',style:'Rock · groupe dense',description:'Une réverbération courte qui laisse la voix devant les guitares.',algorithm:5,preDelayMs:25,decaySeconds:1,size:25,highCutHz:6500},
 {id:'ballad',name:'Ample',style:'Ballade · passages calmes',description:'Une queue plus longue ; commence avec peu d’effet dans les oreilles.',algorithm:0,preDelayMs:45,decaySeconds:2,size:45,highCutHz:6500},
 {id:'slap',name:'Écho court',style:'Rockabilly · vintage',description:'Un écho de 110 ms, avec très peu de répétitions.',algorithm:10,preDelayMs:0,decaySeconds:0,size:0,highCutHz:6000}
] as const;
export const VOCAL_DOSES=[{db:-90,name:'Sec'},{db:-24,name:'Très discret'},{db:-18,name:'Discret'},{db:-12,name:'Présent'},{db:-6,name:'Ample'}] as const;
