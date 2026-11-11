import type {TechRider} from '../../shared/tech-rider';
import {COACH_SOUNDS,DEFAULT_COACH_SOUND,GAIN_HEADROOMS,DEFAULT_GAIN_HEADROOM,MONITOR_LISTENING,coachSound,gainHeadroom,type CoachSound,type GainHeadroom,type MonitorListening} from '../../shared/coach-sound';
import {tx, getLocale} from "./i18n";
import {useMixerModel} from './MixerModel';
import {useEffect,useState} from 'react';
import {Eraser,Check,Drum,Headphones,Plus,QrCode,Trash2,Users,Wand2} from 'lucide-react';

export type Input={channel:number;source:string;name:string};
export type Role='chant'|'guitare'|'basse'|'batterie'|'clavier';
export type Musician={name:string;bus:number;role:Role;channels:number[]};
export type Profile={version:1;sound?:CoachSound;headroom?:GainHeadroom;inputs:Input[];completed:string[];musicians?:Musician[];tech?:TechRider};
export type Source={id:string;label:string;group:string;family:string;color:number;name:string;pan:number};
export type PresetCard={title:string;description:string;advice:string;lines:string[]};
export type CoachData={sources:Source[];presets:Record<string,PresetCard>;presetsBySound?:Record<CoachSound,Record<string,PresetCard>>;roles:{id:Role;label:string;hint:string}[];recipes:Record<Role,Record<string,number>>;recipesByListening?:Record<MonitorListening,Record<Role,Record<string,number>>>;ownLevel:number;templates:{id:string;label:string;description:string;inputs:Input[]}[];drumKit:string[]};

const COLORS=['#555','#e5534b','#57ab5a','#d4b106','#539bf5','#c96198','#39c5cf','#cdd9e5'];
const swatch=(c:number)=>COLORS[c%8];
const freeChannel=(inputs:Input[],after=0,max=16)=>Array.from({length:max},(_,i)=>i+1).find(n=>n>after&&!inputs.some(i=>i.channel===n));
/** Group the instrument list like a stage plot: voices, guitars, bass, drum kit, electronic drums, keys. */
function InstrumentSelect({data,value,disabled,onChange}:{data:CoachData;value:string;disabled:boolean;onChange:(id:string)=>void}){
 const groups=[...new Set(data.sources.map(s=>s.group))];
 return <select disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}>{groups.map(g=><optgroup key={g} label={tx(g)}>{data.sources.filter(s=>s.group===g).map(s=><option key={s.id} value={s.id}>{tx(s.label)}</option>)}</optgroup>)}</select>;
}

