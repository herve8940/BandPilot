import { useCallback, useEffect, useRef, useState } from "react";

export type Take = { valid?:boolean; index: number; name: string; file: string; active: boolean };
export type Item = { pos: number; length: number; takes: Take[] };
export type ShowTrack = { id?:string; index: number; name: string; rec: boolean; role: string | null; mute: boolean; solo: boolean; armed: boolean; items: Item[] };
export type Song = { title: string; start: number; countin: number; stop: number };
export type Show = { original?:boolean; alive: boolean; installed?: boolean; rehearsal?: boolean; audio?: { inputs: number; rate: number; device: string }; bridgeCurrent?: string; version?: string; presence: string[]; project?: string; concert?: string | null; songs?: Song[]; regions?: { start: number; stop: number; name: string }[]; tracks?: ShowTrack[]; pos?: number; playing?: boolean; recording?: boolean; loop?: { on: boolean; start: number; stop: number }; length?: number };
export type Link = { state: "offline" | "ready" | "starting" | "recording" | "stopping" | "lost"; playing: boolean; recording: boolean; elapsed: number; clock: number; autoStopIn: number | null; markers: number; alert: string; session: { title: string } | null };

export async function call<T = unknown>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(path, { signal, method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const v = await r.json().catch(() => ({})); if (!r.ok) throw Error(v.error ?? "Erreur"); return v as T;
}
/** Schedule the next read after this one settles. A command can request a fresh read immediately. */
function useShowRead<T>(path: string, delay: number, initial: T) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let request: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      clearTimeout(timer);
      request?.abort();
      const current = new AbortController();
      request = current;
      try {
        const next = await call<T>(path, undefined, current.signal);
        if (!current.signal.aborted) { setValue(next); setError(""); }
      } catch (e) {
        if (!current.signal.aborted) setError((e as Error).message);
      } finally {
        if (!current.signal.aborted) timer = setTimeout(read, delay);
      }
    };
    refresh.current = read;
    void read();
    return () => { refresh.current = async () => {}; request?.abort(); clearTimeout(timer); };
  }, [path, delay]);
  const reload = useCallback(() => refresh.current(), []);
  return {value, error, reload};
}

export function useShow() {
  const project = useShowRead<Show>("/api/show", 2000, {alive: false, presence: []});
  const transport = useShowRead<Link | null>("/api/reaper", 400, null);
  const [error, setError] = useState("");
  const reload = project.reload;
  const act = useCallback(async (path: string, data: unknown = {}) => {
    setError("");
    try { const result = await call(path, data); void reload(); return result; }
    catch (e) { setError((e as Error).message); return null; }
  }, [reload]);
  return {show: project.value, link: transport.value, error: error || transport.error || project.error, setError, act, reload};
}
export const clock = (s: number) => { const v = Math.max(0, Math.floor(s)); const h = Math.floor(v / 3600), m = Math.floor(v / 60) % 60; return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
export const position = (show: Show, link: Link | null) => link && link.state !== "offline" ? link.clock : show.pos ?? 0;
/** What still prevents a good recording, in plain words. Empty when everything is fine. */
export function setupIssues(show: Show, consoleRate?: number, expectedInputs=18, modelLabel='la console') {
  const out: string[] = [], a = show.audio; if (!a) return out;
  // No name and no inputs: Reaper has simply not opened its device yet, and it does so when recording starts.
  if (a.inputs === 0 && !a.device) return out;
  if (expectedInputs===0) out.push(`${modelLabel} n’a pas d’interface USB multipiste vers l’ordinateur : l’enregistreur USB intégré est stéréo.`);
  else if (a.inputs < expectedInputs) out.push(`Reaper ne voit que ${a.inputs} entrées : vérifie le périphérique ${modelLabel} dans Préférences › Audio › Device (${expectedInputs} entrées attendues).`);
  if (a.rate && consoleRate && a.rate !== consoleRate) out.push(`La console est à ${consoleRate / 1000} kHz et Reaper à ${a.rate / 1000} kHz : mets-les à la même valeur.`);
  return out;
}
export const songAt = (songs: Song[], t: number) => { let i = 0; songs.forEach((s, k) => { if (s.start <= t + .05) i = k; }); return i; };
export const sectionName = (name: string) => name.split(" · ").at(-1) ?? name;
