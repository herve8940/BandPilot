import {useMixerModel} from '../MixerModel';
import { useEffect, useState } from "react";
import { Meter } from "../xair/controls";
type State = "offline" | "ready" | "starting" | "recording" | "stopping" | "lost";
type Status = { state: State; recording: boolean; playing?: boolean; elapsed: number; markers: number; alert: string; session: { title: string; tracks: number } | null };
async function request(path: string, post = false): Promise<Status> {
  const r = await fetch(path, post ? { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" } : undefined);
  const data = await r.json(); if (!r.ok) throw new Error(data.error || "Erreur REAPER"); return data;
}
const time = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60].map(n => String(n).padStart(2, "0")).join(":");
export function RecordingDock({ open }: { open: () => void }) {
  const model=useMixerModel();
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const poll = () => { void request("/api/reaper").then(v => { if (active) { setStatus(v); setError(""); } }).catch(e => { if (active) setError((e as Error).message); }); };
    poll(); const timer = setInterval(poll, 1000); return () => { active = false; clearInterval(timer); };
  }, []);
  const act = async (path: string) => { setBusy(true); try { setStatus(await request(path, true)); setError(""); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const state = status?.state ?? "offline";
  const ready = state === "ready" && !!status?.session;
  const running = state === "recording";
  return <div className="xs3-record-dock" role="region" aria-label="Transport d'enregistrement REAPER">
    <button type="button" className="xs3-record-open" onClick={open} aria-label="Ouvrir l'enregistrement"><span className={running ? "xs3-rec-light active" : "xs3-rec-light"}>●</span><span><strong>Enregistrement</strong><small>{status?.session ? status.session.title : "Préparer une session REAPER"}</small></span></button>
    <div className="xs3-rec-clock" aria-label="Durée d'enregistrement">{time(status?.elapsed ?? 0)}</div>
    <div className="xs3-rec-state"><span className={running ? "active" : ""}>● {running ? "REC" : state === "ready" ? "REAPER prêt" : state === "lost" ? "Liaison perdue" : "Non prêt"}</span><small>{status?.session ? status.session.tracks + " pistes" : "Aucune session"}</small></div>
    <div className="visual-record-meters" aria-label={`Niveaux des ${model.channels} entrées`}>{Array.from({length:model.channels},(_,i)=><Meter key={i} indexes={[i]}/>)}</div>
    <div className="xs3-rec-controls">
      <button type="button" className="rec" title="Démarrer l'enregistrement" disabled={!ready || busy} onClick={() => void act("/api/reaper/rec")}>● <span>REC</span></button>
      <button type="button" title="Lire dans REAPER" disabled={state !== "ready" || status?.playing || busy} onClick={() => void act("/api/show/play")}>▶ <span>Lire</span></button>
      <button type="button" title="Arrêter REAPER" disabled={(!["recording","starting","lost"].includes(state) && !status?.playing) || busy} onClick={() => void act("/api/show/stop")}>■ <span>Stop</span></button>
      <button type="button" title="Ajouter un marqueur" disabled={!running || busy} onClick={() => void act("/api/reaper/marker")}>⚑ <span>Marqueur</span></button>
      <button type="button" title="Configurer l'enregistrement" onClick={open}>⚙ <span>Configurer</span></button>
    </div>
    {(error || status?.alert) && <span className="xs3-rec-error" role="alert">{error || status?.alert}</span>}
  </div>;
}
