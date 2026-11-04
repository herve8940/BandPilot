import { useEffect, useState } from "react";

type Track = { id: string; usb: number; stereo: boolean; name: string; presetLabel: string; source: string; tap: string; selected: boolean; warning?: string };
type Plan = { sampleRate: number; tracks: Track[]; warnings: string[]; hoursFree: number | null };
type State = "offline" | "ready" | "starting" | "recording" | "stopping" | "lost";
type Status = { state: State; recording: boolean; elapsed: number; markers: number; alert: string; defaultFolder?: string; session: { title: string; file: string; hoursFree: number | null; tracks: number } | null };

async function api<T>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(path, { method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const v = await r.json().catch(() => ({})); if (!r.ok) throw Error(v.error ?? "Erreur"); return v as T;
}
const LABEL: Record<State, string> = { offline: "Reaper non relié", ready: "Reaper prêt", starting: "Démarrage de Reaper…", recording: "Enregistrement en cours", stopping: "Arrêt en cours…", lost: "Liaison perdue : regarde Reaper" };
const PILL: Record<State, string> = { offline: "off", ready: "live", starting: "off", recording: "rec", stopping: "off", lost: "rec" };
const clock = (s: number) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, "0")).join(":");

export function RecordingView({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null), [plan, setPlan] = useState<Plan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()), [name, setName] = useState(""), [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const poll = () => void api<Status>("/api/reaper").then(s => { if (alive) setStatus(s); }).catch(e => { if (alive) setError(e.message); });
    poll(); const t = setInterval(poll, 1000); return () => { alive = false; clearInterval(t); };
  }, []);
  const run = async (label: string, task: () => Promise<void>) => { setBusy(label); setError(""); try { await task(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); } };
  const load = () => run("plan", async () => { const p = await api<Plan>("/api/reaper/plan"); setPlan(p); setSelected(new Set(p.tracks.filter(t => t.selected).map(t => t.id))); });
  useEffect(() => { void load(); }, []);
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const prepare = () => run("session", async () => setStatus(await api<Status>("/api/reaper/session", { name, folder, tracks: [...selected] })));
  const act = (label: string, path: string) => run(label, async () => setStatus(await api<Status>(path, {})));
  const state = status?.state ?? "offline", chosen = plan?.tracks.filter(t => selected.has(t.id)) ?? [];
  const alerts = chosen.filter(t => t.warning);

  return <div className="xs2-page xs2-rec">
    {!embedded && <div className={`xs2-card xs2-rec-transport ${state === "recording" ? "on" : ""}`}>
      <span className={`xs2-pill ${PILL[state]}`}><span className="xs2-dot" />{LABEL[state]}</span>
      {status?.recording && <b className="xs2-rec-clock">{clock(status.elapsed)}</b>}
      <div className="xs2-spacer" />
      <button type="button" className="xs2-btn xs2-rec-btn" disabled={!!busy || (state !== "ready" || !status?.session)} onClick={() => void act("rec", "/api/reaper/rec")}>{busy === "rec" ? "Attente de Reaper…" : "● Rec"}</button>
      <button type="button" className="xs2-btn" disabled={busy === "stop" || !["recording", "starting", "lost"].includes(state)} onClick={() => void act("stop", "/api/reaper/stop")}>{busy === "stop" ? "Arrêt…" : "■ Stop"}</button>
      <button type="button" className="xs2-btn" disabled={!status?.recording} onClick={() => void act("marker", "/api/reaper/marker")}>Marqueur{status?.markers ? ` (${status.markers})` : ""}</button>
    </div>}
    {status?.alert && <div className="xs2-msg error" role="alert" style={{ margin: "12px 0 0" }}>{status.alert}<button type="button" aria-label="Fermer" onClick={() => void act("dismiss", "/api/reaper/dismiss")}>×</button></div>}
    {error && <div className="xs2-msg error" role="alert" style={{ margin: "12px 0 0" }}>{error}<button type="button" aria-label="Fermer" onClick={() => setError("")}>×</button></div>}
    {status?.session && <p className="muted">Session préparée ici : <b>{status.session.title}</b> · {status.session.tracks} pistes{status.session.hoursFree !== null ? ` · environ ${status.session.hoursFree} h d’espace disque` : ""}. Vérifie que c’est bien elle qui est ouverte dans Reaper avant d’appuyer sur Rec.</p>}

    <div className="xs2-split" style={{ marginTop: 14 }}>
      <div className="main xs2-card">
        <div className="xs2-rec-head"><h3>Pistes à enregistrer</h3><button type="button" className="xs2-btn" disabled={!!busy} onClick={() => void load()}>{busy === "plan" ? "Lecture…" : "Relire la console"}</button></div>
        {plan?.warnings.map(w => <p key={w} className="xs2-rec-warn">{w}</p>)}
        {plan ? <table className="xs2-rec-table"><thead><tr><th /><th>Piste</th><th>Entrée USB</th><th>Format</th><th>Réglages Reaper</th><th>Prélèvement</th></tr></thead><tbody>
          {plan.tracks.map(t => <tr key={t.id} className={selected.has(t.id) ? "" : "off"}>
            <td><input type="checkbox" aria-label={`Enregistrer ${t.name}`} checked={selected.has(t.id)} onChange={() => toggle(t.id)} /></td>
            <td><b>{t.name}</b>{selected.has(t.id) && t.warning && <small className="xs2-rec-warn">{t.warning}</small>}</td>
            <td>{t.stereo ? `${t.usb}-${t.usb + 1}` : t.usb}</td><td>{t.stereo ? "Stéréo" : "Mono"}</td><td>{t.presetLabel}</td><td>{t.tap}</td>
          </tr>)}</tbody></table> : <div className="xs2-empty">Lecture de la console…</div>}
      </div>
      <aside className="side">
        <div className="xs2-card">
          <h3>Préparer la session</h3>
          <label className="xs2-rec-field">Nom<input value={name} maxLength={60} placeholder="Répétition" onChange={e => setName(e.target.value)} /></label>
          <label className="xs2-rec-field">Dossier<input value={folder} placeholder={status?.defaultFolder ?? ""} onChange={e => setFolder(e.target.value)} /></label>
          <p className="muted">{chosen.length} piste{chosen.length > 1 ? "s" : ""} · WAV 24 bits · réglages par instrument · {plan ? plan.sampleRate / 1000 : "—"} kHz{plan?.hoursFree != null ? ` · environ ${plan.hoursFree} h d’espace disque` : ""}{alerts.length ? ` · ${alerts.length} à vérifier` : ""}</p>
          <button type="button" className="xs2-btn primary" disabled={!!busy || !chosen.length || !!status?.recording} onClick={() => void prepare()}>{busy === "session" ? "Préparation…" : "Créer et ouvrir dans Reaper"}</button>
          <p className="muted">Une session existante n’est jamais écrasée. La console n’est pas modifiée. Même si la console est simulée, REAPER enregistre les véritables entrées audio.</p>
        </div>
        <div className="xs2-card"><h3>Carte son</h3><p className="muted">Une seule fois dans Reaper : Préférences › Audio › Device, choisis la console.</p></div>
      </aside>
    </div>
  </div>;
}
