import {useState} from 'react';
import {EarsSharePanel} from './EarsSharePanel';
import {useAirStrips} from './xair/model-strips';
import {num,pad,useLiveMixer,useMeters,meterStore,type Values,type SetFn,type Value} from './xair/controls';
import type {ViewProps} from './xair/views';
import {stripName} from './xair/strips';
import {faderToDb,formatDb,stripColor} from './xairMath';
import {MonitorDesk} from './expert/Workspace';
const dbText=(v:number)=>formatDb(faderToDb(v));
const busName=(values:Values,b:number)=>{const n=values[`/bus/${b}/config/name`];return typeof n==='string'&&n.trim()?n.trim():`Bus ${b}`;};
const earsLabel=(values:Values,b:number)=>{const n=values[`/bus/${b}/config/name`];return typeof n==='string'&&n.trim()?n.trim():`Retour ${b}`;};
export function ReturnsPage({canWrite}:{canWrite:boolean}){
 const live=useLiveMixer();
 const [tab,setTab]=useState<'mix'|'phones'>('mix');
 return <section className="returns-page" aria-label="Retours du groupe">
  <nav className="bp-section-tabs" aria-label="Organisation des retours"><button type="button" aria-pressed={tab==='mix'} onClick={()=>setTab('mix')}>Mix et traitements</button><button type="button" aria-pressed={tab==='phones'} onClick={()=>setTab('phones')}>Téléphones</button></nav>
  <p className="bp-page-hint">Choisis le musicien, règle ce qu’il entend, puis partage son retour sur son téléphone.</p>
  {tab==='mix'?<div className="xs2 returns-mix"><EarsMix values={live.values} set={live.set} writable={canWrite&&live.online} confirmed={live.confirmed}/>{live.message&&<p role="status">{live.message}</p>}</div>:<EarsSharePanel/>}
 </section>;
}

// ---------------- Ears ----------------
function EarsMix({ values, set, writable, confirmed }: { values: Values; set: SetFn; writable: boolean; confirmed: ViewProps["confirmed"] }) {
  const {ALL,MAIN,OUTPUTS,INPUTS,BUSES,FXSENDS,model}=useAirStrips();
  const levels = useMeters(), fresh = meterStore.fresh();
  const rows = INPUTS.filter(s => s.kind !== "ch" || stripName(s, values) !== s.fallback || (levels[s.meters[0]!] ?? -128) > -60);
  const limiterOff = BUSES.slice(0,model.monitorOutputs).map((_, i) => i + 1).filter(b => num(values, `/bus/${b}/dyn/on`) !== 1 && busName(values, b) !== `Bus ${b}`);
  const addLimiters = () => {
    const v: Record<string, Value> = {};
    for (const b of limiterOff) Object.assign(v, { [`/bus/${b}/dyn/on`]: 1, [`/bus/${b}/dyn/mode`]: 0, [`/bus/${b}/dyn/ratio`]: 11, [`/bus/${b}/dyn/thr`]: -6, [`/bus/${b}/dyn/knee`]: 0, [`/bus/${b}/dyn/attack`]: 1, [`/bus/${b}/dyn/release`]: 100, [`/bus/${b}/dyn/mgain`]: 0 });
    void confirmed(v, `Ajouter un limiteur de protection à −6 dB sur ${limiterOff.map(b => earsLabel(values, b)).join(", ")} ?`);
  };
  return <>
    <MonitorDesk values={values} set={set} writable={writable} confirmed={confirmed}/>
    <details className="monitor-matrix"><summary>Matrice complète · tous les envois et bus internes</summary>
    <div className="xs2-bar"><div><div style={{ fontSize: 18, fontWeight: 700 }}>Matrice des bus</div><div className="muted">Chaque colonne est un bus. Seuls les bus reliés à une sortie physique alimentent directement un retour.</div></div></div>
    <div className="xs2-matrix" role="table" aria-label="Envois vers les ears">
      <div className="row head" role="row"><div role="columnheader" className="muted">Source</div>
        {BUSES.map((b, i) => { const db = fresh ? levels[b.meters[0]!] ?? -128 : -128; const lim = num(values, `/bus/${i + 1}/dyn/on`) === 1; return <div key={b.id} role="columnheader">
          <b>{i<model.monitorOutputs?earsLabel(values,i+1):`Bus ${i+1} interne`}</b>
          <span className="meter"><i className={db > -6 ? "hot" : ""} style={{ width: `${Math.max(0, Math.min(100, (db + 60) / 60 * 100))}%` }} /></span>
          <span className="mono muted" style={{ fontSize: 11 }}>{db <= -90 ? "—" : `crête ${Math.round(db)} dB`} · {lim ? "dynamique active" : "dynamique désactivée"}</span>
        </div>; })}
      </div>
      {rows.map(s => <div className="row" role="row" key={s.id}>
        <div className="src" role="rowheader"><i style={{ background: stripColor(num(values, `${s.prefix}/config/color`)) }} />{stripName(s, values)}</div>
        {BUSES.map((_, i) => { const a = `${s.prefix}/mix/${pad(i + 1)}/level`, v = num(values, a); return <div key={a} role="cell">
          <input type="range" min={0} max={1} step={0.005} value={v} disabled={!writable} aria-label={`${stripName(s, values)} dans ${earsLabel(values, i + 1)}`} onChange={e => set(a, Number(e.target.value))} />
          <span className="v">{v <= 0.001 ? "—" : dbText(v)}</span>
        </div>; })}
      </div>)}
    </div>
    <div className="xs2-cards3">
      {limiterOff.length ? <div className="xs2-note"><b>{limiterOff.length} bus nommé{limiterOff.length > 1 ? "s" : ""} sans dynamique active</b><div>Un limiteur peut réduire les crêtes électriques. Le niveau acoustique dépend aussi du casque et de son amplificateur ; ce réglage ne garantit pas la protection auditive.</div><div style={{ marginTop: 8 }}><button type="button" className="xs2-btn warn" disabled={!writable} onClick={addLimiters}>Ajouter la protection…</button></div></div>
        : <div className="xs2-good"><b>Dynamique active sur les bus nommés</b><div>Vérifie le mode, le ratio et le niveau d’écoute de chaque retour.</div></div>}
      <div className="xs2-card"><h3>Réverbération dans les ears</h3><div className="muted">Un peu de réverbération sur la voix aide le chanteur à se placer : règle la ligne de l’effet dans la colonne de chaque musicien.</div></div>
    </div>
    </details>
  </>;
}
