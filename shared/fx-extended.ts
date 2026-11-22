/** Independent parameter tables derived from the public XAir_fxparse(1).c protocol
 * reference (Maillot / Mitchell). Values describe controls, not recommended sounds.
 * https://github.com/pmaillot/X32-Behringer */
import type {FxParameter} from './fx-parameters.js';
const lin=(label:string,lo:number,hi:number,unit=''):FxParameter=>({label,scale:'linear',lo,hi,unit,initial:lo<=0&&hi>=0?0:lo});
const log=(label:string,lo:number,hi:number,unit=''):FxParameter=>({label,scale:'log',lo,hi,unit,initial:lo});
const list=(label:string,options:string[],aliases?:Record<string,string>):FxParameter=>({label,scale:'enum',options,aliases,initial:0});
const on=(label:string)=>list(label,['OFF','ON']);
const pct=(label:string)=>lin(label,0,100,'%');
const cut=()=>[log('Coupe-bas',10,500,'Hz'),log('Coupe-haut',200,20000,'Hz')];
const mix=()=>pct('Mélange effet');
const balance=()=>lin('Balance',-100,100,'%');
const level=()=>lin('Niveau de sortie',-12,12,'dB');
const speed=(hi=5)=>log('Vitesse de modulation',.05,hi,'Hz');
const phase=()=>lin('Phase',0,180,'°');
const factor=(label:string)=>list(label,['1/4','3/8','1/2','2/3','1','4/3','3/2','2','3']);
const time=()=>lin('Durée du délai',1,3000,'ms');
const dual=(parameters:FxParameter[])=>['A','B'].flatMap(side=>parameters.map(p=>({...p,side:side as 'A'|'B'})));
const envelope=()=>[log('Attaque',10,1000,'ms'),log('Maintien',1,2000,'ms'),log('Relâchement',10,1000,'ms')];
const shortReverb=()=>[lin('Prédélai',0,200,'ms'),log('Durée de réverbération',.1,5,'s'),lin('Taille',2,100),log('Amortissement des aigus',1000,20000,'Hz'),log('Coupe-bas',10,500,'Hz')];
const modulation=(flanger:boolean)=>[speed(4),pct('Profondeur de modulation'),log('Durée du délai',.5,flanger?20:50,'ms'),phase(),flanger?lin('Réinjection',-90,90,'%'):pct('Forme d’onde')];
const pattern=['1/4','1/3','3/8','1/2','2/3','3/4','1','1/4X','1/3X','3/8X','1/2X','2/3X','3/4X','1X'];
const delayCombo=(other:FxParameter[])=>[time(),list('Motif du délai',pattern),log('Coupe-haut de réinjection',1000,20000,'Hz'),pct('Réinjection'),pct('Réinjection croisée'),balance(),...other,mix()];
const programEq=()=>[on('Actif'),level(),lin('Renforcement des graves',0,10),list('Fréquence grave',['20','30','60','100'],{'0':'20'}),lin('Atténuation des graves',0,10),lin('Largeur des aigus',0,10),lin('Renforcement des aigus',0,10),list('Fréquence aiguë',['3K','4K','5K','8K','10K','12K','16K']),lin('Atténuation des aigus',0,10),list('Fréquence d’atténuation',['5K','10K','20K']),on('Transformateur')];
const midEq=()=>[on('Actif'),level(),list('Fréquence grave',['200','300','500','700','1K'],{'1000':'1K'}),lin('Renforcement des graves',0,10),list('Fréquence médium',['200','300','500','700','1K','1K5','2K','3K','4K','5K','7K']),lin('Atténuation des médiums',0,10),list('Fréquence aiguë',['1K5','2K','3K','4K','5K']),lin('Renforcement des aigus',0,10),on('Transformateur')];
const fair=()=>[on('Actif'),lin('Gain d’entrée',-20,0,'dB'),lin('Seuil',0,10),lin('Temps',0,6),pct('Polarisation'),lin('Niveau de sortie',-18,6,'dB'),balance()];
const leisure=()=>[on('Actif'),pct('Gain'),pct('Réduction des crêtes'),list('Mode',['COMP','LIM']),lin('Niveau de sortie',-18,6,'dB')];
const ultimo=()=>[on('Actif'),lin('Gain d’entrée',-48,0,'dB'),lin('Niveau de sortie',-48,0,'dB'),lin('Attaque',1,7),lin('Relâchement',1,7),list('Ratio',['4','8','12','20','ALL'])];
const enhancer=()=>[level(),pct('Dispersion'),pct('Renforcement des graves'),lin('Fréquence grave',1,50),pct('Renforcement des médiums'),lin('Largeur des médiums',1,50),pct('Renforcement des aigus'),lin('Fréquence aiguë',1,50),on('Solo')];
const exciter=()=>[log('Fréquence',1000,10000,'Hz'),pct('Crête'),pct('Remplissage'),lin('Timbre',-50,50),pct('Harmoniques'),mix(),on('Solo')];
const amp=()=>['Préampli','Bourdonnement','Punch','Crunch','Saturation','Graves','Aigus','Niveau de sortie'].map(label=>lin(label,0,10)).concat(on('Simulation de baffle'));
const tube=()=>[pct('Saturation'),lin('Harmoniques paires',0,50),lin('Harmoniques impaires',0,50),level(),log('Coupe-bas',20,200,'Hz'),log('Coupe-haut',4000,20000,'Hz'),lin('Gain grave',-12,12,'dB'),log('Fréquence grave',50,400,'Hz'),lin('Gain aigu',-12,12,'dB'),log('Fréquence aiguë',1000,10000,'Hz')];
const pitch=()=>[lin('Transposition',-12,12,'st'),lin('Désaccordage',-50,50,'ct'),log('Durée du délai',1,500,'ms'),log('Coupe-bas',10,500,'Hz'),log('Coupe-haut',2000,20000,'Hz'),mix()];
const combinator=()=>[on('Actif'),list('Solo de bande',['OFF','BD1','BD2','BD3','BD4','BD5']),mix(),lin('Attaque',0,19),log('Relâchement',20,3000,'ms'),on('Relâchement automatique'),lin('Vitesse SBC',0,10),on('SBC'),lin('Séparation des bandes',-50,50,'%'),list('Pente',['12','48']),list('Ratio',['1.1','1.2','1.3','1.5','1.7','2','2.5','3','3.5','4','5','7','10','LIM']),lin('Seuil',-40,0,'dB'),lin('Niveau de sortie',-10,10,'dB'),...Array.from({length:5},(_,i)=>[lin('Seuil de bande',-10,10,'dB'),lin('Gain de bande',-10,10,'dB'),list('Verrouillage de bande',['0','1'])].map(p=>({...p,band:i+1}))).flat(),list('Mesure',['GR','SBC','PEAK'],{GRA:'GR',GRB:'SBC',PEAKA:'PEAK'})];
export const EXTENDED_FX:Record<number,{name:string;parameters:FxParameter[];tempoIndex?:number}>={
 6:{name:'Vintage Reverb',parameters:[lin('Prédélai',0,120,'ms'),log('Durée de réverbération',.3,4.5,'s'),pct('Modulation'),on('Vintage'),list('Position',['FRONT','REAR']),level(),log('Coupe-bas',10,500,'Hz'),log('Coupe-haut',10000,20000,'Hz'),log('Durée relative des graves',.5,2,'×'),log('Durée relative des aigus',.25,1,'×')]},
 7:{name:'Vintage Room',parameters:[lin('Prédélai',0,200,'ms'),log('Durée de réverbération',.1,20,'s'),pct('Taille'),lin('Densité',1,30),pct('Premières réflexions'),level(),log('Durée relative des graves',.1,10,'×'),log('Durée relative des aigus',.1,10,'×'),...cut(),lin('Réflexion gauche',0,200,'ms'),lin('Réflexion droite',0,200,'ms'),on('Gel')]},
 8:{name:'Gated Reverb',parameters:[lin('Prédélai',0,200,'ms'),lin('Durée de réverbération',140,1000,'ms'),lin('Attaque',0,30),lin('Densité',1,50),pct('Dispersion'),level(),...cut(),lin('Gain aigu',-30,0,'dB'),lin('Diffusion',1,30)]},
 9:{name:'Reverse Reverb',parameters:[lin('Prédélai',0,200,'ms'),lin('Durée de réverbération',140,1000,'ms'),lin('Montée',0,50),lin('Diffusion',1,30),pct('Dispersion'),level(),...cut(),lin('Gain aigu',-30,0,'dB')]},
 11:{name:'3-Tap Delay',tempoIndex:0,parameters:[time(),pct('Niveau de base'),lin('Panorama de base',-100,100,'%'),pct('Réinjection'),...cut(),factor('Facteur A'),pct('Niveau A'),lin('Panorama A',-100,100,'%'),factor('Facteur B'),pct('Niveau B'),lin('Panorama B',-100,100,'%'),on('Réinjection croisée'),on('Mono'),on('Signal direct')]},
 12:{name:'4-Tap Delay',tempoIndex:0,parameters:[time(),pct('Niveau de base'),pct('Réinjection'),...cut(),lin('Dispersion',0,6),factor('Facteur A'),pct('Niveau A'),factor('Facteur B'),pct('Niveau B'),factor('Facteur C'),pct('Niveau C'),on('Réinjection croisée'),on('Mono'),on('Signal direct')]},
 13:{name:'Stereo Chorus',parameters:[speed(),pct('Profondeur gauche'),pct('Profondeur droite'),log('Délai gauche',.5,50,'ms'),log('Délai droit',.5,50,'ms'),mix(),...cut(),phase(),pct('Forme d’onde'),pct('Dispersion')]},
 14:{name:'Stereo Flanger',parameters:[speed(),pct('Profondeur gauche'),pct('Profondeur droite'),log('Délai gauche',.5,20,'ms'),log('Délai droit',.5,20,'ms'),mix(),...cut(),phase(),log('Coupe-bas de réinjection',10,500,'Hz'),log('Coupe-haut de réinjection',200,20000,'Hz'),lin('Réinjection',-90,90,'%')]},
 15:{name:'Stereo Phaser',parameters:[speed(),pct('Profondeur de modulation'),lin('Résonance',0,80,'%'),lin('Base',0,50),lin('Étages',2,12),mix(),lin('Forme d’onde',-50,50),phase(),lin('Modulation par enveloppe',-100,100,'%'),...envelope()]},
 16:{name:'Dimensional Chorus',parameters:[on('Actif'),list('Mode',['M','ST']),on('Signal direct'),on('Mode 1'),on('Mode 2'),on('Mode 3'),on('Mode 4')]},
 17:{name:'Mood Filter',parameters:[speed(20),pct('Profondeur de modulation'),pct('Résonance'),log('Base',20,15000,'Hz'),list('Mode',['LP','HP','BP','NO']),mix(),list('Forme d’onde',['TRI','SIN','SAW','SAW-','RMP','SQU','RND']),phase(),lin('Modulation par enveloppe',-100,100,'%'),log('Attaque',10,250,'ms'),log('Relâchement',10,500,'ms'),pct('Saturation'),list('Pôles',['2POL','4POL'],{OFF:'2POL',ON:'4POL'}),on('Sidechain')]},
 18:{name:'Rotary Speaker',parameters:[log('Vitesse lente',.1,4,'Hz'),log('Vitesse rapide',2,10,'Hz'),pct('Accélération'),pct('Distance'),balance(),mix(),list('Rotation',['RUN','STOP']),list('Vitesse',['SLOW','FAST'])]},
 19:{name:'Tremolo / Panner',parameters:[speed(),phase(),lin('Forme d’onde',-50,50),pct('Profondeur de modulation'),pct('Vitesse d’enveloppe'),pct('Profondeur d’enveloppe'),...envelope()]},
 20:{name:'Sub Octaver',parameters:dual([on('Actif'),list('Plage',['LO','MID','HI']),pct('Signal direct'),pct('Octave −1'),pct('Octave −2')])},
 21:{name:'Delay / Reverb',tempoIndex:0,parameters:delayCombo(shortReverb())},
 22:{name:'Chorus / Reverb',parameters:[...modulation(false),balance(),...shortReverb(),mix()]},
 23:{name:'Flanger / Reverb',parameters:[...modulation(true),balance(),...shortReverb(),mix()]},
 24:{name:'Delay / Chorus',tempoIndex:0,parameters:delayCombo(modulation(false))},
 25:{name:'Delay / Flanger',tempoIndex:0,parameters:delayCombo(modulation(true))},
 31:{name:'Dual De-Esser',parameters:[lin('Graves A',0,50),lin('Aigus A',0,50),lin('Graves B',0,50),lin('Aigus B',0,50),list('Voix A',['FEM','MALE']),list('Voix B',['FEM','MALE'])]},
 32:{name:'Stereo De-Esser',parameters:[lin('Graves A',0,50),lin('Aigus A',0,50),lin('Graves B',0,50),lin('Aigus B',0,50),list('Voix',['FEM','MALE']),list('Mode',['ST','MS'],{FEM:'ST',MALE:'MS'})]},
 33:{name:'Stereo Program EQ',parameters:programEq()},34:{name:'Dual Program EQ',parameters:dual(programEq())},
 35:{name:'Stereo Midrange EQ',parameters:midEq()},36:{name:'Dual Midrange EQ',parameters:dual(midEq())},
 37:{name:'Wave Designer',parameters:dual([lin('Attaque',-100,100,'%'),lin('Maintien',-100,100,'%'),lin('Niveau de sortie',-24,24,'dB')])},
 38:{name:'Precision Limiter',parameters:[lin('Gain d’entrée',0,18,'dB'),lin('Niveau de sortie',-18,0,'dB'),pct('Compression'),lin('Coude',0,10),log('Attaque',.05,1,'ms'),log('Relâchement',20,2000,'ms'),on('Liaison stéréo'),on('Gain automatique')]},
 39:{name:'Stereo Combinator',parameters:combinator()},40:{name:'Dual Combinator',parameters:dual(combinator())},
 41:{name:'Stereo Fair Compressor',parameters:fair()},42:{name:'M/S Fair Compressor',parameters:dual(fair()).map(p=>({...p,side:p.side==='A'?'M':'S'}))},43:{name:'Dual Fair Compressor',parameters:dual(fair())},
 44:{name:'Stereo Leisure Compressor',parameters:leisure()},45:{name:'Dual Leisure Compressor',parameters:dual(leisure())},
 46:{name:'Stereo Ultimo Compressor',parameters:ultimo()},47:{name:'Dual Ultimo Compressor',parameters:dual(ultimo())},
 48:{name:'Dual Enhancer',parameters:dual(enhancer())},49:{name:'Stereo Enhancer',parameters:enhancer()},
 50:{name:'Dual Exciter',parameters:dual(exciter())},51:{name:'Stereo Exciter',parameters:exciter()},
 52:{name:'Stereo Imager',parameters:[balance(),lin('Panorama mono',-100,100,'%'),lin('Panorama stéréo',-100,100,'%'),lin('Gain plateau',0,12,'dB'),log('Fréquence plateau',100,1000,'Hz'),log('Largeur plateau',1,10),level()]},
 53:{name:'Edison EX1',parameters:[on('Actif'),list('Entrée',['ST','MS']),list('Sortie',['ST','MS']),lin('Largeur stéréo',-50,50),lin('Largeur bas-médium',-50,50),lin('Balance',-50,50),lin('Distance du centre',-50,50),level()]},
 54:{name:'Sound Maxer',parameters:dual([on('Actif'),lin('Contour grave',0,10),lin('Traitement',0,10),level()])},
 55:{name:'Dual Guitar Amp',parameters:dual(amp())},56:{name:'Stereo Guitar Amp',parameters:amp()},
 57:{name:'Dual Tube Stage',parameters:dual(tube())},58:{name:'Stereo Tube Stage',parameters:tube()},
 59:{name:'Dual Pitch',parameters:dual(pitch())},60:{name:'Stereo Pitch',parameters:pitch()},
};
