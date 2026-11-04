import {useMixerModel} from '../MixerModel';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  clamp01, dbToFader, EQ_TYPES, faderToDb, formatDb, formatHz, formatMs, lin, linInv, logInv, logMap, qFromWire, qToWire, RATIOS, stripColor,
} from "../xairMath";
import { FX_INFO } from "../xairHelp";
import { FxConsole } from "../FxConsole";
import {
  compCurve, eqResponse, Fader, gateCurve, Knob, Meter, num, pad, Radio, readEq, Select, Toggle, transferPoints, VBar,
  type SetFn, type Value, type Values,
} from "./controls";
import { BUSES, FXSENDS, gainControl, INPUTS, isInput, layerMaster, stripName, type Strip } from "./strips";

export type Tab = "mixer" | "channel" | "input" | "gate" | "eq" | "comp" | "sends" | "main" | "fx" | "routing" | "meter";
export interface ViewProps {
  strip: Strip; values: Values; set: SetFn; canWrite: boolean;
  confirmed: (values: Record<string, Value>, question: string) => Promise<boolean>;
  open: (strip: Strip, tab: Tab) => void;
}

// ---------- shared small pieces ----------
const BUS_TINT = ["#ec4899", "#ec4899", "#22d3ee", "#22d3ee", "#f8fafc", "#64748b"];
export const tapNames = ["Input", "Pre EQ", "Post EQ", "Pre Fader", "Post Fader", "Sub Group"];
const scaleDb = (lo: number, hi: number, marks: number[]) => marks.map(m => [linInv(m, lo, hi), String(m)] as [number, string]);
const freqScale = (lo: number, hi: number, marks: number[]) => marks.map(m => [logInv(m, lo, hi), formatHz(m)] as [number, string]);
const timeScale = (lo: number, hi: number, marks: number[]) => marks.map(m => [logInv(m, lo, hi), String(m)] as [number, string]);

function Block({ title, children, onTitle, className = "" }: { title: string; children: ReactNode; onTitle?: () => void; className?: string }) {
  return <section className={`xm-block ${className}`}>
    {onTitle ? <button type="button" className="xm-block-title link" onClick={onTitle} title="Ouvrir le réglage détaillé">{title} ›</button> : <h4 className="xm-block-title">{title}</h4>}
    {children}
  </section>;
}
export function NotAvailable({ children }: { children: ReactNode }) { return <p className="xm-na">{children}</p>; }

function Thumb({ points, fill, active, onClick, label, zero }: { points: string; fill?: string; active: boolean; onClick?: () => void; label: string; zero?: number }) {
  return <button type="button" className={active ? "xm-thumb on" : "xm-thumb"} onClick={onClick} aria-label={label} title={label}>
    <svg viewBox="0 0 60 40" preserveAspectRatio="none">
      {zero !== undefined && <line x1="0" x2="60" y1={zero} y2={zero} className="xm-thumb-zero" />}
      {fill && <polygon points={fill} className="xm-thumb-fill" />}
      <polyline points={points} />
    </svg>
  </button>;
}
function eqThumb(values: Values, strip: Strip, w = 60, h = 40) {
  const bands = readEq(values, strip.prefix, strip.kind === "bus" || strip.kind === "lr" ? 6 : 4);
  const eqOn = num(values, `${strip.prefix}/eq/on`, 1) === 1;
  const hpf = strip.kind === "ch" && num(values, `${strip.prefix}/preamp/hpon`) === 1 ? logMap(num(values, `${strip.prefix}/preamp/hpf`), 20, 400) : undefined;
  const pts = Array.from({ length: 41 }, (_, i) => { const f = logMap(i / 40, 20, 20000); const db = Math.max(-18, Math.min(18, eqResponse(bands, f, eqOn, hpf))); return `${(i / 40 * w).toFixed(1)},${(h / 2 - db / 18 * h / 2).toFixed(1)}`; }).join(" ");
  return { points: pts, fill: `0,${h / 2} ${pts} ${w},${h / 2}`, active: eqOn };
}
function gateThumb(values: Values, prefix: string) {
  const f = gateCurve(lin(num(values, `${prefix}/gate/thr`), -80, 0), lin(num(values, `${prefix}/gate/range`, 1), 3, 60), num(values, `${prefix}/gate/mode`));
  return { points: transferPoints(f, 60, 40), active: num(values, `${prefix}/gate/on`) === 1 };
}
function compThumb(values: Values, prefix: string) {
  const f = compCurve(lin(num(values, `${prefix}/dyn/thr`, 1), -60, 0), num(values, `${prefix}/dyn/ratio`, 6), lin(num(values, `${prefix}/dyn/knee`), 0, 5), lin(num(values, `${prefix}/dyn/mgain`), 0, 24), num(values, `${prefix}/dyn/mode`) === 1);
  return { points: transferPoints(f, 60, 40, -60, 0), active: num(values, `${prefix}/dyn/on`) === 1 };
}

/** Horizontal send bar (drag to set), coloured like X-AIR Edit's Aux Bus Sends. */
function HBar({ value, onChange, color, label, disabled, display }: { value: number; onChange: (v: number) => void; color: string; label: string; disabled?: boolean; display?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const at = (e: ReactPointerEvent) => { const r = ref.current!.getBoundingClientRect(); onChange(clamp01((e.clientX - r.left) / r.width)); };
  return <div className={disabled ? "xm-hbar disabled" : "xm-hbar"} title={`${label} : ${display ?? formatDb(faderToDb(value)) + " dB"}`}>
    <span className="xm-hbar-label" style={{ borderColor: color }}>{label}</span>
    <div ref={ref} className="xm-hbar-track" role="slider" aria-label={label} aria-valuetext={display ?? `${formatDb(faderToDb(value))} dB`} tabIndex={disabled ? -1 : 0}
      onKeyDown={e => { if (disabled) return; if (e.key === "ArrowRight") onChange(clamp01(value + .01)); if (e.key === "ArrowLeft") onChange(clamp01(value - .01)); }}
      onPointerDown={e => { if (disabled) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); at(e); }}
      onPointerMove={e => { if (dragging.current) at(e); }} onPointerUp={() => { dragging.current = false; }}
      onDoubleClick={() => { if (!disabled) onChange(.75); }}>
      <div className="xm-hbar-fill" style={{ width: `${value * 100}%`, background: color }} />
      <div className="xm-hbar-zero" style={{ left: `${dbToFader(0) * 100}%` }} />
    </div>
    <b>{display ?? formatDb(faderToDb(value))}</b>
  </div>;
}

