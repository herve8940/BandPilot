import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { bandResponse, clamp01, dbToFader, faderToDb, formatDb, lin, logMap, RATIOS } from "../xairMath";
import type { HelpPage } from "../xairHelp";

export type Value = number | string;
export type Values = Record<string, Value>;
export type SetFn = (address: string, value: Value) => void;
export const pad = (n: number) => String(n).padStart(2, "0");
export const num = (values: Values, address: string, fallback = 0) => { const v = values[address]; return typeof v === "number" ? v : fallback; };

// ---------- meters: external store so only meter widgets re-render ----------
export const meterStore = (() => {
  let levels: number[] = []; let at = 0; const listeners = new Set<() => void>();
  return {
    set(next: number[]) { levels = next; at = Date.now(); listeners.forEach(l => l()); },
    get: () => levels, fresh: () => Date.now() - at < 2000,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
})();
export function useMeters() { return useSyncExternalStore(meterStore.subscribe, meterStore.get); }
export const meterPos = (db: number) => Math.max(0, Math.min(1, (db + 60) / 60));

export function Meter({ indexes, wide = false }: { indexes: number[]; wide?: boolean }) {
  const levels = useMeters();
  const peaks = useRef<{ value: number; at: number }[]>([]);
  if (!indexes.length) return <div className="xm-meter none" />;
  const fresh = meterStore.fresh();
  return <div className={wide ? "xm-meter wide" : "xm-meter"}>{indexes.map((index, i) => {
    const db = fresh ? levels[index] ?? -128 : -128;
    const peak = peaks.current[i];
    if (!peak || db > peak.value || Date.now() - peak.at > 1500) peaks.current[i] = { value: db, at: Date.now() };
    const peakPos = meterPos(peaks.current[i]!.value);
    return <div key={index} className="xm-meter-bar" title={`${db.toFixed(1)} dBFS`}>
      <div className="xm-meter-fill" style={{ clipPath: `inset(${(1 - meterPos(db)) * 100}% 0 0 0)` }} />
      {peakPos > 0 && <div className="xm-meter-peak" style={{ bottom: `${peakPos * 100}%` }} />}
      {db > -0.5 && <div className="xm-meter-clip" />}
    </div>;
  })}</div>;
}

/** Big meter with a dB scale, as on the left/right of X-AIR Edit views. */
export function ScaledMeter({ indexes, label }: { indexes: number[]; label?: string }) {
  return <div className="xm-scaled-meter">
    <div className="xm-scale">{[0, -5, -10, -20, -30, -40, -50].map(d => <span key={d} style={{ bottom: `${meterPos(d) * 100}%` }}>{d}</span>)}</div>
    <Meter indexes={indexes} wide />
    {label && <small>{label}</small>}
  </div>;
}

// ---------- drag helper ----------
function useVerticalDrag(value: number, onChange: (v: number) => void, disabled: boolean | undefined, pixels: number) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  return {
    onPointerDown: (e: ReactPointerEvent<Element>) => { if (disabled) return; drag.current = { y: e.clientY, v: value }; (e.currentTarget as Element).setPointerCapture(e.pointerId); },
    onPointerMove: (e: ReactPointerEvent<Element>) => { if (!drag.current) return; onChange(clamp01(drag.current.v + (drag.current.y - e.clientY) / (e.shiftKey ? pixels * 5 : pixels))); },
    onPointerUp: () => { drag.current = null; }, onPointerCancel: () => { drag.current = null; },
    onWheel: (e: React.WheelEvent) => { if (!disabled) onChange(clamp01(value - Math.sign(e.deltaY) * (e.shiftKey ? .002 : .01))); },
  };
}
function keyStep(value: number, onChange: (v: number) => void, disabled?: boolean) {
  return (e: React.KeyboardEvent) => {
    if (disabled) return; const step = e.shiftKey ? .002 : .01;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); onChange(clamp01(value + step)); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); onChange(clamp01(value - step)); }
  };
}

