import type {EarGroup} from '../../../shared/ear-group';
import {MonitorGroups} from './MonitorGroups';
import {ContrastSwitch,useScreenContrast,MeterDisplaySettings,meterPreferences,nextPeak,useMeterPreferences,type Peak} from '../xair/meter-preferences';
import {useScoreScreen} from './useScoreScreen';
import {SongSheet} from './SongSheet';
import {RehearsalDesk} from '../show/RehearsalDesk';
import '../show/show.css';
import type {PersonalPatchInput} from '../../../shared/tech-rider';
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
  const [share, setShare] = useState<{ name: string; bus: number; stereo?:boolean } | null>(null);
  const [patch,setPatch]=useState<PersonalPatchInput[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [values, setValues] = useState<Values>({});
  const [groups,setGroups]=useState<EarGroup[]>([]);
  const [cap, setCap] = useState(.75);
  const [control, setControl] = useState(false);
  const [manager,setManager]=useState(false);
  const [meters, setMeters] = useState<{ levels: number[]; bus: number; busRight?:number; peaks?:Array<Peak|undefined>; reset?:number; at: number }>({ levels: [], bus: -128, at: 0 });
  const [toast, setToast] = useState("");
  const ws = useRef<WebSocket | null>(null);
  const touched = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, object>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let stop = false, retry: ReturnType<typeof setTimeout> | undefined, delay = 800;
    const resetEdits = () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
      pending.current.clear();
      touched.current.clear();
    };
    const connect = () => {
      if (stop || ws.current) return;
      clearTimeout(retry);
      setConn("connecting");
      const socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ears-ws?token=${encodeURIComponent(token)}`);
      ws.current = socket;
      socket.onclose = e => {
        if (stop || ws.current !== socket) return;
        ws.current = null;
        resetEdits();
        setMeters({levels:[], bus:-128, at:0});
        setControl(false);
        if (e.code === 4001) { stop = true; setConn("revoked"); return; }
        setConn("offline");
        retry = setTimeout(connect, delay); delay = Math.min(delay * 1.6, 8000);
      };
      socket.onmessage = ev => {
        if (stop || ws.current !== socket) return;
        const m = JSON.parse(ev.data);
        if (m.type === "snapshot") {
          if (!m.control) resetEdits();
          setGroups(m.groups??[]);setMeters({levels:[],bus:-128,at:0});
          setShare(m.share); setSources(m.sources); setValues(m.values); setCap(m.cap); setControl(m.control); setPatch(m.patch??[]); setManager(m.rehearsal===true);
          setConn("online"); delay = 800;
        }
        else if (m.type==="groups") {
          setGroups(m.groups);
          if(m.levels)setValues(previous=>({...previous,...m.levels}));
        }
        else if (m.type==="rehearsal-role") setManager(m.enabled===true);
        else if (m.type === "technical-card") setPatch(m.patch??[]);
        else if (m.type === "parameter") {
          if (Date.now() - (touched.current.get(m.address) ?? 0) < 400) return;
          setValues(v => ({ ...v, [m.address]: m.value }));
        } else if (m.type === "adjusted") setValues(v => ({ ...v, [m.address]: m.value }));
        else if (m.type === "meters") {
          const at=Date.now(),prefs=meterPreferences.get();
          setMeters(previous=>{
            const old=previous.reset===prefs.reset&&at-previous.at<2000?previous.peaks:undefined;
            const readings=[...m.levels,m.bus,m.busRight];
            const peaks=readings.map((db,index)=>Number.isFinite(db)?nextPeak(old?.[index],db,at,prefs.holdMs,prefs.decay):undefined);
            return {levels:m.levels,bus:m.bus,busRight:m.busRight,at,peaks,reset:prefs.reset};
          });
        }
        else if (m.type === "error") { setToast(m.error); touched.current.delete(m.address); }
      };
    };
    // Reconnect quickly when the phone comes back from sleep.
    const wake = () => { if (document.visibilityState === "visible") connect(); };
    document.addEventListener("visibilitychange", wake);
    connect();
    return () => {
      stop = true; clearTimeout(retry); resetEdits();
      document.removeEventListener("visibilitychange", wake);
      ws.current?.close(); ws.current = null;
    };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); }, [toast]);

  const enqueue = useCallback((address:string,message:object) => {
    const socket = ws.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    pending.current.set(address,message);
    if (timers.current.has(address)) return;
    const flush = () => {
      const next = pending.current.get(address);
      if (next === undefined) { timers.current.delete(address); return; }
      pending.current.delete(address);
      if (ws.current === socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(next));
      timers.current.set(address, setTimeout(flush, 50));
    };
    flush();
  }, []);
  function set(address:string,value:number){
    touched.current.set(address,Date.now());
    setValues(v=>({...v,[address]:value}));
    enqueue(address,{type:'set',address,value});
  }
  function moveGroup(group:EarGroup,value:number){
    enqueue(group.id,{type:'group-volume',id:group.id,revision:group.revision,value});
  }
  return { conn, share, manager, patch, sources, values, cap, control, meters, toast, setToast, set, groups, moveGroup };
}

/** Big horizontal slider: full width = safety ceiling (0 dB). */
function Slider({ value, cap, onChange, disabled, label, color }: { value: number; cap: number; onChange: (v: number) => void; disabled: boolean; label: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; v: number } | null>(null);
  const pos = Math.max(0, Math.min(1, value / cap));
  const fromX = (e: ReactPointerEvent) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * cap; };
  return <div ref={ref} className={disabled ? "ea-slider disabled" : "ea-slider"} role="slider" aria-disabled={disabled} aria-label={tx(label)} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={value} aria-valuetext={tx(`${formatDb(faderToDb(value))} dB`)} tabIndex={disabled ? -1 : 0}
    style={{ "--c": color } as React.CSSProperties}
    onKeyDown={e => {
      if (disabled) return;
      const steps: Record<string, number> = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1};
      if (!Object.hasOwn(steps, e.key)) return;
      e.preventDefault();
      onChange(Math.max(0, Math.min(cap, value + steps[e.key]! * .01)));
    }}
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
function MeterBar({ db,peak }: { db: number; peak?:number }) {
  const pos = Math.max(0, Math.min(1, (db + 60) / 60));
  const marker=peak!==undefined&&peak>-60?Math.min(100,(peak+60)/60*100):0;
  return <div className="ea-meter-readout"><div className="ea-meter"><i style={{ width: `${pos * 100}%` }} className={db > -6 ? "hot" : db > -18 ? "warm" : ""} />{marker>0&&<span className="ea-peak" style={{left:marker+'%'}} title={peak!.toFixed(1)+' dBFS'}/>}</div>{marker>0&&<small>{tx('Crête')} {peak!.toFixed(1)} dBFS</small>}</div>;
}

export function EarsApp() {
  useScreenContrast();
  useLanguage();
  const { conn, share, manager, patch, sources, values, cap, control, meters, toast, setToast, set, groups, moveGroup } = useEars();
  const peakPrefs=useMeterPreferences();
  const [checkedSource,setCheckedSource]=useState("");
  const [view,setView]=useState<'monitor'|'rehearse'|'sheet'>('monitor');
  useEffect(()=>{if(!manager)setView(v=>v==='rehearse'?'monitor':v);},[manager]);
  const screen=useScoreScreen();
  useEffect(()=>{if(view!=='sheet'||conn==='revoked')screen.leave();},[view,conn,screen.leave]);
  const rehearsing=manager&&view==='rehearse';

  const [meterClock,setMeterClock]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setMeterClock(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  const [showAll, setShowAll] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState(false);
  const bus = share?.bus ?? 1;
  const num = (a: string, fallback = 0) => typeof values[a] === "number" ? values[a] as number : fallback;
  const str = (a: string) => typeof values[a] === "string" ? (values[a] as string).trim() : "";
  const freshMeters = conn === "online" && Math.max(meterClock,meters.at) - meters.at < 2000;
  const peakAt=(i:number)=>freshMeters&&peakPrefs.holdMs!==0&&meters.reset===peakPrefs.reset?meters.peaks?.[i]?.value:undefined;
  const canMove = control && conn === "online";

  const loadProfiles = useCallback(async () => { try { const r = await fetch(`/ears-api/${token}/profiles`); if (r.ok) setProfiles(await r.json()); } catch { /* offline: keep list */ } }, []);
  useEffect(() => { if (conn === "online") void loadProfiles(); }, [conn, loadProfiles]);
  const call = async (path: string, method: string, body?: unknown) => {
    setBusy(true);
    try { const r = await fetch(`/ears-api/${token}/profiles${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const d = await r.json(); if (!r.ok) throw Error(d.error); await loadProfiles(); return d; }
    catch (e) { setToast((e as Error).message); return null; } finally { setBusy(false); }
  };

  const allSources = useMemo(() => sources.map(s => ({
    ...s,name:str(`${s.prefix}/config/name`),level:`${s.prefix}/mix/${pad(bus)}/level`
  })), [sources,values,bus]);
  const list=allSources.filter(s=>showAll||s.name||num(s.level)>.01);

  if (conn === "revoked") return <main className="ea ea-center"><div className="ea-card"><LanguageSelect/><h1>{tx("Lien expiré")}</h1><p>{tx("Ce QR code a été remplacé. Demande le nouveau à la personne qui gère la console.")}</p></div></main>;
  if (!share) return <main className="ea ea-center"><LanguageSelect/><div className="ea-loader" /><p>{tx(conn === "offline" ? "Connexion à la console…" : "Chargement de ton retour…")}</p></main>;

  function renderSource(s:typeof allSources[number]) {
        const color = stripColor(num(`${s.prefix}/config/color`)), level = num(s.level), muted = num(`${s.prefix}/mix/on`, 1) === 0;
        const db = freshMeters ? Math.max(...s.meters.map(i => meters.levels[i] ?? -128)) : -128;
        return <article key={s.prefix} className="ea-row" style={{ "--c": color } as React.CSSProperties}>
          <div className="ea-row-top"><span className="ea-dot" /><b>{s.name || s.label}</b>{muted && <em>{tx("coupé en façade")}</em>}<span className="ea-db">{tx(formatDb(faderToDb(level)))}<small>{tx(" dB")}</small></span></div>
          <Slider label={tx(`Niveau de ${s.name || s.label} dans mon retour`)} value={level} cap={cap} color={color} disabled={!canMove} onChange={v => set(s.level, v)} />
          {share?.stereo&&<label>{tx('Panorama')}<input aria-label={tx('Panorama')+' '+(s.name||s.label)} type="range" min="0" max="1" step=".01" value={num(`${s.prefix}/mix/${pad(bus)}/pan`,.5)} disabled={!canMove} onChange={e=>set(`${s.prefix}/mix/${pad(bus)}/pan`,Number(e.target.value))}/><span>{Math.round((num(`${s.prefix}/mix/${pad(bus)}/pan`,.5)-.5)*200)}</span></label>}
          <MeterBar db={db} peak={Math.max(...s.meters.map(i=>peakAt(i)??-128))} />
        </article>;
  }

  const busName = str(`/bus/${bus}/config/name`) || `Bus ${bus}`;
  const masterAddr = `/bus/${bus}/mix/fader`, onAddr = `/bus/${bus}/mix/on`, on = num(onAddr, 1) === 1;
  const master = num(masterAddr);
  return <main className={rehearsing?"ea ea-rehearsing":"ea"}>
    {!rehearsing&&<LanguageSelect/>}
    <header className="ea-head">
      <div><p className="ea-eyebrow">{rehearsing?tx("Gestionnaire de la répétition"):<>{tx("Mon retour · ")}{busName}{share.stereo?` · ${tx('Stéréo')} ${bus}–${bus+1}`:''}</>}</p><h1>{share.name}</h1></div>
      <span className={`ea-conn ${conn}`}>{tx(conn === "online" ? "En direct" : "Reconnexion…")}</span>
    </header>
    <nav className="sh-seg ea-page-switch" aria-label={tx('Navigation du musicien')}>
      <button type="button" className={view==='monitor'?'on':''} aria-pressed={view==='monitor'} onClick={()=>setView('monitor')}>{tx('Mon retour')}</button>
      <button type="button" className={view==='sheet'?'on':''} aria-pressed={view==='sheet'} onClick={()=>{void screen.acquire();setView('sheet');}}>{tx('Mon morceau')}</button>
      {manager&&<button type="button" className={rehearsing?'on':''} aria-pressed={rehearsing} onClick={()=>setView('rehearse')}>{tx('Répéter')}</button>}
    </nav>
    <SongSheet token={token} manager={manager} visible={view==='sheet'} awake={screen.awake} keepAwake={screen.acquire}/>
    <div className="ea-monitor-page" hidden={view!=='monitor'}>
    {!control && <p className="ea-banner">{tx("Lecture seule : le contrôle n’est pas activé sur l’ordinateur de la console.")}</p>}

    <MonitorGroups token={token} groups={groups} sources={allSources.map(s=>({prefix:s.prefix,name:s.name||tx(s.label)}))}
      online={conn==='online'} canMove={canMove} move={moveGroup} notify={setToast}
      renderSource={prefix=>{const source=allSources.find(s=>s.prefix===prefix);return source?renderSource(source):null;}}/>

    {!!patch.length&&<details className="ea-profiles">
      <summary>{tx("Ma fiche de branchement")}</summary>
      <ul>{patch.map(input=><li key={input.channel}><b>{tx("Entrée ")}{input.channel} · {input.name}</b>
        <span>{input.connection?tx(({micro:"Micro",di:"DI",line:"Ligne"})[input.connection]):""}{input.phantom?" · 48 V":""}{input.stereoWith?` · ${tx("Paire stéréo")} ${input.channel}–${input.stereoWith}`:""}</span></li>)}</ul>
    </details>}



    <details className="ea-profiles">
      <summary>{tx("Vérifier mon retour")}</summary>
      <p>{share.name} · {tx("Bus")} {bus}{busName!==`Bus ${bus}`?` · ${busName}`:""}</p>
      <p>{tx(!on ? "Ton retour est coupé." : master <= .001 ? "Le volume de ton retour est au minimum." : "Ton retour est ouvert.")}</p>
      <label>{tx("Source à vérifier")} <select value={checkedSource} onChange={e=>setCheckedSource(e.target.value)}>
        <option value="">{tx("Choisir une source")}</option>
        {sources.map(s=><option value={s.prefix} key={s.prefix}>{str(s.prefix+"/config/name")||s.label}</option>)}
      </select></label>
      {sources.filter(s=>s.prefix===checkedSource).map(s=>{
        const db=Math.max(...s.meters.map(i=>meters.levels[i]??-128));
        const address=s.prefix+"/mix/"+pad(bus)+"/level";
        return <div key={s.prefix} role="status">
          <p>{tx(!freshMeters||!s.meters.some(i=>Number.isFinite(meters.levels[i])) ? "Mesure de la source indisponible." : db > -60 ? "Signal détecté sur cette source." : "Aucun signal net sur cette source. Joue ou chante pour vérifier.")}</p>
          {typeof values[address]==="number"&&num(address)<=.001&&<p>{tx("L’envoi de cette source vers ton retour est au minimum.")}</p>}
        </div>;
      })}
      {profiles.length>0&&(()=>{const latest=[...profiles].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]!;
        return <button type="button" disabled={!canMove||busy} onClick={()=>{
          if(confirm(tx(`Rappeler « ${latest.name} » dans ton retour ?`)))void call(`/${latest.id}/recall`,"POST").then(d=>{if(d)setToast(`« ${latest.name} » rappelé`);});
        }}>{tx("Rappeler mon dernier mix")} · {latest.name}</button>;
      })()}
    </details>

    <section className="ea-list">
      <div className="ea-list-head"><h2>{tx("Ce que j’entends")}</h2><label><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />{tx(" Afficher les autres entrées")}</label></div>
      {list.map(renderSource)}
      {!list.length && <p className="ea-empty">{tx("Aucune source envoyée dans ton retour. Coche « Afficher les autres entrées » pour en ajouter.")}</p>}
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

    <MeterDisplaySettings/>
    <footer className="ea-foot">{tx("Sécurité auditive : le niveau est plafonné à 0 dB et monte progressivement. Commence bas, puis monte ce qui te manque.")}</footer>
    <section className={on ? "ea-master" : "ea-master muted"}>
      <div className="ea-master-top">
        <div><b>{tx("Volume de mon retour")}</b><span>{tx(on ? `${formatDb(faderToDb(master))} dB` : "Coupé")}</span></div>
        <button type="button" className={on ? "ea-mute" : "ea-mute on"} disabled={!canMove} onClick={() => set(onAddr, on ? 0 : 1)} aria-pressed={!on}>{tx(on ? "Couper" : "Rétablir")}</button>
      </div>
      <Slider label={tx("Volume de mon retour")} value={master} cap={cap} color="#3ee0e0" disabled={!canMove} onChange={v => set(masterAddr, v)} />
      <MeterBar db={freshMeters ? meters.bus : -128} peak={peakAt(meters.levels.length)}/>{share.stereo&&<MeterBar db={freshMeters ? meters.busRight??-128 : -128} peak={peakAt(meters.levels.length+1)}/>}
    </section>
    </div>
    {manager&&<div hidden={!rehearsing}><RehearsalDesk token={token} visible={rehearsing}/></div>}
    <ContrastSwitch/>{rehearsing&&<LanguageSelect/>}
    {toast && <div className="ea-toast" role="status">{tx(toast)}</div>}
  </main>;
}
