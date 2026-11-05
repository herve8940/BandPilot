import {LanguageSelect} from "../LanguageSettings";
import {tx, getLocale, useLanguage} from "../i18n";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { faderToDb, formatDb, stripColor } from "../xairMath";

type Values = Record<string, unknown>;
interface Source { prefix: string; label: string; meters: number[] }
interface Profile { id: string; name: string; updatedAt: string }
type Conn = "connecting" | "online" | "offline" | "revoked";

const pad = (n: number) => String(n).padStart(2, "0");
const token = location.pathname.split("/").filter(Boolean)[1] ?? "";

function useEars() {
  const [conn, setConn] = useState<Conn>("connecting");
  const [share, setShare] = useState<{ name: string; bus: number } | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [values, setValues] = useState<Values>({});
  const [cap, setCap] = useState(.75);
  const [control, setControl] = useState(true);
  const [meters, setMeters] = useState<{ levels: number[]; bus: number; at: number }>({ levels: [], bus: -128, at: 0 });
  const [toast, setToast] = useState("");
  const ws = useRef<WebSocket | null>(null);
  const touched = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let stop = false, retry: ReturnType<typeof setTimeout> | undefined, delay = 800;
    const connect = () => {
      setConn(c => c === "revoked" ? c : "connecting");
      const socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ears-ws?token=${encodeURIComponent(token)}`);
      ws.current = socket;
      socket.onopen = () => { setConn("online"); delay = 800; };
      socket.onclose = e => {
        if (e.code === 4001) { setConn("revoked"); return; }
        setConn("offline");
        if (!stop) { retry = setTimeout(connect, delay); delay = Math.min(delay * 1.6, 8000); }
      };
      socket.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.type === "snapshot") { setShare(m.share); setSources(m.sources); setValues(m.values); setCap(m.cap); setControl(m.control); }
        else if (m.type === "parameter") {
          if (Date.now() - (touched.current.get(m.address) ?? 0) < 400) return;
          setValues(v => ({ ...v, [m.address]: m.value }));
        } else if (m.type === "adjusted") setValues(v => ({ ...v, [m.address]: m.value }));
        else if (m.type === "meters") setMeters({ levels: m.levels, bus: m.bus, at: Date.now() });
        else if (m.type === "error") { setToast(m.error); touched.current.delete(m.address); }
      };
    };
    // Reconnect quickly when the phone comes back from sleep.
    const wake = () => { if (document.visibilityState === "visible" && ws.current?.readyState !== WebSocket.OPEN && !stop) { clearTimeout(retry); connect(); } };
    document.addEventListener("visibilitychange", wake);
    connect();
    return () => { stop = true; clearTimeout(retry); document.removeEventListener("visibilitychange", wake); ws.current?.close(); };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); }, [toast]);

  const set = useCallback((address: string, value: number) => {
    touched.current.set(address, Date.now());
    setValues(v => ({ ...v, [address]: value }));
    pending.current.set(address, value);
    if (timers.current.has(address)) return;
    const flush = () => {
      const next = pending.current.get(address);
      if (next === undefined) { timers.current.delete(address); return; }
      pending.current.delete(address);
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: "set", address, value: next }));
      timers.current.set(address, setTimeout(flush, 50));
    };
    flush();
  }, []);
  return { conn, share, sources, values, cap, control, meters, toast, setToast, set };
}

/** Big horizontal slider: full width = safety ceiling (0 dB). */
function Slider({ value, cap, onChange, disabled, label, color }: { value: number; cap: number; onChange: (v: number) => void; disabled: boolean; label: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; v: number } | null>(null);
  const pos = Math.max(0, Math.min(1, value / cap));
  const fromX = (e: ReactPointerEvent) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * cap; };
  return <div ref={ref} className={disabled ? "ea-slider disabled" : "ea-slider"} role="slider" aria-label={tx(label)} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={value} aria-valuetext={tx(`${formatDb(faderToDb(value))} dB`)} tabIndex={disabled ? -1 : 0}
    style={{ "--c": color } as React.CSSProperties}
    onKeyDown={e => { if (disabled) return; if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(cap, value + .01)); if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, value - .01)); }}
    onPointerDown={e => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, v: value }; }}
    onPointerMove={e => {
      if (!drag.current || disabled) return;
      // Relative drag: putting a finger down never jumps the level, only sliding does.
      const r = ref.current!.getBoundingClientRect();
      onChange(Math.max(0, Math.min(cap, drag.current.v + (e.clientX - drag.current.x) / r.width * cap)));
    }}
    onPointerUp={e => { if (drag.current && Math.abs(e.clientX - drag.current.x) < 4 && !disabled) onChange(Math.min(fromX(e), value + .15)); drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }}>
    <div className="ea-slider-fill" style={{ width: `${pos * 100}%` }} />
    <div className="ea-slider-thumb" style={{ left: `${pos * 100}%` }} />
  </div>;
}
function MeterBar({ db }: { db: number }) {
  const pos = Math.max(0, Math.min(1, (db + 60) / 60));
  return <div className="ea-meter"><i style={{ width: `${pos * 100}%` }} className={db > -6 ? "hot" : db > -18 ? "warm" : ""} /></div>;
}

export function EarsApp() {
  useLanguage();
  const { conn, share, sources, values, cap, control, meters, toast, setToast, set } = useEars();
  const [showAll, setShowAll] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState(false);
  const bus = share?.bus ?? 1;
  const num = (a: string, fallback = 0) => typeof values[a] === "number" ? values[a] as number : fallback;
  const str = (a: string) => typeof values[a] === "string" ? (values[a] as string).trim() : "";
  const freshMeters = Date.now() - meters.at < 2000;
  const canMove = control && conn === "online";

  const loadProfiles = useCallback(async () => { try { const r = await fetch(`/ears-api/${token}/profiles`); if (r.ok) setProfiles(await r.json()); } catch { /* offline: keep list */ } }, []);
  useEffect(() => { if (conn === "online") void loadProfiles(); }, [conn, loadProfiles]);
  const call = async (path: string, method: string, body?: unknown) => {
    setBusy(true);
    try { const r = await fetch(`/ears-api/${token}/profiles${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const d = await r.json(); if (!r.ok) throw Error(d.error); await loadProfiles(); return d; }
    catch (e) { setToast((e as Error).message); return null; } finally { setBusy(false); }
  };

  const list = useMemo(() => sources.map(s => ({ ...s, name: str(`${s.prefix}/config/name`), level: `${s.prefix}/mix/${pad(bus)}/level` }))
    .filter(s => showAll || s.name || num(s.level) > .01), [sources, values, showAll, bus]);

  if (conn === "revoked") return <main className="ea ea-center"><div className="ea-card"><LanguageSelect/><h1>{tx("Lien expiré")}</h1><p>{tx("Ce QR code a été remplacé. Demande le nouveau à la personne qui gère la console.")}</p></div></main>;
  if (!share) return <main className="ea ea-center"><LanguageSelect/><div className="ea-loader" /><p>{tx(conn === "offline" ? "Connexion à la console…" : "Chargement de ton retour…")}</p></main>;

  const busName = str(`/bus/${bus}/config/name`) || `Bus ${bus}`;
  const masterAddr = `/bus/${bus}/mix/fader`, onAddr = `/bus/${bus}/mix/on`, on = num(onAddr, 1) === 1;
  const master = num(masterAddr);
  return <main className="ea">
    <LanguageSelect/>
    <header className="ea-head">
      <div><p className="ea-eyebrow">{tx("Mon retour · ")}{busName}</p><h1>{share.name}</h1></div>
      <span className={`ea-conn ${conn}`}>{tx(conn === "online" ? "En direct" : "Reconnexion…")}</span>
    </header>
    {!control && <p className="ea-banner">{tx("Lecture seule : le contrôle n’est pas activé sur l’ordinateur de la console.")}</p>}

    <section className={on ? "ea-master" : "ea-master muted"}>
      <div className="ea-master-top">
        <div><b>{tx("Volume de mon retour")}</b><span>{tx(on ? `${formatDb(faderToDb(master))} dB` : "Coupé")}</span></div>
        <button type="button" className={on ? "ea-mute" : "ea-mute on"} disabled={!canMove} onClick={() => set(onAddr, on ? 0 : 1)} aria-pressed={!on}>{tx(on ? "Couper" : "Rétablir")}</button>
      </div>
      <Slider label={tx("Volume de mon retour")} value={master} cap={cap} color="#3ee0e0" disabled={!canMove} onChange={v => set(masterAddr, v)} />
      <MeterBar db={freshMeters ? meters.bus : -128} />
    </section>

    <section className="ea-list">
      <div className="ea-list-head"><h2>{tx("Ce que j’entends")}</h2><label><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />{tx(" Tout afficher")}</label></div>
      {list.map(s => {
        const color = stripColor(num(`${s.prefix}/config/color`)), level = num(s.level), muted = num(`${s.prefix}/mix/on`, 1) === 0;
        const db = freshMeters ? Math.max(...s.meters.map(i => meters.levels[i] ?? -128)) : -128;
        return <article key={s.prefix} className="ea-row" style={{ "--c": color } as React.CSSProperties}>
          <div className="ea-row-top"><span className="ea-dot" /><b>{s.name || s.label}</b>{muted && <em>{tx("coupé en façade")}</em>}<span className="ea-db">{tx(formatDb(faderToDb(level)))}<small>{tx(" dB")}</small></span></div>
          <Slider label={tx(`Niveau de ${s.name || s.label} dans mon retour`)} value={level} cap={cap} color={color} disabled={!canMove} onChange={v => set(s.level, v)} />
          <MeterBar db={db} />
        </article>;
      })}
      {!list.length && <p className="ea-empty">{tx("Aucune source envoyée dans ton retour. Coche « Tout afficher » pour en ajouter.")}</p>}
    </section>

    <section className="ea-profiles">
      <h2>{tx("Mes réglages enregistrés")}</h2>
      <form onSubmit={e => { e.preventDefault(); if (profileName.trim()) void call("", "POST", { name: profileName.trim() }).then(d => { if (d) { setProfileName(""); setToast("Réglage enregistré"); } }); }}>
        <input value={profileName} maxLength={40} onChange={e => setProfileName(e.target.value)} placeholder={tx("Nom (ex. Concert, Répète)")} aria-label={tx("Nom du réglage")} />
        <button type="submit" disabled={busy || !profileName.trim()}>{tx("Enregistrer")}</button>
      </form>
      <ul>{profiles.map(p => <li key={p.id}>
        <span><b>{p.name}</b><small>{tx(new Date(p.updatedAt).toLocaleString(getLocale(), { dateStyle: "short", timeStyle: "short" }))}</small></span>
        <button type="button" disabled={busy || !canMove} onClick={() => void call(`/${p.id}/recall`, "POST").then(d => { if (d) setToast(`« ${p.name} » rappelé`); })}>{tx("Rappeler")}</button>
        <button type="button" className="ghost" disabled={busy} aria-label={tx(`Supprimer ${p.name}`)} onClick={() => { if (confirm(tx(`Supprimer « ${p.name} » ?`))) void call(`/${p.id}`, "DELETE"); }}>{tx("×")}</button>
      </li>)}</ul>
      {!profiles.length && <p className="ea-empty">{tx("Enregistre ton mix pour le retrouver au prochain concert.")}</p>}
    </section>

    <footer className="ea-foot">{tx("Sécurité auditive : le niveau est plafonné à 0 dB et monte progressivement. Commence bas, puis monte ce qui te manque.")}</footer>
    {toast && <div className="ea-toast" role="status">{tx(toast)}</div>}
  </main>;
}
