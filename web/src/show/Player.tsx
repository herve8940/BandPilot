import { useEffect, useMemo, useRef, useState } from "react";
import { call, clock, sectionName, type Item, type Show, type ShowTrack } from "./api";

type Range = { start: number; stop: number };
function Wave({ track, items, range, muted, rec, cursor }: { track: number; items: Item[]; range: Range; muted: boolean; rec: boolean; cursor: number }) {
  const ref = useRef<HTMLCanvasElement>(null), [peaks, setPeaks] = useState<Record<string, number[] | null>>({});
  const wanted = useMemo(() => items.map((item, index) => ({ item, index })).filter(({ item }) => item.pos < range.stop && item.pos + item.length > range.start && item.takes.some(t => t.active)), [items, range.start, range.stop]);
  const keyOf = (i: Item) => { const t = i.takes.find(k => k.active); return `${i.pos}:${t?.index}:${t?.file}`; };
  useEffect(() => { for (const { item, index } of wanted) { const key = keyOf(item), take = item.takes.find(t => t.active)!.index; if (!(key in peaks)) { setPeaks(p => ({ ...p, [key]: null })); void call<{ peaks: number[] | null }>(`/api/show/peaks?track=${track}&item=${index}&take=${take}&buckets=800`).then(r => setPeaks(p => ({ ...p, [key]: r.peaks }))).catch(() => undefined); } } }, [wanted, track]);
  useEffect(() => {
    const c = ref.current; if (!c) return; const w = c.width = c.clientWidth * 2 || 1, h = c.height = 140, x = c.getContext("2d")!, span = Math.max(.001, range.stop - range.start);
    x.clearRect(0, 0, w, h); const played = (cursor - range.start) / span * w;
    for (const item of items) {
      const data = peaks[keyOf(item)], a = (item.pos - range.start) / span * w, b = (item.pos + item.length - range.start) / span * w;
      x.fillStyle = rec ? "rgba(61,219,168,.10)" : "rgba(122,167,255,.10)"; x.fillRect(a, 2, b - a, h - 4);
      if (!data?.length) continue;
      for (let px = Math.max(0, Math.floor(a)); px < Math.min(w, b); px += 3) {
        const v = data[Math.floor((px - a) / (b - a) * data.length)] ?? 0, bar = Math.max(2, Math.sqrt(v) * (h - 8));
        x.globalAlpha = muted ? .25 : px < played ? 1 : .55; x.fillStyle = rec ? "#3DDBA8" : "#7AA7FF"; x.fillRect(px, (h - bar) / 2, 2, bar);
      }
      x.globalAlpha = 1;
    }
  }, [items, peaks, range.start, range.stop, muted, rec, cursor]);
  return <canvas ref={ref} className="sh-wave" aria-hidden="true" />;
}
export function Player({ show, band = false, cursor, range, disabled, onSeek, onTrack }: { show: Show; band?: boolean; cursor: number; range: Range; disabled: boolean; onSeek: (t: number) => void; onTrack: (t: ShowTrack, solo: boolean) => void }) {
  const lanes = (show.tracks ?? []).filter(t => !["CUES", "VOIX", "VOICE", "CLICK"].includes(t.name) && t.items.some(i => i.pos < range.stop && i.pos + i.length > range.start));
  const sections = (show.regions ?? []).filter(r => r.start >= range.start - .05 && r.stop <= range.stop + .05), span = Math.max(.001, range.stop - range.start);
  const seek = (e: React.MouseEvent<HTMLDivElement>) => { if (disabled) return; const b = e.currentTarget.getBoundingClientRect(); onSeek(range.start + (e.clientX - b.left) / b.width * span); };
  const cursorLeft = `${Math.max(0, Math.min(100, (cursor - range.start) / span * 100))}%`;
  return <div className="sh-player">
    {sections.length > 0 && <div className="sh-row"><span className="sh-tag">Sections</span><div className="sh-sections">{sections.map(s => <button key={s.start} type="button" disabled={disabled} className={cursor >= s.start && cursor < s.stop ? "on" : ""} title={sectionName(s.name)} style={{ flexGrow: s.stop - s.start }} onClick={() => onSeek(s.start)}>{sectionName(s.name)}</button>)}</div></div>}
    {lanes.length ? lanes.map(t => <div className="sh-row" key={t.index}>
      <div className="sh-lane"><div><b>{t.name.replace(/^REC /, "")}</b><small>{t.rec || band ? "Prise du groupe" : "Piste ReaCue"}</small></div>
        <button type="button" className={t.mute ? "warn" : ""} aria-pressed={t.mute} aria-label={`Couper ${t.name}`} onClick={() => onTrack(t, false)}>M</button>
        <button type="button" className={t.solo ? "on" : ""} aria-pressed={t.solo} aria-label={`Écouter ${t.name} seule`} onClick={() => onTrack(t, true)}>S</button></div>
      <div className="sh-track" onClick={seek}><Wave track={t.index} items={t.items} range={range} muted={t.mute} rec={t.rec || band} cursor={cursor} /><i style={{ left: cursorLeft }} /></div>
    </div>) : <div className="xs2-empty">Rien à afficher pour l’instant : lance une prise.</div>}
    <div className="sh-time">{clock(cursor - range.start)} / {clock(span)}</div>
  </div>;
}