// ---------- MIXER overview ----------
export function MixerView({ values, open, strips }: ViewProps & { strips: Strip[] }) {
  const model = useMixerModel();
  return <div className="xm-overview">{strips.map(strip => {
    const input = isInput(strip), p = strip.prefix;
    const gain = gainControl(strip, values, model.micPreamps);
    const gainDb = gain ? lin(num(values, gain.address, linInv(0, gain.lo, gain.hi)), gain.lo, gain.hi) : null;
    const phantom = gain?.headamp ? num(values, `${gain.headamp}/phantom`) === 1 : false;
    const pan = num(values, `${p}/mix/pan`, .5);
    const eq = strip.kind === "fxsend" || strip.kind === "dca" ? null : eqThumb(values, strip);
    const gate = strip.kind === "ch" ? gateThumb(values, p) : null;
    const comp = strip.kind === "ch" || strip.kind === "bus" || strip.kind === "lr" ? compThumb(values, p) : null;
    return <div key={strip.id} className="xm-ov-col">
      <button type="button" className="xm-ov-gain" onClick={() => open(strip, "input")} title="Gain d’entrée">
        <span>{gainDb === null ? "" : `${gainDb >= 0 ? "+" : ""}${gainDb.toFixed(1)}`}</span>
        {gainDb !== null && gain && <i style={{ width: `${linInv(gainDb, gain.lo, gain.hi) * 100}%` }} />}
      </button>
      <div className="xm-ov-flags">{strip.kind === "ch" && <>
        <span className={num(values, `${p}/preamp/invert`) === 1 ? "on" : ""} title="Polarité inversée">Ø</span>
        <span className={phantom ? "on red" : ""} title="Alimentation 48 V">48</span>
        <span className={num(values, `/config/chlink/${Math.floor((Number(strip.short) - 1) / 2) * 2 + 1}-${Math.floor((Number(strip.short) - 1) / 2) * 2 + 2}`) === 1 ? "on" : ""} title="Couplage stéréo">∞</span>
      </>}</div>
      <button type="button" className="xm-ov-sends" onClick={() => open(strip, "sends")} title="Envois vers les retours et les effets">
        {input ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <i key={n} style={{ width: `${num(values, `${p}/mix/${pad(n)}/level`) * 100}%`, background: n <= 6 ? BUS_TINT[n - 1] : "#2563eb" }} />) : null}
      </button>
      {gate ? <Thumb label="Gate" points={gate.points} active={gate.active} onClick={() => open(strip, "gate")} /> : <div className="xm-thumb empty" />}
      {eq ? <Thumb label="Égaliseur" points={eq.points} fill={eq.fill} zero={20} active={eq.active} onClick={() => open(strip, "eq")} /> : <div className="xm-thumb empty" />}
      {comp ? <Thumb label="Compresseur" points={comp.points} active={comp.active} onClick={() => open(strip, "comp")} /> : <div className="xm-thumb empty" />}
      <button type="button" className="xm-ov-pan" onClick={() => open(strip, "main")} title="Panoramique">
        {strip.kind !== "fxsend" && strip.kind !== "dca" && <i style={{ left: `${pan * 100}%` }} />}
      </button>
    </div>;
  })}</div>;
}

// ---------- CHANNEL summary ----------
export function ChannelView(props: ViewProps) {
  const model = useMixerModel();
  const { strip, values, set, canWrite, open } = props, p = strip.prefix;
  if (!isInput(strip)) return <NotAvailable>La vue Canal concerne les entrées. Pour un bus ou la façade, utilise EQ, Comp ou Main.</NotAvailable>;
  const gain = gainControl(strip, values, model.micPreamps);
  const gate = strip.kind === "ch" ? gateThumb(values, p) : null, eq = eqThumb(values, strip), comp = strip.kind === "ch" ? compThumb(values, p) : null;
  return <div className="xm-row-blocks">
    <Block title="Entrée" onTitle={() => open(strip, "input")}>
      {gain ? <VBar label={gain.label} disabled={!canWrite} value={num(values, gain.address, linInv(0, gain.lo, gain.hi))} display={`${lin(num(values, gain.address, linInv(0, gain.lo, gain.hi)), gain.lo, gain.hi).toFixed(1)} dB`}
        scale={scaleDb(gain.lo, gain.hi, gain.lo === -12 ? [-12, 0, 12, 24, 36, 48, 60] : [-18, -6, 0, 6, 18])} onChange={v => set(gain.address, v)} height={120} /> : <NotAvailable>Pas de gain.</NotAvailable>}
      {strip.kind === "ch" && <div className="xm-stack">
        <Toggle tone="cyan" disabled={!canWrite} on={num(values, `${p}/preamp/invert`) === 1} onClick={() => set(`${p}/preamp/invert`, num(values, `${p}/preamp/invert`) === 1 ? 0 : 1)} title="Inverser la polarité">Ø Polarité</Toggle>
        <span className={gain?.headamp && num(values, `${gain.headamp}/phantom`) === 1 ? "xm-badge red" : "xm-badge"}>48 V {gain?.headamp && num(values, `${gain.headamp}/phantom`) === 1 ? "actif" : "coupé"}</span>
        <span className="xm-badge">{num(values, `${p}/preamp/rtnsw`) === 1 ? "Source USB" : "Source A/D"}</span>
      </div>}
    </Block>
    {gate && <Block title="Noise Gate" onTitle={() => open(strip, "gate")}><Thumb label="Gate" points={gate.points} active={gate.active} /><Toggle tone="cyan" disabled={!canWrite} on={gate.active} onClick={() => set(`${p}/gate/on`, gate.active ? 0 : 1)}>Noise Gate</Toggle></Block>}
    <Block title="Égaliseur" onTitle={() => open(strip, "eq")}><Thumb label="EQ" points={eq.points} fill={eq.fill} zero={20} active={eq.active} />
      <Toggle tone="cyan" disabled={!canWrite} on={eq.active} onClick={() => set(`${p}/eq/on`, eq.active ? 0 : 1)}>Égaliseur</Toggle>
      {strip.kind === "ch" && <Toggle tone="cyan" disabled={!canWrite} on={num(values, `${p}/preamp/hpon`) === 1} onClick={() => set(`${p}/preamp/hpon`, num(values, `${p}/preamp/hpon`) === 1 ? 0 : 1)}>Low Cut {formatHz(logMap(num(values, `${p}/preamp/hpf`), 20, 400))} Hz</Toggle>}
    </Block>
    {comp && <Block title="Compresseur" onTitle={() => open(strip, "comp")}><Thumb label="Comp" points={comp.points} active={comp.active} /><Toggle tone="cyan" disabled={!canWrite} on={comp.active} onClick={() => set(`${p}/dyn/on`, comp.active ? 0 : 1)}>Compresseur</Toggle></Block>}
    <Block title="Envois aux bus" onTitle={() => open(strip, "sends")} className="wide">
      {BUSES.map((b, i) => <HBar key={b.id} label={stripName(b, values)} color={BUS_TINT[i]!} disabled={!canWrite} value={num(values, `${p}/mix/${pad(i + 1)}/level`)} onChange={v => set(`${p}/mix/${pad(i + 1)}/level`, v)} />)}
      <h5>Envois aux effets</h5>
      {FXSENDS.map((f, i) => <HBar key={f.id} label={stripName(f, values)} color="#2563eb" disabled={!canWrite} value={num(values, `${p}/mix/${pad(i + 7)}/level`)} onChange={v => set(`${p}/mix/${pad(i + 7)}/level`, v)} />)}
    </Block>
    <Block title="Main Out" onTitle={() => open(strip, "main")}>
      <Toggle tone="orange" disabled={!canWrite} on={num(values, `${p}/mix/lr`, 1) === 1} onClick={() => set(`${p}/mix/lr`, num(values, `${p}/mix/lr`, 1) === 1 ? 0 : 1)}>LR Main Stereo</Toggle>
      <Knob bipolar label="Panorama" disabled={!canWrite} value={num(values, `${p}/mix/pan`, .5)} reset={.5} display={panText(num(values, `${p}/mix/pan`, .5))} onChange={v => set(`${p}/mix/pan`, v)} />
    </Block>
  </div>;
}
export const panText = (pan: number) => Math.abs(pan - .5) < .005 ? "Centre" : `${pan < .5 ? "G" : "D"} ${Math.round(Math.abs(pan - .5) * 200)}`;

