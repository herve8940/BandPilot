import { useEffect, useState } from 'react';
import { Activity, ArrowRight, BarChart3, SlidersHorizontal } from 'lucide-react';
import type { Profile } from './CoachSetup';
import { coachMeters, coachNext, type CoachCalibration } from './coach-guidance';
import './coach-overview.css';

export type CoachMeterSnapshot = { channels:number[]; updatedAt:string|null; available:boolean };
type Props = {
  meters:CoachMeterSnapshot; refresh:number;
  profile: Profile; simulation: boolean; connected: boolean; online: boolean; canApply: boolean; busy: boolean;
  onStep: (step:string, channel?:number) => void; onConnect: () => void;
  onExpert: (channel?:number, view?:'channel'|'analysis') => void;
};
/** Read-only overview using the existing application connection, without another OSC subscription. */
export function CoachOverview({meters:snapshot,refresh,profile,simulation,connected,online,canApply,busy,onStep,onConnect,onExpert}:Props) {
  const [manualRefresh,setManualRefresh] = useState(0);
  const [calibration, setCalibration] = useState<CoachCalibration[]|null>(null);
  const [calibrationIssue, setCalibrationIssue] = useState(false);
  const inputKey = profile.inputs.map(i=>`${i.channel}:${i.source}`).join(',');
  useEffect(() => {
    let active = true;
    setCalibration(null);setCalibrationIssue(false);
    if (!simulation && connected && online && profile.inputs.length) {
      void fetch('/api/coach/calibration',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)})
        .then(async response=>{if(!response.ok)throw Error('Mesures indisponibles');const data=await response.json();if(!Array.isArray(data))throw Error('Mesures illisibles');return data as CoachCalibration[];})
        .then(data=>{if(active)setCalibration(data);})
        .catch(()=>{if(active)setCalibrationIssue(true);});
    }
    return()=>{active=false;};
  },[simulation,connected,online,inputKey,refresh,manualRefresh]);
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick(n=>n+1), 1000); return () => clearInterval(timer); }, []);
  const age = Date.now() - Date.parse(snapshot.updatedAt ?? '');
  const fresh = !simulation && connected && online && snapshot.available && age >= 0 && age < 2000;
  const meters = coachMeters(profile.inputs, snapshot.channels, fresh);
  const next = coachNext({simulation,connected,online,inputs:profile.inputs.length,completed:profile.completed,meters,calibration});
  const received = meters.filter(m=>m.db !== null).length;
  const high = meters.filter(m=>m.db !== null && m.db >= -1);
  const go = () => next.step === 'connect' ? onConnect() : onStep(next.step,next.channel);
  return <section className="coach-overview" aria-label="Tableau de bord de la balance">
    <div className={`coach-next ${next.tone}`}>
      <small><Activity size={14}/> PROCHAIN PAS CONSEILLÉ</small>
      <h2>{next.title}</h2><p>{next.why}</p>
      <button type="button" className="primary" disabled={busy} onClick={go}>{next.action}<ArrowRight size={16}/></button>
    </div>
    <div className="coach-live-summary">
      <div className="coach-overview-status"><span className={simulation?'simulation':fresh?'live':'pending'}>{simulation?'Simulation':fresh?'Mesures reçues':'Mesures en attente'}</span><span>{canApply?'Application des réglages disponible':'Consultation · application désactivée'}</span></div>
      <details className="coach-live-inputs" open={profile.inputs.length > 0 && profile.inputs.length <= 6}>
        <summary><b>{profile.inputs.length} instrument{profile.inputs.length>1?'s':''}</b><span>{simulation?'Aucun niveau réel':high.length?`${high.length} niveau${high.length>1?'x':''} proche${high.length>1?'s':''} de 0 dBFS`:`${received} niveau${received>1?'x':''} reçu${received>1?'s':''}`}</span></summary>
        <div className="coach-live-grid">{meters.map(m => <div className={`coach-live-input${m.db !== null && m.db >= -1?' hot':''}`} key={m.channel}>
          <button type="button" disabled={busy} onClick={()=>onStep('levels',m.channel)} title={`Contrôler les niveaux de ${m.name}`}><small>{String(m.channel).padStart(2,'0')}</small><b>{m.name}</b><span>{m.db === null?'—':m.db <= -90?'Sous −90':`${m.db.toFixed(1)}`}<small>{m.db !== null?' dBFS':''}</small></span></button>
          <div className="coach-live-bar" aria-hidden="true"><i style={{width:`${m.db === null?0:Math.max(0,Math.min(100,(m.db+60)/60*100))}%`}}/></div>
          <button type="button" className="coach-open-channel" disabled={busy} aria-label={`Ouvrir ${m.name} dans la console Expert`} onClick={()=>onExpert(m.channel,'channel')}><SlidersHorizontal size={15}/></button>
        </div>)}</div>
        {!meters.length&&<p>Les entrées apparaîtront après la préparation du groupe.</p>}
      </details>
      {!simulation&&profile.inputs.length>0&&<div className="coach-calibration-state"><small>{calibration?`${calibration.filter(c=>c.state==='ok'&&profile.inputs.some(i=>i.channel===c.channel)).length} / ${profile.inputs.length} mesures de gain valides`:calibrationIssue?'Mesures enregistrées indisponibles · vérification dans Niveaux':'Vérification des mesures enregistrées…'}</small><button type="button" disabled={busy||!online||!connected} onClick={()=>setManualRefresh(n=>n+1)}>Actualiser</button></div>}
      <div className="coach-overview-foot"><small>Niveaux instantanés reçus de la console. Pour régler le gain, utilise la mesure du passage fort.</small><button type="button" disabled={busy} onClick={()=>onExpert(undefined,'analysis')}><BarChart3 size={15}/> Analyse du mix</button></div>
    </div>
  </section>;
}