export function InputsStep({data,profile,setProfile,admin,busy,canApply,onApplyChannel,onApplyAll,onSave,notify,onNext,onBlank}:{
 data:CoachData;profile:Profile;setProfile:(p:Profile)=>void;admin:boolean;busy:boolean;canApply:boolean;
 onApplyChannel:(p:Profile,channel:number)=>void;onApplyAll:(p:Profile)=>void;onSave:(p:Profile)=>Promise<boolean>;notify:(m:string)=>void;onNext:()=>void;onBlank:()=>void}){
 const model=useMixerModel();
 const [open,setOpen]=useState<number|null>(null);
 const sound=coachSound(profile.sound),presets=data.presetsBySound?.[sound.id]??data.presets;
 const src=(id:string)=>data.sources.find(s=>s.id===id)!;
 const withoutObsoleteWiring=(next:Profile):Profile=>{
  if(!next.tech?.inputs)return next;
  const unchanged=new Set(next.inputs.filter(i=>profile.inputs.some(old=>old.channel===i.channel&&old.source===i.source)).map(i=>i.channel));
  const inputs=Object.fromEntries(Object.entries(next.tech.inputs).filter(([channel])=>unchanged.has(Number(channel))).map(([channel,details])=>[channel,{...details,stereoWith:details.stereoWith&&unchanged.has(details.stereoWith)?details.stereoWith:undefined}]));
  return {...next,tech:{...next.tech,inputs}};
 };
 const update=(next:Profile)=>setProfile({...withoutObsoleteWiring(next),musicians:next.musicians?.map(m=>({...m,channels:m.channels.filter(c=>next.inputs.some(i=>i.channel===c))}))});
 const choose=(index:number,id:string)=>{
  const current=profile.inputs[index]!,before=src(current.source);
  const keepName=current.name.trim()&&current.name!==before.name&&!/^Micro \d+$/.test(current.name);
  const next=withoutObsoleteWiring({...profile,inputs:profile.inputs.map((v,i)=>i===index?{...v,source:id,name:keepName?v.name:src(id).name}:v)});
  setProfile(next);setOpen(current.channel);
  notify('Instrument choisi. Enregistre ton groupe, puis utilise Préparer les réglages quand tu es prêt.');
 };
 const addDrums=()=>{
  const inputs=profile.inputs.filter(i=>!i.source.startsWith('drum-module'));let last=0;
  for(const id of data.drumKit){if(inputs.some(i=>i.source===id))continue;const ch=freeChannel(inputs,last,model.channels)??freeChannel(inputs,0,model.channels);if(!ch){notify(`Plus assez d’entrées libres pour toute la batterie (${model.channels} maximum).`);return;}inputs.push({channel:ch,source:id,name:src(id).name});last=ch;}
  update({...profile,inputs:inputs.sort((a,b)=>a.channel-b.channel)});notify('Batterie détaillée ajoutée : kick, snare, tom 1, tom 2, tom 3, OH 1 et OH 2. Vérifie les numéros d’entrée puis applique.');
 };
 return <div className="coach-section">
  <div className="coach-sound-choice">
   <label>{tx('Base sonore')}<select aria-label={tx('Base sonore')} disabled={!admin||busy} value={sound.id} onChange={e=>{setProfile({...profile,sound:e.target.value as CoachSound});notify('Base sonore choisie. Enregistre ton groupe ou prépare les réglages pour voir les changements.');}}>{COACH_SOUNDS.map(s=><option key={s.id} value={s.id}>{tx(s.label)}</option>)}</select></label>
   <p>{tx(sound.description)}</p>
   <p>{tx('Les traitements des canaux sont communs aux sorties qui les reçoivent. Chaque musicien conserve son propre mix de retour.')}</p>
   <label>{tx('Marge à l’entrée')}<select aria-label={tx('Marge à l’entrée')} disabled={!admin||busy} value={profile.headroom??DEFAULT_GAIN_HEADROOM} onChange={e=>setProfile({...profile,headroom:e.target.value as GainHeadroom})}>{GAIN_HEADROOMS.map(h=><option key={h.id} value={h.id}>{tx(h.label)}</option>)}</select></label>
   <p>{tx('Plus de marge laisse davantage de place aux crêtes imprévues. Ce choix est indépendant du style sonore et du type de retour ; il sera utilisé pour régler les gains à l’étape 3.')}</p>
  </div>
  <div className="coach-blank"><Eraser size={18}/><p><b>{tx("La console garde les réglages d’un autre groupe ou d’un ancien concert ?")}</b>{tx(" Repars d’une scène vierge : tout revient à neutre, volumes en bas. Le 48 V, les gains et le routage ne bougent pas.")}</p><button disabled={!admin||busy||!canApply} onClick={onBlank}>{tx(busy?"Lecture de la console…":"Partir d’une scène vierge")}</button></div>
  <h3>{tx("1. Pars d’un modèle")}</h3>
  <div className="coach-templates">{data.templates.map(t=><button key={t.id} disabled={!admin||busy} onClick={()=>{update({...profile,inputs:structuredClone(t.inputs)});notify(`Modèle « ${t.label} » chargé. Rien n’est encore envoyé à la console.`);}}><b>{tx(t.label)}</b><small>{tx(t.description)}</small></button>)}
   <button className="drums" disabled={!admin||busy} onClick={addDrums}><b><Drum size={16}/>{tx(" Ajouter la batterie détaillée")}</b><small>{tx("Kick, snare, tom 1, tom 2, tom 3, OH 1, OH 2 sur les entrées libres.")}</small></button></div>
  <h3>{tx("2. Choisis l’instrument de chaque prise")}</h3>
  <p className="coach-hint">{tx('Ajouter ou choisir un instrument prépare ton groupe. La console est consultée seulement avec Préparer les réglages, puis modifiée après confirmation.')}</p>
  <div className="coach-inputs">{profile.inputs.map((input,index)=>{const s=src(input.source),card=presets[input.source];return <div className="coach-input2" key={input.channel+':'+index} style={{['--chip' as string]:swatch(s.color)}}>
   <div className="row">
    <label>{tx("Prise")}<select disabled={!admin||busy} value={input.channel} onChange={e=>{const channel=Number(e.target.value);update({...profile,inputs:profile.inputs.map((v,i)=>i===index?{...v,channel}:v),musicians:profile.musicians?.map(m=>({...m,channels:m.channels.map(c=>c===input.channel?channel:c)}))});}}>{Array.from({length:model.channels},(_,i)=><option key={i+1} value={i+1} disabled={i+1!==input.channel&&profile.inputs.some(v=>v.channel===i+1)}>{tx("Entrée ")}{tx(i+1)}</option>)}</select></label>
    <label>{tx("Instrument")}<InstrumentSelect data={data} value={input.source} disabled={!admin||busy} onChange={id=>choose(index,id)}/></label>
    <label>{tx("Nom sur la console")}<input disabled={!admin||busy} value={input.name} maxLength={12} onChange={e=>update({...profile,inputs:profile.inputs.map((v,i)=>i===index?{...v,name:e.target.value}:v)})}/></label>
    <div className="row-actions"><button className="apply" disabled={!admin||busy||!canApply} title={tx("Appliquer la configuration complète de cet instrument")} onClick={()=>onApplyChannel(profile,input.channel)}><Wand2 size={15}/>{tx(" Préparer les réglages")}</button><button disabled={!admin||busy} aria-label={tx('Retirer '+input.name)} title={tx("Retirer")} onClick={()=>update({...profile,inputs:profile.inputs.filter((_,i)=>i!==index)})}><Trash2 size={15}/></button></div>
   </div>
   {card&&<details open={open===input.channel} onToggle={e=>{if((e.target as HTMLDetailsElement).open)setOpen(input.channel);}}><summary>{tx("Ce que je règle : ")}{tx(card.title)}</summary><ul>{card.lines.map((l,n)=><li key={n}>{tx(l)}</li>)}</ul><p>{tx(card.advice)}</p></details>}
  </div>;})}</div>
  <div className="coach-actions">
   <button disabled={!admin||busy||profile.inputs.length>=model.channels} onClick={()=>{const ch=freeChannel(profile.inputs,0,model.channels);if(ch)update({...profile,inputs:[...profile.inputs,{channel:ch,source:'lead-rock',name:'Micro '+ch}].sort((a,b)=>a.channel-b.channel)});}}><Plus size={15}/>{tx(" Ajouter un instrument")}</button>
   <button disabled={!admin||busy} onClick={()=>onSave(profile)}>{tx("Enregistrer mon groupe")}</button>
   <button className="primary" disabled={!admin||busy||!canApply||!profile.inputs.length} onClick={()=>onApplyAll(profile)}><Wand2 size={16}/>{tx(" Préparer les réglages du groupe (")}{tx(profile.inputs.length)}{tx(" instruments)")}</button>
   <button disabled={!admin||busy||!profile.inputs.length} onClick={()=>void onSave(profile).then(saved=>{if(saved)onNext();})}>{tx("Étape suivante : régler les gains →")}</button>
  </div>
  <p className="coach-note">{tx('Les presets sont des points de départ à adapter à tes sources et à l’écoute. Règle les gains à l’étape 3. Chaque application affiche la comparaison avant / après et crée une sauvegarde.')} {sound.id==='natural'&&tx('En mode Naturel, les gates restent désactivés : les seules crêtes fortes ne suffisent pas à préserver les notes faibles.')}</p>
 </div>;
}

