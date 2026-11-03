import { useEffect, useMemo, useState } from "react";
import { Fader, Meter, num, pad, useLiveMixer, useMeters, meterStore, readEq, eqResponse, type Values, type SetFn, type Value } from "../xair/controls";
import { INPUTS, BUSES, FXSENDS, faderAddress, onAddress, soloAddress, stripName, type Strip } from "../xair/strips";
import { CompView, EqView, FxView, GateView, InputView, RoutingView, SendsView, type ViewProps } from "../xair/views";
import { faderToDb, formatDb, logMap, RATIOS, stripColor } from "../xairMath";
import { AnalysisView } from "./AnalysisView";
import { RecordingView } from "./RecordingView";
import { RecordingDock } from "./RecordingDock";
import "../xair-mixer.css";
import "./expert.css";
import "./expert-v3.css";

type View = "console" | "channel" | "ears" | "fx" | "routing" | "analysis" | "recording";
const VIEWS: { id: View; label: string }[] = [
  { id: "console", label: "Console" }, { id: "channel", label: "Canal" }, { id: "ears", label: "Ears" },
  { id: "fx", label: "Effets" }, { id: "routing", label: "Routage" }, { id: "analysis", label: "Analyse" }, { id: "recording", label: "Enregistrement" },
];
async function api<T = any>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(path, { method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const v = await r.json().catch(() => ({})); if (!r.ok) throw Error(v.error ?? "Erreur"); return v as T;
}
const dbText = (wire: number) => formatDb(faderToDb(wire)).replace("-", "−");
const busName = (values: Values, b: number) => { const n = values[`/bus/${b}/config/name`]; return typeof n === "string" && n.trim() ? n.trim() : `Bus ${b}`; };
const earsLabel = (values: Values, b: number) => { const n = values[`/bus/${b}/config/name`]; return typeof n === "string" && n.trim() ? n.trim() : `Ears ${b}`; };

/** Small EQ curve of a strip (high-pass included), drawn on 60×26. */
function eqPath(values: Values, prefix: string) {
  if (!values[`${prefix}/eq/1/f`] && values[`${prefix}/eq/1/f`] !== 0) return "M0 13 H60";
  const bands = readEq(values, prefix, 4), on = num(values, `${prefix}/eq/on`, 1) === 1;
  const hp = num(values, `${prefix}/preamp/hpon`) === 1 ? logMap(num(values, `${prefix}/preamp/hpf`), 20, 400) : undefined;
  let d = "";
  for (let x = 0; x <= 60; x += 2) { const f = 20 * Math.pow(1000, x / 60); const y = Math.max(1, Math.min(25, 13 - eqResponse(bands, f, on, hp) * 0.7)); d += `${x ? "L" : "M"}${x} ${y.toFixed(1)} `; }
  return d;
}

export function ExpertStudio({ canWrite, selectedChannel, onSelectChannel }: { canWrite: boolean; selectedChannel?: number; onSelectChannel?: (n: number) => void }) {
  const live = useLiveMixer();
  const { values, set, confirmed, online, message, clearMessage } = live;
  const [view, setView] = useState<View>(() => { try { return (localStorage.getItem("xr18-expert-view") as View) || "console"; } catch { return "console"; } });
  const [selectedId, setSelectedId] = useState(selectedChannel ? `ch${selectedChannel}` : "ch1");
  const [rehearsal, setRehearsal] = useState(false), [recoCount, setRecoCount] = useState(0), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const writable = canWrite && online;
  const strip = INPUTS.find(s => s.id === selectedId) ?? INPUTS[0]!;
  const go = (v: View) => { setView(v); try { localStorage.setItem("xr18-expert-view", v); } catch { /* convenience only */ } };
  const select = (s: Strip) => { setSelectedId(s.id); if (s.kind === "ch") onSelectChannel?.(Number(s.short)); };
  useEffect(() => { if (selectedChannel) setSelectedId(`ch${selectedChannel}`); }, [selectedChannel]);
  useEffect(() => { void api<{ on: boolean }>("/api/rehearsal").then(r => setRehearsal(r.on)).catch(() => undefined); }, []);
  useEffect(() => { const t = setInterval(() => { void api<{ recommendations: unknown[] }>("/api/analysis").then(a => setRecoCount(a.recommendations.length)).catch(() => undefined); }, 5000); return () => clearInterval(t); }, []);
  const toggleRehearsal = async () => {
    const next = !rehearsal;
    if (!confirm(next ? "Passer en Ears seulement ? Le Main (façade) est coupé et reste coupé : on ne travaille que les ears des musiciens." : "Quitter Ears seulement ? Le Main reste coupé tant que tu ne le rallumes pas toi-même.")) return;
    try { const r = await api<{ on: boolean }>("/api/rehearsal", { on: next }); setRehearsal(r.on); setNotice(r.on ? "Ears seulement : Main coupé, analyse sur les ears." : "Ears seulement quitté."); } catch (e) { setError((e as Error).message); }
  };
  const props: ViewProps = { strip, values, set, canWrite: writable, confirmed, open: (s) => { select(s); go("channel"); } };

  return <section className="xs2 xs3" aria-label="Mode Expert">
    <div className="xs3-intro"><div className="xs3-emblem">◈</div><div><h1>Mode Expert</h1><p>Contrôle des traitements de canal · Préampli · Gate · Compresseur · EQ · Envois · Routage</p></div><div className="xs3-intro-status"><span className={online ? "live" : "off"}>● {online ? "XR18 connectée" : "XR18 hors ligne"}</span></div></div>
    <header className="xs2-head">
      <nav className="xs2-tabs" aria-label="Vues du mode Expert">
        {VIEWS.map(v => <button key={v.id} type="button" className={view === v.id ? "on" : ""} aria-current={view === v.id ? "page" : undefined} onClick={() => go(v.id)}>
          {v.label}{v.id === "analysis" && recoCount > 0 && <span className="xs2-badge">{recoCount}</span>}
        </button>)}
      </nav>
      <div className="xs2-spacer" />
      <button type="button" className={`xs2-pill ${rehearsal ? "rehearsal" : "foh"}`} onClick={() => void toggleRehearsal()} disabled={!canWrite} title="En Ears seulement, le Main est coupé et verrouillé : on ne règle que les ears">
        {rehearsal ? <><Lock /> Ears seulement · Main coupé</> : "Façade active"}
      </button>
      <span className={`xs2-pill ${online ? "live" : "off"}`}><span className="xs2-dot" />{online ? (writable ? "Contrôle actif" : "Lecture seule") : "Hors ligne"}</span>
    </header>
    {(message || notice || error) && <div className={`xs2-msg${error || message ? " error" : ""}`} role="status">{error || message || notice}<button type="button" aria-label="Fermer" onClick={() => { clearMessage(); setNotice(""); setError(""); }}>×</button></div>}
    {(view === "channel" || view === "console") && <div className="xs3-channelrail" role="tablist" aria-label="Sélection des canaux">{INPUTS.map((s, i) => <button type="button" key={s.id} role="tab" aria-selected={s.id === strip.id} className={s.id === strip.id ? "active" : ""} onClick={() => { select(s); go("channel"); }}><small>{i + 1}</small><span className="xs3-channelcolor" style={{background:stripColor(num(values, `${s.prefix}/config/color`))}}/><b>{stripName(s, values)}</b></button>)}</div>}
    <div className="xs2-body">
      {view === "console" && <ConsoleView values={values} set={set} writable={writable} rehearsal={rehearsal} strip={strip} select={select} openChannel={() => go("channel")} openAnalysis={() => go("analysis")} recoCount={recoCount} />}
      {view === "channel" && <ChannelPage {...props} select={select} />}
      {view === "ears" && <EarsView values={values} set={set} writable={writable} confirmed={confirmed} />}
      {view === "fx" && <div className="xm xs2-legacy"><FxView {...props} /></div>}
      {view === "routing" && <RoutingPage {...props} />}
      {view === "analysis" && <AnalysisView values={values} rehearsal={rehearsal} canWrite={writable} onCount={setRecoCount} />}
      {view === "recording" && <RecordingView />}
    </div>
    {view !== "recording" && <RecordingDock open={() => go("recording")} />}
  </section>;
}

function Lock() { return <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>; }

// ---------------- Console ----------------
function ConsoleView({ values, set, writable, rehearsal, strip, select, openChannel, openAnalysis, recoCount }: { values: Values; set: SetFn; writable: boolean; rehearsal: boolean; strip: Strip; select: (s: Strip) => void; openChannel: () => void; openAnalysis: () => void; recoCount: number }) {
  const [layer, setLayer] = useState(() => rehearsal ? 1 : 0);
  useEffect(() => { if (rehearsal && layer === 0) setLayer(1); }, [rehearsal, layer]);
  const levels = useMeters();
  const used = (s: Strip) => s.kind !== "ch" || stripName(s, values) !== s.fallback || (levels[s.meters[0]!] ?? -128) > -60;
  const color = (s: Strip) => stripColor(num(values, `${s.prefix}/config/color`));
  return <div className="xs2-split">
    <div className="main">
      <div className="xs2-bar">
        <span className="label">Les faders règlent</span>
        <button type="button" className={`xs2-chip${layer === 0 ? " on" : ""}${rehearsal ? " locked" : ""}`} disabled={rehearsal} onClick={() => setLayer(0)} title={rehearsal ? "Main coupé en répétition" : "Le mix de la façade"}>{rehearsal && <Lock />} Façade</button>
        {BUSES.map((b, i) => <button key={b.id} type="button" className={`xs2-chip${layer === i + 1 ? " on" : ""}`} onClick={() => setLayer(i + 1)}>{earsLabel(values, i + 1)}</button>)}
        {FXSENDS.map((f, i) => <button key={f.id} type="button" className={`xs2-chip${layer === i + 7 ? " on" : ""}`} onClick={() => setLayer(i + 7)}>FX {i + 1}</button>)}
      </div>
      <div className="xs2-strips" role="list" aria-label="Tranches">
        {INPUTS.map(s => {
          const fa = faderAddress(s, layer), oa = onAddress(s), so = soloAddress(s), on = num(values, oa, 1) === 1;
          const comp = s.kind === "ch" && num(values, `${s.prefix}/dyn/on`) === 1;
          return <div key={s.id} role="listitem" className={`xs2-strip${s.id === strip.id ? " sel" : ""}${used(s) ? "" : " idle"}`} onClick={() => select(s)}>
            <i className="tag" style={{ background: color(s) }} />
            <button type="button" className="name" onClick={() => select(s)} title={stripName(s, values)}>{stripName(s, values)}</button>
            <span className="ch">{s.short}</span>
            <svg className="eq" viewBox="0 0 60 26" aria-hidden="true"><path d="M0 13 H60" stroke="#222A34" /><path d={eqPath(values, s.prefix)} fill="none" stroke={color(s)} strokeWidth="1.6" /></svg>
            <span className="dyn" title="Compresseur"><span className={comp ? "on" : ""}>{s.kind === "ch" ? (comp ? `${Number(RATIOS[num(values, `${s.prefix}/dyn/ratio`)])}:1` : "—") : ""}</span></span>
            <div className="fz"><Fader label={`${layer ? "Envoi" : "Fader"} ${stripName(s, values)}`} value={num(values, fa)} disabled={!writable} reset={layer ? 0 : .75} accent={color(s)} onChange={v => set(fa, v)} /><Meter indexes={s.meters} /></div>
            <span className="db">{dbText(num(values, fa))}</span>
            <span className="ms">
              <button type="button" className={on ? "" : "mute"} disabled={!writable} aria-pressed={!on} onClick={e => { e.stopPropagation(); set(oa, on ? 0 : 1); }}>M</button>
              {so && <button type="button" className={values[so] === 1 ? "solo" : ""} disabled={!writable} aria-pressed={values[so] === 1} onClick={e => { e.stopPropagation(); set(so, values[so] === 1 ? 0 : 1); }}>S</button>}
            </span>
          </div>;
        })}
      </div>
    </div>
    <aside className="side">
      <Inspector values={values} strip={strip} openChannel={openChannel} />
      {recoCount > 0 && <button type="button" className="xs2-note" style={{ textAlign: "left", cursor: "pointer" }} onClick={openAnalysis}><b>{recoCount} suggestion{recoCount > 1 ? "s" : ""} de l’analyse</b><br />Voir et valider →</button>}
      <Outputs values={values} rehearsal={rehearsal} />
    </aside>
  </div>;
}

function Inspector({ values, strip, openChannel }: { values: Values; strip: Strip; openChannel: () => void }) {
  const p = strip.prefix, ch = strip.kind === "ch";
  const hp = num(values, `${p}/preamp/hpon`) === 1, gate = num(values, `${p}/gate/on`) === 1, eq = num(values, `${p}/eq/on`, 1) === 1, comp = num(values, `${p}/dyn/on`) === 1;
  const sends = BUSES.filter((_, i) => num(values, `${p}/mix/${pad(i + 1)}/level`) > .02).length;
  return <div className="xs2-card">
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <i style={{ width: 10, height: 34, borderRadius: 4, background: stripColor(num(values, `${p}/config/color`)) }} />
      <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700 }}>{stripName(strip, values)}</div><div className="muted">{strip.fallback}</div></div>
      <button type="button" className="xs2-btn" onClick={openChannel}>Ouvrir</button>
    </div>
    <div className="xs2-chain">
      <div className={hp ? "on" : ""}><small>Coupe-bas</small><b>{ch ? (hp ? `${Math.round(logMap(num(values, `${p}/preamp/hpf`), 20, 400))} Hz` : "off") : "—"}</b></div>
      <div className={gate ? "on" : ""}><small>Gate</small><b>{ch ? (gate ? "on" : "off") : "—"}</b></div>
      <div className={eq ? "on" : ""}><small>EQ</small><b>{eq ? "on" : "off"}</b></div>
      <div className={comp ? "on" : ""}><small>Comp</small><b>{ch ? (comp ? RATIOS[num(values, `${p}/dyn/ratio`)] + ":1" : "off") : "—"}</b></div>
      <div className={sends ? "on" : ""}><small>Ears</small><b>{sends} / 6</b></div>
    </div>
  </div>;
}

