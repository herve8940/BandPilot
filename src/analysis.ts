import {EventEmitter} from 'node:events';
import {XR18} from './xr18.js';
import {fromWire,toWire,PARAMETERS,type Value} from './parameters.js';
import type {Family} from './sound-coach.js';

/**
 * Live analysis of the console sound, with sound-engineer recommendations.
 *
 * Everything comes from the XR18's own measurements:
 *  - /meters/4: spectrum analyser, 100 bands from 20 Hz to 20 kHz, one source at a time;
 *  - /meters/6: gain reduction of the gates, compressors and bus/Main dynamics;
 *  - /meters/1: levels of the channels and buses.
 * The app never listens to audio itself. Recommendations are proposals only: nothing is applied
 * without the user (A/B listening, then preview, backup and apply like every other change).
 */

export const BANDS=100;
/** Centre frequency of each analyser band (log scale, 20 Hz → 20 kHz). */
export const bandFreq=(i:number)=>20*Math.pow(1000,i/(BANDS-1));
const bandOf=(f:number)=>Math.max(0,Math.min(BANDS-1,Math.round(Math.log(f/20)/Math.log(1000)*(BANDS-1))));
const dbSum=(xs:number[])=>xs.length?10*Math.log10(xs.reduce((a,v)=>a+Math.pow(10,v/10),0)/xs.length):-128;
/** Average level (power) of a spectrum between two frequencies. */
export function level(spec:number[],f1:number,f2:number){const a=bandOf(f1),b=bandOf(f2);return dbSum(spec.slice(Math.min(a,b),Math.max(a,b)+1));}
/** Average several spectra in power. */
export function averageSpectra(frames:number[][]){return Array.from({length:BANDS},(_,i)=>dbSum(frames.map(f=>f[i]!).filter(Number.isFinite)));}
const r1=(v:number)=>Math.round(v*10)/10;
const sg=(v:number)=>String(r1(v)).replace('-','−');
const pad=(n:number)=>String(n).padStart(2,'0');
const hz=(f:number)=>f>=1000?`${r1(f/1000).toLocaleString('fr-BE')} kHz`:`${Math.round(f)} Hz`;

/** Frequency zones shown in « qui joue où ». */
export const ZONES:[string,number,number][]=[['Sub',20,60],['Grave',60,120],['Bas-méd.',120,350],['Médium',350,1200],['Haut-méd.',1200,2500],['Présence',2500,5000],['Brillance',5000,10000],['Air',10000,20000]];

export type Target={kind:'bus'|'lr'|'ch';n:number};
export type Severity='important'|'conseil'|'securite';
export type Recommendation={id:string;severity:Severity;where:string;title:string;why:string;changes:Record<string,Value>;channel?:number;bus?:number;zone?:string;current?:Record<string,Value|null>};
export type Instrument={channel:number;name:string;family:Family|null};
export type AnalysisSnapshot={
 active:boolean;target:Target;targetLabel:string;rehearsal:boolean;scanning:boolean;lastScanAt:string|null;
 live:{bands:number[];at:number}|null;
 map:{channel:number;name:string;family:Family|null;zones:number[]}[];
 recommendations:Recommendation[];
};

/** Guess the family of an input from its name when the coach does not know it. */
export function familyFromName(name:string):Family|null{
 const n=name.toLowerCase();
 if(/kick|grosse|gc\b|bd\b/.test(n))return 'kick';
 if(/snare|caisse|clair/.test(n))return 'snare';
 if(/tom/.test(n))return 'toms';
 if(/oh\b|over|cymb|charley|hh|hihat|hi-hat/.test(n))return 'cymbals';
 if(/e-?drum|td-?\d|batterie|drum/.test(n))return 'edrums';
 if(/bass|basse/.test(n))return 'bass';
 if(/ch(oe|œ)ur|backing voc|bv/.test(n))return 'backing';
 if(/chant|voix|vocal|voc\b|lead/.test(n))return 'voice';
 if(/gui?t|gtr/.test(n))return 'guitar';
 if(/clav|key|piano|synth|orgue/.test(n))return 'keys';
 return null;
}
/** Lowest useful frequency per family: below, a microphone only brings rumble. */
const HPF_BY_FAMILY:Partial<Record<Family,number>>={voice:100,backing:120,guitar:90,snare:90,toms:70,cymbals:250};

