import {Workshop} from './Workshop';
import {useMixerModel} from '../MixerModel';
import { useEffect, useMemo, useState } from "react";
import { RecordingView } from "../expert/RecordingView";
import { Player } from "./Player";
import { call, clock, position, setupIssues, songAt, useShow, type ShowTrack } from "./api";
import "../expert/expert.css";
import "./show.css";

type Plan = { sampleRate: number; warnings: string[]; tracks: { id: string; name: string; selected: boolean; presetLabel: string }[] };
const projectName = (p: string) => p.split(/[\\/]/).at(-1)?.replace(/\.rpp$/i, "") ?? p;
export function Status({ show, link }: { show: { alive: boolean }; link: { state: string } | null }) {
  return <div className="sh-status"><span className={link && link.state !== "offline" ? "ok" : ""}>Reaper</span><span className={show.alive ? "ok" : ""}>Pont</span></div>;
}
export const needsBridge = (s: { alive: boolean; version?: string; bridgeCurrent?: string }) => !s.alive || (!!s.version && s.version !== s.bridgeCurrent);
export function BridgeInstall({ act, show }: { act: (p: string, d?: unknown) => Promise<unknown>; show: { alive: boolean; installed?: boolean; version?: string; bridgeCurrent?: string } }) {
  const [done, setDone] = useState(false);
  if (show.installed && !show.alive && !done) return <div className="xs2-card sh-install"><h3>Reaper ne répond pas</h3><p className="muted">Ouvre Reaper. S’il est déjà ouvert, regarde s’il affiche une fenêtre, puis ferme-la.</p></div>;
  return <div className="xs2-card sh-install"><h3>{show.version ? "Mettre à jour le pont Reaper" : "Relier BandPilot à Reaper"}</h3><p className="muted">Une seule fois : j’ajoute un petit script dans Reaper, qui sert à Rec, Stop et à l’affichage de tes morceaux. Redémarre ensuite Reaper.</p>
    <button type="button" className="xs2-btn primary" onClick={() => { if (confirm("Ajouter le pont BandPilot au démarrage de Reaper ?")) void act("/api/show/install", { confirm: true }).then(r => { if (r) setDone(true); }); }}>Installer le pont</button>
    {done && <p role="status">Installé. Redémarre Reaper.</p>}</div>;
}
export function Rehearse({onExpert}:{onExpert?:(channel:number)=>void}) {
  const [atelier,setAtelier]=useState(()=>{try{return sessionStorage.getItem('bandpilot-workshop-view')==='true';}catch{return false;}});
  const mixerModel=useMixerModel();
  const { show, link, error, setError, act } = useShow();
  const [mode, setMode] = useState<"songs" | "band">(() => { try { return localStorage.getItem("xr18-rehearse") === "band" ? "band" : "songs"; } catch { return "songs"; } });
  const [picked, setPicked] = useState(0), [plan, setPlan] = useState<Plan | null>(null);
  const present=show.presence, original=show.original===true;
  useEffect(()=>{setPicked(0);},[show.project]);
  const go = (m: "songs" | "band") => { setMode(m); try { localStorage.setItem("xr18-rehearse", m); } catch { /* convenience */ } };
  useEffect(() => { void call<Plan>("/api/reaper/plan").then(setPlan).catch(e => setError(e.message)); }, []);
  const songs = useMemo(() => show.songs?.length ? show.songs : show.length ? [{ title: "Projet ouvert", start: 0, countin: 0, stop: show.length }] : [], [show.songs, show.length]);
  const cursor = position(show, link), recording = !!link?.recording, busy = recording || link?.state === "starting";
  const playingSong = link?.playing && songs.length ? songAt(songs, cursor) : -1;
  useEffect(() => { if (playingSong >= 0) setPicked(playingSong); }, [playingSong]);
  const song = songs[Math.min(picked, Math.max(0, songs.length - 1))];
  const range = mode === "songs" && song ? { start: song.start, stop: song.stop } : { start: 0, stop: Math.max(show.length ?? 0, cursor, 1) };
  const rec = (show.tracks ?? []).filter(t => t.rec && t.items.length);
  const firstRec = mode === "band" ? (show.tracks ?? []).find(t => t.armed && t.items.length) : rec[0];
  const items = firstRec?.items.filter(i => i.pos < range.stop && i.pos + i.length > range.start) ?? [];
  const allRecItems=(show.tracks??[]).filter(t=>t.rec||t.armed).flatMap(t=>t.items).filter(i=>i.pos<range.stop&&i.pos+i.length>range.start);
  const takeIndices=mode==="songs"?[...new Set(allRecItems.flatMap(i=>i.takes.filter(t=>t.valid!==false).map(t=>t.index)))].sort((a,b)=>a-b):items.map((_,i)=>i);
  const takes=takeIndices.length;
  const activeTake = mode === "songs" ? items[0]?.takes.find(t => t.active)?.index ?? -1 : -1;
  const pick = (i: number) => { setPicked(i); const s = songs[i]; if (s && !busy) void act("/api/show/goto", { pos: s.start }); };
  const onTrack = (t: ShowTrack, solo: boolean) => void act("/api/show/track", { name: t.name, solo, on: solo ? !t.solo : !t.mute });
  const toggle = (id: string) => { const list = present ?? []; const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id]; void act("/api/show/presence", { present: next, project:show.project }); };
  const useTake = (i: number) => { if (mode === "band") { const it = items[i]; if (it) void act("/api/show/goto", { pos: it.pos }); } else void act("/api/show/take", { project:show.project, take: i, start: range.start, stop: range.stop }); };
  const startRec = () => { if (mode === "songs" && song) void act("/api/show/rec", { start: song.countin ?? song.start, stop: song.stop }); else void act("/api/reaper/rec"); };
  const armed = (show.tracks ?? []).filter(t => t.armed).length, canRec = armed > 0;
  const issues = [...setupIssues(show, plan?.sampleRate,mixerModel.usbChannels,mixerModel.label), ...(plan?.warnings ?? [])];
  const loop = show.loop?.on, section = (show.regions ?? []).find(r => cursor >= r.start && cursor < r.stop);

  return <section className="xs2 sh sh-rehearse" aria-label="Répéter">
    <div className="sh-head">
      <div className="sh-seg" role="group" aria-label="Type de répétition"><button type="button" className={mode === "songs" ? "on" : ""} aria-pressed={mode === "songs"} onClick={() => go("songs")}>Avec mes morceaux</button><button type="button" className={mode === "band" ? "on" : ""} aria-pressed={mode === "band"} onClick={() => go("band")}>Groupe seul</button></div>
      <button type="button" className={`xs2-btn ${atelier?'primary':''}`} onClick={()=>{setAtelier(!atelier);sessionStorage.setItem('bandpilot-workshop-view',String(!atelier));}}>{atelier?'Revenir à la répétition':'Atelier du son'}</button><Status show={show} link={link} />
    </div>
    {atelier?<>{needsBridge(show)&&<BridgeInstall act={act} show={show}/>}<Workshop onExpert={onExpert}/></>:<>
    {(error || link?.alert) && <div className="xs2-msg error" role="alert">{error || link?.alert}<button type="button" aria-label="Fermer" onClick={() => { setError(""); if (link?.alert) void act("/api/reaper/dismiss"); }}>×</button></div>}
    {!busy && issues.slice(0, 2).map(i => <div className="xs2-msg" role="status" key={i}>{i}</div>)}
    <div className={`sh-transport ${recording ? "rec" : ""}`}>
      <div className="sh-transport-info"><small className="sh-project">{show.project ? `Projet ouvert : ${projectName(show.project)}` : ""}</small><small>{recording ? "Enregistrement confirmé par Reaper" : link?.state === "ready" ? (canRec ? `Prêt · ${armed} piste${armed > 1 ? "s" : ""} armée${armed > 1 ? "s" : ""}` : mode === "band" ? "Crée d’abord une session" : "Coche qui est là pour enregistrer") : link?.state === "lost" ? "Liaison perdue : regarde Reaper" : link?.state === "starting" ? "Démarrage…" : "Reaper non relié"}</small><b>{mode === "songs" ? song?.title ?? "Aucun morceau" : link?.session?.title ?? "Session du groupe"}</b></div>
      <strong className="sh-clock">{clock(recording ? link!.elapsed : cursor - range.start)}</strong>
      {link?.autoStopIn !== null && link?.autoStopIn !== undefined && <button type="button" className="xs2-btn sh-continue" onClick={() => void act("/api/show/continue")}>Arrêt dans {link.autoStopIn} s · Continuer</button>}
      <div className="sh-transport-actions" role="group" aria-label="Transport de répétition">
      <button type="button" className="sh-big" disabled={link?.state !== "ready" || !!link?.playing} onClick={() => void act("/api/show/play")}>▶ Lecture</button>
      <button type="button" className="sh-big" disabled={!link?.playing && !busy && link?.state !== "lost"} onClick={() => void act("/api/show/stop")}>■ Stop</button>
      <button type="button" className="sh-big rec" disabled={link?.state !== "ready" || !!link?.playing || !canRec} title={canRec ? undefined : "Aucune piste armée dans le projet ouvert"} onClick={startRec}>● Rec</button>
      <button type="button" className="sh-big" disabled={!recording} onClick={() => void act("/api/reaper/marker")}>Marqueur</button>
      </div>
    </div>

    {mode === "band" && !firstRec && !needsBridge(show) && <RecordingView embedded />}
        {needsBridge(show) ? <BridgeInstall act={act} show={show} /> : (mode === "songs" || firstRec) && <div className={`sh-grid ${mode === "band" ? "band" : ""}`}>
      {mode === "songs" && <aside className="xs2-card sh-songs" aria-label="Morceaux"><h3>{show.concert || "Morceaux"}</h3><div className="sh-song-list">{songs.length ? songs.map((s, i) => <button key={s.start} type="button" className={`sh-song ${s === song ? "on" : ""}`} disabled={busy} onClick={() => pick(i)}><b>{s.title}</b><small>{clock(s.stop - s.start)}</small></button>) : <p className="muted">Ouvre un projet ReaCue dans Reaper.</p>}</div></aside>}
      <main className="xs2-card sh-main"><Player show={show} band={mode === "band"} cursor={cursor} range={range} disabled={busy} onSeek={t => void act("/api/show/goto", { pos: t })} onTrack={onTrack} />
        <div className="sh-tools">{mode === "songs" && loop && !section && <button type="button" className="xs2-btn primary" disabled={busy} onClick={()=>void act("/api/show/loop",{on:false,project:show.project})}>Arrêter la boucle</button>}{mode === "songs" && section && <button type="button" className={`xs2-btn ${loop ? "primary" : ""}`} disabled={busy} onClick={() => void act("/api/show/loop", { project:show.project, on: !loop, start: section.start, stop: section.stop })}>{loop ? "Arrêter la boucle" : "Boucler cette section"}</button>}</div></main>
      <aside className="sh-side">
        {mode === "songs" && <div className="xs2-card"><h3>Qui est là aujourd’hui ?</h3><p className="muted">Les cases reflètent les pistes REC armées du projet ouvert. Cocher prépare l’enregistrement et coupe la piste ReaCue correspondante.</p>{plan?.tracks.filter(t => t.selected).map(t => <label key={t.id} className="sh-check"><input type="checkbox" disabled={busy} checked={(present ?? []).includes(t.id)} onChange={() => toggle(t.id)} /><span>{t.name}<small>{(present ?? []).includes(t.id) ? "Prêt à enregistrer" : "Absent"}</small></span></label>)}</div>}
        <div className="xs2-card"><h3>Prises</h3>{takes ? takeIndices.map(i => <button key={i} type="button" className={`sh-song ${i === activeTake && !original ? "on" : ""}`} disabled={busy} onClick={() => useTake(i)}><b>Prise {i + 1}</b>{mode === "band" && items[i] && <small>{clock(items[i]!.length)}</small>}</button>) : <p className="muted">Pas encore de prise.</p>}
          {mode === "songs" && takes > 0 && <button type="button" className={`sh-song ${original ? "on" : ""}`} disabled={busy} onClick={() => { const on = !original; void act("/api/show/original", { on, project:show.project }); }}><b>Original ReaCue</b></button>}</div>
      </aside>
    </div>}
  </>}
  </section>;
}
