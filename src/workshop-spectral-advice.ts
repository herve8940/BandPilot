import {PARAMETERS,fromWire,type Value} from './parameters.js';
import {inferWorkshopFamily} from '../shared/workshop-spectrum.js';
import type {Advice,Evidence,Mapping} from './workshop.js';
const prefix=(c:number)=>`/ch/${String(c).padStart(2,'0')}`;
type Values=Record<string,Value>;
export function spectralAdvice(report:Evidence[],mapping:Mapping[],values:Values):Advice[]{
 const out:Advice[]=[];
 const unit=(a:string)=>values[a]===undefined?NaN:Number(fromWire(a,values[a]!));
 for(const e of report){
  const spec=e.spectral,m=mapping.find(m=>m.channel===e.channel);if(!spec||!m)continue;
  const channels=Array.from({length:m.channels},(_,i)=>m.channel+i),family=m.family??inferWorkshopFamily(m.name);
  const baseline=(kind:'eq'|'phase'|'hpf')=>Object.fromEntries(Object.entries(values).filter(([a])=>channels.some(c=>a.startsWith(prefix(c)+'/'))&&(kind==='eq'?a.includes('/eq/'):kind==='phase'?a.endsWith('/preamp/invert'):/\/preamp\/(hpon|hpf)$/.test(a))));
  const base={channel:e.channel,start:spec.lowMidStart,stop:spec.lowMidStart+1,impact:'Traitement du canal : façade et retours prélevés après ce traitement. À comparer au même volume d’écoute.'};
  const safeEq=(f:number)=>{
   const changes:Values={};let reason='';
   for(const c of channels){
    const p=prefix(c),bands=[1,2,3,4];
    if(unit(p+'/eq/on')===0&&bands.some(b=>Math.abs(unit(`${p}/eq/${b}/g`))>.1)){reason='Cet EQ désactivé contient déjà des réglages : ouvre le canal pour les vérifier avant de l’activer.';break;}
    if(unit(p+'/eq/on')===1&&bands.some(b=>unit(`${p}/eq/${b}/g`)<-1&&Math.abs(Math.log2(unit(`${p}/eq/${b}/f`)/f))<.6)){reason='Une réduction existe déjà dans cette zone. La mesure porte sur la prise avant EQ : compare à l’écoute avant d’ajouter une autre coupe.';break;}
    const band=[2,3,1,4].find(b=>Math.abs(unit(`${p}/eq/${b}/g`))<.1);
    if(!band){reason='Les bandes EQ sont déjà utilisées. Ouvre le canal pour choisir laquelle adapter.';break;}
    Object.assign(changes,{[p+'/eq/on']:1,[`${p}/eq/${band}/type`]:2,[`${p}/eq/${band}/f`]:f,[`${p}/eq/${band}/g`]:-3,[`${p}/eq/${band}/q`]:1.2});
   }
   return {changes:reason?{}:changes,reason};
  };
  if(['guitar','voice','backing','keys'].includes(family)&&spec.activeSeconds>=3&&spec.lowMidPercent>=50&&spec.lowMidSeconds>=Math.max(3,spec.activeSeconds*.25)){
   const f=250,{changes,reason}=safeEq(f);
   out.push({...base,id:`mud-${e.channel}`,kind:'eq',title:`${e.name} : bas-médiums très présents`,fact:`${spec.lowMidPercent} % de l’énergie entre 80 Hz et 8 kHz se situe entre 160 et 400 Hz ; dominance large sur ${Math.round(spec.lowMidSeconds)} s de signal.`,hypothesis:'Cette zone donne du corps, mais peut aussi rendre le son chargé. Compare une réduction légère de 3 dB à 250 Hz (Q 1,2), sans chercher à obtenir une courbe plate.',changes,baseline:baseline('eq'),unavailableReason:reason||undefined});
  }
  const cut=family==='guitar'?80:family==='voice'?90:family==='backing'?100:0;
  if(cut&&spec.activeSeconds>=3&&spec.rumblePercent>=10&&channels.some(c=>unit(prefix(c)+'/preamp/hpon')!==1||unit(prefix(c)+'/preamp/hpf')<cut*.85)){
   const changes:Values={};for(const c of channels){const p=prefix(c);if(unit(p+'/preamp/hpon')!==1||unit(p+'/preamp/hpf')<cut*.85){changes[p+'/preamp/hpon']=1;changes[p+'/preamp/hpf']=Math.max(cut,unit(p+'/preamp/hpon')===1?unit(p+'/preamp/hpf'):cut);}}
   out.push({...base,start:spec.rumbleStart,stop:spec.rumbleStart+1,id:`rumble-${e.channel}`,kind:'eq',title:`${e.name} : vérifier le grave sous ${cut} Hz`,fact:`${spec.rumblePercent} % de l’énergie mesurée entre 25 Hz et 8 kHz est sous 71 Hz.`,hypothesis:`Cela peut venir de la source, d’un bruit grave ou d’un effet volontaire. Pour la famille choisie, essaie un coupe-bas à ${cut} Hz et vérifie que le son garde son corps.`,changes,baseline:baseline('hpf')});
  }
  const phase=spec.phase;
  if(m.channels===2&&phase&&phase.activeSeconds>=2&&phase.negativePercent>0){
   const p=prefix(m.channel),right=prefix(m.channel+1),linked=channels.some(c=>{const odd=c%2?c:c-1;return Number(values[`/config/chlink/${odd}-${odd+1}`])===1;});
   const compensated=unit(p+'/preamp/invert')!==unit(right+'/preamp/invert');
   const constant=!phase.variable&&phase.correlation<=-.85&&phase.balanced;
   const reason=phase.variable?'L’opposition varie dans le passage : une inversion globale dégraderait les parties correctes. Corrige la prise concernée dans REAPER, ou prépare un atelier sur le passage indiqué.':compensated?'La console applique déjà des polarités différentes à ces deux canaux. La mesure porte sur la prise brute : vérifie d’abord le résultat à l’écoute.':linked?'Ces canaux sont liés : vérifie leur polarité dans la console avant de modifier la paire.':!constant?'Une inversion simple n’est pas suffisamment étayée. Vérifie le routage, les effets stéréo et l’alignement des prises.':'';
   out.push({...base,id:`phase-${e.channel}`,kind:'phase',start:phase.start,stop:phase.stop,title:`${e.name} : ${phase.variable?'opposition de phase par moments':'compatibilité mono à vérifier'}`,fact:`Perte maximale en sommant gauche et droite : ${phase.worstLossDb>=90?'au moins 90':phase.worstLossDb} dB ; opposition sur ${phase.negativePercent} % du signal stéréo mesurable.`,hypothesis:reason||'Les deux côtés présentent une opposition presque constante. Essaie d’inverser uniquement la polarité du canal droit, puis compare en mono et en stéréo. Une inversion de polarité ne corrige pas un retard acoustique.',changes:reason?{}:{[right+'/preamp/invert']:unit(right+'/preamp/invert')===1?0:1},baseline:baseline('phase'),unavailableReason:reason||undefined});
  }
 }
 return out.filter(a=>Object.keys(a.changes).every(k=>PARAMETERS[k]));
}
export const advicePriority=(a:Advice)=>a.id.startsWith('clip-')?0:a.kind==='phase'?1:a.id.startsWith('quiet-')?2:a.id.startsWith('gr-')?3:a.kind==='eq'?4:5;
