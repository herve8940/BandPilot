import {EXTENDED_FX} from './fx-extended.js';
/** X-Air parameter order and units: protocol facts checked against XAir_fxparse1.c
 * (Patrick-Gilles Maillot / Ken Mitchell). Independent declarative implementation.
 * https://github.com/pmaillot/X32-Behringer/blob/master/XAir_fxparse1.c */
export type FxParameter = {label:string;unit?:string;initial?:number;frequency?:number;side?:'A'|'B'|'M'|'S'|'stereo';band?:number} & (
 {scale:'linear'|'log';lo:number;hi:number} | {scale:'enum';options:string[];aliases?:Record<string,string>});
export type FxVector={slot:number;algorithm:number;parameters:{type:'f'|'i';value:number}[]};
export const FX_NAMES='HALL AMBI RPLT ROOM CHAM PLAT VREV VRM GATE RVRS DLY 3TAP 4TAP CRS FLNG PHAS DIMC FILT ROTA PAN SUB D/RV CR/R FL/R D/CR D/FL MODD GEQ2 GEQ TEQ2 TEQ DES2 DES P1A P1A2 PQ5 PQ5S WAVD LIM CMB CMB2 FAC FAC1M FAC2 LEC LEC2 ULC ULC2 ENH2 ENH EXC2 EXC IMG EDI SON AMP2 AMP DRV2 DRV PIT2 PIT'.split(' ');
const lin=(label:string,lo:number,hi:number,unit='',initial=lo):FxParameter=>({label,scale:'linear',lo,hi,unit,initial});
const log=(label:string,lo:number,hi:number,unit='',initial=lo):FxParameter=>({label,scale:'log',lo,hi,unit,initial});
const list=(label:string,options:string[],initial=0,aliases?:Record<string,string>):FxParameter=>({label,scale:'enum',options,initial,aliases});
const factor=(side:string)=>list(side,['1/4','3/8','1/2','2/3','1','4/3','3/2','2','3'],4);
const base=(decayLo:number,decayHi:number,sizeLo:number,sizeHi:number,diffLo:number,diffHi:number)=>[
 lin('Prédélai',0,200,'ms',20),log('Durée de réverbération',decayLo,decayHi,'s',1.5),lin('Taille',sizeLo,sizeHi,'',20),
 log('Amortissement des aigus',1000,20000,'Hz',6000),lin('Diffusion',diffLo,diffHi,'',diffLo+(diffHi-diffLo)/2),
 lin('Niveau de sortie',-12,12,'dB',0),log('Coupe-bas',10,500,'Hz',100),log('Coupe-haut',200,20000,'Hz',10000),
];
const hallPlate=(plate:boolean):FxParameter[]=>[...base(plate?.5:.2,plate?10:5,2,100,1,30),
 log('Durée relative des graves',.5,2,'×',1),plate?log('Séparation des graves',10,500,'Hz',200):lin('Dispersion',0,50,'',20),
 lin(plate?'Modulation':'Forme',0,plate?50:250),lin('Vitesse de modulation',0,100),
];
const room=(rich:boolean,chamber:boolean):FxParameter[]=>[...base(.3,29,4,rich?39:76,0,100),
 log('Durée relative des graves',.25,4,'×',1),lin('Dispersion',0,50,'',20),lin(rich?'Attaque':'Forme',0,rich?100:250),lin('Rotation',0,100),
 lin(chamber?'Réflexion gauche':'Écho gauche',0,chamber?500:1200,'ms'),lin(chamber?'Réflexion droite':'Écho droit',0,chamber?500:1200,'ms'),
 lin(chamber?'Niveau réflexion gauche':'Réinjection gauche',chamber?0:-100,100,'%',0),lin(chamber?'Niveau réflexion droite':'Réinjection droite',chamber?0:-100,100,'%',0),
];
// GEQ/TEQ: 31 ascending ISO bands then output gain, repeated for B in dual mode.
// XAir_fxparse.c confirms 32/64 floats, all -15..15 dB; X32GEQ2cpy.c identifies
// the two master gains at OSC parameters 32/64. No DSP response is inferred.
export const GEQ_FREQUENCIES=[20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000];
const geq=(dual:boolean):FxParameter[]=>(dual?['A','B'] as const:['stereo'] as const).flatMap(side=>[
 ...GEQ_FREQUENCIES.map(frequency=>({...lin('Gain de bande',-15,15,'dB',0),frequency,side})),
 {...lin('Niveau de sortie',-15,15,'dB',0),side},
]);
export const FX_SCHEMAS:Record<number,{name:string;parameters:FxParameter[];tempoIndex?:number;geq?:'dual'|'stereo'}>={
 ...EXTENDED_FX,
 0:{name:'Hall Reverb',parameters:hallPlate(false)},
 1:{name:'Ambience',parameters:[...base(.2,7.3,2,100,1,30),lin('Modulation',0,100),lin('Niveau de fin de réverbération',0,100,'%',50)]},
 2:{name:'Rich Plate Reverb',parameters:room(true,false)},3:{name:'Room Reverb',parameters:room(false,false)},4:{name:'Chamber Reverb',parameters:room(false,true)},
 5:{name:'Plate Reverb',parameters:hallPlate(true)},
 10:{name:'Stereo Delay',tempoIndex:1,parameters:[lin('Mélange effet',0,100,'%',100),lin('Durée du délai',1,3000,'ms',500),
  list('Mode du délai',['Stéréo','Croisé','Mono']),factor('Facteur gauche'),factor('Facteur droit'),lin('Décalage gauche / droite',-100,100,'%',0),
  log('Coupe-bas',10,500,'Hz',100),log('Coupe-haut',200,20000,'Hz',10000),log('Coupe-bas de réinjection',10,500,'Hz',100),
  lin('Réinjection gauche',0,100,'%',20),lin('Réinjection droite',0,100,'%',20),log('Coupe-haut de réinjection',200,20000,'Hz',8000)]},
 26:{name:'Modulation Delay',tempoIndex:0,parameters:[lin('Durée du délai',1,3000,'ms',500),list('Facteur du délai',['1','1/2','2/3','3/2']),
  lin('Réinjection',0,100,'%',20),log('Coupe-bas',10,500,'Hz',100),log('Coupe-haut',200,20000,'Hz',10000),lin('Profondeur de modulation',0,100,'%',0),
  log('Vitesse de modulation',.05,10,'Hz',1),list('Disposition',['Parallèle','Série']),list('Type de réverbération',['Ambiance','Club','Hall']),
  lin('Durée de réverbération',1,10,'s',2),log('Amortissement des aigus',1000,20000,'Hz',6000),lin('Balance délai / réverbération',-100,100,'%',0),lin('Mélange effet',0,100,'%',100)]},
 27:{name:'GEQ double',geq:'dual',parameters:geq(true)},
 28:{name:'GEQ stéréo',geq:'stereo',parameters:geq(false)},
 29:{name:'True EQ double',geq:'dual',parameters:geq(true)},
 30:{name:'True EQ stéréo',geq:'stereo',parameters:geq(false)},
};
// Native scene tokens differ from the translated presentation labels.
export const FX_NATIVE_OPTIONS:Record<string,string[]>={'10:2':['ST','X','M'],'26:7':['PAR','SER'],'26:8':['AMB','CLUB','HALL']};
export function fxFromWire(p:FxParameter,value:number){return p.scale==='enum'?value:p.scale==='log'?p.lo*Math.pow(p.hi/p.lo,value):p.lo+(p.hi-p.lo)*value;}
export function fxToWire(p:FxParameter,value:number):{type:'f'|'i';value:number}{
 if(!Number.isFinite(value)||(p.scale==='enum'?(!Number.isInteger(value)||value<0||value>=p.options.length):(value<p.lo||value>p.hi)))throw Error('Valeur FX hors plage');
 return {type:p.scale==='enum'?'i':'f',value:p.scale==='enum'?value:p.scale==='log'?Math.log(value/p.lo)/Math.log(p.hi/p.lo):(value-p.lo)/(p.hi-p.lo)};
}
export function defaultFxParameters(algorithm:number){return FX_SCHEMAS[algorithm]?.parameters.map(p=>fxToWire(p,p.initial??0))??[];}
export function canEditFx(f:FxVector){const s=FX_SCHEMAS[f.algorithm];return !!s&&s.parameters.length===f.parameters.length&&s.parameters.every((p,i)=>{const v=f.parameters[i]!;return v.type===(p.scale==='enum'?'i':'f')&&Number.isFinite(v.value)&&(p.scale==='enum'?Number.isInteger(v.value)&&v.value>=0&&v.value<p.options.length:v.value>=0&&v.value<=1);});}
/** Monotonic taps; a pause starts a fresh measurement, accidental rapid taps are ignored. */
export function tempoTap(previous:number[],now:number):{taps:number[];bpm:number|null}{
 if(!Number.isFinite(now))return {taps:[],bpm:null};
 const last=previous.at(-1),gap=last===undefined?Infinity:now-last;
 if(gap<=0||gap>2500)return {taps:[now],bpm:null};
 const taps=gap<150?previous:[...previous,now].slice(-6);
 if(taps.length<2)return {taps,bpm:null};
 const intervals=taps.slice(1).map((t,i)=>t-taps[i]!).sort((a,b)=>a-b),mid=Math.floor(intervals.length/2);
 const ms=intervals.length%2?intervals[mid]!:(intervals[mid-1]!+intervals[mid]!)/2;
 return {taps,bpm:Math.round(60000/ms*10)/10};
}
export function tempoDelayMs(bpm:number,division=1){
 if(!Number.isFinite(bpm)||bpm<24||bpm>400||![.5,2/3,.75,1,1.5,2].includes(division))throw Error('Tempo ou division hors plage');
 const ms=60000/bpm*division;if(ms<1||ms>3000)throw Error('Durée du délai hors plage');return ms;
}
