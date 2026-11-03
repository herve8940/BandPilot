import { useCallback, useEffect, useState } from "react";

export type Take = { index: number; name: string; file: string; active: boolean };
export type Item = { pos: number; length: number; takes: Take[] };
export type ShowTrack = { index: number; name: string; rec: boolean; role: string | null; mute: boolean; solo: boolean; armed: boolean; items: Item[] };
export type Song = { title: string; start: number; countin: number; stop: number };
export type Show = { alive: boolean; installed?: boolean; rehearsal?: boolean; audio?: { inputs: number; rate: number; device: string }; bridgeCurrent?: string; version?: string; presence: string[]; project?: string; concert?: string | null; songs?: Song[]; regions?: { start: number; stop: number; name: string }[]; tracks?: ShowTrack[]; pos?: number; playing?: boolean; recording?: boolean; loop?: { on: boolean; start: number; stop: number }; length?: number };
export type Link = { state: "offline" | "ready" | "starting" | "recording" | "stopping" | "lost"; playing: boolean; recording: boolean; elapsed: number; clock: number; autoStopIn: number | null; markers: number; alert: string; session: { title: string } | null };

export async function call<T = unknown>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(path, { method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const v = await r.json().catch(() => ({})); if (!r.ok) throw Error(v.error ?? "Erreur"); return v as T;
}
/** Everything shown comes from Reaper: fast for the transport, slower for the project. */
export function useShow() {
  const [show, setShow] = useState<Show>({ alive: false, presence: [] }), [link, setLink] = useState<Link | null>(null), [error, setError] = useState(""), [lost, setLost] = useState("");
  const reload = useCallback(() => call<Show>("/api/show").then(s => { setShow(s); setLost(""); }).catch(e => setLost(e.message)), []);
  useEffect(() => { void reload(); const t = setInterval(() => void reload(), 2000); return () => clearInterval(t); }, [reload]);
  useEffect(() => { let on = true; const poll = () => void call<Link>("/api/reaper").then(l => { if (on) setLink(l); }).catch(e => { if (on) setLost(e.message); }); poll(); const t = setInterval(poll, 400); return () => { on = false; clearInterval(t); }; }, []);
  const act = useCallback(async (path: string, data: unknown = {}) => { setError(""); try { const r = await call(path, data); void reload(); return r; } catch (e) { setError((e as Error).message); return null; } }, [reload]);
  return { show, link, error: error || lost, setError, act, reload };
}
export const clock = (s: number) => { const v = Math.max(0, Math.floor(s)); const h = Math.floor(v / 3600), m = Math.floor(v / 60) % 60; return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
export const position = (show: Show, link: Link | null) => link && link.state !== "offline" ? link.clock : show.pos ?? 0;
/** What still prevents a good recording, in plain words. Empty when everything is fine. */
export function setupIssues(show: Show, consoleRate?: number) {
  const out: string[] = [], a = show.audio; if (!a) return out;
  // No name and no inputs: Reaper has simply not opened its device yet, and it does so when recording starts.
  if (a.inputs === 0 && !a.device) return out;
  if (a.inputs < 18) out.push(`Reaper ne voit que ${a.inputs} entrées : choisis la XR18 dans Préférences › Audio › Device, en 18×18.`);
  if (a.rate && consoleRate && a.rate !== consoleRate) out.push(`La console est à ${consoleRate / 1000} kHz et Reaper à ${a.rate / 1000} kHz : mets-les à la même valeur.`);
  return out;
}
export const songAt = (songs: Song[], t: number) => { let i = 0; songs.forEach((s, k) => { if (s.start <= t + .05) i = k; }); return i; };
export const sectionName = (name: string) => name.split(" · ").at(-1) ?? name;