// ---------- INPUT ----------
export function InputView({ strip, values, set, canWrite, confirmed }: ViewProps) {
  const model=useMixerModel();
  const p = strip.prefix;
  if (strip.kind !== "ch" && strip.kind !== "aux" && strip.kind !== "fxrtn") return <NotAvailable>Les réglages d’entrée concernent les canaux et retours.</NotAvailable>;
  const trimAddress = `${p}/preamp/rtntrim`, trim = num(values, trimAddress, .5);
  const trimBar = <VBar label="USB Trim" help="Niveau de la source USB" disabled={!canWrite || (strip.kind === "ch" && !model.usbChannels)} value={trim} reset={.5} display={`${lin(trim, -18, 18) >= 0 ? "+" : ""}${lin(trim, -18, 18).toFixed(1)} dB`} scale={scaleDb(-18, 18, [-18, -12, -6, 0, 6, 12, 18])} onChange={v => set(trimAddress, v)} />;
  if (strip.kind !== "ch") return <div className="xm-row-blocks"><Block title="Niveau du retour">{trimBar}</Block><NotAvailable>Ce retour stéréo n’a pas de préampli : seul le trim s’applique.</NotAvailable></div>;
  const usb = num(values, `${p}/preamp/rtnsw`) === 1;
  const source = num(values, `${p}/config/insrc`, Number(strip.short) - 1), headamp = source >= 0 && source < model.micPreamps ? `/headamp/${pad(source + 1)}` : null;
  const gain = headamp ? num(values, `${headamp}/gain`, linInv(0, -12, 60)) : 0;
  const phantom = headamp ? num(values, `${headamp}/phantom`) === 1 : false;
  const pair = Math.floor((Number(strip.short) - 1) / 2) * 2 + 1, link = `/config/chlink/${pair}-${pair + 1}`;
  const hpf = num(values, `${p}/preamp/hpf`);
  const insrcOptions = [...Array.from({ length: 16 }, (_, i) => `INP ${pad(i + 1)}`), "OFF"];
  return <div className="xm-row-blocks">
    <Block title="Source du canal">
      <div className="xm-stack">
        <div className="xm-seg"><Toggle tone="green" disabled={!canWrite||!model.usbChannels} on={!usb} onClick={() => set(`${p}/preamp/rtnsw`, 0)} title="Prise physique de la console">Mic/Line A/D</Toggle>
          <Toggle tone="green" disabled={!canWrite||!model.usbChannels} on={usb} onClick={() => set(`${p}/preamp/rtnsw`, 1)} title="Piste venant de l’ordinateur">USB</Toggle></div>
        <Select label="Entrée analogique" disabled={!canWrite} value={source} options={insrcOptions} title="Quelle prise physique alimente ce canal"
          onChange={i => { if (confirm(`Brancher ce canal sur ${insrcOptions[i]} ? Le son du canal va changer immédiatement.`)) set(`${p}/config/insrc`, i); }} />
        <Select label="Retour USB" disabled={!canWrite||!model.usbChannels} value={num(values, `${p}/config/rtnsrc`, Number(strip.short) - 1)} options={Array.from({ length: 18 }, (_, i) => `USB ${pad(i + 1)}`)} onChange={i => set(`${p}/config/rtnsrc`, i)} title="Piste de l’ordinateur utilisée en mode USB" />
      </div>
      <div className="xm-stack">
        <Toggle tone="red" disabled={!canWrite || !headamp} on={phantom} title="Alimentation fantôme (confirmation obligatoire)"
          onClick={() => headamp && void confirmed({ [`${headamp}/phantom`]: phantom ? 0 : 1 }, `${phantom ? "Couper" : "Activer"} le 48 V sur la prise IN ${source + 1} ? Cela concerne tous les canaux qui utilisent cette prise.`)}>48V Phantom</Toggle>
        <Toggle tone="cyan" disabled={!canWrite} on={num(values, `${p}/preamp/invert`) === 1} onClick={() => set(`${p}/preamp/invert`, num(values, `${p}/preamp/invert`) === 1 ? 0 : 1)}>Ø Polarity</Toggle>
        <Toggle tone="cyan" disabled={!canWrite} on={num(values, link) === 1} title={`Couple les canaux ${pair} et ${pair + 1}`}
          onClick={() => { if (confirm(`${num(values, link) === 1 ? "Découpler" : "Coupler en stéréo"} les canaux ${pair} et ${pair + 1} ?`)) set(link, num(values, link) === 1 ? 0 : 1); }}>Stereo Link {pair}-{pair + 1}</Toggle>
      </div>
    </Block>
    <Block title="Niveaux d’entrée">
      <div className="xm-bars">
        {headamp ? <VBar label="Mic Gain" help="Amplification du préampli (agit sur la prise physique)" disabled={!canWrite} value={gain} reset={linInv(0, -12, 60)} display={`${lin(gain, -12, 60) >= 0 ? "+" : ""}${lin(gain, -12, 60).toFixed(1)} dB`} scale={scaleDb(-12, 60, [-12, 0, 12, 24, 36, 48, 60])} onChange={v => set(`${headamp}/gain`, v)} /> : <NotAvailable>Pas de préampli micro pilotable pour cette source</NotAvailable>}
        {trimBar}
        <VBar label="Low Cut" help="Coupe le grave sous cette fréquence" disabled={!canWrite} value={hpf} display={`${formatHz(logMap(hpf, 20, 400))} Hz`} scale={freqScale(20, 400, [20, 40, 60, 90, 140, 230])} onChange={v => set(`${p}/preamp/hpf`, v)} />
      </div>
      <Toggle tone="cyan" disabled={!canWrite} on={num(values, `${p}/preamp/hpon`) === 1} onClick={() => set(`${p}/preamp/hpon`, num(values, `${p}/preamp/hpon`) === 1 ? 0 : 1)}>Low Cut actif</Toggle>
    </Block>
    <Block title="Channel Insert">
      <Toggle tone="cyan" disabled={!canWrite} on={num(values, `${p}/insert/on`) === 1} onClick={() => set(`${p}/insert/on`, num(values, `${p}/insert/on`) === 1 ? 0 : 1)}>Insert FX</Toggle>
      <Select label="Emplacement" disabled={!canWrite} value={num(values, `${p}/insert/sel`)} options={["Off", "FX1 A", "FX1 B", "FX2 A", "FX2 B", "FX3 A", "FX3 B", "FX4 A", "FX4 B"]} onChange={i => set(`${p}/insert/sel`, i)} title="Effet inséré directement dans ce canal" />
      <p className="xm-note">Pour insérer un effet, il doit être réglé en mode Insert dans l’onglet Effets.</p>
    </Block>
  </div>;
}

