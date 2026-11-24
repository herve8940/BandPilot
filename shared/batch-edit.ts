/** Narrow allowlist for direct batch and linked edits on X-Air. */
export const BATCH_SETTINGS={
 pan:{label:'Position stéréo',path:'mix/pan',min:-100,max:100,step:1},
 hpon:{label:'Coupe-bas actif',path:'preamp/hpon',min:0,max:1,step:1},
 hpf:{label:'Coupe-bas (Hz)',path:'preamp/hpf',min:20,max:400,step:1},
 eq:{label:'Égaliseur',path:'eq/on',min:0,max:1,step:1},
 eqGain:{label:'Gain d’une bande EQ',path:'eq/1/g',min:-15,max:15,step:.25},
 eqFrequency:{label:'Fréquence d’une bande EQ',path:'eq/1/f',min:20,max:20000,step:1},
 eqQ:{label:'Largeur Q d’une bande EQ',path:'eq/1/q',min:.3,max:10,step:.1},
 compressorThreshold:{label:'Seuil du compresseur',path:'dyn/thr',min:-60,max:0,step:.5},
 gateThreshold:{label:'Seuil du gate',path:'gate/thr',min:-80,max:0,step:.5},
 dyn:{label:'Compresseur',path:'dyn/on',min:0,max:1,step:1},
 gate:{label:'Gate',path:'gate/on',min:0,max:1,step:1},
 tap:{label:'Point de prélèvement',path:'mix/01/tap',min:0,max:4,step:1},
} as const;
export type BatchSetting=keyof typeof BATCH_SETTINGS;
export const BATCH_TAPS=['Entrée','Avant EQ','Après EQ','Avant fader','Après fader'] as const;
export function batchPath(setting:BatchSetting,bus:number,band:number){
 if(setting==='tap')return 'mix/'+String(bus).padStart(2,'0')+'/tap';
 if(batchUsesBand(setting))return 'eq/'+band+'/'+BATCH_SETTINGS[setting].path.split('/').at(-1);
 return BATCH_SETTINGS[setting].path;
}
export const batchUsesBand=(setting:BatchSetting)=>['eqGain','eqFrequency','eqQ'].includes(setting);
/** Same wire laws as the X-Air catalogue, shared by the surface controls. */
export function batchFromWire(setting:BatchSetting,wire:number){
 const d=BATCH_SETTINGS[setting];
 if(setting==='eqQ')return .3*Math.pow(10/.3,1-wire);
 if(setting==='hpf'||setting==='eqFrequency')return d.min*Math.pow(d.max/d.min,wire);
 return d.max===1||setting==='tap'?wire:d.min+wire*(d.max-d.min);
}
export function batchToWire(setting:BatchSetting,value:number){
 const d=BATCH_SETTINGS[setting];
 if(setting==='eqQ')return 1-Math.log(value/.3)/Math.log(10/.3);
 if(setting==='hpf'||setting==='eqFrequency')return Math.log(value/d.min)/Math.log(d.max/d.min);
 return d.max===1||setting==='tap'?value:(value-d.min)/(d.max-d.min);
}