type Params=(address:string)=>Value|undefined;
/** Current value of a parameter in user units (Hz, dB…), or undefined when not read yet. */
function unitReader(xr:XR18):Params{const state=xr.parameterState();return a=>{const v=state[a]?.value;return v===undefined?undefined:fromWire(a,v);};}

/** EQ band of a channel that is free to use (flat, or already near the frequency we want). */
function freeBand(p:Params,prefix:string,f:number):number|null{
 for(let b=1;b<=4;b++){const bf=Number(p(`${prefix}/eq/${b}/f`)),g=Number(p(`${prefix}/eq/${b}/g`)),t=Number(p(`${prefix}/eq/${b}/type`));if(Number.isFinite(bf)&&Math.abs(Math.log2(bf/f))<0.5&&t===2)return b;}
 for(const b of [2,3,1,4]){const g=Number(p(`${prefix}/eq/${b}/g`)),t=Number(p(`${prefix}/eq/${b}/type`));if(Number.isFinite(g)&&Math.abs(g)<0.5&&(t===2||t===3))return b;}
 return null;
}
function eqCut(prefix:string,band:number,f:number,g:number,q:number):Record<string,Value>{
 return {[`${prefix}/eq/on`]:1,[`${prefix}/eq/${band}/type`]:2,[`${prefix}/eq/${band}/f`]:Math.round(f),[`${prefix}/eq/${band}/g`]:g,[`${prefix}/eq/${band}/q`]:q};
}