function Outputs({ values, rehearsal }: { values: Values; rehearsal: boolean }) {
  const levels = useMeters(), fresh = meterStore.fresh();
  const row = (label: string, idx: number[], locked = false) => {
    const db = fresh ? Math.max(...idx.map(i => levels[i] ?? -128)) : -128, w = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
    return <div key={label}><span className={locked ? "lock" : ""}>{label}</span><span className="bar"><i className={db > -6 ? "hot" : ""} style={{ width: `${locked ? 0 : w}%` }} /></span><span className="mono muted" style={{ textAlign: "right" }}>{locked ? "coupé" : db <= -90 ? "—" : `${Math.round(db)} dB`}</span></div>;
  };
  return <div className="xs2-card"><h3>Sorties</h3><div className="xs2-outs">
    {BUSES.map((b, i) => row(earsLabel(values, i + 1), b.meters))}
    {row("Main", [36, 37], rehearsal)}
  </div></div>;
}

function eqPathWide(values: Values, prefix: string) { const bands = readEq(values,prefix,4), on=num(values,`${prefix}/eq/on`,1)===1; const hp=num(values,`${prefix}/preamp/hpon`)===1?logMap(num(values,`${prefix}/preamp/hpf`),20,400):undefined; let d=""; for(let x=0;x<=600;x+=4){const f=20*Math.pow(1000,x/600);const y=Math.max(4,Math.min(96,50-eqResponse(bands,f,on,hp)*3));d+=`${x?"L":"M"}${x} ${y.toFixed(1)} `;}return d; }

