import { Fragment, useEffect, useRef, useState } from "react";
import type { Values, Value } from "../xair/controls";

type Target = { kind: "bus" | "lr" | "ch"; n: number };
type Reco = { id: string; severity: "important" | "conseil" | "securite"; where: string; title: string; why: string; changes: Record<string, Value>; channel?: number; bus?: number; zone?: string; current?: Record<string, Value | null> };
type Snapshot = { active: boolean; target: Target; targetLabel: string; rehearsal: boolean; scanning: boolean; lastScanAt: string | null; live: { bands: number[]; at: number } | null; map: { channel: number; name: string; zones: number[] }[]; recommendations: Reco[] };
type Plan = { token: string; changes: { address: string; before: Value; after: Value }[] };
type Done = { title: string; backupId: string };

async function api<T = any>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(path, { method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const v = await r.json().catch(() => ({})); if (!r.ok) throw Error(v.error ?? "Erreur"); return v as T;
}
const ZONES: [string, number, number][] = [["Sub", 20, 60], ["Grave", 60, 120], ["Bas-méd.", 120, 350], ["Médium", 350, 1200], ["Haut-méd.", 1200, 2500], ["Présence", 2500, 5000], ["Brillance", 5000, 10000], ["Air", 10000, 20000]];
const TAG = { important: "Important", conseil: "Conseil", securite: "Sécurité" };
const W = 900, H = 260;
const xOf = (f: number) => Math.log(f / 20) / Math.log(1000) * W;
const yOf = (db: number) => Math.max(0, Math.min(H - 20, (H - 20) * (-db - 10) / 80)); // −10 dB top … −90 dB bottom
const freqOf = (i: number) => 20 * Math.pow(1000, i / 99);

/** Words a musician understands for each kind of setting. */
function label(address: string) {
  const ch = /^\/ch\/(\d\d)\/(.+)$/.exec(address), bus = /^\/bus\/(\d)\/(.+)$/.exec(address);
  const where = ch ? `Canal ${Number(ch[1])}` : bus ? `Bus ${bus[1]}` : "";
  const leaf = (ch ?? bus)?.[2] ?? address;
  const names: Record<string, string> = { "preamp/hpon": "coupe-bas", "preamp/hpf": "coupe-bas (Hz)", "eq/on": "égaliseur", "dyn/thr": "compresseur · seuil (dB)", "dyn/on": "compresseur", "dyn/ratio": "compresseur · ratio", "dyn/attack": "attaque (ms)", "dyn/release": "relâche (ms)", "dyn/knee": "knee", "dyn/mgain": "gain de sortie", "dyn/mode": "mode", "mix/fader": "volume (dB)" };
  const eq = /^eq\/(\d)\/(type|f|g|q)$/.exec(leaf);
  const what = eq ? `EQ bande ${eq[1]} · ${{ type: "type", f: "fréquence (Hz)", g: "gain (dB)", q: "Q" }[eq[2] as "type"]}` : names[leaf] ?? leaf;
  return `${where} · ${what}`;
}
const show = (v: Value) => typeof v === "number" ? String(Math.round(v * 100) / 100).replace("-", "−") : String(v);

export function AnalysisView({ values, rehearsal, canWrite, onCount }: { values: Values; rehearsal: boolean; canWrite: boolean; onCount: (n: number) => void }) {
  const [snap, setSnap] = useState<Snapshot | null>(null), [live, setLive] = useState<number[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(""), [progress, setProgress] = useState("");
  const [open, setOpen] = useState<Reco | null>(null), [done, setDone] = useState<Done[]>([]);
  const load = (s: Snapshot) => { setSnap(s); if (s.live) setLive(s.live.bands); onCount(s.recommendations.length); };
  useEffect(() => { void api<Snapshot>("/api/analysis").then(load).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    let closed = false, ws: WebSocket | null = null, retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`);
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === "analysis-live") setLive(m.live.bands); else if (m.type === "analysis") load(m.analysis); else if (m.type === "analysis-progress") setProgress(`J’écoute ${m.progress.name}…`); };
      ws.onclose = () => { if (!closed) retry = setTimeout(connect, 1500); };
    };
    connect(); return () => { closed = true; if (retry) clearTimeout(retry); ws?.close(); };
  }, []);
  const run = async (label: string, fn: () => Promise<unknown>) => { setBusy(label); setError(""); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); setProgress(""); } };
  const start = (target?: Target) => run("start", async () => load(await api<Snapshot>(snap?.active && target ? "/api/analysis/target" : "/api/analysis/start", target ? { target } : {})));
  const busName = (b: number) => { const n = values[`/bus/${b}/config/name`]; return typeof n === "string" && n.trim() ? n.trim() : `Ears ${b}`; };
  const t = snap?.target;

  // Target curve "clean ears": flat 120 Hz–2 kHz around the mix's own level, gentle slope above, roll-off in the sub.
  const ref = live ? 10 * Math.log10(live.slice(Math.round(99 * Math.log(200 / 20) / Math.log(1000)), Math.round(99 * Math.log(2000 / 20) / Math.log(1000))).reduce((a, v) => a + Math.pow(10, v / 10), 0) / 40) : -50;
  const target = (f: number) => ref - (f < 80 ? 6 * Math.log2(80 / f) : 0) - (f > 2000 ? 3 * Math.log2(f / 2000) : 0);
  const livePath = live ? live.map((v, i) => `${i ? "L" : "M"}${xOf(freqOf(i)).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ") : "";
  const targetPath = Array.from({ length: 60 }, (_, i) => { const f = 20 * Math.pow(1000, i / 59); return `${i ? "L" : "M"}${xOf(f).toFixed(1)} ${yOf(target(f)).toFixed(1)}`; }).join(" ");
  const recos = snap?.recommendations ?? [];
  const zonesFlagged = new Set(recos.map(r => r.zone).filter(Boolean));
  const clash = (name: string, zone: string) => recos.some(r => r.zone === zone && r.where.includes(name));

  return <>
    <div className="xs2-bar">
      <span className={`xs2-pill ${snap?.active ? "live" : "off"}`}><span className="xs2-dot" />{snap?.active ? "En écoute" : "Analyse en pause"}</span>
      <span className="label">J’écoute</span>
      {[1, 2, 3, 4, 5, 6].map(b => <button key={b} type="button" className={`xs2-chip${t?.kind === "bus" && t.n === b && snap?.active ? " on" : ""}`} disabled={!!busy} onClick={() => void start({ kind: "bus", n: b })}>{busName(b)}</button>)}
      <button type="button" className={`xs2-chip${t?.kind === "lr" && snap?.active ? " on" : ""}`} disabled={!!busy} onClick={() => void start({ kind: "lr", n: 0 })} title={rehearsal ? "En répétition, le Main est coupé : le spectre sera vide" : ""}>Main</button>
      <div className="xs2-spacer" />
      <button type="button" className="xs2-btn" disabled={!!busy} onClick={() => void run("scan", async () => load(await api<Snapshot>("/api/analysis/scan", {})))}>{busy === "scan" ? (progress || "J’écoute chaque instrument…") : "Analyser chaque instrument"}</button>
      {snap?.active ? <button type="button" className="xs2-btn" onClick={() => void run("stop", async () => load(await api<Snapshot>("/api/analysis/stop", {})))}>Pause</button>
        : <button type="button" className="xs2-btn primary" disabled={!!busy} onClick={() => void start()}>Lancer l’écoute</button>}
    </div>
    {rehearsal && <p className="muted" style={{ margin: "0 0 10px" }}>Mode Répétition : la façade est coupée, l’analyse porte sur les ears des musiciens.</p>}
    {error && <div className="xs2-msg error" style={{ margin: "0 0 12px" }}>{error}<button type="button" aria-label="Fermer" onClick={() => setError("")}>×</button></div>}

    <div className="xs2-split">
      <div className="main" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="xs2-card">
          <h3>Spectre en direct{snap?.active ? ` · ${snap.targetLabel}` : ""}</h3>
          <div className="xs2-legend"><span><i style={{ background: "#3EE0E0" }} />son actuel</span><span><i style={{ background: "repeating-linear-gradient(90deg,#C9D2DC 0 6px,transparent 6px 10px)" }} />courbe cible « ears propres »</span><span><i style={{ height: 10, background: "#F5B83D33", border: "1px solid #F5B83D" }} />zone à corriger</span></div>
          <svg className="xs2-rta" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Spectre en direct comparé à la courbe cible">
            <g stroke="#161C24">{[-30, -50, -70].map(d => <path key={d} d={`M0 ${yOf(d)} H${W}`} />)}{[50, 100, 250, 1000, 3000, 8000, 16000].map(f => <path key={f} d={`M${xOf(f)} 0 V${H - 20}`} />)}</g>
            {ZONES.filter(([z]) => zonesFlagged.has(z)).map(([z, a, b]) => <rect key={z} x={xOf(a)} y={0} width={xOf(b) - xOf(a)} height={H - 20} fill="#F5B83D14" stroke="#F5B83D55" strokeDasharray="4 4" />)}
            {live && <path d={`${livePath} L${W} ${H - 20} L0 ${H - 20} Z`} fill="#3EE0E01A" stroke="none" />}
            {live && <path d={livePath} fill="none" stroke="#3EE0E0" strokeWidth="2" />}
            {live && <path d={targetPath} fill="none" stroke="#C9D2DC" strokeWidth="2" strokeDasharray="7 6" />}
            {!live && <text x={W / 2} y={H / 2} textAnchor="middle" fill="#9AA6B4" fontSize="15">{snap?.active ? "Rien n’arrive encore : faites jouer le groupe." : "Lance l’écoute pendant que le groupe joue."}</text>}
            <g fill="#8994A1" fontSize="11">{[50, 100, 250, 1000, 3000, 8000, 16000].map(f => <text key={f} x={xOf(f) + 4} y={H - 6}>{f >= 1000 ? `${f / 1000}k` : f}</text>)}</g>
          </svg>
        </div>
        <div className="xs2-card">
          <h3>Qui joue où</h3>
          <p className="muted" style={{ margin: "0 0 10px" }}>Énergie de chaque instrument par zone de fréquences. Un carré orange : une zone à corriger (deux instruments qui se gênent, grondement ou résonance).</p>
          {snap?.map.length ? <div className="xs2-map">
            <div className="r"><span />{ZONES.map(([z]) => <span key={z} className="h">{z}</span>)}</div>
            {snap.map.map(row => { const max = Math.max(...row.zones), silent = max < -85; return <div className="r" key={row.channel}><b>{row.name}</b>{row.zones.map((v, k) => { const lvl = silent ? 0 : v > max - 3 ? 4 : v > max - 8 ? 3 : v > max - 14 ? 2 : v > max - 22 ? 1 : 0; return <span key={k} className={`c${clash(row.name, ZONES[k]![0]) ? " clash" : ""}`} style={{ background: ["#11161D", "#15323A", "#1C5560", "#2A8C93", "#3EE0E0"][lvl] }} title={`${row.name} · ${ZONES[k]![0]} : ${Math.round(v)} dB`} />; })}</div>; })}
          </div> : <div className="xs2-empty">Clique sur « Analyser chaque instrument » pendant que le groupe joue : j’écoute chaque canal une seconde, l’un après l’autre.</div>}
        </div>
      </div>
      <aside className="side">
        <div><b style={{ fontSize: 16 }}>{recos.length ? `${recos.length} recommandation${recos.length > 1 ? "s" : ""}` : "Recommandations"}</b> <span className="muted">pour des instruments plus propres dans les ears</span></div>
        {recos.length ? recos.map(r => <div key={r.id} className={`xs2-reco ${r.severity}`}>
          <span className="tag">{TAG[r.severity]}</span><span className="muted">{r.where}</span>
          <b style={{ fontSize: 14 }}>{r.title}</b><span className="why">{r.why}</span>
          <div className="acts"><button type="button" className="xs2-btn primary" onClick={() => setOpen(r)}>Voir et valider</button><button type="button" className="xs2-btn ghost" onClick={() => void run("dismiss", async () => load(await api<Snapshot>("/api/analysis/dismiss", { id: r.id })))}>Ignorer</button></div>
        </div>) : <div className="xs2-empty">{snap?.lastScanAt ? "Rien à corriger dans ce que j’ai entendu. Relance l’analyse sur un autre morceau ou un passage plus fort." : "Les recommandations apparaissent après l’analyse des instruments."}</div>}
        {done.length > 0 && <div className="xs2-card"><h3>Appliqué ce soir</h3>{done.map(d => <div key={d.backupId} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}><span style={{ flex: 1 }}>{d.title}</span><button type="button" className="xs2-btn ghost" onClick={() => void run("undo", async () => { const plan = await api<Plan>("/api/console/restore", { backupId: d.backupId }); await api("/api/console/apply", { token: plan.token, confirm: true, tolerant: true }); setDone(x => x.filter(y => y.backupId !== d.backupId)); })}>Annuler</button></div>)}</div>}
      </aside>
    </div>
    {open && <Validate reco={open} values={values} canWrite={canWrite} onClose={() => setOpen(null)} onDone={(d) => { setDone(x => [d, ...x]); setOpen(null); void api<Snapshot>("/api/analysis").then(load); }} />}
  </>;
}

function Validate({ reco, values, canWrite, onClose, onDone }: { reco: Reco; values: Values; canWrite: boolean; onClose: () => void; onDone: (d: Done) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [side, setSide] = useState<"a" | "b">("a"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const ab = async (s: "a" | "b") => { setBusy(true); setError(""); try { await api("/api/analysis/listen", { id: reco.id, side: s }); setSide(s); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const close = async () => { if (side === "b") { try { await api("/api/analysis/listen", { id: reco.id, side: "a" }); } catch { /* best effort */ } } try { await api("/api/analysis/release", { id: reco.id }); } catch { /* best effort */ } onClose(); };
  const apply = async () => {
    setBusy(true); setError("");
    try { const plan = await api<Plan>("/api/analysis/preview", { id: reco.id }); const r = await api<{ backupId: string }>("/api/console/apply", { token: plan.token, confirm: true, tolerant: true }); onDone({ title: reco.title, backupId: r.backupId }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  void values;
  return <dialog ref={dialog} className="xs2-dialog" aria-labelledby="reco-title" onCancel={e => { e.preventDefault(); void close(); }}>
    <div className="in">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={`xs2-reco ${reco.severity}`} style={{ padding: 0, border: 0, background: "none" }}><span className="tag">{TAG[reco.severity]}</span></div>
          <span className="muted">{reco.where}</span>
          <h2 id="reco-title">{reco.title}</h2>
          <p style={{ margin: 0, color: "#B4BFCB", maxWidth: 760 }}>{reco.why}</p>
        </div>
        <button type="button" className="close" aria-label="Fermer sans rien changer" onClick={() => void close()}>×</button>
      </div>
      <div className="xs2-split">
        <div className="main xs2-card" style={{ background: "#141920" }}>
          <h3>Ce qui change sur la console</h3>
          <div className="xs2-diff">{Object.entries(reco.changes).map(([a, v]) => <Fragment key={a}><span style={{ color: "#C9D2DC" }}>{label(a)}</span><span className="muted">{reco.current?.[a] == null ? "—" : show(reco.current[a]!)}</span><span className="muted" aria-hidden="true">→</span><span style={{ color: "#3EE0E0" }}>{show(v)}</span></Fragment>)}</div>
          <p className="muted" style={{ margin: "10px 0 0" }}>Le 48 V, les gains et la façade ne sont pas touchés. Une sauvegarde est faite juste avant : « Annuler » remet tout comme avant.</p>
        </div>
        <div className="side">
          <div className="xs2-card" style={{ background: "#141920" }}>
            <h3>Écouter avant de décider</h3>
            <div className="xs2-ab" role="group" aria-label="Comparer avant et après">
              <button type="button" className={side === "a" ? "on" : ""} aria-pressed={side === "a"} disabled={busy || !canWrite} onClick={() => void ab("a")}>A · Avant</button>
              <button type="button" className={side === "b" ? "on" : ""} aria-pressed={side === "b"} disabled={busy || !canWrite} onClick={() => void ab("b")}>B · Après</button>
            </div>
            <p className="muted" style={{ margin: "8px 0 0" }}>La console bascule en direct : les musiciens entendent la différence dans leurs ears.</p>
          </div>
        </div>
      </div>
      {error && <div className="xs2-msg error" style={{ margin: 0 }}>{error}</div>}
      {!canWrite && <div className="xs2-note">Pour écouter et appliquer, active le contrôle de la console (Réglages › Connexion).</div>}
      <div className="foot">
        <span className="muted">Rien n’est appliqué sans ton accord.</span><div className="xs2-spacer" />
        <button type="button" className="xs2-btn" disabled={busy} onClick={() => void close()}>{side === "b" ? "Revenir à A et fermer" : "Fermer"}</button>
        <button type="button" className="xs2-btn primary" disabled={busy || !canWrite} onClick={() => void apply()}>{busy ? "Application…" : "Appliquer"}</button>
      </div>
    </div>
  </dialog>;
}
