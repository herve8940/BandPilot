/** Narrow allowlist for direct batch and linked edits on X-Air. */
export const BATCH_SETTINGS={
 pan:{label:'Position stéréo',path:'mix/pan',min:-100,max:100,step:1},
 hpon:{label:'Coupe-bas actif',path:'preamp/hpon',min:0,max:1,step:1},
 hpf:{label:'Coupe-bas (Hz)',path:'preamp/hpf',min:20,max:400,step:1},
 eq:{label:'Égaliseur',path:'eq/on',min:0,max:1,step:1},
 eqGain:{label:'Gain d’une bande EQ',path:'eq/1/g',min:-15,max:15,step:.25},
 dyn:{label:'Compresseur',path:'dyn/on',min:0,max:1,step:1},
 gate:{label:'Gate',path:'gate/on',min:0,max:1,step:1},
 tap:{label:'Point de prélèvement',path:'mix/01/tap',min:0,max:4,step:1},
} as const;
export type BatchSetting=keyof typeof BATCH_SETTINGS;
export const BATCH_TAPS=['Entrée','Avant EQ','Après EQ','Avant fader','Après fader'] as const;
export function batchPath(setting:BatchSetting,bus:number,band:number){
 if(setting==='tap')return 'mix/'+String(bus).padStart(2,'0')+'/tap';
 if(setting==='eqGain')return 'eq/'+band+'/g';
 return BATCH_SETTINGS[setting].path;
}