// ---------------- Channel ----------------
type Step = "input" | "gate" | "eq" | "comp" | "sends";
function ChannelPage(props: ViewProps & { select: (s: Strip) => void }) {
  const { strip, values, select, set, canWrite } = props;
  const [step, setStep] = useState<Step>("comp");
  const i = INPUTS.findIndex(s => s.id === strip.id), p = strip.prefix, ch = strip.kind === "ch";
  const hp = num(values, `${p}/preamp/hpon`) === 1;
  const steps: { id: Step; title: string; value: string; on: boolean }[] = [
    { id: "input", title: "Entrée", value: ch ? (hp ? `coupe-bas ${Math.round(logMap(num(values, `${p}/preamp/hpf`), 20, 400))} Hz` : "coupe-bas off") : "retour", on: true },
    { id: "gate", title: "Gate", value: num(values, `${p}/gate/on`) === 1 ? "on" : "off", on: num(values, `${p}/gate/on`) === 1 },
    { id: "eq", title: "Égaliseur", value: num(values, `${p}/eq/on`, 1) === 1 ? "on" : "off", on: num(values, `${p}/eq/on`, 1) === 1 },
    { id: "comp", title: "Compresseur", value: num(values, `${p}/dyn/on`) === 1 ? `${RATIOS[num(values, `${p}/dyn/ratio`)]}:1` : "off", on: num(values, `${p}/dyn/on`) === 1 },
    { id: "sends", title: "Ears + FX", value: `${BUSES.filter((_, k) => num(values, `${p}/mix/${pad(k + 1)}/level`) > .02).length} ears`, on: true },
  ];
  const detail = step === "input" ? <InputView {...props} /> : step === "gate" ? <GateView {...props} /> : step === "sends" ? <SendsView {...props} /> : step === "comp" ? <CompView {...props} /> : <EqView {...props} />;
  return <>
    <div className="xs2-chhead">
      <button type="button" className="xs2-sq" aria-label="Canal précédent" disabled={i <= 0} onClick={() => select(INPUTS[i - 1]!)}>‹</button>
      <i className="sw" style={{ background: stripColor(num(values, `${p}/config/color`)) }} />
      <div><h2>{stripName(strip, values)}</h2><div className="muted">{strip.fallback}</div></div>
      <button type="button" className="xs2-sq" aria-label="Canal suivant" disabled={i >= INPUTS.length - 1} onClick={() => select(INPUTS[i + 1]!)}>›</button>
    </div>
    <div className="xs3-channel-layout"><aside className="xs3-channel-sidebar"><div className="xs3-source-icon">♫</div><strong>{stripName(strip, values)}</strong><small>{strip.fallback}</small><label className="xs3-fader-label">Fader {dbText(num(values, `${p}/mix/fader`,0.5))}<input type="range" orient="vertical" min="0" max="1" step=".005" value={num(values, `${p}/mix/fader`,0.5)} disabled={!canWrite} onChange={e => set(`${p}/mix/fader`, Number(e.target.value))} aria-label={`Volume de ${stripName(strip,values)}`} /></label><div className="xs3-channel-actions"><button type="button" disabled={!canWrite} className={num(values, `${p}/mix/on`,1) === 0 ? "muted" : ""} onClick={() => set(`${p}/mix/on`,num(values, `${p}/mix/on`,1)===1?0:1)}> {num(values, `${p}/mix/on`,1)===1?"Mute":"Réactiver"} </button></div></aside><div className="xs3-channel-main"><div className="xs2-steps">{steps.map((s, k) => <button key={s.id} type="button" className={step === s.id ? "on" : ""} aria-pressed={step === s.id} onClick={() => setStep(s.id)}><small>{k + 1} · {s.title.toUpperCase()}</small><b>{s.title}</b><span>{s.value}</span></button>)}</div>
    <div className="xm xs2-legacy">{detail}</div>{step === "comp" && <div className="xs3-eq-preview"><strong>Égaliseur · aperçu réel</strong><svg viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label="Courbe de réponse de l’égaliseur"><path d="M0 50H600" stroke="#3a4b70" strokeDasharray="4 4"/><path d={eqPathWide(values,p)} stroke="#a88aff" fill="none" strokeWidth="3"/></svg><button type="button" className="xs2-btn" onClick={() => setStep("eq")}>Ouvrir l’égaliseur</button></div>}</div></div>
  </>;
}