export function EarsStep({data,profile,setProfile,admin,busy,canApply,onSuggest,onApply,onShare,onSave}:{
 data:CoachData;profile:Profile;setProfile:(p:Profile)=>void;admin:boolean;busy:boolean;canApply:boolean;
 onSuggest:()=>void;onApply:(p:Profile,bus?:number)=>void;onShare:(p:Profile)=>void;onSave:(p:Profile)=>void}){
 const model=useMixerModel();
 const musicians=profile.musicians??[];
 const src=(id:string)=>data.sources.find(s=>s.id===id)!;
 const set=(list:Musician[])=>setProfile({...profile,musicians:list});
 const edit=(i:number,patch:Partial<Musician>)=>{
  const next=musicians.map((m,n)=>n===i?{...m,...patch}:m),oldBus=musicians[i]!.bus;
  if(patch.bus===undefined||patch.bus===oldBus||!profile.tech){set(next);return;}
  // The listening equipment and stage position belong to the player when moving buses.
  const move=<V,>(values:Record<string,V>|undefined)=>{
   const entries={...values};delete entries[String(patch.bus)];
   if(entries[String(oldBus)])entries[String(patch.bus)]=entries[String(oldBus)]!;
   delete entries[String(oldBus)];
   return entries;
  };
  const tech={...profile.tech,monitors:move(profile.tech.monitors),positions:move(profile.tech.positions)};
  setProfile({...profile,musicians:next,tech});
 };
 const listening=(m:Musician)=>profile.tech?.monitors?.[m.bus]?.kind;
 const setListening=(m:Musician,kind:MonitorListening|undefined)=>setProfile({...profile,tech:{...profile.tech,monitors:{...profile.tech?.monitors,[m.bus]:{...profile.tech?.monitors?.[m.bus],kind}}}});
 const level=(m:Musician,input:Input)=>{const family=src(input.source).family,kind=listening(m),recipes=(kind&&data.recipesByListening?.[kind])||data.recipes;return m.channels.includes(input.channel)&&!(m.role==='batterie'&&family!=='edrums')?data.ownLevel:recipes[m.role][family]!;};
 const freeBus=Array.from({length:model.monitorOutputs},(_,i)=>i+1).find(b=>!musicians.some(m=>m.bus===b));
 return <div className="coach-section">
  <div className="coach-checklist"><p><Headphones size={18}/>{tx(" Chaque musicien a son propre bus (sortie Aux 1 à ")}{tx(model.monitorOutputs)}{tx(" de la console) : branche-y son boîtier in-ear ou son retour.")}</p><p><Check size={17}/>{tx(" Je prépare un mix de départ ")}<b>{tx("pré-fader")}</b>{tx(" : ce que tu changes en façade ne bouge pas ses oreilles.")}</p><p><QrCode size={17}/>{tx(" Ensuite, chacun scanne son QR code et ajuste son mix sur son téléphone.")}</p></div>
  <div className="coach-actions"><button disabled={!admin||busy} onClick={onSuggest}><Users size={15}/>{tx(" Proposer les musiciens d’après mon groupe")}</button><button disabled={!admin||busy||!freeBus} onClick={()=>freeBus&&set([...musicians,{name:'Musicien '+freeBus,bus:freeBus,role:'chant',channels:[]}])}><Plus size={15}/>{tx(" Ajouter un musicien")}</button></div>
  {!musicians.length&&<p className="coach-note">{tx("Aucun musicien pour l’instant : clique sur « Proposer les musiciens d’après mon groupe ».")}</p>}
  <div className="coach-musicians">{musicians.map((m,i)=>{const role=data.roles.find(r=>r.id===m.role)!;const rows=[...profile.inputs].map(input=>({input,db:level(m,input)})).sort((a,b)=>b.db-a.db);return <article className="coach-musician" key={i}>
   <div className="row">
    <label>{tx("Musicien")}<input disabled={!admin||busy} value={m.name} maxLength={12} onChange={e=>edit(i,{name:e.target.value})}/></label>
    <label>{tx("Sortie / bus")}<select disabled={!admin||busy} value={m.bus} onChange={e=>edit(i,{bus:Number(e.target.value)})}>{Array.from({length:model.monitorOutputs},(_,b)=><option key={b+1} value={b+1} disabled={b+1!==m.bus&&musicians.some(x=>x.bus===b+1)}>{tx("Bus ")}{tx(b+1)}{tx(" (Aux ")}{tx(b+1)})</option>)}</select></label>
    <label>{tx("Rôle")}<select disabled={!admin||busy} value={m.role} onChange={e=>edit(i,{role:e.target.value as Role})}>{data.roles.map(r=><option key={r.id} value={r.id}>{tx(r.label)}</option>)}</select></label>
    <label>{tx('Écoute')}<select aria-label={tx('Écoute de '+m.name)} disabled={!admin||busy} value={listening(m)??''} onChange={e=>setListening(m,(e.target.value||undefined) as MonitorListening|undefined)}><option value="">{tx('À préciser · mix historique')}</option>{MONITOR_LISTENING.map(l=><option key={l.id} value={l.id}>{tx(l.label)}</option>)}</select></label>
    <div className="row-actions"><button className="apply" disabled={!admin||busy||!canApply} onClick={()=>onApply(profile,m.bus)}><Wand2 size={15}/>{tx(" Préparer les réglages")}</button><button disabled={!admin||busy} aria-label={tx('Retirer '+m.name)} onClick={()=>set(musicians.filter((_,n)=>n!==i))}><Trash2 size={15}/></button></div>
   </div>
   <small className="role-hint">{tx(role.hint)}</small>
   <div className="own"><span>{tx("Ses instruments (mis devant) :")}</span>{profile.inputs.map(input=><button key={input.channel} disabled={!admin||busy} className={m.channels.includes(input.channel)?'on':''} onClick={()=>edit(i,{channels:m.channels.includes(input.channel)?m.channels.filter(c=>c!==input.channel):[...m.channels,input.channel]})}>{input.name}</button>)}</div>
   <div className="mixbars" aria-label={tx('Mix de départ de '+m.name)}>{rows.map(({input,db})=><div key={input.channel} className={db<=-90?'off':''}><span>{input.name}</span><i><b style={{width:db<=-90?'0%':Math.max(4,Math.round((db+40)/40*100))+'%',background:swatch(src(input.source).color)}}/></i><em>{tx(db<=-90?'coupé':db+' dB')}</em></div>)}</div>
  </article>;})}</div>
  <div className="coach-actions">
   <button disabled={!admin||busy} onClick={()=>onSave(profile)}>{tx("Enregistrer les musiciens")}</button><button className="primary" disabled={!admin||busy||!canApply||!musicians.length||!profile.inputs.length} onClick={()=>onApply(profile)}><Wand2 size={16}/>{tx(" Appliquer les retours de tous (")}{tx(musicians.length)})</button>
   <button disabled={!admin||busy||!musicians.length} onClick={()=>onShare(profile)}><QrCode size={16}/>{tx(" Créer les QR codes des musiciens")}</button>
  </div>
  <p className="coach-note">{tx('Choisis l’écoute de chaque musicien : un même groupe peut mélanger in-ears, casques et retours de scène. Pour le batteur aux in-ears ou au casque, les toms sont plus présents et les overheads démarrent bas. Sans choix, le mix historique est conservé.')} {tx('Ce sont des niveaux de départ, à ajuster selon ce que chacun entend. Le bus démarre à −10 dB ; garde le volume du boîtier bas au premier essai.')}</p>
 </div>;
}

