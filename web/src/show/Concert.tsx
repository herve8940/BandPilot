import {tx, getLocale} from "../i18n";
import {useMixerModel} from '../MixerModel';
import { useEffect, useRef, useState } from "react";
import { BridgeInstall, needsBridge, Status } from "./Rehearse";
import { call, clock, position, sectionName, setupIssues, songAt, useShow } from "./api";
import "../expert/expert.css";
import "./show.css";

/** Risky actions need two presses within 3 seconds. */
function useTwoPress() {
  const [armed, setArmed] = useState(""), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return { armed, press: (id: string, run: () => void) => { if (armed === id) { setArmed(""); run(); return; } setArmed(id); clearTimeout(timer.current); timer.current = setTimeout(() => setArmed(""), 3000); } };
}
export function Concert() {
  const mixerModel=useMixerModel();
  const { show, link, error, setError, act } = useShow();
  const [unlocked, setUnlocked] = useState(false), [recordShow, setRecordShow] = useState(true), [checks, setChecks] = useState<{ warnings: string[]; hoursFree: number | null; sampleRate: number } | null>(null);
  const { armed, press } = useTwoPress();
  useEffect(() => { void call<{ warnings: string[]; hoursFree: number | null; sampleRate: number }>("/api/reaper/plan").then(setChecks).catch(e => setError(e.message)); }, []);
  const songs = show.songs ?? [], cursor = position(show, link), index = songAt(songs, cursor), song = songs[index], next = songs[index + 1];
  const recording = !!link?.recording, running = recording || !!link?.playing || link?.state === "starting";
  const armedTracks = (show.tracks ?? []).filter(t => t.armed).length, issues = [...setupIssues(show, checks?.sampleRate,mixerModel.usbChannels,mixerModel.label), ...(checks?.warnings ?? [])];
  if (recordShow && !armedTracks) issues.unshift("Aucune piste armée : prépare Qui est là dans Répéter, ou passe Sans enregistrement.");
  const section = (show.regions ?? []).find(r => cursor >= r.start && cursor < r.stop);
  const start = () => { if (!song) return; if (recordShow) void act("/api/show/rec", { start: cursor > song.start + 1 ? cursor : song.countin, stop: song.stop }); else void act("/api/show/play"); };
  const wanted = recordShow && !recording && running;
  if (needsBridge(show)) return <section className="xs2 sh"><BridgeInstall act={act} show={show} /></section>;
  return <section className="xs2 sh sh-concert" aria-label={tx("Concert")}>
    <div className="sh-head"><b className="sh-title">{tx(show.concert || "Concert")}</b><div className="xs2-spacer" />
      {recording ? <span className="sh-rec">{tx("● REC ")}{tx(clock(link!.elapsed))}</span> : <button type="button" className={`xs2-btn ${recordShow ? "primary" : ""}`} disabled={running} aria-pressed={recordShow} onClick={() => setRecordShow(!recordShow)}>{tx(recordShow ? "Enregistrement prévu" : "Sans enregistrement")}</button>}
      <Status show={show} link={link} />
      <button type="button" className="xs2-btn" onClick={() => setUnlocked(!unlocked)}>{tx(unlocked ? "Verrouiller" : "Déverrouiller")}</button></div>
    {(error || link?.alert || wanted) && <div className="xs2-msg error" role="alert">{tx(error || link?.alert || "Attention : ce morceau joue sans être enregistré.")}<button type="button" aria-label={tx("Fermer")} onClick={() => { setError(""); if (link?.alert) void act("/api/reaper/dismiss"); }}>{tx("×")}</button></div>}
    {show.rehearsal && <div className="xs2-msg error" role="alert">{tx("Le Main est coupé (Ears seulement) : la façade ne sort pas. Quitte ce mode dans la console Expert.")}</div>}
    {!running && issues.length > 0 && <div className="xs2-msg" role="status">{tx(issues[0])}</div>}
    {!running && checks?.hoursFree !== null && checks && checks.hoursFree < 3 && <div className="xs2-msg error" role="alert">{tx("Il reste environ ")}{tx(checks.hoursFree)}{tx(" h d’espace disque.")}</div>}
    <div className="sh-show">
      <main>
        <div className="xs2-card sh-now"><small>{tx(songs.length ? `En cours · ${index + 1} / ${songs.length}` : "Ouvre ton concert ReaCue dans Reaper")}</small><h1>{song?.title ?? "—"}</h1><h2>{section ? sectionName(section.name) : " "}</h2>
          <strong className="sh-clock">-{tx(clock((song?.stop ?? 0) - cursor))}</strong></div>
        <div className="sh-cmds">
          <button type="button" className="sh-cmd" disabled={!running} onClick={() => press("stop", () => void act("/api/show/stop"))}>{tx(armed === "stop" ? "Confirmer Stop" : "■ Stop")}<small>{tx("2 appuis")}</small></button>
          {running ? <button type="button" className="sh-cmd next" disabled>{tx(next ? `Ensuite : ${next.title}` : "Dernier morceau")}</button>
            : <button type="button" className="sh-cmd next" disabled={!song || link?.state !== "ready" || (recordShow && !armedTracks)} onClick={start}>▶ {tx(recordShow ? "Jouer et enregistrer" : "Jouer")} {song?.title}</button>}
          <button type="button" className="sh-cmd" disabled={running || !next} onClick={() => next && void act("/api/show/goto", { pos: next.start })}>{tx("Morceau suivant")}</button>
          <button type="button" className="sh-cmd danger" onClick={() => press("mute", () => void act("/api/console/mute-all", { confirm: true }))}>{tx(armed === "mute" ? "Confirmer" : "Tout couper")}<small>{tx("2 appuis")}</small></button>
        </div>
      </main>
      <aside className="xs2-card"><h3>{tx("Setlist")}</h3>{songs.map((s, i) => <button key={s.start} type="button" className={`sh-song ${i === index ? "on" : ""}`} disabled={!unlocked || running} onClick={() => void act("/api/show/goto", { pos: s.start })}><b>{s.title}</b><small>{tx(clock(s.stop - s.start))}</small></button>)}
        {!unlocked && <p className="muted">{tx("Setlist verrouillée pendant le concert.")}</p>}</aside>
    </div>
  </section>;
}