// ---------------- Ears ----------------
function EarsView({ values, set, writable, confirmed }: { values: Values; set: SetFn; writable: boolean; confirmed: ViewProps["confirmed"] }) {
  const levels = useMeters(), fresh = meterStore.fresh();
  const rows = INPUTS.filter(s => s.kind !== "ch" || stripName(s, values) !== s.fallback || (levels[s.meters[0]!] ?? -128) > -60);
  const limiterOff = BUSES.map((_, i) => i + 1).filter(b => num(values, `/bus/${b}/dyn/on`) !== 1 && busName(values, b) !== `Bus ${b}`);
  const addLimiters = () => {
    const v: Record<string, Value> = {};
    for (const b of limiterOff) Object.assign(v, { [`/bus/${b}/dyn/on`]: 1, [`/bus/${b}/dyn/mode`]: 0, [`/bus/${b}/dyn/ratio`]: 11, [`/bus/${b}/dyn/thr`]: -6, [`/bus/${b}/dyn/knee`]: 0, [`/bus/${b}/dyn/attack`]: 1, [`/bus/${b}/dyn/release`]: 100, [`/bus/${b}/dyn/mgain`]: 0 });
    void confirmed(v, `Ajouter un limiteur de protection à −6 dB sur ${limiterOff.map(b => earsLabel(values, b)).join(", ")} ?`);
  };
  return <>
    <div className="xs2-bar"><div><div style={{ fontSize: 18, fontWeight: 700 }}>Les ears du groupe</div><div className="muted">Chaque colonne est le mix d’un musicien. Le téléphone du musicien règle la même colonne.</div></div></div>
    <div className="xs2-matrix" role="table" aria-label="Envois vers les ears">
      <div className="row head" role="row"><div role="columnheader" className="muted">Source</div>
        {BUSES.map((b, i) => { const db = fresh ? levels[b.meters[0]!] ?? -128 : -128; const lim = num(values, `/bus/${i + 1}/dyn/on`) === 1; return <div key={b.id} role="columnheader">
          <b>{earsLabel(values, i + 1)}</b>
          <span className="meter"><i className={db > -6 ? "hot" : ""} style={{ width: `${Math.max(0, Math.min(100, (db + 60) / 60 * 100))}%` }} /></span>
          <span className="mono muted" style={{ fontSize: 11 }}>{db <= -90 ? "—" : `crête ${Math.round(db)} dB`} · {lim ? "limiteur ✓" : "sans limiteur"}</span>
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
      {limiterOff.length ? <div className="xs2-note"><b>{limiterOff.length} ear{limiterOff.length > 1 ? "s" : ""} sans limiteur</b><div>Un limiteur à −6 dB empêche qu’un pic abîme les oreilles.</div><div style={{ marginTop: 8 }}><button type="button" className="xs2-btn warn" disabled={!writable} onClick={addLimiters}>Ajouter la protection…</button></div></div>
        : <div className="xs2-good"><b>Protection des oreilles active</b><div>Chaque ear nommé a son limiteur.</div></div>}
      <div className="xs2-card"><h3>Réverbération dans les ears</h3><div className="muted">Un peu de réverbération sur la voix aide le chanteur à se placer : règle la ligne de l’effet dans la colonne de chaque musicien.</div></div>
    </div>
  </>;
}

// ---------------- Routing ----------------
function RoutingPage(props: ViewProps) {
  const { values, canWrite, confirmed } = props;
  const usb = useMemo(() => Array.from({ length: 16 }, (_, i) => num(values, `/ch/${pad(i + 1)}/preamp/rtnsw`) === 1).filter(Boolean).length, [values]);
  const virtual = (on: boolean) => {
    const v: Record<string, Value> = {}; for (let c = 1; c <= 16; c++) v[`/ch/${pad(c)}/preamp/rtnsw`] = on ? 1 : 0;
    void confirmed(v, on ? "Passer les 16 canaux sur les pistes USB ? Chaque canal écoute l’enregistrement au lieu du micro (balance virtuelle)." : "Revenir aux micros sur les 16 canaux ?");
  };
  return <div className="xs2-split">
    <div className="main"><div className="xm xs2-legacy"><RoutingView {...props} /></div></div>
    <div className="side">
      <div className="xs2-card" style={{ background: "#0F1E1E", borderColor: "#1D4A4A" }}>
        <h3>Balance virtuelle {usb ? <span className="xs2-badge" style={{ background: "#3EE0E0" }}>{usb} USB</span> : null}</h3>
        <div style={{ color: "#B9E6E6", marginBottom: 10 }}>Chaque canal écoute la piste USB enregistrée (REAPER) au lieu du micro : on rejoue la répète et on peaufine le son sans les musiciens.</div>
        {usb ? <button type="button" className="xs2-btn" disabled={!canWrite} onClick={() => virtual(false)}>Revenir aux micros…</button> : <button type="button" className="xs2-btn primary" disabled={!canWrite} onClick={() => virtual(true)}>Passer les 16 canaux sur USB…</button>}
      </div>
    </div>
  </div>;
}
