import {PROCESSING_PRESETS} from './coach-presets.js';
import {PARAMETERS,type Value} from './parameters.js';
import {bound,envelopePoints,quantile,type GateReference} from '../shared/workshop-envelope.js';
import {inferWorkshopFamily} from '../shared/workshop-spectrum.js';
import type {Advice,Evidence,Mapping} from './workshop.js';
type Values=Record<string,Value>;
const prefix=(c:number)=>`/ch/${String(c).padStart(2,'0')}`;
const presets={voice:'lead-rock',backing:'backing-vocal',guitar:'electric-rhythm',bass:'bass-di',kick:'kick',drums:'snare',keys:'keys',other:'electric-rhythm'};
export function dynamicsAdvice(report:Evidence[],mapping:Mapping[],values:Values,references:Record<string,GateReference>={}):Advice[]{
 const result:Advice[]=[];
 for(const e of report){const m=mapping.find(m=>m.channel===e.channel),t=e.temporal;if(!m||!t)continue;
  const family=m.family??inferWorkshopFamily(m.name),preset=PROCESSING_PRESETS.find(p=>p.id===presets[family])!,p=prefix(e.channel);
  const base={channel:e.channel,start:t.softStart,stop:t.softStart+1,impact:'Traitement de cet instrument, audible en façade et dans les retours prélevés après ce traitement. Les fichiers restent intacts.'};
  const channels=Array.from({length:m.channels},(_,i)=>m.channel+i);
  const baseline=(part:string)=>Object.fromEntries(Object.entries(values).filter(([key])=>channels.some(c=>key.startsWith(prefix(c)+'/'+part+'/'))));
  const external=(part:string)=>channels.some(c=>Number(values[prefix(c)+`/${part}/keysrc`])!==0||Number(values[prefix(c)+`/${part}/filter/on`]??0)===1);
  // Envelope spread excludes low-level gaps: pauses alone must not trigger compression.
  if(t.activeSpreadDb>=7&&e.clipped===0&&channels.every(c=>Number(values[prefix(c)+'/dyn/on'])===0)){
   const attack=Math.round(t.events>=3?bound(t.attackMs/2,Math.max(5,preset.compressor.attackMs*.5),Math.min(40,preset.compressor.attackMs*2)):preset.compressor.attackMs);
   const release=Math.round(t.decayMs>0?bound(t.decayMs*.7,80,350):preset.compressor.releaseMs);
   const ratio=Math.min(3,preset.compressor.ratio),ratioIndex=PARAMETERS[p+'/dyn/ratio']!.options!.findIndex(v=>Number(v)===ratio);
   const threshold=Math.round(bound(t.activeMedianDb+3,-40,Math.min(-6,t.activePeakDb-4))*2)/2;
   const reason=external('dyn')?'La détection du compresseur utilise un filtre ou une autre source. Vérifie-la dans la Console avant cet essai.':'';
   const changes:Values={};if(!reason)for(const c of channels){const q=prefix(c);Object.assign(changes,{[q+'/dyn/on']:1,[q+'/dyn/mode']:0,[q+'/dyn/det']:0,[q+'/dyn/thr']:threshold,[q+'/dyn/ratio']:ratioIndex,[q+'/dyn/attack']:attack,[q+'/dyn/hold']:.02,[q+'/dyn/release']:release,[q+'/dyn/mgain']:0,[q+'/dyn/auto']:0,[q+'/dyn/mix']:100});}
   result.push({...base,id:`envelope-comp-${e.channel}`,kind:'dynamics',title:`${e.name} : rapprocher les passages joués`,fact:`Écart de ${t.activeSpreadDb} dB entre les niveaux faibles et forts des zones actives ; ${t.events} attaques repérées à une résolution de 20 ms.`,hypothesis:`Essaie ${ratio}:1, une attaque de ${attack} ms et un relâchement de ${release} ms. Les temps sont des points de départ adaptés à la famille et à l’enveloppe ; vérifie l’attaque et les notes tenues. Compensation à zéro.`,changes,baseline:baseline('dyn'),unavailableReason:reason||undefined});
  }
  const ref=references[String(e.channel)];if(!ref)continue;
  const points=envelopePoints(e.windows),quiet=points.filter(v=>v.at>=ref.quietStart&&v.at<ref.quietStop),soft=points.filter(v=>v.at>=ref.softStart&&v.at<ref.softStop);
  if(quiet.length<10||soft.length<10)continue;
  const noise=quantile(quiet.map(v=>v.peak),.95),weak=quantile(soft.map(v=>v.peak),.2),margin=weak-noise;
  const reason=external('gate')?'Le gate écoute une autre source ou un filtre. Vérifie sa détection dans la Console.':noise< -78?'Le passage de repos est déjà presque silencieux : activer un gate n’est pas nécessaire.':margin<10?'Le bruit et les notes faibles sont trop proches pour proposer un gate fiable. Améliore le placement du micro ou conserve ce canal ouvert.':m.channels===2?'Un gate sur cette prise stéréo peut déplacer l’image. Travaille d’abord les sources séparées ; le réglage manuel reste accessible.':'';
  const threshold=Math.round(bound(noise+Math.min(6,margin*.4),-75,weak-5)*2)/2;
  const attack=Math.round(bound(preset.gate.attackMs,1,10)),hold=Math.round(bound(preset.gate.holdMs,60,150)),release=Math.round(bound(Math.max(preset.gate.releaseMs,t.decayMs),150,600)),range=family==='drums'?12:family==='voice'||family==='backing'?6:8;
  result.push({...base,start:ref.softStart,stop:ref.softStop,id:`gate-${e.channel}`,kind:'gate',title:`${e.name} : atténuer entre les notes`,fact:`Dans les passages que tu as identifiés : repos ${noise.toFixed(1)} dBFS, notes faibles ${weak.toFixed(1)} dBFS, séparation ${margin.toFixed(1)} dB.`,hypothesis:reason||`Essai d’expansion douce 2:1 : seuil ${threshold} dB, atténuation limitée à ${range} dB, attaque ${attack} ms, maintien ${hold} ms, relâchement ${release} ms. Écoute les consonnes et la fin des notes avant de garder.`,changes:reason?{}:{[p+'/gate/on']:1,[p+'/gate/mode']:1,[p+'/gate/thr']:threshold,[p+'/gate/range']:range,[p+'/gate/attack']:attack,[p+'/gate/hold']:hold,[p+'/gate/release']:release},baseline:baseline('gate'),unavailableReason:reason||undefined});
 }
 return result;
}
