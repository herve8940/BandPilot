import {PROCESSING_PRESETS} from './coach-presets.js';
import {processingCommands} from './processing-osc.js';
import {fromWire,descriptor,type Value} from './parameters.js';
import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import type {LibraryStore} from './library-store.js';

/**
 * Instruments the coach knows. Each one carries a complete live starting point
 * (HPF, 4-band EQ, compressor, gate, pan, colour) built from common practice.
 * Thresholds are STARTING points for signals gain-staged around -18 dBFS
 * average / -6 dBFS peaks: they are shown as such and must be refined by ear.
 */
export type Family='voice'|'backing'|'guitar'|'bass'|'kick'|'snare'|'toms'|'cymbals'|'keys'|'edrums'|'track';
export type Source={id:string;label:string;group:string;family:Family;color:number;name:string;preset:string;pan:number;compThr:number|null;gateThr:number|null};
const S=(id:string,label:string,group:string,family:Family,color:number,name:string,preset:string,pan:number,compThr:number|null,gateThr:number|null):Source=>({id,label,group,family,color,name,preset,pan,compThr,gateThr});
export const SOURCES:Source[]=[
 S('lead-rock','Chant principal','Voix','voice',1,'Chant','lead-rock',0,-20,null),
 S('backing-vocal','Chœurs','Voix','backing',9,'Choeurs','backing-vocal',-15,-22,null),
 S('electric-rhythm','Guitare rythmique','Guitares','guitar',3,'Guit rythm','electric-rhythm',-35,-16,null),
 S('electric-solo','Guitare solo','Guitares','guitar',11,'Guit solo','electric-solo',35,-18,null),
 S('acoustic-guitar','Guitare acoustique','Guitares','guitar',3,'Acoustique','acoustic-guitar',-20,-20,null),
 S('bass-di','Basse','Basse','bass',2,'Basse','bass-di',0,-20,null),
 S('kick','Kick (grosse caisse)','Batterie détaillée','kick',4,'Kick','kick',0,-16,-40),
 S('snare','Snare (caisse claire)','Batterie détaillée','snare',4,'Snare','snare',0,-16,-45),
 S('tom1','Tom 1 (aigu)','Batterie détaillée','toms',12,'Tom 1','tom1',-30,-18,-42),
 S('tom2','Tom 2 (medium)','Batterie détaillée','toms',12,'Tom 2','tom2',10,-18,-42),
 S('tom3','Tom 3 (basse)','Batterie détaillée','toms',12,'Tom 3','tom3',45,-18,-44),
 S('oh-left','OH 1 (overhead gauche)','Batterie détaillée','cymbals',6,'OH 1','overheads',-70,-18,null),
 S('oh-right','OH 2 (overhead droit)','Batterie détaillée','cymbals',6,'OH 2','overheads',70,-18,null),
 S('hihat','Charleston (hi-hat)','Batterie détaillée','cymbals',6,'Hi-hat','hihat',-45,-18,null),
 S('toms','Tom (générique)','Batterie détaillée','toms',12,'Tom','toms',0,-18,-42),
 S('overheads','Overhead (mono)','Batterie détaillée','cymbals',6,'OH','overheads',0,-18,null),
 S('drum-module','Batterie électronique (mono)','Batterie électronique','edrums',4,'E-drums','drum-module',0,null,null),
 S('drum-module-l','Batterie électronique — gauche','Batterie électronique','edrums',4,'TD27 L','drum-module',-100,null,null),
 S('drum-module-r','Batterie électronique — droite','Batterie électronique','edrums',4,'TD27 R','drum-module',100,null,null),
 S('keys','Clavier / piano','Claviers','keys',5,'Clavier','keys',20,-20,null),
 S('backing-track','Backing track (depuis l’ordinateur)','Ordinateur','track',7,'Backing','backing-track',0,null,null)
];
export const source=(id:string)=>{const s=SOURCES.find(s=>s.id===id);if(!s)throw Error('Instrument inconnu : '+id);return s;};
/** Monitor (in-ear / wedge) starting mix by musician role, in dB of pre-fader send. */
export type Role='chant'|'guitare'|'basse'|'batterie'|'clavier';
export const ROLES:{id:Role;label:string;color:number;hint:string}[]=[
 {id:'chant',label:'Chanteur·se',color:1,hint:'Sa voix devant, la batterie et la basse pour le tempo et la justesse.'},
 {id:'guitare',label:'Guitariste',color:3,hint:'Sa guitare, la voix pour suivre le morceau, kick et snare pour le tempo.'},
 {id:'basse',label:'Bassiste',color:2,hint:'Basse et kick soudés, snare pour le placement, la voix pour la structure.'},
 {id:'batterie',label:'Batteur·se',color:4,hint:'Basse et kick en avant, voix pour la structure ; cymbales déjà fortes acoustiquement.'},
 {id:'clavier',label:'Claviériste',color:5,hint:'Son clavier, la voix et la section rythmique.'}
];
const OFF=-90;
export const MONITOR_RECIPES:Record<Role,Record<Family,number>>={
 chant:   {voice:-3, backing:-10,guitar:-16,bass:-14,kick:-10,snare:-14,toms:-24,cymbals:-26,keys:-14,edrums:-10,track:-12},
 guitare: {voice:-8, backing:-15,guitar:-12,bass:-14,kick:-10,snare:-12,toms:-24,cymbals:-26,keys:-16,edrums:-10,track:-12},
 basse:   {voice:-10,backing:-18,guitar:-16,bass:-4, kick:-5, snare:-10,toms:-20,cymbals:-26,keys:-18,edrums:-6,track:-12},
 batterie:{voice:-8, backing:-18,guitar:-15,bass:-5, kick:-6, snare:-14,toms:-22,cymbals:OFF,keys:-18,edrums:-4,track:-12},
 clavier: {voice:-8, backing:-14,guitar:-15,bass:-12,kick:-10,snare:-12,toms:-24,cymbals:-26,keys:-4, edrums:-10,track:-12}
};
/** Own instrument: clearly in front of everything else. */
export const OWN_LEVEL=-3;
/** An acoustic drummer already hears the kit loud: his own mics follow the recipe (cymbals off), not a blanket boost. */
export function monitorLevel(role:Role,family:Family,own:boolean){return own&&!(role==='batterie'&&family!=='edrums')?OWN_LEVEL:MONITOR_RECIPES[role][family];}
export type Musician={name:string;bus:number;role:Role;channels:number[]};
export type Input={channel:number;source:string;name:string};
export type Calibration={peakDb:number;gainDb:number|null;bleedDb?:number;at:string};
export type CoachProfile={version:1;inputs:Input[];completed:string[];musicians?:Musician[];calibration?:Record<string,Calibration>};
export const STEPS=[
 {id:'connect',title:'1. Brancher et connecter',text:'Relie le PC et la console au même réseau. Vérifie tes branchements, puis connecte la console. Garde les volumes des enceintes et des in-ear bas pendant la préparation.'},
 {id:'inputs',title:'2. Dire qui est branché où',text:'Choisis la prise utilisée par chaque instrument. Le modèle de groupe ci-dessous est une proposition : compare-le aux câbles avant de préparer les canaux.'},
 {id:'levels',title:'3. Régler le gain de chaque instrument',text:'Tout part du gain : le compresseur et le gate travaillent sur le signal qui sort du préampli. Un musicien à la fois joue son passage le plus fort ; je mesure et je propose le gain pour viser des crêtes vers −6 dB. Ensuite je cale les seuils du compresseur et du gate sur ce vrai signal.'},
 {id:'tone',title:'4. Écouter et corriger un problème',text:'Écoute avec tout le groupe, décris un seul problème et essaie une petite correction. Si le résultat est moins bon, annule le dernier réglage.'},
 {id:'ears',title:'5. Préparer les retours',text:'Chaque musicien reçoit son propre mix sur un bus : son instrument devant, puis ce dont il a besoin pour jouer en place. Je prépare un départ selon son rôle ; il l’affine ensuite lui-même sur son téléphone via son QR code.'},
 {id:'save',title:'6. Garder le bon réglage',text:'Quand la balance te convient, sauvegarde une scène complète. Refaire la balance reste nécessaire si les micros, enceintes ou la salle changent.'}
];
export const SYMPTOMS=[
 {id:'muddy',label:'C’est brouillon / la voix est étouffée',answer:'On peut essayer de retirer un peu de bas-médium. Cette petite correction peut laisser plus de place aux autres instruments.',check:'Écoute les mots ou les notes dans le groupe complet, puis annule si le son devient trop maigre.'},
 {id:'harsh',label:'C’est agressif / ça pique',answer:'On peut essayer d’adoucir une zone de présence. Il s’agit d’une hypothèse à écouter, pas d’une fréquence mesurée dans ton son.',check:'Compare à volume d’écoute similaire. Si l’attaque ou les paroles disparaissent, annule.'},
 {id:'boomy',label:'Il y a trop de graves / ça résonne',answer:'Un coupe-bas peut retirer le grondement qui n’appartient pas à cet instrument. Sur la basse ou la grosse caisse, je privilégie une petite baisse ciblée pour garder leur grave utile.',check:'Vérifie aussi la position du micro et des enceintes ; une résonance de salle ne se corrige pas toujours sur un seul canal.'},
 {id:'buried',label:'On ne distingue pas ma voix / mon instrument',answer:'Ne monte pas tout de suite le gain. Vérifie d’abord le micro, la distance et le canal. Demande aux autres de jouer moins fort ou baisse un peu les instruments qui masquent celui-ci.',check:'Compare avec et sans les autres instruments. Si le son est clair seul mais disparaît en groupe, travaille d’abord l’équilibre.',},
 {id:'cutoff',label:'Les fins de mots / notes sont coupées',answer:'Si un gate est actif, on peut le désactiver pour vérifier s’il coupe les sons faibles. Cela peut aussi faire revenir du bruit ou de la repisse.',check:'Chante doucement, tiens une note et laisse-la mourir. Si le problème reste, vérifie aussi le module ou le pédalier en amont.'},
 {id:'uneven',label:'Certaines notes sont beaucoup plus fortes',answer:'Un compresseur peut réduire les écarts, mais son seuil doit être réglé sur ton signal. Commence par vérifier la technique et les niveaux de l’instrument. Je ne choisis pas un seuil au hasard.',check:'Demande au musicien de jouer fort puis doucement. Règle le compresseur dans les contrôles avancés en écoutant, sans compensation automatique de volume.'},
 {id:'dry',label:'La voix est trop sèche / je veux de la reverb',answer:'Une réverbération légère peut aider. Les quatre effets sont partagés : vérifie d’abord le slot, son type et son retour. Je ne remplace pas un effet existant sans connaître son usage.',check:'Choisis ou rappelle un preset dans Effets, puis augmente son envoi très progressivement. Garde les paroles compréhensibles.'},
 {id:'noise',label:'Il y a du souffle / un bourdonnement',answer:'Vérifie d’abord le câble, l’alimentation, la DI et la source. Un gate ne répare pas un câble et peut masquer le problème entre les notes.',check:'Coupe le canal concerné pour localiser le bruit, puis compare avec un autre câble. Ne supprime jamais une terre de protection.'},
 {id:'feedback',label:'Ça siffle / larsen',answer:'Baisse le niveau du canal ou du retour concerné, puis éloigne le micro des enceintes et rapproche-le de la source utile. N’augmente pas le gain pour compenser.',check:'Je ne peux pas identifier la fréquence du larsen avec les seuls vumètres OSC. Ne tente pas de provoquer un larsen pour me le faire détecter.'},
 {id:'clipping',label:'Ça sature / ça grésille',answer:'Repère où apparaît le voyant rouge : instrument, préampli, canal, bus ou sortie. Réduis le niveau à l’étage qui sature. Baisser le master ne répare pas une saturation déjà créée en entrée.',check:'Fais jouer les passages forts. Si le signal de la source est déjà déformé, vérifie le pédalier, le module ou la DI avant la console.'}
];
const I=(channel:number,src:string,name?:string):Input=>({channel,source:src,name:name??source(src).name});
export const DRUM_KIT=['kick','snare','tom1','tom2','tom3','oh-left','oh-right'];
export const TEMPLATES:{id:string;label:string;description:string;inputs:Input[]}[]=[
 {id:'rock-td27',label:'Rock + batterie électronique',description:'Chant, guitare rythmique, guitare solo, basse, TD-27 en stéréo (6 entrées).',
  inputs:[I(1,'lead-rock'),I(2,'electric-rhythm'),I(3,'electric-solo'),I(4,'bass-di'),I(5,'drum-module-l'),I(6,'drum-module-r')]},
 {id:'rock-drums',label:'Rock + batterie acoustique détaillée',description:'Chant, chœurs, 2 guitares, basse, kick, snare, 3 toms et 2 overheads (12 entrées).',
  inputs:[I(1,'lead-rock'),I(2,'backing-vocal'),I(3,'electric-rhythm'),I(4,'electric-solo'),I(5,'bass-di'),...DRUM_KIT.map((d,i)=>I(6+i,d))]},
 {id:'acoustic',label:'Acoustique / duo',description:'Chant, chœurs, guitare acoustique, clavier, basse (5 entrées).',
  inputs:[I(1,'lead-rock'),I(2,'backing-vocal'),I(3,'acoustic-guitar'),I(4,'keys'),I(5,'bass-di')]}
];
export const GROUP_TEMPLATE:Input[]=TEMPLATES[0]!.inputs;
const ROLE_OF:Record<Family,Role>={voice:'chant',backing:'chant',guitar:'guitare',bass:'basse',kick:'batterie',snare:'batterie',toms:'batterie',cymbals:'batterie',edrums:'batterie',keys:'clavier',track:'clavier'};
/** One musician per player: the lead singer, each guitar, the bassist, the whole kit, keys. Max 6 buses. */
export function suggestMusicians(inputs:Input[]):Musician[]{
 const out:Musician[]=[];
 for(const i of [...inputs].sort((a,b)=>a.channel-b.channel)){
  const s=source(i.source),role=ROLE_OF[s.family];
  if(s.family==='backing'||s.family==='track')continue;
  const shared=role==='batterie'||role==='basse'||role==='clavier'?out.find(m=>m.role===role):undefined;
  if(shared){shared.channels.push(i.channel);continue;}
  if(out.length>=6)continue;
  const label=role==='batterie'?'Batterie':role==='basse'?'Basse':role==='clavier'?'Clavier':role==='chant'?'Chant':i.name;
  out.push({name:label.slice(0,12),bus:out.length+1,role,channels:[i.channel]});
 }
 return out;
}
/** XR18 names are 12 bytes; keep them ASCII so the console reads back exactly what was sent. */
export function consoleName(name:string){return name.replace(/[œŒ]/g,m=>m==='œ'?'oe':'OE').replace(/[æÆ]/g,m=>m==='æ'?'ae':'AE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'').slice(0,12).trim()||'Micro';}
export function validateProfile(value:unknown):CoachProfile {
 const p=value as CoachProfile;
 if(!p||p.version!==1||!Array.isArray(p.inputs)||p.inputs.length>16||!Array.isArray(p.completed)||p.completed.some(id=>!STEPS.some(s=>s.id===id)))throw Error('Préparation de groupe invalide');
 if(new Set(p.inputs.map(i=>i.channel)).size!==p.inputs.length)throw Error('Une seule source par canal');
 for(const i of p.inputs)if(!i||!Number.isInteger(i.channel)||i.channel<1||i.channel>16||!SOURCES.some(s=>s.id===i.source)||typeof i.name!=='string'||!i.name.trim()||Buffer.byteLength(i.name)>12||/[\x00-\x1f\x7f]/.test(i.name))throw Error('Source, canal 1 à 16 et nom de 12 octets maximum requis');
 if(p.musicians!==undefined){
  if(!Array.isArray(p.musicians)||p.musicians.length>6)throw Error('6 musiciens maximum (un bus chacun)');
  if(new Set(p.musicians.map(m=>m.bus)).size!==p.musicians.length)throw Error('Un bus différent par musicien');
  for(const m of p.musicians)if(!m||typeof m.name!=='string'||!m.name.trim()||m.name.length>12||/[\x00-\x1f\x7f]/.test(m.name)||!Number.isInteger(m.bus)||m.bus<1||m.bus>6||!ROLES.some(r=>r.id===m.role)||!Array.isArray(m.channels)||m.channels.some(c=>!Number.isInteger(c)||c<1||c>16))throw Error('Musicien : nom (12 caractères), bus 1 à 6, rôle et instruments requis');
 }
 if(p.calibration!==undefined){
  if(!p.calibration||typeof p.calibration!=='object'||Array.isArray(p.calibration))throw Error('Mesures invalides');
  for(const [k,c] of Object.entries(p.calibration))if(!/^([1-9]|1[0-6])$/.test(k)||!c||!Number.isFinite(c.peakDb)||c.peakDb<-90||c.peakDb>0||(c.gainDb!==null&&!Number.isFinite(c.gainDb))||(c.bleedDb!==undefined&&(!Number.isFinite(c.bleedDb)||c.bleedDb<-90||c.bleedDb>0))||typeof c.at!=='string')throw Error('Mesures invalides');
 }
 return structuredClone(p);
}
/** Gain staging: aim for peaks around -6 dBFS (headroom for the loudest song, room for the processing). */
export const TARGET_PEAK=-6,GAIN_OK_WINDOW=3,MAX_GAIN_UP=6,MAX_GAIN_DOWN=12;
export type GainDecision={state:'ok'|'raise'|'lower'|'clip'|'none'|'limit';deltaDb:number;targetGainDb:number|null;title:string;message:string};
const half=(v:number)=>Math.round(v*2)/2;
const fmt=(v:number)=>(v>0?'+':'')+String(v).replace('.',',')+' dB';
/** Above this preamp gain a line-level source (e-drums, keys) should rather be turned up at the instrument. */
export const LINE_GAIN_ADVICE_DB=20;
export function gainProposal(peakDb:number,gainDb:number|null,min=-12,max=60):GainDecision{
 if(peakDb< -55)return {state:'none',deltaDb:0,targetGainDb:null,title:'Pas de signal',message:'Rien n’arrive sur cette entrée pendant la mesure. Vérifie le câble, le numéro d’entrée, le volume de l’instrument ou le 48 V d’un micro statique. Je ne monte pas le gain à l’aveugle.'};
 if(peakDb>=-1){const target=gainDb===null?null:Math.max(min,half(gainDb-6));return {state:'clip',deltaDb:-6,targetGainDb:target,title:'Ça sature',message:'Le signal touche le plafond : la vraie crête est peut-être plus haute. Je propose de baisser de 6 dB puis de remesurer. Si l’instrument lui-même distord (pédale, DI), corrige-le à la source.'};}
 const wanted=TARGET_PEAK-peakDb;
 if(Math.abs(wanted)<=GAIN_OK_WINDOW)return {state:'ok',deltaDb:0,targetGainDb:gainDb,title:'Gain bien réglé',message:`Niveau max à ${fmt(half(peakDb))} : dans la bonne zone (−9 à −3 dB). Je m’en sers pour caler le compresseur et le gate.`};
 const delta=half(Math.max(-MAX_GAIN_DOWN,Math.min(MAX_GAIN_UP,wanted)));
 if(gainDb===null)return {state:wanted>0?'raise':'lower',deltaDb:delta,targetGainDb:null,title:wanted>0?'Signal trop faible':'Signal trop fort',message:'Cette tranche ne passe pas par un préampli de la console (retour USB ou entrée coupée) : ajuste le niveau à la source.'};
 const target=Math.max(min,Math.min(max,half(gainDb+delta)));
 if(target===gainDb)return {state:'limit',deltaDb:0,targetGainDb:gainDb,title:'Gain en butée',message:wanted>0?'Le préampli est déjà au maximum. Monte le volume de l’instrument ou rapproche le micro ; une DI ou un micro dynamique éloigné peut être trop faible.':'Le préampli est déjà au minimum. Baisse la sortie de l’instrument ou active le pad de la DI.'};
 return {state:wanted>0?'raise':'lower',deltaDb:target-gainDb,targetGainDb:target,title:wanted>0?'Signal trop faible':'Signal trop fort',message:`Niveau max mesuré : ${fmt(half(peakDb))}. Je propose ${fmt(target-gainDb)} de gain (${fmt(gainDb)} → ${fmt(target)}), puis une nouvelle mesure.${Math.abs(wanted)>Math.abs(target-gainDb)?' On y va par étapes pour éviter un coup de volume dans les retours.':''}`};
}
/** Compressor starts this many dB under the measured peak, per family (gentler on cymbals). */
export const COMP_UNDER_PEAK:Record<Family,number>={voice:8,backing:8,guitar:6,bass:8,kick:6,snare:6,toms:6,cymbals:4,keys:6,edrums:6,track:6};
export function thresholdsFrom(src:Source,peakDb:number,bleedDb?:number){
 const clamp=(v:number,lo:number,hi:number)=>half(Math.max(lo,Math.min(hi,v)));
 const comp=src.compThr===null?null:clamp(peakDb-COMP_UNDER_PEAK[src.family],-60,0);
 let gate:number|null=null,note='';
 if(src.gateThr!==null){
  const softest=peakDb-12;
  if(bleedDb===undefined){gate=clamp(peakDb-24,-80,0);note='Seuil du gate estimé (24 dB sous la crête) : mesure la repisse pour le placer précisément.';}
  else if(bleedDb+4<=softest){gate=clamp(bleedDb+4,-80,0);note='Gate placé 4 dB au-dessus de la repisse mesurée.';}
  else{gate=clamp((bleedDb+softest)/2,-80,0);note='La repisse est presque aussi forte que les coups doux : rapproche le micro du fût ou oriente-le loin des cymbales. Gate placé à mi-chemin, vérifie les ghost notes.';}
 }
 return {compThrDb:comp,gateThrDb:gate,note};
}
export function identifySymptom(text:string){
 const t=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const patterns:[string,RegExp][]=[['feedback',/larsen|siffl|feedback|whistl/],['clipping',/satur|gresill|distors|rouge|clipp|crackl|distort/],['cutoff',/coup|fin.*mot|fin.*note|cut.?off|cutting|chopp/],['noise',/souffle|bourdonn|bruit|buzz|hiss|humming|noise/],['harsh',/agress|pique|strident|criard|harsh|piercing|shrill/],['boomy',/grave|resonn|boom|resonan|too much bass/],['muddy',/brouill|etouff|sourd|boueu|muddy|muffled/],['buried',/entend|disting|masqu|disparai|noye|buried|mask|disappear|cannot hear|can.t hear/],['uneven',/ecart|fort.*faible|irreguli|dynamique|uneven|inconsistent|loud.*quiet/],['dry',/reverb|sech|seche|echo|\bdry\b/]];
 return patterns.find(([,r])=>r.test(t))?.[0]??null;
}
type MeterSample={updatedAt:string;channels:number[];available:boolean};
export function levelReport(channel:number,samples:MeterSample[],now=Date.now()){
 const unique=new Map(samples.filter(s=>s.available&&Number.isFinite(Date.parse(s.updatedAt))&&now-Date.parse(s.updatedAt)>=0&&now-Date.parse(s.updatedAt)<15000&&typeof s.channels[channel-1]==='number'&&Number.isFinite(s.channels[channel-1])).map(s=>[s.updatedAt,s.channels[channel-1]!]));
 const values=[...unique.values()];if(values.length<3)return {available:false,samples:values.length,state:'unknown',title:'Pas assez de mesures récentes',message:'Aucun diagnostic de niveau fiable. Vérifie la connexion et fais jouer cet instrument pendant le test. Aucun son simulé n’est présenté comme mesuré.'};
 const maximum=Math.max(...values),state=maximum>=-1?'high':maximum< -55?'low':'present';
 return {available:true,samples:values.length,maximumDb:maximum,state,title:state==='high'?'Niveau reçu proche du plafond':state==='low'?'Signal reçu très faible':'Signal présent',message:state==='high'?'Vérifie les voyants et l’étage concerné. Je n’augmente aucun niveau et je ne peux pas localiser la saturation avec cette mesure seule.':state==='low'?'Vérifie le câble, la source et le canal. Cette mesure ne justifie pas une hausse automatique de gain.':'Du signal arrive. Ce résultat ne prouve ni la qualité du timbre, ni le bon équilibre, ni le volume acoustique.'};
}
export class SoundCoach {
 constructor(private xr:XR18,private control:ConsoleControl,private library:LibraryStore){}
 profile():CoachProfile {
  const p=this.library.list('coach-profile')[0]?.data as CoachProfile??{version:1,inputs:structuredClone(GROUP_TEMPLATE),completed:[]};
  return p.musicians?p:{...p,musicians:suggestMusicians(p.inputs)};
 }
 /** Measurements belong to the server: a profile sent by the browser never overwrites them. */
 saveProfile(input:unknown,measurements=false){const p=validateProfile(input);if(p.inputs.some(i=>i.channel>this.xr.model().channels)||p.musicians?.some(m=>m.bus>this.xr.model().monitorOutputs))throw Error('Entrée ou sortie de retour absente sur '+this.xr.model().label);if(!measurements){const stored=this.library.list('coach-profile')[0]?.data as CoachProfile|undefined;if(stored?.calibration)p.calibration=stored.calibration;else delete p.calibration;}const saved=this.library.save('coach-profile','Ma préparation',p);return {...p,id:saved.id};}
 catalog(){return {sources:SOURCES,presets:this.presetSummaries(),roles:ROLES,recipes:MONITOR_RECIPES,ownLevel:OWN_LEVEL,templates:TEMPLATES,drumKit:DRUM_KIT,steps:STEPS,symptoms:SYMPTOMS,template:GROUP_TEMPLATE,profile:this.profile(),status:this.xr.status(),aiConfigured:Boolean(process.env.XR18_OPENAI_API_KEY&&process.env.XR18_OPENAI_MODEL)};}
 /** Plain-language card of what each instrument setting does. */
 presetSummaries(){
  return Object.fromEntries(SOURCES.map(s=>{const p=PROCESSING_PRESETS.find(p=>p.id===s.preset)!;
   const db=(g:number)=>(g>0?'+':'')+g+' dB',hz=(f:number)=>f>=1000?(f/1000).toLocaleString('fr-BE')+' kHz':f+' Hz';
   const eq=p.eq.filter(b=>b.gainDb!==0).map(b=>`${db(b.gainDb)} à ${hz(b.frequencyHz)}`).join(', ');
   const pan=s.pan===0?'au centre':s.pan<0?`à gauche (${-s.pan} %)`:`à droite (${s.pan} %)`;
   return [s.id,{title:p.name,description:p.description,advice:p.advice,lines:[
    p.hpfHz?`Coupe-bas à ${hz(p.hpfHz)} : retire le grondement inutile.`:'Pas de coupe-bas.',
    eq?`Égaliseur : ${eq}.`:'Égaliseur neutre.',
    s.compThr!==null&&p.compressor.enabled?`Compresseur ${p.compressor.ratio}:1 à partir de ${s.compThr} dB (attaque ${p.compressor.attackMs} ms, relâchement ${p.compressor.releaseMs} ms) : vise ${p.compressor.targetReductionDb} de réduction.`:'Compresseur désactivé (le son est déjà contrôlé).',
    s.gateThr!==null&&p.gate.enabled?`${p.gate.mode==='gate'?'Gate':'Expandeur'} à ${s.gateThr} dB : coupe la repisse des autres fûts entre les frappes.`:'Gate désactivé (ne coupe aucune fin de note).',
    `Placé ${pan} dans la façade.`]}];}));
 }
 private input(channel:number){if(!Number.isInteger(channel)||channel<1||channel>16)throw Error('Canal 1 à 16 requis');return this.profile().inputs.find(i=>i.channel===channel);}
 advice(channel:number,symptom:string){
  this.input(channel);const s=SYMPTOMS.find(s=>s.id===symptom);if(!s)throw Error('Choisir un problème proposé');
  return {...s,basis:'description',measuredAudio:false,canSuggest:['muddy','harsh','boomy','cutoff'].includes(symptom)};
 }
 /** Every value needed for one instrument, in human units (converted by preview). */
 static channelValues(i:Input,measured?:{compThrDb:number|null;gateThrDb:number|null}){
  const s=source(i.source),p=PROCESSING_PRESETS.find(p=>p.id===s.preset)!,prefix=`/ch/${String(i.channel).padStart(2,'0')}`;
  const comp=measured?.compThrDb??s.compThr,gate=measured?.gateThrDb??s.gateThr;
  const preset={hpfHz:p.hpfHz,eq:p.eq,compressor:{...p.compressor,thresholdDb:comp,enabled:p.compressor.enabled&&s.compThr!==null},gate:{...p.gate,thresholdDb:gate,enabled:p.gate.enabled&&s.gateThr!==null}};
  const {values:wire}=processingCommands(i.channel,preset);
  const values:Record<string,Value>={};for(const [a,v] of Object.entries(wire))values[a]=fromWire(a,v);
  values[prefix+'/config/name']=consoleName(i.name);values[prefix+'/config/color']=s.color;
  values[prefix+'/dyn/knee']=2;values[prefix+'/dyn/det']='RMS';values[prefix+'/dyn/auto']=0;values[prefix+'/dyn/mix']=100;
  values[prefix+'/mix/pan']=s.pan;
  // Played by the computer: the channel listens to USB, and USB send N taps after that switch (AIN is the empty socket).
  if(s.family==='track'){values[prefix+'/preamp/rtnsw']=1;values[`/routing/usb/${String(i.channel).padStart(2,'0')}/pos`]='IN';}
  return values;
 }
 async prepare(channel?:number){
  const profile=validateProfile(this.profile());if(channel!==undefined&&!this.input(channel))throw Error('Attribuer un instrument à ce canal');
  const inputs=profile.inputs.filter(i=>channel===undefined||i.channel===channel);if(!inputs.length)throw Error('Ajouter un instrument');
  const status=await this.calibrationStatus(),calibrated:string[]=[],estimated:string[]=[];
  const values:Record<string,Value>={};
  for(const i of inputs){const c=status.find(c=>c.channel===i.channel);if(c?.valid&&c.thresholds){calibrated.push(i.name);Object.assign(values,SoundCoach.channelValues(i,c.thresholds));}else{estimated.push(i.name);Object.assign(values,SoundCoach.channelValues(i));}}
  const one=inputs.length===1?source(inputs[0]!.source):null;
  const thresholdsNote=!estimated.length?' Seuils du compresseur et du gate calés sur ton signal mesuré.':calibrated.length?` Seuils calés sur la mesure pour : ${calibrated.join(', ')}. Valeurs de départ (gain pas encore mesuré) pour : ${estimated.join(', ')} — passe par l’étape 3.`:' Seuils = valeurs de départ : règle le gain à l’étape 3 pour que je les cale sur ton vrai signal.';
  return {...await this.control.preview(values),title:one?`Configuration complète : ${one.label.toLowerCase().startsWith(inputs[0]!.name.toLowerCase())?one.label:`${inputs[0]!.name} · ${one.label}`}`:`Configuration complète de ${inputs.length} instruments`,
   explanation:'Nom, couleur, coupe-bas, égaliseur 4 bandes, compresseur, gate et position stéréo, selon les bonnes pratiques live pour chaque instrument.'+thresholdsNote+(inputs.some(i=>source(i.source).family==='track')?' Le backing track passe sur sa source USB et son entrée d’enregistrement est réglée pour l’enregistrer. Gain d’entrée, 48 V, volumes et mutes ne sont pas touchés.':' Gain d’entrée, 48 V, volumes, mutes et routage ne sont pas touchés ici.'),inputs:inputs.map(i=>`${i.name} (entrée ${i.channel})`)};
 }
 /** Monitor mixes: one bus per musician, pre-fader sends shaped by role. */
 static earsValues(profile:CoachProfile,bus?:number){
  const musicians=(profile.musicians??[]).filter(m=>bus===undefined||m.bus===bus);
  const values:Record<string,Value>={};
  for(const m of musicians){
   const role=ROLES.find(r=>r.id===m.role)!;
   values[`/bus/${m.bus}/config/name`]=consoleName(m.name);values[`/bus/${m.bus}/config/color`]=role.color;
   values[`/bus/${m.bus}/mix/on`]=1;values[`/bus/${m.bus}/mix/lr`]=0;values[`/bus/${m.bus}/mix/fader`]=-10;
   for(const i of profile.inputs){
    const a=`/ch/${String(i.channel).padStart(2,'0')}/mix/${String(m.bus).padStart(2,'0')}`;
    values[a+'/tap']='PRE';values[a+'/level']=monitorLevel(m.role,source(i.source).family,m.channels.includes(i.channel));
   }
  }
  return {values,musicians};
 }
 async prepareEars(bus?:number){
  const profile=validateProfile(this.profile());const {values,musicians}=SoundCoach.earsValues(profile,bus);
  if(!musicians.length)throw Error(bus?'Aucun musicien sur ce bus':'Ajouter un musicien');if(!profile.inputs.length)throw Error('Ajouter un instrument');
  return {...await this.control.preview(values),title:musicians.length===1?`Retour de ${musicians[0]!.name} (bus ${musicians[0]!.bus})`:`Retours de ${musicians.length} musiciens`,
   explanation:'Chaque musicien reçoit un mix pré-fader (indépendant de la façade) : son instrument devant, puis ce dont son rôle a besoin. Le bus est nommé, sorti de la façade et démarré à −10 dB par sécurité. Garde le volume du boîtier d’écoute bas au premier essai ; chacun affine ensuite sur son téléphone.',
   inputs:musicians.map(m=>`${m.name} → bus ${m.bus}`)};
 }
 async apply(token:unknown,confirm:unknown){
  if(confirm!==true)throw Error('Confirmation requise');const result=await this.control.apply(token,false,true);
  this.library.save('coach-history','Réglage guidé appliqué',{backupId:result.backupId,at:new Date().toISOString()});return result;
 }
 async suggest(channel:number,symptom:string){
  const input=this.input(channel);if(!input)throw Error('Attribuer un instrument à ce canal');
  const advice=this.advice(channel,symptom),prefix=`/ch/${String(channel).padStart(2,'0')}`,values:Record<string,Value>={};
  if(symptom==='cutoff'){
   const on=await this.xr.readParameter(prefix+'/gate/on');if(on!==1)return {advice,proposal:null,message:'Le gate de la console est déjà désactivé. Vérifie le traitement en amont.'};values[prefix+'/gate/on']=0;
  }else if(['muddy','harsh','boomy'].includes(symptom)){
   if(await this.xr.readParameter(prefix+'/eq/on')!==1)return {advice,proposal:null,message:'L’égaliseur est désactivé. Prépare une base connue ou vérifie ses bandes avant de l’activer.'};
   const band=symptom==='harsh'?3:1,frequency=symptom==='harsh'?3200:symptom==='muddy'?280:(input.source==='bass-di'||input.source==='kick'||input.source==='drum-module'?120:180);
   const a=prefix+`/eq/${band}`,gain=Number(fromWire(a+'/g',await this.xr.readParameter(a+'/g')));
   if(await this.xr.readParameter(a+'/type')!==2)return {advice,proposal:null,message:'Cette bande utilise un autre type de filtre. Prépare une base connue plutôt que de modifier ce filtre à l’aveugle.'};
   if(gain<=-6)return {advice,proposal:null,message:'Cette zone est déjà fortement réduite. Écoute et vérifie la source avant de creuser davantage.'};
   if(gain>0){values[a+'/g']=Math.max(0,gain-1.5);}else{values[a+'/f']=frequency;values[a+'/q']=1;values[a+'/g']=Math.max(-6,gain-1.5);}
  }else return {advice,proposal:null,message:'Vérifications d’abord : aucun réglage automatique pertinent pour ce problème avec les seules données OSC.'};
  return {advice,proposal:{...await this.control.preview(values),title:symptom==='cutoff'?'Essayer sans gate':'Essayer une petite correction',explanation:symptom==='cutoff'?'Le gate sera désactivé sur ce canal seulement.':`Une bande EQ du canal sera remplacée pour essayer une réduction ciblée. La fréquence est une hypothèse liée à ta description ; elle n’est pas détectée dans le son.`,inputs:[input.name]}};
 }
 async undo(){
  const last=this.library.list('coach-history')[0];if(!last)throw Error('Aucun réglage guidé à annuler');
  const before=this.library.get((last.data as {backupId:string}).backupId);if(before.kind!=='parameter-backup')throw Error('Sauvegarde incompatible');
  return {...await this.control.preview(before.data,true),title:'Revenir au réglage précédent',explanation:'Seuls les paramètres de la dernière intervention guidée sont restaurés. Compare aussi tes éventuelles modifications manuelles depuis cette intervention.',inputs:[]};
 }
 /** The preamp feeding a channel (/headamp/NN/gain), or null for USB returns / input OFF. */
 async gainAddress(channel:number){
  const ch=String(channel).padStart(2,'0');
  if(this.xr.model().usbChannels&&await this.xr.readParameter(`/ch/${ch}/preamp/rtnsw`)===1)return null;
  const src=await this.xr.readParameter(`/ch/${ch}/config/insrc`);
  return typeof src==='number'&&src>=0&&src<this.xr.model().micPreamps?`/headamp/${String(src+1).padStart(2,'0')}/gain`:null;
 }
 private async currentGain(channel:number){const a=await this.gainAddress(channel);return {address:a,gainDb:a?Math.round(Number(fromWire(a,await this.xr.readParameter(a)))*2)/2:null};}
 private storeCalibration(channel:number,patch:Partial<Calibration>&{peakDb?:number}){
  const p=this.profile(),cal={...(p.calibration??{})},old=cal[String(channel)];
  cal[String(channel)]={peakDb:patch.peakDb??old!.peakDb,gainDb:patch.gainDb!==undefined?patch.gainDb:old!.gainDb,bleedDb:'bleedDb' in patch?patch.bleedDb:old?.bleedDb,at:new Date().toISOString()};
  if(cal[String(channel)]!.bleedDb===undefined)delete cal[String(channel)]!.bleedDb;
  this.saveProfile({...p,calibration:cal},true);
 }
 /** Per input: current gain, measured peak/bleed, whether the measure still matches the gain, thresholds. */
 async calibrationStatus(){
  const p=this.profile(),out=[];
  for(const i of p.inputs){
   const c=p.calibration?.[String(i.channel)],s=source(i.source);let gainDb:number|null=null;
   try{gainDb=(await this.currentGain(i.channel)).gainDb;}catch{gainDb=null;}
   const valid=!!c&&(c.gainDb===null||gainDb===null||Math.abs(c.gainDb-gainDb)<.3);
   out.push({channel:i.channel,name:i.name,source:i.source,gainDb,peakDb:c?.peakDb??null,bleedDb:c?.bleedDb??null,measuredAt:c?.at??null,valid,needsBleed:s.gateThr!==null,
    state:!c?'todo':valid?'ok':'stale',thresholds:c&&valid?thresholdsFrom(s,c.peakDb,c.bleedDb):null});
  }
  return out;
 }
 /** Measure the loudest passage, then propose the preamp gain that puts peaks near -6 dBFS. */
 async gainCheck(channel:number,durationMs=4500){
  const input=this.input(channel);if(!input)throw Error('Attribuer un instrument à ce canal');
  const report=await this.measure(channel,durationMs);
  if(!report.available)return {report,decision:null,proposal:null};
  const {address,gainDb}=await this.currentGain(channel),p=address?descriptor(address):null;
  const decision=gainProposal(report.maximumDb!,gainDb,p?.min,p?.max);
  // E-drums and keyboards send a line-level signal: much preamp gain only adds hiss. Their own output volume is the right knob.
  const fam=source(input.source).family;
  if((fam==='edrums'||fam==='keys')&&(decision.state==='raise'||decision.state==='limit')&&(decision.targetGainDb??gainDb??0)>LINE_GAIN_ADVICE_DB)
   decision.message+=` ${fam==='edrums'?'Une batterie électronique':'Un clavier'} sort un signal « ligne » : au-delà de +${LINE_GAIN_ADVICE_DB} dB de gain, monte plutôt le volume de sortie de ${fam==='edrums'?'son module (Master / Output)':'l’instrument'}, puis remesure. Le son sera plus propre (moins de souffle).`;
  if(decision.state==='ok'){const old=this.profile().calibration?.[String(channel)];this.storeCalibration(channel,{peakDb:report.maximumDb!,gainDb,bleedDb:old&&old.gainDb===gainDb?old.bleedDb:undefined});return {report,decision,gainDb,proposal:null,thresholds:thresholdsFrom(source(input.source),report.maximumDb!)};}
  if(!address||decision.targetGainDb===null||decision.targetGainDb===gainDb)return {report,decision,gainDb,proposal:null};
  const plan=await this.control.preview({[address]:decision.targetGainDb});
  return {report,decision,gainDb,proposal:{...plan,title:`Gain de ${input.name} : ${decision.deltaDb>0?'+':''}${String(decision.deltaDb).replace('.',',')} dB`,explanation:`${decision.message} Seul le gain du préampli de cette entrée change. Le 48 V n’est pas touché. Baisse le volume des retours si un musicien porte ses in-ear.`,inputs:[`${input.name} (entrée ${channel})`]}};
 }
 /** Gate placement: this instrument stays silent while the others play; the level that still arrives is bleed. */
 async bleedCheck(channel:number,durationMs=4500){
  const input=this.input(channel);if(!input)throw Error('Attribuer un instrument à ce canal');
  const status=(await this.calibrationStatus()).find(c=>c.channel===channel)!;
  if(status.state!=='ok')throw Error('Règle et mesure d’abord le gain de cet instrument');
  const report=await this.measure(channel,durationMs);if(!report.available)return {report,thresholds:null};
  const bleed=report.maximumDb!;
  if(bleed>status.peakDb!-3)return {report,thresholds:null,message:'Le niveau mesuré ressemble à l’instrument lui-même. Pendant cette mesure, cet instrument doit se taire et les autres jouer.'};
  this.storeCalibration(channel,{bleedDb:bleed});
  return {report,thresholds:thresholdsFrom(source(input.source),status.peakDb!,bleed)};
 }
 async measure(channel:number,durationMs=4500){
  if(!this.input(channel))throw Error('Attribuer un instrument à ce canal');
  if(this.xr.mode!=='real'||!this.xr.status().connected)return {available:false,samples:0,state:'unknown',title:'Console réelle nécessaire',message:'Le test ne simule pas de son. Connecte la console pour recevoir ses niveaux.'};
  const identity=this.control.identity(),samples:MeterSample[]=[];
  const listener=(sample:MeterSample)=>{samples.push(structuredClone(sample));};this.xr.on('meters',listener);
  try{await new Promise(r=>setTimeout(r,Math.max(50,Math.min(durationMs,6000))));if(identity!==this.control.identity())throw Error('Connexion modifiée : recommencer le test');return levelReport(channel,samples);}
  finally{this.xr.off('meters',listener);}
 }
}
