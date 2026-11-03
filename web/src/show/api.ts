import { useCallback, useEffect, useState } from "react";

export type Take = { index: number; name: string; file: string; active: boolean };
export type Item = { pos: number; length: number; takes: Take[] };
export type ShowTrack = { index: number; name: string; rec: boolean; role: string | null; mute: boolean; solo: boolean; armed: boolean; items: Item[] };
export type Song = { title: string; start: number; countin: number; stop: number };
export type Show = { alive: boolean; bridgeCurrent?: string; version?: string; presence: string[]; project?: string; concert?: string | null; songs?: Song[]; regions?: { start: number; stop: number; name: string }[]; tracks?: ShowTrack[]; pos?: number; playing?: boolean; recording?: boolean; loop?: { on: boolean; start: number; stop: number }; length?: number };
export type Link = { state: "offline" | "ready" | "starting" | "recording" | "stopping" | "lost"; recording: boolean; elapsed: number; clock: number; autoStopIn: number | null; markers: number; alert: string; session: { title: string } | null };

export async function call<T = unknown>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(path, { method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const v = await r.json().catch(() => ({})); if (!r.ok) throw Error(v.error ?? "Erreur"); return v as T;
}
/** Everything shown comes from Reaper: fast for the transport, slower for the project. */
export function useShow() {
  const [show, setShow] = useState<Show>({ alive: false, presence: [] }), [link, setLink] = useState<Link | null>(null), [error, setError] = useState("");
  const reload = useCallback(() => call<Show>("/api/show").then(setShow).catch(e => setError(e.message)), []);
  useEffect(() => { void reload(); const t = setInterval(() => void reload(), 2000); return () => clearInterval(t); }, [reload]);
  useEffect(() => { let on = true; const poll = () => void call<Link>("/api/reaper").then(l => { if (on) setLink(l); }).catch(e => { if (on) setError(e.message); }); poll(); const t = setInterval(poll, 400); return () => { on = false; clearInterval(t); }; }, []);
  const act = useCallback(async (path: string, data: unknown = {}) => { setError(""); try { const r = await call(path, data); void reload(); return r; } catch (e) { setError((e as Error).message); return null; } }, [reload]);
  return { show, link, error, setError, act, reload };
}
export const clock = (s: number) => { const v = Math.max(0, Math.floor(s)); const h = Math.floor(v / 3600), m = Math.floor(v / 60) % 60; return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
export const position = (show: Show, link: Link | null) => (show.playing || link?.recording) && link ? link.clock : show.pos ?? 0;
export const songAt = (songs: Song[], t: number) => { let i = 0; songs.forEach((s, k) => { if (s.start <= t + .05) i = k; }); return i; };
export const sectionName = (name: string) => name.split(" · ").at(-1) ?? name;