// ---------- fader (real X-Air dB law) ----------
const FADER_MARKS = [10, 5, 0, -5, -10, -20, -30, -50];
export function Fader({ value, onChange, disabled, label, reset = .75, accent }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string; reset?: number; accent?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number } | null>(null);
  return <div className={disabled ? "xm-fader disabled" : "xm-fader"} role="slider" aria-disabled={!!disabled} aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value}
    aria-valuetext={`${formatDb(faderToDb(value))} dB`} tabIndex={disabled ? -1 : 0} onKeyDown={keyStep(value, onChange, disabled)}
    onWheel={e => { if (!disabled) onChange(clamp01(value - Math.sign(e.deltaY) * (e.shiftKey ? .002 : .01))); }}
    onDoubleClick={() => { if (!disabled) onChange(reset); }}>
    <div className="xm-fader-scale">{FADER_MARKS.map(db => <span key={db} style={{ bottom: `${dbToFader(db) * 100}%` }}>{db > 0 ? db : Math.abs(db)}</span>)}</div>
    <div className="xm-fader-track" ref={track}
      onPointerDown={e => {
        if (disabled || !track.current) return;
        const rect = track.current.getBoundingClientRect(), capY = rect.bottom - value * rect.height;
        const v = Math.abs(e.clientY - capY) > 14 ? clamp01((rect.bottom - e.clientY) / rect.height) : value;
        if (v !== value) onChange(v);
        drag.current = { y: e.clientY, v }; e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => { if (!drag.current || !track.current) return; onChange(clamp01(drag.current.v + (drag.current.y - e.clientY) / track.current.clientHeight * (e.shiftKey ? .15 : 1))); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="xm-fader-slot" />
      <div className="xm-fader-cap" style={{ bottom: `${value * 100}%`, "--cap": accent ?? "#9aa4b1" } as React.CSSProperties}><i /></div>
    </div>
  </div>;
}

// ---------- vertical value bar (X-AIR Edit style cyan bars) ----------
export function VBar({ value, onChange, label, display, disabled, reset, scale, help, height = 150 }: { value: number; onChange: (v: number) => void; label: string; display: string; disabled?: boolean; reset?: number; scale?: [number, string][]; help?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useVerticalDrag(value, onChange, disabled, height);
  return <div className={disabled ? "xm-vbar disabled" : "xm-vbar"} title={help ? `${label} — ${help}` : label}>
    <b className="xm-vbar-value">{display}</b>
    <div className="xm-vbar-body" style={{ height }}>
      {scale && <div className="xm-vbar-scale">{scale.map(([pos, text]) => <span key={text} style={{ bottom: `${pos * 100}%` }}>{text}</span>)}</div>}
      <div ref={ref} className="xm-vbar-track" role="slider" aria-label={label} aria-valuetext={display} tabIndex={disabled ? -1 : 0} onKeyDown={keyStep(value, onChange, disabled)}
        onDoubleClick={() => { if (!disabled && reset !== undefined) onChange(reset); }}
        {...drag}
        onPointerDown={e => {
          if (disabled || !ref.current) return;
          const rect = ref.current.getBoundingClientRect();
          onChange(clamp01((rect.bottom - e.clientY) / rect.height));
          drag.onPointerDown(e);
        }}>
        <div className="xm-vbar-fill" style={{ height: `${value * 100}%` }} />
      </div>
    </div>
    <small>{label}</small>
  </div>;
}

export function Knob({ value, onChange, label, display, disabled, reset, size = 38, bipolar = false, help }: { value: number; onChange: (v: number) => void; label: string; display: string; disabled?: boolean; reset?: number; size?: number; bipolar?: boolean; help?: string }) {
  const r = size / 2 - 4, c = size / 2, a0 = -225, a1 = 45;
  const angle = (v: number) => (a0 + (a1 - a0) * v) * Math.PI / 180;
  const point = (v: number) => [c + r * Math.cos(angle(v)), c + r * Math.sin(angle(v))] as const;
  const arc = (from: number, to: number) => { const [x0, y0] = point(from), [x1, y1] = point(to); return `M${x0} ${y0} A${r} ${r} 0 ${Math.abs(to - from) * 270 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
  const start = bipolar ? .5 : 0, [px, py] = point(value);
  const drag = useVerticalDrag(value, onChange, disabled, 160);
  return <div className={disabled ? "xm-knob disabled" : "xm-knob"} title={`${label} : ${display}${help ? " — " + help : ""}`}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="slider" aria-disabled={!!disabled} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} aria-label={label} aria-valuetext={display} tabIndex={disabled ? -1 : 0} onKeyDown={keyStep(value, onChange, disabled)} {...drag}
      onDoubleClick={() => { if (!disabled && reset !== undefined) onChange(reset); }}>
      <path d={arc(0, 1)} className="xm-knob-bg" />
      {Math.abs(value - start) > .002 && <path d={value > start ? arc(start, value) : arc(value, start)} className="xm-knob-val" />}
      <circle cx={c} cy={c} r={r - 5} className="xm-knob-body" />
      <line x1={c} y1={c} x2={c + (px - c) * .62} y2={c + (py - c) * .62} className="xm-knob-dot" />
    </svg>
    <small>{label}</small><b>{display}</b>
  </div>;
}

export function Toggle({ on, onClick, children, tone = "cyan", disabled, title }: { on: boolean; onClick: () => void; children: ReactNode; tone?: "red" | "yellow" | "cyan" | "green" | "orange"; disabled?: boolean; title?: string }) {
  return <button type="button" title={title} aria-pressed={on} disabled={disabled} className={`xm-toggle ${tone}${on ? " on" : ""}`} onClick={onClick}>{children}</button>;
}

export function Radio({ options, value, onChange, disabled, label }: { options: string[]; value: number; onChange: (i: number) => void; disabled?: boolean; label: string }) {
  return <div className="xm-radio" role="radiogroup" aria-label={label}>{options.map((o, i) => <label key={o} className={value === i ? "on" : ""}>
    <input type="radio" disabled={disabled} checked={value === i} onChange={() => onChange(i)} /><span>{o}</span></label>)}</div>;
}

export function Select({ label, value, options, onChange, disabled, title }: { label: string; value: number; options: string[]; onChange: (i: number) => void; disabled?: boolean; title?: string }) {
  return <label className="xm-select" title={title}>{label}<select disabled={disabled} value={value} onChange={e => onChange(Number(e.target.value))}>{options.map((o, i) => <option key={i} value={i}>{o}</option>)}</select></label>;
}

// ---------- help ----------
export function HelpPanel({ page, open, onToggle }: { page: HelpPage; open: boolean; onToggle: () => void }) {
  return <aside className={open ? "xm-help open" : "xm-help"}>
    <button type="button" className="xm-help-toggle" onClick={onToggle} aria-expanded={open}>{open ? "Masquer les explications" : "? Explications"}</button>
    {open && <div className="xm-help-body">
      <h4>{page.title}</h4><p>{page.intro}</p>
      <dl>{page.items.map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
      {page.tip && <p className="xm-help-tip">💡 {page.tip}</p>}
    </div>}
  </aside>;
}

// ---------- curves (shared by thumbnails and big views) ----------
export interface EqBand { type: number; f: number; g: number; q: number }
export function readEq(values: Values, prefix: string, bands: number): EqBand[] {
  return Array.from({ length: bands }, (_, i) => {
    const b = `${prefix}/eq/${i + 1}`;
    return { type: num(values, `${b}/type`, 2), f: logMap(num(values, `${b}/f`, (i + .5) / bands), 20, 20000), g: lin(num(values, `${b}/g`, .5), -15, 15), q: .3 * Math.pow(10 / .3, 1 - num(values, `${b}/q`, .5)) };
  });
}
export function eqResponse(bands: EqBand[], f: number, eqOn: boolean, hpf?: number) {
  let db = hpf ? bandResponse(0, hpf, 0, .707, f) : 0;
  if (eqOn) for (const b of bands) db += bandResponse(b.type, b.f, b.g, b.q, f);
  return db;
}
export function gateCurve(thr: number, range: number, mode: number) {
  // input/output in dB from -80 to 0; expander ratio by mode
  const ratio = [Infinity, 2, 3, 4, 1][mode] ?? Infinity;
  return (input: number) => {
    if (mode === 4) return input > thr ? input - range : input; // ducker-ish illustration
    if (input >= thr) return input;
    const reduced = ratio === Infinity ? input - range : thr + (input - thr) * ratio;
    return Math.max(input - range, reduced);
  };
}
export function compCurve(thr: number, ratioIndex: number, knee: number, gain: number, expander = false) {
  const ratio = Number(RATIOS[ratioIndex] ?? 4);
  return (input: number) => {
    const over = input - thr;
    if (expander) return (over >= 0 ? input : thr + over * ratio) + gain;
    const out = over <= -knee / 2 ? input : over >= knee / 2 ? thr + over / ratio : input + (1 / ratio - 1) * Math.pow(over + knee / 2, 2) / (2 * Math.max(knee, .001));
    return out + gain;
  };
}
/** Polyline points of y=f(x) for x in [lo,hi] dB, drawn in a w×h box. */
export function transferPoints(f: (x: number) => number, w: number, h: number, lo = -80, hi = 0) {
  return Array.from({ length: 81 }, (_, i) => {
    const x = lo + (hi - lo) * i / 80, y = Math.max(lo, Math.min(hi, f(x)));
    return `${(i / 80 * w).toFixed(1)},${(h - (y - lo) / (hi - lo) * h).toFixed(1)}`;
  }).join(" ");
}

// ---------- live connection ----------
async function api(path: string, data?: unknown) {
  const r = await fetch(path, { method: data ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
  const result = await r.json(); if (!r.ok) throw Error(result.error ?? "Opération refusée"); return result;
}
export function useLiveMixer() {
  const [values, setValues] = useState<Values>({});
  const [online, setOnline] = useState(false);
  const [message, setMessage] = useState("");
  const ws = useRef<WebSocket | null>(null);
  const touched = useRef(new Map<string, number>());
  const queue = useRef(new Map<string, Value>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    let closed = false, retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`);
      ws.current = socket;
      socket.onopen = () => setOnline(true);
      socket.onclose = () => { setOnline(false); if (!closed) retry = setTimeout(connect, 1500); };
      socket.onmessage = event => {
        const m = JSON.parse(event.data);
        if (m.type === "snapshot") {
          const next: Values = {};
          for (const [address, state] of Object.entries(m.parameters ?? {})) next[address] = (state as { value: Value }).value;
          setValues(next);
          if (m.meters?.all) meterStore.set(m.meters.all);
          if (Object.keys(next).length < 2000) socket.send(JSON.stringify({ type: "sync" }));
        } else if (m.type === "parameter") {
          const { address, value } = m.state as { address: string; value: Value };
          if (Date.now() - (touched.current.get(address) ?? 0) < 400) return;
          setValues(v => v[address] === value ? v : { ...v, [address]: value });
        } else if (m.type === "meters") {
          if (m.state?.all) meterStore.set(m.state.all);
        } else if (m.type === "live-error") {
          setMessage(m.error); if (m.address) touched.current.delete(m.address);
        }
      };
    };
    connect();
    return () => { closed = true; if (retry) clearTimeout(retry); ws.current?.close(); };
  }, []);

  /** Immediate control: shown at once, sent at most every 40 ms per control (last value always sent). */
  const set = useCallback((address: string, value: Value) => {
    touched.current.set(address, Date.now());
    setValues(v => ({ ...v, [address]: value }));
    queue.current.set(address, value);
    if (timers.current.has(address)) return;
    const flush = () => {
      const pending = queue.current.get(address);
      if (pending === undefined) { timers.current.delete(address); return; }
      queue.current.delete(address);
      if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: "set", address, value: pending }));
      timers.current.set(address, setTimeout(flush, 40));
    };
    flush();
  }, []);

  /**
   * Protected changes (48 V, routing, FX type): server preview, explicit confirmation, backup and readback.
   * `values` are display values: enum index, 0/1, or physical unit.
   */
  const confirmed = useCallback(async (values: Record<string, Value>, question: string) => {
    if (!confirm(question)) return false;
    try {
      const preview = await api("/api/console/preview", { values });
      const allowPhantom = preview.phantom ? confirm("Confirmer le changement de l’alimentation 48 V ? Vérifie le micro branché (un micro à ruban peut être endommagé).") : false;
      if (preview.phantom && !allowPhantom) return false;
      const result = await api("/api/console/apply", { token: preview.token, confirm: true, allowPhantom });
      setMessage(`Appliqué. Sauvegarde : ${result.backupId}`);
      return true;
    } catch (e) { setMessage((e as Error).message); return false; }
  }, []);
  return { values, set, confirmed, online, message, clearMessage: () => setMessage("") };
}

export function usePersistentFlag(key: string, initial: boolean) {
  const [value, setValue] = useState(() => { try { const v = localStorage.getItem(key); return v === null ? initial : v === "1"; } catch { return initial; } });
  const update = (next: boolean) => { setValue(next); try { localStorage.setItem(key, next ? "1" : "0"); } catch { /* per-viewer convenience only */ } };
  return [value, update] as const;
}
