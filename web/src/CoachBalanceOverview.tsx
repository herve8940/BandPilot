import {tx} from "./i18n";
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Check, ArrowRight, BarChart3, SlidersHorizontal, ListMusic, Cable, AudioLines, Ear, Headphones, Save } from 'lucide-react';
import type { Profile } from './CoachSetup';
import { coachMeters, coachNext, type CoachCalibration } from './coach-guidance';
import './coach-overview.css';

import {emptyCoachMeters, type CoachMeters} from './coach-meters';
const idleSubscribe = () => () => {};
const stepLabels:Record<string,string> = {
  connect:'Connexion', inputs:'Instruments', levels:'Niveaux', tone:'Écoute', ears:'Retours', save:'Sauvegarde'
};
const stepIcons = {connect:Cable, inputs:ListMusic, levels:AudioLines, tone:Ear, ears:Headphones, save:Save};
type Props = {
  steps:{id:string;title:string}[]; selected:string|null;
  onMeasure?:(channel:number)=>void; measuring:boolean;
  meters:CoachMeters; refresh:number;
  profile: Profile; simulation: boolean; connected: boolean; online: boolean; canApply: boolean; busy: boolean;
  onStep: (step:string, channel?:number) => void; onConnect: () => void;
  onExpert: (channel?:number, view?:'channel'|'analysis') => void;
};
/** Read-only overview using the existing application connection, without another OSC subscription. */
export function CoachOverview({steps,selected,onMeasure,measuring,meters:source,refresh,profile,simulation,connected,online,canApply,busy,onStep,onConnect,onExpert}:Props) {
  const live = !simulation && connected && online;
  const snapshot = useSyncExternalStore(
    live && "subscribe" in source ? source.subscribe : idleSubscribe,
    "getSnapshot" in source ? (live ? source.getSnapshot : () => emptyCoachMeters) : () => source,
  );
  const [showAllInputs,setShowAllInputs] = useState(false);
  const [manualRefresh,setManualRefresh] = useState(0);
  const [calibration, setCalibration] = useState<CoachCalibration[]|null>(null);
  const [calibrationIssue, setCalibrationIssue] = useState(false);
  const inputKey = profile.inputs.map(i=>`${i.channel}:${i.source}`).join(',');
  useEffect(() => {
    let active = true;
    setCalibration(null);setCalibrationIssue(false);
    if (!simulation && connected && online && profile.inputs.length) {
      void fetch('/api/coach/calibration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sound:profile.sound,headroom:profile.headroom}),signal:AbortSignal.timeout(12000)})
        .then(async response=>{if(!response.ok)throw Error('Mesures indisponibles');const data=await response.json();if(!Array.isArray(data))throw Error('Mesures illisibles');return data as CoachCalibration[];})
        .then(data=>{if(active)setCalibration(data);})
        .catch(()=>{if(active)setCalibrationIssue(true);});
    }
    return()=>{active=false;};
  },[simulation,connected,online,inputKey,profile.sound,profile.headroom,refresh,manualRefresh]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (simulation || !connected || !online || !snapshot.available) return;
    const expiresIn = Date.parse(snapshot.updatedAt ?? '') + 2000 - Date.now();
    if (!(expiresIn > 0)) return;
    const timer = setTimeout(() => tick(n => n + 1), expiresIn);
    return () => clearTimeout(timer);
  }, [simulation, connected, online, snapshot.available, snapshot.updatedAt]);
  const age = Date.now() - Date.parse(snapshot.updatedAt ?? '');
  const fresh = !simulation && connected && online && snapshot.available && age >= 0 && age < 2000;
  const meters = coachMeters(profile.inputs, snapshot.channels, fresh);
  const next = coachNext({simulation,connected,online,inputs:profile.inputs.length,completed:profile.completed,meters,calibration});
  const received = meters.filter(m=>m.db !== null).length;
  const high = meters.filter(m=>m.db !== null && m.db >= -1);
  const needsConsole = simulation && next.step === 'levels';
  const go = () => next.step === 'connect' ? onConnect() : onStep(next.step,next.channel);
  const measureChannel = next.step === 'levels' && next.channel && !simulation && connected && online && onMeasure ? next.channel : undefined;
  const verified = steps.filter(s => profile.completed.includes(s.id)).length;
  return <section className="coach-overview" aria-label={tx("Balance guidée")}>
    {!selected && <div className={`coach-next ${next.tone}`}>
      <div className="balance-lead">
        <small>{next.channel ? <>{tx("Entrée ")}{next.channel} · {profile.inputs.find(i=>i.channel===next.channel)?.name}</> : tx("Prochaine étape")}</small>
        <h2>{tx(next.title)}</h2>
        <p>{tx(measureChannel ? "Joue ou chante le passage le plus fort pendant 5 secondes." : next.why)}</p>
        <button type="button" className="primary" disabled={busy} onClick={()=>measureChannel ? onMeasure?.(measureChannel) : go()}>
          {tx(measuring ? "Mesure… joue maintenant !" : measureChannel ? "Lancer la mesure" : needsConsole ? "Explorer en simulation" : next.action)}<ArrowRight size={18}/>
        </button>
        {measureChannel && <small className="measure-hint">{tx("Cette mesure laisse le gain inchangé.")}</small>}
        {simulation && next.step!=='connect' && <button type="button" className="balance-link" disabled={busy} onClick={onConnect}>{tx("Connecter ma console")}</button>}
      </div>
      <div className="balance-mic" aria-hidden="true"/>
    </div>}
    {!selected && profile.inputs.length>0 && <section className="regie-inputs">
      <div className="journey-heading"><h3>{tx("Entrées à vérifier")}</h3>
        <span>{simulation ? tx("Simulation") : calibration ? <>{tx("Mesures valides")} <b>{profile.inputs.filter(i=>calibration.some(c=>c.channel===i.channel&&c.state==="ok")).length} / {profile.inputs.length}</b></> : tx("Mesures en attente")}</span>
      </div>
      <div className="regie-input-list">{(showAllInputs ? profile.inputs : profile.inputs.slice(0,4)).map(input=>{
        const state=calibration?.find(c=>c.channel===input.channel)?.state;
        const label=!calibration ? "Mesures en attente" : state==="ok" ? "Vérifiée" : state==="stale" ? "Mesure à refaire" : "À mesurer";
        return <div key={input.channel} className="regie-input-row">
          <button type="button" className="regie-input-main" disabled={busy} onClick={()=>onStep("levels",input.channel)}>
            <span className="regie-track-number">{String(input.channel).padStart(2,"0")}</span><b>{input.name}</b>{!simulation && <small data-state={state}>{tx(label)}</small>}<ArrowRight size={15}/>
          </button>
          <button type="button" className="regie-open-strip" disabled={busy} onClick={()=>onExpert(input.channel,"channel")} title={tx("Ouvrir la tranche")+" · "+input.name} aria-label={tx("Ouvrir la tranche")+" · "+input.name}><SlidersHorizontal size={16}/></button>
        </div>;
      })}</div>
      {profile.inputs.length>4 && <button type="button" className="regie-text-button" aria-expanded={showAllInputs} onClick={()=>setShowAllInputs(!showAllInputs)}>{tx(showAllInputs?"Réduire la liste":"Afficher toutes les entrées")} <span>({profile.inputs.length})</span></button>}
    </section>}
    <nav className="coach-journey" aria-label={tx("Étapes de la balance")}>
      <div className="journey-heading"><h3>{tx("Ta balance")}</h3><span>{tx("Étapes vérifiées")} <b>{verified} / {steps.length}</b></span></div>
      {!selected && steps.length>0 && <div className="balance-completion" aria-hidden="true">{steps.map(s=><i key={s.id} data-done={profile.completed.includes(s.id)}/>)}</div>}
      <div className="balance-track">{steps.map(step=>{
        const done=profile.completed.includes(step.id);
        const Icon=stepIcons[step.id as keyof typeof stepIcons] ?? AudioLines;
        const current=step.id===(selected??next.step);
        return <button key={step.id} type="button" disabled={busy} className={current?'active':done?'complete':''} aria-current={current?'step':undefined}
          aria-label={tx(step.title)+(done?' · '+tx('Étape vérifiée'):'')} title={tx(step.title)} onClick={()=>onStep(step.id)}>
          <span className={done?'checked':''}>{done?<Check size={16}/>:<Icon size={16}/>}</span>{tx(stepLabels[step.id]??step.title)}
        </button>;
      })}</div>
    </nav>

    {!selected && <details className="balance-meter-details"><summary>{tx("Niveaux des instruments")}</summary>
    <div className="coach-live-summary">
      <div className="coach-overview-status"><span className={simulation?'simulation':fresh?'live':'pending'}>{tx(simulation?'Simulation':fresh?'Mesures reçues':'Mesures en attente')}</span><span>{tx(canApply?'Application des réglages disponible':'Consultation · application désactivée')}</span></div>
      <details className="coach-live-inputs" open={profile.inputs.length > 0 && profile.inputs.length <= 6}>
        <summary><b>{tx(profile.inputs.length===1?"1 instrument":`${profile.inputs.length} instruments`)}</b><span>{tx(simulation?'Aucun niveau réel':high.length?`${high.length} niveau${high.length>1?'x':''} proche${high.length>1?'s':''} de 0 dBFS`:`${received} niveau${received>1?'x':''} reçu${received>1?'s':''}`)}</span></summary>
        <div className="coach-live-grid">{meters.map(m => <div className={`coach-live-input${m.db !== null && m.db >= -1?' hot':''}`} key={m.channel}>
          <button type="button" disabled={busy} onClick={()=>onStep('levels',m.channel)} title={tx(`Contrôler les niveaux de ${m.name}`)}><small>{tx(String(m.channel).padStart(2,'0'))}</small><b>{m.name}</b><span>{tx(m.db === null?'—':m.db <= -90?'Sous −90':`${m.db.toFixed(1)}`)}<small>{tx(m.db !== null?' dBFS':'')}</small></span></button>
          <div className="coach-live-bar" aria-hidden="true"><i style={{width:`${m.db === null?0:Math.max(0,Math.min(100,(m.db+60)/60*100))}%`}}/></div>
          <button type="button" className="coach-open-channel" disabled={busy} aria-label={tx(`Ouvrir ${m.name} dans la console Expert`)} onClick={()=>onExpert(m.channel,'channel')}><SlidersHorizontal size={15}/></button>
        </div>)}</div>
        {!meters.length&&<p>{tx("Les entrées apparaîtront après la préparation du groupe.")}</p>}
      </details>
      {!simulation&&profile.inputs.length>0&&<div className="coach-calibration-state"><small>{tx(calibration?`${calibration.filter(c=>c.state==='ok'&&profile.inputs.some(i=>i.channel===c.channel)).length} / ${profile.inputs.length} mesures de gain valides`:calibrationIssue?'Mesures enregistrées indisponibles · vérification dans Niveaux':'Vérification des mesures enregistrées…')}</small><button type="button" disabled={busy||!online||!connected} onClick={()=>setManualRefresh(n=>n+1)}>{tx("Actualiser")}</button></div>}
      <div className="coach-overview-foot"><small>{tx("Niveaux instantanés reçus de la console. Pour régler le gain, utilise la mesure du passage fort.")}</small><button type="button" disabled={busy} onClick={()=>onExpert(undefined,'analysis')}><BarChart3 size={15}/>{tx(" Analyse du mix")}</button></div>
    </div></details>}
  </section>;
}