// ---------- side-chain filter (gate & comp) ----------
const SC_TYPES = ["LC6", "LC12", "HC6", "HC12", "1.0", "2.0", "3.0", "5.0", "10.0"];
const KEYSRC = ["Self", ...Array.from({ length: 16 }, (_, i) => `Ch ${pad(i + 1)}`), ...Array.from({ length: 6 }, (_, i) => `Bus ${i + 1}`)];
function SideChain({ base, values, set, canWrite }: { base: string; values: Values; set: SetFn; canWrite: boolean }) {
  const on = num(values, `${base}/filter/on`) === 1, type = num(values, `${base}/filter/type`), f = logMap(num(values, `${base}/filter/f`, .5), 20, 20000);
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = logMap(i / 40, 20, 20000);
    const db = type <= 1 ? Math.min(0, 12 * (type + 1) * Math.log2(x / f)) : type <= 3 ? Math.min(0, -12 * (type - 1) * Math.log2(x / f)) : -Math.abs(Math.log2(x / f)) * 24 / Number(SC_TYPES[type]);
    return `${i * 3},${Math.min(60, -db * 1.2 + 4)}`;
  }).join(" ");
  return <Block title="Side Chain Filter">
    <svg className={on ? "xm-mini-graph on" : "xm-mini-graph"} viewBox="0 0 120 64" preserveAspectRatio="none"><polygon points={`0,64 ${pts} 120,64`} /></svg>
    <div className="xm-stack row"><Toggle tone="cyan" disabled={!canWrite} on={on} onClick={() => set(`${base}/filter/on`, on ? 0 : 1)}>Filter</Toggle>
      <Select label="KeySrc" disabled={!canWrite} value={num(values, `${base}/keysrc`)} options={KEYSRC} onChange={i => set(`${base}/keysrc`, i)} title="Le signal qui déclenche le traitement" /></div>
    <div className="xm-bars">
      <VBar label="Type" disabled={!canWrite} value={type / 8} display={SC_TYPES[type]!} onChange={v => set(`${base}/filter/type`, Math.round(v * 8))} height={110} help="LC = coupe-bas, HC = coupe-haut, chiffre = bande étroite (Q)" />
      <VBar label="Frequency" disabled={!canWrite} value={num(values, `${base}/filter/f`, .5)} display={`${formatHz(f)} Hz`} onChange={v => set(`${base}/filter/f`, v)} height={110} />
    </div>
  </Block>;
}
function Envelope({ attack, hold, release }: { attack: number; hold: number; release: number }) {
  const a = 6 + attack * 30, h = 6 + hold * 30, r = 8 + release * 40, x0 = 10;
  return <svg className="xm-mini-graph on" viewBox="0 0 120 64"><polygon points={`${x0},60 ${x0 + a},10 ${x0 + a + h},10 ${Math.min(118, x0 + a + h + r)},60`} /><line x1={x0 + a} x2={x0 + a} y1="4" y2="60" className="xm-guide" /><line x1={x0 + a + h} x2={x0 + a + h} y1="4" y2="60" className="xm-guide" /></svg>;
}

// ---------- GATE ----------
const GATE_PRESETS: Record<string, [thr: number, range: number, attack: number, hold: number, release: number]> = {
  Kick: [-30, 40, 1, 20, 120], Snare: [-28, 30, 1, 30, 150], Acoustic: [-45, 20, 5, 50, 300], Vocal: [-50, 15, 10, 80, 400],
};
export function GateView({ strip, values, set, canWrite }: ViewProps) {
  if (strip.kind !== "ch") return <NotAvailable>La porte de bruit n’existe que sur les canaux 1 à 16.</NotAvailable>;
  const p = `${strip.prefix}/gate`, on = num(values, `${p}/on`) === 1, mode = num(values, `${p}/mode`);
  const thr = lin(num(values, `${p}/thr`), -80, 0), range = lin(num(values, `${p}/range`, 1), 3, 60);
  const applyPreset = (name: string) => {
    const [t, r, a, h, rel] = GATE_PRESETS[name]!;
    if (!confirm(`Appliquer le préréglage gate « ${name} » ? (seuil ${t} dB, plage ${r} dB)`)) return;
    set(`${p}/thr`, linInv(t, -80, 0)); set(`${p}/range`, linInv(r, 3, 60)); set(`${p}/attack`, a / 120); set(`${p}/hold`, logInv(h, .02, 2000)); set(`${p}/release`, logInv(rel, 5, 4000)); set(`${p}/on`, 1);
  };
  return <div className="xm-row-blocks">
    <Block title="Noise Gate">
      <Toggle tone="cyan" disabled={!canWrite} on={on} onClick={() => set(`${p}/on`, on ? 0 : 1)}>Noise Gate</Toggle>
      <h5>Presets</h5>{Object.keys(GATE_PRESETS).map(n => <button key={n} type="button" className="xm-preset" disabled={!canWrite} onClick={() => applyPreset(n)}>{n}</button>)}
    </Block>
    <Block title="Gain">
      <svg className={on ? "xm-mini-graph big on" : "xm-mini-graph big"} viewBox="0 0 120 120"><line x1="0" y1="120" x2="120" y2="0" className="xm-guide" /><polyline points={transferPoints(gateCurve(thr, range, mode), 120, 120)} /></svg>
      <Radio label="Mode" disabled={!canWrite} value={mode} options={["Gate", "Exp 2:1", "Exp 3:1", "Exp 4:1", "Ducker"]} onChange={i => set(`${p}/mode`, i)} />
    </Block>
    <Block title="Seuil et plage"><div className="xm-bars">
      <VBar label="Threshold" disabled={!canWrite} value={num(values, `${p}/thr`)} display={`${thr.toFixed(1)} dB`} scale={scaleDb(-80, 0, [-80, -60, -40, -20, -10])} onChange={v => set(`${p}/thr`, v)} help="Niveau sous lequel la porte se ferme" />
      <VBar label="Range" disabled={!canWrite} value={num(values, `${p}/range`, 1)} display={`${range.toFixed(0)} dB`} scale={scaleDb(3, 60, [10, 20, 30, 40, 50, 60])} onChange={v => set(`${p}/range`, v)} help="De combien on baisse quand c’est fermé" />
    </div></Block>
    <Block title="Gain Envelope">
      <Envelope attack={num(values, `${p}/attack`)} hold={num(values, `${p}/hold`)} release={num(values, `${p}/release`)} />
      <div className="xm-bars">
        <VBar label="Attack" height={110} disabled={!canWrite} value={num(values, `${p}/attack`)} display={`${lin(num(values, `${p}/attack`), 0, 120).toFixed(0)} ms`} onChange={v => set(`${p}/attack`, v)} />
        <VBar label="Hold" height={110} disabled={!canWrite} value={num(values, `${p}/hold`)} display={`${formatMs(logMap(num(values, `${p}/hold`), .02, 2000))} ms`} onChange={v => set(`${p}/hold`, v)} />
        <VBar label="Release" height={110} disabled={!canWrite} value={num(values, `${p}/release`)} display={`${formatMs(logMap(num(values, `${p}/release`), 5, 4000))} ms`} onChange={v => set(`${p}/release`, v)} />
      </div>
    </Block>
    <SideChain base={p} values={values} set={set} canWrite={canWrite} />
  </div>;
}