/** Sound-engineer rules. Pure function: spectra per channel, recent levels and gain reduction, current settings. */
export function recommend(input:{
 instruments:Instrument[];spectra:Record<number,number[]>;params:Params;
 compGr:Record<number,number>;busPeak:Record<number,number>;busNames:Record<number,string>;usedBuses:number[];
}):Recommendation[]{
 const {instruments,spectra,params:p,compGr,busPeak,busNames}=input,out:Recommendation[]=[];
 const named=(c:number)=>instruments.find(i=>i.channel===c);
 const busLabel=(b:number)=>busNames[b]?.trim()?`Ears ${busNames[b]}`:`Ears bus ${b}`;
 const allEars='tous les ears';
 // 1. Rumble: high-pass filter too low (or off) on sources that have nothing useful down there.
 for(const ins of instruments){
  const spec=spectra[ins.channel],cut=ins.family?HPF_BY_FAMILY[ins.family]:undefined;if(!spec||!cut)continue;
  const pre=`/ch/${pad(ins.channel)}`,on=Number(p(`${pre}/preamp/hpon`)),f=Number(p(`${pre}/preamp/hpf`));
  if(on===1&&f>=cut*0.85)continue;
  const low=level(spec,20,cut*0.85),body=level(spec,cut*2,cut*8);
  if(low>body-15&&body>-90)out.push({id:`hpf-${ins.channel}`,severity:'important',channel:ins.channel,where:`${ins.name} · ${allEars}`,zone:'Sub',
   title:`Coupe-bas de ${ins.name} ${on===1&&Number.isFinite(f)?`de ${Math.round(f)} → `:'à '}${cut} Hz`,
   why:`Le micro capte du grondement sous ${cut} Hz (${Math.round(low-body)>0?'+':''}${sg(Math.round(low-body))} dB par rapport au corps du son). Rien d’utile pour ${ins.name.toLowerCase()} à cet endroit : couper allège tous les ears.`,
   changes:{[`${pre}/preamp/hpon`]:1,[`${pre}/preamp/hpf`]:cut}});
 }
 // 2. Kick and bass on top of each other.
 const kick=instruments.find(i=>i.family==='kick'&&spectra[i.channel])??instruments.find(i=>i.family==='edrums'&&spectra[i.channel]);
 for(const bass of instruments.filter(i=>i.family==='bass'&&spectra[i.channel])){
  if(!kick)break;
  const ks=spectra[kick.channel]!,bs=spectra[bass.channel]!;
  let peak=bandOf(45);for(let i=bandOf(45);i<=bandOf(110);i++)if(ks[i]!>ks[peak]!)peak=i;
  const f=bandFreq(peak),kickLow=level(ks,f/1.25,f*1.25),bassLow=level(bs,f/1.25,f*1.25);
  if(kickLow>level(ks,20,20000)+3&&bassLow>level(bs,40,400)-6){
   const pre=`/ch/${pad(bass.channel)}`,band=freeBand(p,pre,f);if(band===null)continue;
   out.push({id:`mask-kick-bass-${bass.channel}`,severity:'important',channel:bass.channel,where:`${bass.name} ↔ ${kick.name} · ${allEars}`,zone:'Grave',
    title:`Creuser ${bass.name} de −3 dB à ${hz(f)}`,
    why:`${bass.name} et ${kick.name} remplissent la même zone (${hz(f/1.25)}–${hz(f*1.25)}) : le grave devient flou. ${kick.name} garde cette place, ${bass.name.toLowerCase()} se décale juste au-dessus.`,
    changes:eqCut(pre,band,f,-3,1.4)});
  }
 }
 // 3. Guitars in the presence zone of the voice.
 const voices=instruments.filter(i=>i.family==='voice'&&spectra[i.channel]);
 for(const voice of voices.slice(0,1)){
  const vs=spectra[voice.channel]!;let peak=bandOf(2000);for(let i=bandOf(2000);i<=bandOf(4500);i++)if(vs[i]!>vs[peak]!)peak=i;
  const f=bandFreq(peak),vl=level(vs,2000,4500);
  for(const gtr of instruments.filter(i=>i.family==='guitar'&&spectra[i.channel])){
   const gl=level(spectra[gtr.channel]!,2000,4500);if(gl<vl-6)continue;
   const pre=`/ch/${pad(gtr.channel)}`,band=freeBand(p,pre,f);if(band===null)continue;
   out.push({id:`mask-voice-${gtr.channel}`,severity:'conseil',channel:gtr.channel,where:`${gtr.name} ↔ ${voice.name} · ${allEars}`,zone:'Présence',
    title:`${gtr.name} −2,5 dB à ${hz(f)} (Q 2)`,
    why:`${gtr.name} occupe la zone de présence de ${voice.name.toLowerCase()} (${hz(2000)}–${hz(4500)}) : la voix se comprend moins bien dans les ears et le chanteur monte son volume.`,
    changes:eqCut(pre,band,f,-2.5,2)});
  }
 }
 // 4. One narrow resonance per channel (boxy or harsh ring).
 for(const ins of instruments){
  const spec=spectra[ins.channel];if(!spec||out.some(r=>r.channel===ins.channel&&r.id.startsWith('mask')))continue;
  const max=Math.max(...spec.slice(bandOf(150),bandOf(8000)+1));let best=-1,excess=0;
  for(let i=bandOf(150);i<=bandOf(8000);i++){const around=dbSum([...spec.slice(i-4,i-1),...spec.slice(i+2,i+5)]);const e=spec[i]!-around;if(e>excess&&spec[i]!>max-12){excess=e;best=i;}}
  if(best<0||excess<9)continue;
  const f=bandFreq(best),pre=`/ch/${pad(ins.channel)}`,band=freeBand(p,pre,f);if(band===null)continue;
  out.push({id:`res-${ins.channel}`,severity:'conseil',channel:ins.channel,where:`${ins.name} · ${allEars}`,zone:f<350?'Bas-méd.':f<1200?'Médium':f<2500?'Haut-méd.':'Présence',
   title:`Résonance de ${ins.name} à ${hz(f)} : −3 dB (Q 4)`,
   why:`Une bande étroite ressort de ${Math.round(excess)} dB au-dessus de ses voisines : son qui « sonne » ou siffle, et premier endroit où un larsen démarre dans les retours.`,
   changes:eqCut(pre,band,f,-3,4)});
 }
 // 5. Compressor squashing too hard.
 for(const ins of instruments){
  const gr=compGr[ins.channel];if(gr===undefined||gr>-8)continue;
  const pre=`/ch/${pad(ins.channel)}`,thr=Number(p(`${pre}/dyn/thr`));if(Number(p(`${pre}/dyn/on`))!==1||!Number.isFinite(thr))continue;
  const next=Math.min(0,Math.round((thr+Math.abs(gr)-4)*2)/2);
  out.push({id:`comp-${ins.channel}`,severity:'conseil',channel:ins.channel,where:`${ins.name} · ${allEars}`,
   title:`Compresseur de ${ins.name} : seuil ${sg(thr)} → ${sg(next)} dB`,
   why:`Il retire jusqu’à ${Math.round(-gr)} dB : le son est écrasé et perd sa dynamique. Visé : environ 4 dB de réduction sur les passages forts.`,
   changes:{[`${pre}/dyn/thr`]:next}});
 }
 // 6. Ear safety: a monitor mix close to clipping.
 for(const b of input.usedBuses){
  const peak=busPeak[b];if(peak===undefined||peak<=-3)continue;
  const pre=`/bus/${b}`;
  if(Number(p(`${pre}/dyn/on`))!==1){
   out.push({id:`limit-${b}`,severity:'securite',bus:b,where:busLabel(b),
    title:`Limiteur de protection sur ${busLabel(b)}`,
    why:`Crêtes à ${sg(peak)} dB, trop près du maximum. Un limiteur à −6 dB garantit qu’aucun pic ne dépasse ce niveau dans les oreilles.`,
    changes:{[`${pre}/dyn/on`]:1,[`${pre}/dyn/mode`]:0,[`${pre}/dyn/ratio`]:11,[`${pre}/dyn/thr`]:-6,[`${pre}/dyn/knee`]:0,[`${pre}/dyn/attack`]:1,[`${pre}/dyn/release`]:100,[`${pre}/dyn/mgain`]:0}});
  }else{
   const fader=Number(p(`${pre}/mix/fader`));if(!Number.isFinite(fader))continue;
   out.push({id:`ear-${b}`,severity:'securite',bus:b,where:busLabel(b),
    title:`${busLabel(b)} : −3 dB`,
    why:`Crêtes à ${sg(peak)} dB : le limiteur travaille sans arrêt. Baisser le mix de 3 dB rend le son plus propre dans l’oreille.`,
    changes:{[`${pre}/mix/fader`]:Math.max(-90,Math.round((fader-3)*2)/2)}});
  }
 }
 const order:Record<Severity,number>={securite:0,important:1,conseil:2};
 return out.filter(r=>Object.keys(r.changes).every(a=>PARAMETERS[a])).sort((a,b)=>order[a.severity]-order[b.severity]);
}

