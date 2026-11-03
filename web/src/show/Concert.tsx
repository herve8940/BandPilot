import { useEffect, useRef, useState } from "react";
import { BridgeInstall, Status } from "./Rehearse";
import { call, clock, position, sectionName, songAt, useShow } from "./api";
import "../expert/expert.css";
import "./show.css";

/** Risky actions need two presses within 3 seconds. */
function useTwoPress() {
  const [armed, setArmed] = useState(""), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return { armed, press: (id: string, run: () => void) => { if (armed === id) { setArmed(""); run(); return; } setArmed(id); clearTimeout(timer.current); timer.current = setTimeout(() => setArmed(""), 3000); } };
}
export function Concert() {
  const { show, link, error, setError, act } = useShow();
  const [unlocked, setUnlocked] = useState(false), [recordShow, setRecordShow] = useState(true), [checks, setChecks] = useState<{ warnings: string[]; hoursFree: number | null } | null>(null);
  const { armed, press } = useTwoPress();
  useEffect(() => { void call<{ warnings: string[]; hoursFree: number | null }>("/api/reaper/plan").then(setChecks).catch(e => setError(e.message)); }, []);
  const songs = show.songs ?? [], cursor = position(show, link), index = songAt(songs, cursor), song = songs[index], next = songs[index + 1];
  const recording = !!link?.recording, running = recording || !!show.playing || link?.state === "starting";
  const section = (show.regions ?? []).find(r => cursor >= r.start && cursor < r.stop);
  const start = () => { if (!song) return; if (recordShow) void act("/api/show/rec", { start: cursor > song.start + 1 ? cursor : song.countin, stop: song.stop }); else void act("/api/show/play"); };
  const wanted = recordShow && !recording && running;
  if (!show.alive) return <section className="xs2 sh"><BridgeInstall act={act} /></section>;
  return <section className="xs2 sh sh-concert" aria-label="Concert">
    <div className="sh-head"><b className="sh-title">{show.concert || "Concert"}</b><div className="xs2-spacer" />
      {recording ? <span className="sh-rec">● REC {clock(link!.elapsed)}</span> : <button type="button" className={`xs2-btn ${recordShow ? "primary" : ""}`} disabled={running} aria-pressed={recordShow} onClick={() => setRecordShow(!recordShow)}>{recordShow ? "Enregistrement prévu" : "Sans enregistrement"}</button>}
      <Status show={show} link={link} />
      <button type="button" className="xs2-btn" onClick={() => setUnlocked(!unlocked)}>{unlocked ? "Verrouiller" : "Déverrouiller"}</button></div>
    {(error || link?.alert || wanted) && <div className="xs2-msg error" role="alert">{error || link?.alert || "Attention : ce morceau joue sans être enregistré."}<button type="button" aria-label="Fermer" onClick={() => { setError(""); if (link?.alert) void act("/api/reaper/dismiss"); }}>×</button></div>}
    {!running && checks && checks.warnings.length > 0 && <div className="xs2-msg" role="status">{checks.warnings[0]}</div>}
    {!running && checks?.hoursFree !== null && checks && checks.hoursFree < 3 && <div className="xs2-msg error" role="alert">Il reste environ {checks.hoursFree} h d’espace disque.</div>}
    <div className="sh-show">
      <main>
        <div className="xs2-card sh-now"><small>{songs.length ? `En cours · ${index + 1} / ${songs.length}` : "Ouvre ton concert ReaCue dans Reaper"}</small><h1>{song?.title ?? "—"}</h1><h2>{section ? sectionName(section.name) : " "}</h2>
          <strong className="sh-clock">-{clock((song?.stop ?? 0) - cursor)}</strong></div>
        <div className="sh-cmds">
          <button type="button" className="sh-cmd" disabled={!running} onClick={() => press("stop", () => void act("/api/show/stop"))}>{armed === "stop" ? "Confirmer Stop" : "■ Stop"}<small>2 appuis</small></button>
          {running ? <button type="button" className="sh-cmd next" disabled>{next ? `Ensuite : ${next.title}` : "Dernier morceau"}</button>
            : <button type="button" className="sh-cmd next" disabled={!song || link?.state !== "ready"} onClick={start}>▶ {recordShow ? "Jouer et enregistrer" : "Jouer"} {song?.title}</button>}
          <button type="button" className="sh-cmd" disabled={running || !next} onClick={() => next && void act("/api/show/goto", { pos: next.start })}>Morceau suivant</button>
          <button type="button" className="sh-cmd danger" onClick={() => press("mute", () => void act("/api/console/mute-all", { confirm: true }))}>{armed === "mute" ? "Confirmer" : "Tout couper"}<small>2 appuis</small></button>
        </div>
      </main>
      <aside className="xs2-card"><h3>Setlist</h3>{songs.map((s, i) => <button key={s.start} type="button" className={`sh-song ${i === index ? "on" : ""}`} disabled={!unlocked || running} onClick={() => void act("/api/show/goto", { pos: s.start })}><b>{s.title}</b><small>{clock(s.stop - s.start)}</small></button>)}
        {!unlocked && <p className="muted">Setlist verrouillée pendant le concert.</p>}</aside>
    </div>
  </section>;
}