// ---------- COMP ----------
const COMP_PRESETS: Record<string, [thr: number, ratio: number, attack: number, release: number, knee: number, gain: number]> = {
  Kick: [-20, 6, 10, 100, 2, 3], Snare: [-18, 5, 5, 120, 2, 3], Bass: [-20, 6, 20, 150, 3, 4], Vocal: [-24, 5, 10, 150, 3, 4],
};
export function CompView({ strip, values, set, canWrite }: ViewProps) {
  if (!(strip.kind === "ch" || strip.kind === "bus" || strip.kind === "lr")) return <NotAvailable>Le compresseur existe sur les canaux, les bus et la façade.</NotAvailable>;
  const p = `${strip.prefix}/dyn`, on = num(values, `${p}/on`) === 1;
  const thr = lin(num(values, `${p}/thr`, 1), -60, 0), ratio = num(values, `${p}/ratio`, 6), knee = Math.round(lin(num(values, `${p}/knee`), 0, 5)), gain = lin(num(values, `${p}/mgain`), 0, 24), exp = num(values, `${p}/mode`) === 1;
  const applyPreset = (name: string) => {
    const [t, r, a, rel, k, g] = COMP_PRESETS[name]!;
    if (!confirm(`Appliquer le préréglage compresseur « ${name} » ? (seuil ${t} dB, ratio ${RATIOS[r]}:1)`)) return;
    set(`${p}/thr`, linInv(t, -60, 0)); set(`${p}/ratio`, r); set(`${p}/attack`, a / 120); set(`${p}/release`, logInv(rel, 5, 4000)); set(`${p}/knee`, k / 5); set(`${p}/mgain`, g / 24); set(`${p}/mix`, 1); set(`${p}/mode`, 0); set(`${p}/on`, 1);
  };
  return <div className="xm-row-blocks">
    <Block title="Compressor">
      <Toggle tone="cyan" disabled={!canWrite} on={on} onClick={() => set(`${p}/on`, on ? 0 : 1)}>Compressor</Toggle>
      <h5>Presets</h5>{Object.keys(COMP_PRESETS).map(n => <button key={n} type="button" className="xm-preset" disabled={!canWrite} onClick={() => applyPreset(n)}>{n}</button>)}
    </Block>
    <Block title="Gain">
      <svg className={on ? "xm-mini-graph big on" : "xm-mini-graph big"} viewBox="0 0 120 120"><line x1="0" y1="120" x2="120" y2="0" className="xm-guide" /><polyline points={transferPoints(compCurve(thr, ratio, knee, gain, exp), 120, 120, -60, 0)} /></svg>
      <div className="xm-stack row">
        <Radio label="Mode" disabled={!canWrite} value={exp ? 1 : 0} options={["Comp", "Exp"]} onChange={i => set(`${p}/mode`, i)} />
        <Radio label="Knee" disabled={!canWrite} value={knee} options={["0", "1", "2", "3", "4", "5"]} onChange={i => set(`${p}/knee`, i / 5)} />
      </div>
    </Block>
    <Block title="Détection">
      <Radio label="Enveloppe" disabled={!canWrite} value={num(values, `${p}/env`, 1)} options={["Lin", "Log"]} onChange={i => set(`${p}/env`, i)} />
      <Radio label="Détecteur" disabled={!canWrite} value={num(values, `${p}/det`)} options={["Peak", "RMS"]} onChange={i => set(`${p}/det`, i)} />
      <Toggle tone="cyan" disabled={!canWrite} on={num(values, `${p}/auto`) === 1} onClick={() => set(`${p}/auto`, num(values, `${p}/auto`) === 1 ? 0 : 1)} title="La console choisit attaque et relâchement">Auto Time</Toggle>
    </Block>
    <Block title="Réglages"><div className="xm-bars">
      <VBar label="Threshold" disabled={!canWrite} value={num(values, `${p}/thr`, 1)} display={`${thr.toFixed(1)} dB`} scale={scaleDb(-60, 0, [-60, -50, -40, -30, -20, -10])} onChange={v => set(`${p}/thr`, v)} help="Niveau à partir duquel il agit" />
      <VBar label="Ratio" disabled={!canWrite} value={ratio / 11} display={`${RATIOS[ratio]}:1`} onChange={v => set(`${p}/ratio`, Math.round(v * 11))} help="Force de la compression" />
      <VBar label="Mix" disabled={!canWrite} value={num(values, `${p}/mix`, 1)} display={`${lin(num(values, `${p}/mix`, 1), 0, 100).toFixed(0)} %`} onChange={v => set(`${p}/mix`, v)} help="Part de son compressé" />
      <VBar label="Gain" disabled={!canWrite} value={num(values, `${p}/mgain`)} display={`${gain.toFixed(1)} dB`} onChange={v => set(`${p}/mgain`, v)} help="Rattrapage de volume" />
    </div></Block>
    <Block title="Gain Envelope">
      <Envelope attack={num(values, `${p}/attack`)} hold={num(values, `${p}/hold`)} release={num(values, `${p}/release`)} />
      <div className="xm-bars">
        <VBar label="Attack" height={110} disabled={!canWrite} value={num(values, `${p}/attack`)} display={`${lin(num(values, `${p}/attack`), 0, 120).toFixed(0)} ms`} onChange={v => set(`${p}/attack`, v)} />
        <VBar label="Hold" height={110} disabled={!canWrite} value={num(values, `${p}/hold`)} display={`${formatMs(logMap(num(values, `${p}/hold`), .02, 2000))} ms`} onChange={v => set(`${p}/hold`, v)} />
        <VBar label="Release" height={110} disabled={!canWrite} value={num(values, `${p}/release`)} display={`${formatMs(logMap(num(values, `${p}/release`), 5, 4000))} ms`} onChange={v => set(`${p}/release`, v)} />
      </div>
    </Block>
    <SideChain base={p} values={values} set={set} canWrite={canWrite} />
  </div>;
}