export class Analyzer extends EventEmitter{
 private active=false;private target:Target={kind:'lr',n:0};private live:number[]|null=null;private liveAt=0;private lastEmit=0;
 private spectra:Record<number,number[]>={};private scanFrames:number[][]|null=null;private scanning=false;private lastScanAt:string|null=null;
 private grSamples:{at:number;comp:number[]}[]=[];private busSamples:{at:number;bus:number[]}[]=[];
 private dismissed=new Set<string>();private ab=new Map<string,Record<string,Value>>();
 // A recommendation being compared A/B stays available even once B makes the rule silent.
 private pinned=new Map<string,Recommendation>();
 constructor(private xr:XR18,private instruments:()=>Instrument[]){
  super();
  xr.on('rta',({bands}:{bands:number[]})=>{
   if(this.scanFrames){this.scanFrames.push(bands);return;}
   // While scanning, the analyser listens to one instrument after the other: not the mix shown live.
   if(!this.active||this.scanning)return;
   this.live=this.live?this.live.map((v,i)=>Math.max(bands[i]!,v-1.5)):bands;// fast attack, slow release, like a real analyser
   this.liveAt=Date.now();
   if(Date.now()-this.lastEmit>200){this.lastEmit=Date.now();this.emit('live',{bands:this.live.map(r1),at:this.liveAt});}
  });
  xr.on('dynamics',({comp}:{comp:number[]})=>{if(this.active){this.grSamples.push({at:Date.now(),comp});this.trim();}});
  xr.on('meters',(m:{all:number[]})=>{if(this.active&&m.all?.length>=32){this.busSamples.push({at:Date.now(),bus:m.all.slice(26,32)});this.trim();}});
 }
 private trim(){const t=Date.now()-15000;while(this.grSamples[0]&&this.grSamples[0].at<t)this.grSamples.shift();while(this.busSamples[0]&&this.busSamples[0].at<t)this.busSamples.shift();}
 private code(t:Target){return t.kind==='lr'?XR18.RTA.lr:t.kind==='bus'?XR18.RTA.bus(t.n):XR18.RTA.channel(t.n);}
 private label(t:Target){
  const v=this.xr.parameterState();
  if(t.kind==='lr')return 'Main';
  if(t.kind==='bus'){const n=String(v[`/bus/${t.n}/config/name`]?.value??'').trim();return n?`Ears ${n}`:`Ears bus ${t.n}`;}
  return this.instruments().find(i=>i.channel===t.n)?.name??`Canal ${t.n}`;
 }
 start(target?:Target){
  if(this.xr.mode!=='real'||!this.xr.status().connected)throw Error('L’analyse a besoin de la vraie XR18 connectée.');
  if(target)this.validate(target);
  this.target=target??this.defaultTarget();this.active=true;this.live=null;
  this.xr.setRtaSource(this.code(this.target));this.xr.startAnalysisStream();this.emit('state');return this.snapshot();
 }
 stop(){this.active=false;this.xr.stopAnalysisStream();this.emit('state');return this.snapshot();}
 setTarget(target:Target){this.validate(target);this.target=target;this.live=null;if(this.active)this.xr.setRtaSource(this.code(target));this.emit('state');return this.snapshot();}
 private validate(t:Target){if(!t||!['bus','lr','ch'].includes(t.kind)||(t.kind==='bus'&&!(t.n>=1&&t.n<=6))||(t.kind==='ch'&&!(t.n>=1&&t.n<=16)))throw Error('Source d’analyse invalide');}
 /** In rehearsal the band only hears the ears: listen to the first monitor mix that carries sound. */
 private defaultTarget():Target{
  if(!this.xr.isRehearsal())return {kind:'lr',n:0};
  const all=this.xr.meterState().all??[];let best=1,lvl=-200;for(let b=1;b<=6;b++){const v=all[25+b]??-128;if(v>lvl){lvl=v;best=b;}}
  return {kind:'bus',n:best};
 }
 /** Listen to each instrument that plays, one after the other (the analyser has one source at a time). */
 async scan(perChannelMs=1200){
  if(!this.active)this.start();
  if(this.scanning)throw Error('Analyse des instruments déjà en cours');
  this.scanning=true;this.emit('state');
  try{
   const meters=this.xr.meterState().channels??[];
   const playing=this.instruments().filter(i=>(meters[i.channel-1]??-128)>-60);
   const list=playing.length?playing:this.instruments();
   for(const ins of list){
    if(!this.active)break;
    this.xr.setRtaSource(XR18.RTA.channel(ins.channel));await new Promise(r=>setTimeout(r,300));
    this.scanFrames=[];await new Promise(r=>setTimeout(r,perChannelMs));
    const frames=this.scanFrames;this.scanFrames=null;
    if(frames.length)this.spectra[ins.channel]=averageSpectra(frames);
    this.emit('progress',{channel:ins.channel,name:ins.name});
   }
   this.lastScanAt=new Date().toISOString();
  }finally{this.scanFrames=null;this.scanning=false;if(this.active)this.xr.setRtaSource(this.code(this.target));this.emit('state');}
  return this.snapshot();
 }
 recommendations(){
  const v=this.xr.parameterState(),p=unitReader(this.xr);
  const compGr:Record<number,number>={},busPeak:Record<number,number>={};
  for(const s of this.grSamples)s.comp.forEach((g,i)=>{compGr[i+1]=Math.min(compGr[i+1]??0,g);});
  for(const s of this.busSamples)s.bus.forEach((l,i)=>{busPeak[i+1]=Math.max(busPeak[i+1]??-128,l);});
  const busNames:Record<number,string>={};const usedBuses:number[]=[];
  for(let b=1;b<=6;b++){busNames[b]=String(v[`/bus/${b}/config/name`]?.value??'');if(busNames[b]!.trim()||(busPeak[b]??-128)>-60)usedBuses.push(b);}
  const list=recommend({instruments:this.instruments(),spectra:this.spectra,params:p,compGr,busPeak,busNames,usedBuses});
  for(const r of this.pinned.values())if(!list.some(x=>x.id===r.id))list.unshift(r);
  for(const r of list)if(!this.pinned.has(r.id))r.current=Object.fromEntries(Object.keys(r.changes).map(a=>[a,p(a)??null]));
  return list.filter(r=>!this.dismissed.has(r.id));
 }
 find(id:string){const r=this.recommendations().find(r=>r.id===id);if(!r)throw Error('Recommandation introuvable ou déjà réglée : relance l’analyse');return r;}
 dismiss(id:string){this.dismissed.add(id);this.emit('state');return this.snapshot();}
 /** A/B: switch the console between the current setting (A) and the recommendation (B), live, without backup. */
 async listen(id:string,side:'a'|'b'){
  const r=this.find(id);this.pinned.set(id,r);
  if(side==='b'){
   if(!this.ab.has(id)){const before:Record<string,Value>={};for(const a of Object.keys(r.changes))before[a]=await this.xr.readParameter(a);this.ab.set(id,before);}
   const wire=Object.fromEntries(Object.entries(r.changes).map(([a,u])=>[a,toWire(a,u)]));
   await this.xr.applyParameters(wire,false,true);
  }else await this.restoreA(id);
  return {id,side};
 }
 /** Back to A before the real preview, so the backup made at apply time holds the true "before". */
 async restoreA(id:string){const before=this.ab.get(id);if(before){await this.xr.applyParameters(before,false,true);this.ab.delete(id);}}
 /** The comparison is over (applied or closed): the rules decide again whether it is still needed. */
 release(id:string){this.pinned.delete(id);this.emit('state');}
 snapshot():AnalysisSnapshot{
  const instruments=this.instruments();
  return {active:this.active,target:this.target,targetLabel:this.label(this.target),rehearsal:this.xr.isRehearsal(),scanning:this.scanning,lastScanAt:this.lastScanAt,
   live:this.live?{bands:this.live.map(r1),at:this.liveAt}:null,
   map:instruments.filter(i=>this.spectra[i.channel]).map(i=>({channel:i.channel,name:i.name,family:i.family,zones:ZONES.map(([,a,b])=>r1(level(this.spectra[i.channel]!,a,b)))})),
   recommendations:this.recommendations()};
 }
}