type Thresholds={compThrDb:number|null;gateThrDb:number|null;note:string};
type Cal={channel:number;name:string;source:string;gainDb:number|null;peakDb:number|null;bleedDb:number|null;valid:boolean;needsBleed:boolean;state:'todo'|'ok'|'stale';thresholds:Thresholds|null};
type Report={available:boolean;title:string;message:string;maximumDb?:number};
type Decision={state:string;title:string;message:string;deltaDb:number};
type GainResult={report:Report;decision:Decision|null;proposal:unknown|null;gainDb?:number|null;thresholds?:Thresholds};
type BleedResult={report:Report;thresholds:Thresholds|null;message?:string};
const db=(v:number|null|undefined)=>v===null||v===undefined?'—':(v>0?'+':'')+(Math.round(v*2)/2).toLocaleString(getLocale())+' dB';
const STATE_LABEL={todo:'À mesurer',ok:'Calé',stale:'Mesure à refaire'};
/** Peak position on a -60..0 dBFS scale, with the selected headroom target zone. */
function PeakBar({peak,target=-6}:{peak:number;target?:number}){
 const pos=(v:number)=>Math.max(0,Math.min(100,(v+60)/60*100));
 return <div className="peakbar" aria-label={tx('Crête '+db(peak))}><span className="zone" style={{left:pos(target-3)+'%',width:(pos(target+3)-pos(target-3))+'%'}}/><i style={{width:pos(peak)+'%'}} className={peak>=-1?'clip':Math.abs(peak-target)<=3?'good':'off'}/><small style={{left:pos(target)+'%'}}>{String(target).replace('-','−')}</small></div>;
}
export function GainStep({profile,channel,setChannel,admin,busy,canApply,real,refresh,api,run,onPlan,onApplyChannel,onApplyAll,onMeasured}:{
 profile:Profile;channel:number;setChannel:(c:number)=>void;admin:boolean;busy:boolean;canApply:boolean;real:boolean;refresh:number;
 api:(path:string,data?:unknown)=>Promise<any>;run:(fn:()=>Promise<void>)=>void;onMeasured?:()=>void;onPlan:(plan:any)=>void;onApplyChannel:(p:Profile,ch:number)=>void;onApplyAll:(p:Profile)=>void}){
 const [status,setStatus]=useState<Cal[]>([]),[gain,setGain]=useState<GainResult|null>(null),[bleed,setBleed]=useState<BleedResult|null>(null),[measuring,setMeasuring]=useState<''|'gain'|'bleed'>('');
 const natural=profile.sound==='natural',target=gainHeadroom(profile.headroom).targetPeakDb;
 useEffect(()=>{let live=true;api('/api/coach/calibration',{sound:profile.sound??DEFAULT_COACH_SOUND,headroom:profile.headroom??DEFAULT_GAIN_HEADROOM}).then(s=>{if(live)setStatus(s);}).catch(()=>{});return()=>{live=false;};},[refresh,channel,profile.inputs.length,profile.sound,profile.headroom,gain,bleed]);
 useEffect(()=>{setGain(null);setBleed(null);},[channel,profile.sound,profile.headroom]);
 const current=status.find(s=>s.channel===channel),input=profile.inputs.find(i=>i.channel===channel);
 const done=status.filter(s=>s.state==='ok').length,index=profile.inputs.findIndex(i=>i.channel===channel),next=profile.inputs[index+1];
 const measure=(kind:'gain'|'bleed')=>run(async()=>{setMeasuring(kind);try{if(kind==='gain'){const r=await api('/api/coach/gain',{channel}) as GainResult;setGain(r);setBleed(null);if(r.proposal)onPlan(r.proposal);}else setBleed(await api('/api/coach/bleed',{channel}));}finally{setMeasuring('');onMeasured?.();}});
 const th=bleed?.thresholds??current?.thresholds??null;
 // The proposal belongs to the measure: once the gain has changed (applied here or on the console), it is out of date.
 const gainMoved=!!gain&&gain.gainDb!=null&&current?.gainDb!=null&&current.gainDb!==gain.gainDb;
 return <div className="coach-section gain-step">
  {!real&&<p className="coach-message warn">{tx("La mesure a besoin de la vraie console et des musiciens qui jouent. En simulation, aucun niveau n’est inventé : connecte la console pour régler les gains.")}</p>}
  <h3>{tx("Où en est chaque instrument ")}<small>{tx(done)} / {tx(profile.inputs.length)}{tx(" calés")}</small></h3>
  <div className="gain-table" role="table">
   <div role="row" className="head"><span>{tx("Instrument")}</span><span>{tx("Gain")}</span><span>{tx("Niveau max")}</span><span>{tx("Repisse")}</span><span>{tx("Compresseur")}</span><span>{tx("Gate")}</span><span>{tx("État")}</span></div>
   {profile.inputs.map(i=>{const s=status.find(s=>s.channel===i.channel);return <button role="row" key={i.channel} className={(i.channel===channel?'active ':'')+(s?.state??'todo')} onClick={()=>setChannel(i.channel)}>
    <span><b>{i.name}</b> <small>{tx("entrée ")}{tx(i.channel)}</small></span><span>{tx(db(s?.gainDb))}</span><span>{tx(s?.valid?db(s.peakDb):'—')}</span><span>{tx(s?.valid&&s.needsBleed?db(s.bleedDb):s?.needsBleed?'—':'inutile')}</span>
    <span>{tx(s?.thresholds?.compThrDb!=null?db(s.thresholds.compThrDb):'—')}</span><span>{tx(natural?'off':s?.thresholds?.gateThrDb!=null?db(s.thresholds.gateThrDb):s?.needsBleed?'—':'off')}</span><span className="pill">{tx(STATE_LABEL[s?.state??'todo'])}</span></button>;})}
  </div>
  {input&&<div className="gain-card">
   <h3>{input.name} <small>{tx("entrée ")}{tx(channel)}{tx(current?.gainDb!=null?` · gain actuel ${db(current.gainDb)}`:'')}</small></h3>
   {current?.state==='stale'&&<p className="coach-message warn">{tx('La mesure ne correspond plus au gain ou à la marge choisie. Remesure.')}</p>}
   <ol className="gain-steps">
    <li className={current?.state==='ok'?'done':''}><div><b>{tx("Régler le gain")}</b><p>{tx("Fais jouer ")}<b>{input.name}</b>{tx(profile.headroom==='extra'?' seul, au volume du passage le plus fort du concert, pendant 5 secondes. Je vise des crêtes vers −9 dB.':" seul, au volume du passage le plus fort du concert, pendant 5 secondes. Je vise des crêtes vers −6 dB.")}</p></div>
     <button className="primary" disabled={!admin||busy||!real} onClick={()=>measure('gain')}>{tx(measuring==='gain'?'Mesure… joue maintenant !':gain?.proposal?'Remesurer':'Mesurer (5 s)')}</button>
     {gain&&<div className={'gain-result '+(gain.decision?.state??'none')}>{gain.report.available&&gain.report.maximumDb!==undefined&&<PeakBar peak={gain.report.maximumDb} target={target}/>}<b>{tx(gain.decision?.title??gain.report.title)}</b><p>{tx(gain.decision?.message??gain.report.message)}</p>{gain.proposal!=null&&!gainMoved&&<button disabled={!admin||busy||!canApply} onClick={()=>onPlan(gain.proposal)}>{tx("Revoir et appliquer ce gain")}</button>}{gain.proposal!=null&&!gainMoved&&<small>{tx("Après l’avoir appliqué, remesure pour vérifier.")}</small>}{gainMoved&&<p className="gain-moved"><b>{tx("Gain passé à ")}{tx(db(current?.gainDb))}.</b>{tx(" Cette mesure date d’avant : clique sur « Remesurer » et fais rejouer ")}{input.name}{tx(" pour vérifier.")}</p>}</div>}
    </li>
    {current?.needsBleed&&<li className={current.bleedDb!=null&&current.valid?'done':''}><div><b>{tx(natural?'Mesurer la repisse':'Placer le gate')}</b><p><b>{input.name}</b>{tx(natural?' se tait, les autres jouent pendant 5 secondes. Cette mesure décrit la repisse ; elle n’active pas le gate.':" se tait, les autres jouent fort pendant 5 secondes : je mesure la repisse (le son des autres captés par ce micro) et je place le gate juste au-dessus.")}</p></div>
     <button disabled={!admin||busy||!real||current.state!=='ok'} onClick={()=>measure('bleed')}>{tx(measuring==='bleed'?'Mesure… les autres jouent !':'Mesurer la repisse (5 s)')}</button>
     {bleed&&<div className="gain-result"><b>{tx(bleed.thresholds?'Repisse mesurée : '+db(bleed.report.maximumDb):bleed.report.title)}</b><p>{tx(bleed.message??(bleed.thresholds?bleed.thresholds.note:bleed.report.message))}</p></div>}
    </li>}
    <li className={current?.state==='ok'?'':'locked'}><div><b>{tx(natural?"Préparer le son naturel":"Appliquer la configuration calée")}</b><p>{th?<>{tx(th.compThrDb===null?"Compresseur désactivé":"Compresseur à partir de ")}{th.compThrDb!==null&&<b>{tx(db(th.compThrDb))}</b>}{th.gateThrDb!==null&&<>{tx(", gate à ")}<b>{tx(db(th.gateThrDb))}</b></>}. {tx(th.note)}</>:tx('Les seuils seront calculés sur ta mesure dès que le gain sera bien réglé.')}</p></div>
     <button className="primary" disabled={!admin||busy||!canApply||current?.state!=='ok'} onClick={()=>onApplyChannel(profile,channel)}><Wand2 size={15}/>{tx(" Appliquer à ")}{input.name}</button>
    </li>
   </ol>
   <div className="coach-actions">{next&&<button onClick={()=>setChannel(next.channel)}>{tx("Instrument suivant : ")}{next.name} →</button>}<button disabled={!admin||busy||!canApply||!profile.inputs.length} onClick={()=>onApplyAll(profile)}><Wand2 size={15}/>{tx(done===1?"Appliquer tout le groupe (1 calé)":`Appliquer tout le groupe (${done} calés)`)}</button></div>
  </div>}
  <p className="coach-note">{tx("Pourquoi cet ordre : le compresseur et le gate travaillent sur le signal qui sort du préampli, avec des seuils fixes. Si le gain monte de 6 dB après coup, le compresseur écrase 6 dB de plus et le gate laisse passer la repisse. Si tu changes un gain plus tard, je te le signale ici (« à refaire »). Je ne touche jamais au 48 V et je ne monte pas de plus de 6 dB à la fois.")}</p>
 </div>;
}