// ---------- EQ ----------
const EQ_W = 1000, EQ_H = 300, BAND_COLORS = ["#2dd4bf", "#14b8a6", "#ec4899", "#f59e0b", "#3b82f6", "#a855f7"], BAND_NAMES4 = ["Low", "LoMid", "HiMid", "High"], BAND_NAMES6 = ["Low", "Low 2", "LoMid", "HiMid", "High 2", "High"];
const xOf = (f: number) => logInv(f, 20, 20000) * EQ_W, yOf = (db: number) => EQ_H / 2 - db / 18 * (EQ_H / 2);
export function EqView({ strip, values, set, canWrite }: ViewProps) {
  const model=useMixerModel();
  const svg = useRef<SVGSVGElement>(null), drag = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const p = strip.prefix, count = strip.kind === "bus" || strip.kind === "lr" ? 6 : 4;
  const hasEq = strip.kind !== "fxsend" && strip.kind !== "dca";
  const bands = readEq(values, p, count), eqOn = num(values, `${p}/eq/on`, 1) === 1;
  const hasHpf = strip.kind === "ch", hpfOn = hasHpf && num(values, `${p}/preamp/hpon`) === 1, hpf = logMap(num(values, `${p}/preamp/hpf`), 20, 400);
  const curve = useMemo(() => Array.from({ length: 200 }, (_, i) => { const f = logMap(i / 199, 20, 20000); return `${(i / 199 * EQ_W).toFixed(1)},${yOf(Math.max(-18, Math.min(18, eqResponse(bands, f, eqOn, hpfOn ? hpf : undefined)))).toFixed(1)}`; }).join(" "), [JSON.stringify(bands), eqOn, hpfOn, hpf]);
  if (!hasEq) return <NotAvailable>Pas d’égaliseur sur cette sortie.</NotAvailable>;
  const move = (e: ReactPointerEvent) => {
    if (drag.current === null || !canWrite || !svg.current) return;
    const r = svg.current.getBoundingClientRect(), band = drag.current, b = `${p}/eq/${band + 1}`;
    set(`${b}/f`, clamp01((e.clientX - r.left) / r.width));
    const t = bands[band]!.type;
    if (t !== 0 && t !== 5) set(`${b}/g`, clamp01(linInv(Math.round(Math.max(-15, Math.min(15, (EQ_H / 2 - (e.clientY - r.top) / r.height * EQ_H) / (EQ_H / 2) * 18)) * 4) / 4, -15, 15)));
  };
  const names = count === 6 ? BAND_NAMES6 : BAND_NAMES4;
  return <div className="xm-eq">
    <svg ref={svg} className={eqOn ? "xm-eq-graph" : "xm-eq-graph off"} viewBox={`0 0 ${EQ_W} ${EQ_H}`} onPointerMove={move} onPointerUp={() => { drag.current = null; }}>
      {[30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000].map(f => <g key={f}><line x1={xOf(f)} x2={xOf(f)} y1={0} y2={EQ_H} className="xm-grid" /><text x={xOf(f) + 3} y={EQ_H - 5} className="xm-grid-label">{formatHz(f)}</text></g>)}
      {[-12, -6, 0, 6, 12].map(d => <g key={d}><line x1={0} x2={EQ_W} y1={yOf(d)} y2={yOf(d)} className={d === 0 ? "xm-grid zero" : "xm-grid"} /><text x={4} y={yOf(d) - 3} className="xm-grid-label">{d > 0 ? `+${d}` : d}</text></g>)}
      <polygon points={`0,${EQ_H / 2} ${curve} ${EQ_W},${EQ_H / 2}`} className="xm-eq-fill" />
      <polyline points={curve} className="xm-eq-curve" />
      {hpfOn && <g><line x1={xOf(hpf)} x2={xOf(hpf)} y1={0} y2={EQ_H} stroke="#67e8f9" strokeWidth="1.5" /><text x={xOf(hpf) + 4} y={16} className="xm-grid-label">Low Cut</text></g>}
      {bands.map((b, i) => { const x = xOf(b.f), y = yOf(b.type === 0 || b.type === 5 ? 0 : b.g); return <g key={i}>
        <line x1={x} x2={x} y1={0} y2={EQ_H} stroke={BAND_COLORS[i]} strokeOpacity=".5" />
        <circle cx={x} cy={14} r={11} fill={BAND_COLORS[i]} /><text x={x} y={18} textAnchor="middle" className="xm-node-num">{i + 1}</text>
        <circle cx={x} cy={y} r={i === active ? 22 : 18} className="xm-eq-node" stroke={BAND_COLORS[i]}
          onPointerDown={e => { setActive(i); if (!canWrite) return; drag.current = i; svg.current!.setPointerCapture(e.pointerId); }}
          onWheel={e => { if (canWrite) set(`${p}/eq/${i + 1}/q`, clamp01(qToWire(b.q) + Math.sign(e.deltaY) * .03)); }} />
        <line x1={x - 6} x2={x + 6} y1={y} y2={y} stroke="#fff" /><line x1={x} x2={x} y1={y - 6} y2={y + 6} stroke="#fff" />
      </g>; })}
    </svg>
    <div className="xm-eq-panel">
      <div className="xm-stack">
        <Toggle tone="cyan" disabled={!canWrite} on={eqOn} onClick={() => set(`${p}/eq/on`, eqOn ? 0 : 1)}>EQ</Toggle>
        <button type="button" className="xm-preset" disabled={!canWrite} onClick={() => { if (confirm("Remettre tous les gains de l’égaliseur à 0 dB ?")) bands.forEach((_, i) => set(`${p}/eq/${i + 1}/g`, .5)); }}>RESET</button>
        {hasHpf && <><Toggle tone="cyan" disabled={!canWrite} on={hpfOn} onClick={() => set(`${p}/preamp/hpon`, hpfOn ? 0 : 1)}>Low Cut</Toggle>
          <Knob label="Low Cut" disabled={!canWrite} value={num(values, `${p}/preamp/hpf`)} display={`${formatHz(hpf)} Hz`} onChange={v => set(`${p}/preamp/hpf`, v)} /></>}
      </div>
      {bands.map((b, i) => { const base = `${p}/eq/${i + 1}`, cut = b.type === 0 || b.type === 5; return <div key={i} className={i === active ? "xm-band active" : "xm-band"} style={{ "--band": BAND_COLORS[i] } as React.CSSProperties} onClick={() => setActive(i)}>
        <b>{names[i]}</b>
        <Select label="Mode" disabled={!canWrite} value={b.type} options={EQ_TYPES} onChange={t => set(`${base}/type`, t)} />
        <div className="xm-band-knobs">
          <Knob size={34} label="Gain" bipolar disabled={!canWrite || cut} value={linInv(b.g, -15, 15)} reset={.5} display={cut ? "—" : `${b.g > 0 ? "+" : ""}${b.g.toFixed(2)} dB`} onChange={v => set(`${base}/g`, v)} />
          <Knob size={34} label="Freq" disabled={!canWrite} value={logInv(b.f, 20, 20000)} display={`${formatHz(b.f)} Hz`} onChange={v => set(`${base}/f`, v)} />
          <Knob size={34} label="Qual" disabled={!canWrite || cut} value={qToWire(b.q)} display={qFromWire(qToWire(b.q)).toFixed(1)} onChange={v => set(`${base}/q`, v)} />
        </div>
      </div>; })}
    </div>
  </div>;
}

// ---------- SENDS ----------
export function SendsView({ strip, values, set, canWrite }: ViewProps) {
  if (!isInput(strip)) return <NotAvailable>Les envois partent des entrées et des retours d’effets. Sélectionne un canal.</NotAvailable>;
  const p = strip.prefix;
  const col = (n: number, target: Strip, color: string) => {
    const level = `${p}/mix/${pad(n)}/level`, tap = `${p}/mix/${pad(n)}/tap`;
    return <div key={n} className="xm-send-col">
      <div className="xm-radio vertical">{tapNames.map((t, i) => <label key={t} className={num(values, tap, n <= 6 ? 3 : 4) === i ? "on" : ""} title={t}><input type="radio" disabled={!canWrite} checked={num(values, tap, n <= 6 ? 3 : 4) === i} onChange={() => set(tap, i)} /><span>{t}</span></label>)}</div>
      <span className="xm-send-name" style={{ background: color }}>{stripName(target, values)}</span>
      <b>{formatDb(faderToDb(num(values, level)))} dB</b>
      <div className="xm-send-fader"><Fader label={`Envoi vers ${stripName(target, values)}`} disabled={!canWrite} value={num(values, level)} reset={.75} onChange={v => set(level, v)} /></div>
      <small>{n <= 6 ? `Bus ${n}` : `FX ${n - 6}`}</small>
    </div>;
  };
  return <div className="xm-sends-view">
    <div className="xm-send-group"><h5>Retours (bus)</h5><div>{BUSES.map((b, i) => col(i + 1, b, BUS_TINT[i]!))}</div></div>
    <div className="xm-send-group"><h5>Effets</h5><div>{FXSENDS.map((f, i) => col(i + 7, f, "#2563eb"))}</div></div>
  </div>;
}

// ---------- MAIN ----------
export function MainView({ strip, values, set, canWrite }: ViewProps) {
  const p = strip.prefix, input = isInput(strip);
  const bit = (address: string, i: number) => (num(values, address) >> i & 1) === 1;
  const flip = (address: string, i: number) => set(address, num(values, address) ^ (1 << i));
  const pan = num(values, `${p}/mix/pan`, .5);
  const hasLr = input || strip.kind === "bus", hasPan = input || strip.kind === "bus" || strip.kind === "lr", hasGroups = strip.kind !== "lr" && strip.kind !== "dca";
  return <div className="xm-row-blocks">
    <Block title="Main Output">
      {hasLr ? <Toggle tone="orange" disabled={!canWrite} on={num(values, `${p}/mix/lr`, 1) === 1} onClick={() => set(`${p}/mix/lr`, num(values, `${p}/mix/lr`, 1) === 1 ? 0 : 1)} title="Envoyer en façade">LR Main Stereo</Toggle> : <NotAvailable>—</NotAvailable>}
      {hasPan && <><h5>Panorama {panText(pan)}</h5>
        <div className="xm-panorama" role="slider" aria-label="Panorama" aria-valuetext={panText(pan)} onDoubleClick={() => canWrite && set(`${p}/mix/pan`, .5)}
          onPointerDown={e => { if (!canWrite) return; const r = e.currentTarget.getBoundingClientRect(); set(`${p}/mix/pan`, clamp01((e.clientX - r.left) / r.width)); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (!canWrite || !e.buttons) return; const r = e.currentTarget.getBoundingClientRect(); set(`${p}/mix/pan`, clamp01((e.clientX - r.left) / r.width)); }}>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none"><polygon points="0,0 100,30 0,60" /><polygon points="200,0 100,30 200,60" /></svg><i style={{ left: `${pan * 100}%` }} />
        </div></>}
    </Block>
    {hasGroups && <Block title="Group Assignments">
      <div className="xm-groups">
        <div><h5>DCA Group</h5>{[0, 1, 2, 3].map(i => <button key={i} type="button" className={bit(`${p}/grp/dca`, i) ? "xm-round on" : "xm-round"} disabled={!canWrite} onClick={() => flip(`${p}/grp/dca`, i)} title={`Commandé par le DCA ${i + 1}`}>{i + 1}</button>)}</div>
        <div><h5>Mute Group</h5>{[0, 1, 2, 3].map(i => <button key={i} type="button" className={bit(`${p}/grp/mute`, i) ? "xm-square on" : "xm-square"} disabled={!canWrite} onClick={() => flip(`${p}/grp/mute`, i)} title={`Coupé avec le groupe ${i + 1}`}>{i + 1}</button>)}</div>
        {strip.kind === "ch" && <div><h5>Auto Mix</h5>
          <Radio label="Groupe auto-mix" disabled={!canWrite} value={num(values, `${p}/automix/group`)} options={["Off", "X", "Y"]} onChange={i => set(`${p}/automix/group`, i)} />
          <VBar label="Weight" height={100} disabled={!canWrite} value={num(values, `${p}/automix/weight`, .5)} reset={.5} display={`${lin(num(values, `${p}/automix/weight`, .5), -12, 12).toFixed(1)} dB`} onChange={v => set(`${p}/automix/weight`, v)} help="Priorité dans l’auto-mix" />
        </div>}
      </div>
    </Block>}
  </div>;
}

// ---------- FX ----------
export function FxView({ values, set, canWrite, confirmed, open }: ViewProps) {
  return <div className="xm-fx-view">
    <div className="xm-fx-slots">{[1, 2, 3, 4].map(n => {
      const type = num(values, `/fx/${n}/type`), info = FX_INFO[type], insert = num(values, `/fx/${n}/insert`) === 1;
      const rtn = INPUTS.find(s => s.id === `rtn${n}`)!;
      const senders = INPUTS.filter(s => s.kind !== "fxrtn" && num(values, `${s.prefix}/mix/${pad(n + 6)}/level`) > .01);
      // Channels whose insert points at this FX slot (Fx{n}A or Fx{n}B).
      const inserted = INPUTS.filter(s => s.kind === "ch" && num(values, `${s.prefix}/insert/on`) === 1 && Math.ceil(num(values, `${s.prefix}/insert/sel`) / 2) === n);
      return <section key={n} className="xm-fx-slot">
        <h4>FX {n}</h4>
        <select disabled={!canWrite} value={type} aria-label={`Type de l’effet ${n}`} onChange={e => { const next = Number(e.target.value); void confirmed({ [`/fx/${n}/type`]: next }, `Remplacer l’effet ${n} (${info?.name}) par ${FX_INFO[next]?.name} ? Tous les canaux qui l’utilisent seront concernés.`); }}>
          {FX_INFO.map((f, i) => <option key={f.code} value={i}>{f.name}</option>)}
        </select>
        <p className="xm-fx-family">{info?.family}</p><p className="xm-fx-text">{info?.text}</p>
        <div className="xm-stack row">
          <Toggle tone="cyan" disabled={!canWrite} on={insert} title="Insert : l’effet est placé directement dans un canal au lieu d’être en départ / retour"
            onClick={() => { if (confirm(insert ? `Repasser l’effet ${n} en départ / retour ?` : `Passer l’effet ${n} en mode Insert ? Il ne sera plus disponible en départ / retour.`)) set(`/fx/${n}/insert`, insert ? 0 : 1); }}>{insert ? "Mode Insert" : "Départ / retour"}</Toggle>
          <Toggle tone="red" disabled={!canWrite} on={num(values, `${rtn.prefix}/mix/on`, 1) === 0} onClick={() => set(`${rtn.prefix}/mix/on`, num(values, `${rtn.prefix}/mix/on`, 1) === 1 ? 0 : 1)}>Mute retour</Toggle>
        </div>
        {insert && !inserted.length && <p className="xm-note warn">Cet effet est en mode Insert mais aucun canal ne l’utilise : les envois vers lui ne s’entendent pas. Clique sur « Mode Insert » pour le repasser en départ / retour.</p>}
        {insert && inserted.length > 0 && <p className="xm-note">Inséré sur : {inserted.map(s => stripName(s, values)).join(", ")}.</p>}
        <HBar label="Retour" color="#22c55e" disabled={!canWrite} value={num(values, `${rtn.prefix}/mix/fader`)} onChange={v => set(`${rtn.prefix}/mix/fader`, v)} />
        <div className="xm-fx-meter"><Meter indexes={rtn.meters} /></div>
        <h5>Canaux envoyés</h5>
        <p className="xm-fx-senders">{senders.length ? senders.map(s => <button key={s.id} type="button" onClick={() => open(s, "sends")}>{stripName(s, values)}</button>) : <em>Aucun canal n’envoie vers cet effet.</em>}</p>
      </section>;
    })}</div>
    <details className="xm-fx-params"><summary>Paramètres de l’effet (lecture, modification et presets)</summary><FxConsole /></details>
  </div>;
}

// ---------- ROUTING ----------
const ROUTE_SOURCES = ["Ch01", "Ch02", "Ch03", "Ch04", "Ch05", "Ch06", "Ch07", "Ch08", "Ch09", "Ch10", "Ch11", "Ch12", "Ch13", "Ch14", "Ch15", "Ch16", "AuxL", "AuxR", "Fx1L", "Fx1R", "Fx2L", "Fx2R", "Fx3L", "Fx3R", "Fx4L", "Fx4R", "Bus1", "Bus2", "Bus3", "Bus4", "Bus5", "Bus6", "Send1", "Send2", "Send3", "Send4", "L", "R", ...Array.from({ length: 18 }, (_, i) => `U${pad(i + 1)}`)];
const ROUTE_TAPS = ["AIN", "AIN+M", "IN", "IN+M", "PREEQ", "PREEQ+M", "POSTEQ", "POSTEQ+M", "PRE", "PRE+M", "POST"];
const MAIN_SOURCES = ["LR", "MON", "U01-02", "U03-04", "U05-06", "U07-08", "U09-10", "U11-12", "U13-14", "U15-16", "U17-18"];
export function RoutingView({ values, canWrite, confirmed }: ViewProps) {
  const [draft, setDraft] = useState<Record<string, number>>({});
  const value = (a: string, fallback = 0) => draft[a] ?? num(values, a, fallback);
  const change = (a: string, v: number) => setDraft(d => ({ ...d, [a]: v }));
  const changed = Object.entries(draft).filter(([a, v]) => num(values, a) !== v);
  const rows = (group: string, count: number, label: (i: number) => string, withTap: boolean, sources: string[], usbLimit = false) =>
    Array.from({ length: count }, (_, i) => {
      const base = `/routing/${group}/${pad(i + 1)}`, src = `${base}/src`, pos = `${base}/pos`;
      return <tr key={base} className={draft[src] !== undefined || draft[pos] !== undefined ? "changed" : ""}>
        <th>{label(i)}</th>
        <td><select disabled={!canWrite} value={value(src, i)} onChange={e => change(src, Number(e.target.value))} aria-label={`Source ${label(i)}`}>{(usbLimit ? sources.slice(0, 38) : sources).map((s, k) => <option key={s} value={k}>{s}</option>)}</select></td>
        {withTap && <td><select disabled={!canWrite} value={value(pos, 8)} onChange={e => change(pos, Number(e.target.value))} aria-label={`Prélèvement ${label(i)}`}>{ROUTE_TAPS.map((t, k) => <option key={t} value={k}>{t}</option>)}</select></td>}
      </tr>;
    });
  return <div className="xm-routing">
    <div className="xm-routing-actions">
      <span>{changed.length ? `${changed.length} modification(s) en attente` : "Aucune modification en attente"}</span>
      <button type="button" disabled={!canWrite || !changed.length} onClick={() => void confirmed(Object.fromEntries(changed), `Appliquer ${changed.length} changement(s) de routage ? Une sortie mal routée peut couper la façade ou un retour.`).then(ok => { if (ok) setDraft({}); })}>Appliquer (avec aperçu)</button>
      <button type="button" disabled={!changed.length} onClick={() => setDraft({})}>Annuler</button>
    </div>
    <div className="xm-routing-grid">
      <section><h5>Sorties principales</h5><table><tbody>{rows("main", 2, i => i === 0 ? "Main L/R" : "Main 2", false, MAIN_SOURCES)}</tbody></table></section>
      <section><h5>Sorties Aux (prises)</h5><table><thead><tr><th>Sortie</th><th>Source</th><th>Prélèvement</th></tr></thead><tbody>{rows("aux", 6, i => `Aux ${i + 1}`, true, ROUTE_SOURCES)}</tbody></table></section>
      <section><h5>USB vers l’ordinateur</h5><table><thead><tr><th>Piste</th><th>Source</th><th>Prélèvement</th></tr></thead><tbody>{rows("usb", 18, i => `USB ${i + 1}`, true, ROUTE_SOURCES, true)}</tbody></table></section>
      <section><h5>P16 (retours personnels)</h5><table><thead><tr><th>Canal</th><th>Source</th><th>Prélèvement</th></tr></thead><tbody>{rows("p16", 16, i => `P16 ${i + 1}`, true, ROUTE_SOURCES)}</tbody></table></section>
    </div>
  </div>;
}

// ---------- METERS ----------
function MeterGroup({ title, items }: { title: string; items: [string, number[]][] }) {
  return <section className="xm-meter-group"><h5>{title}</h5><div>{items.map(([label, idx]) => <div key={label} className="xm-meter-cell"><Meter indexes={idx} wide /><small>{label}</small></div>)}</div></section>;
}
export function MeterView() {
  return <div className="xm-meter-view">
    <section className="xm-meter-group"><h5>&nbsp;</h5><div><div className="xm-meter-cell"><div className="xm-scale">{[0, -5, -10, -20, -30, -40, -50].map(d => <span key={d} style={{ bottom: `${(d + 60) / 60 * 100}%` }}>{d}</span>)}</div><small>dB</small></div></div></section>
    <MeterGroup title="Entrées" items={[...Array.from({ length: 16 }, (_, i): [string, number[]] => [String(i + 1), [i]]), ["Aux", [16, 17]]]} />
    <MeterGroup title="Envois FX" items={[1, 2, 3, 4].map(n => [String(n), [31 + n]])} />
    <MeterGroup title="Retours FX" items={[1, 2, 3, 4].map(n => [`FX${n}`, [16 + n * 2, 17 + n * 2]])} />
    <MeterGroup title="Bus" items={[1, 2, 3, 4, 5, 6].map(n => [String(n), [25 + n]])} />
    <MeterGroup title="Mon/Solo" items={[["L R", [38, 39]]]} />
    <MeterGroup title="Main" items={[["L R", [36, 37]]]} />
  </div>;
}

export { stripColor };
