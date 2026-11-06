import {tx, getLocale} from "./i18n";
import "./studio-control.css";
import { useEffect, useState } from "react";
import { PlanDialog, type Plan } from "./SoundCoach";

type Entry = { id: string; kind: string; name: string; data: unknown; createdAt: string };
type BalanceSheet = {sceneId:string;notes:string;updatedAt:string;patchChanged?:boolean};
type Change = { address: string; before: string | number; after: string | number };
type Pending = { plan: Plan; apply: () => Promise<string> };

async function api<T = any>(path: string, method = "GET", data?: unknown): Promise<T> {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const value = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(value.error || "Erreur serveur");
  return value as T;
}
const when = (iso: string) => new Date(iso).toLocaleString(getLocale(), { dateStyle: "short", timeStyle: "short" });
// Saves made by the app itself before a change ("Avant …") are kept apart so they don't drown the user's scenes.
const isAuto = (e: Entry) => e.kind === "parameter-backup" || (e.kind === "scene" && /^Avant /.test(e.name));
const KIND_LABEL: Record<string, string> = { scene: "Scène complète", "native-scene": "Fichier .scn", "parameter-backup": "Sauvegarde automatique" };

export function ScenesPage({ mode, canWrite }: { mode: "real" | "simulation"; canWrite: boolean }) {
  const [admin, setAdmin] = useState(false);
  useEffect(() => { void api<{ user: { role: string } | null }>("/api/auth").then(a => setAdmin(a.user?.role === "admin")).catch(() => undefined); }, []);
  const [entries, setEntries] = useState<Entry[]>([]), [name, setName] = useState(""), [busy, setBusy] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null), [applying, setApplying] = useState(false);
  const [group,setGroup]=useState(""),[sheetScene,setSheetScene]=useState(""),[sheetNotes,setSheetNotes]=useState("");
  const refresh = async () => setEntries(await api<Entry[]>("/api/library"));
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
  const run = async (label: string, task: () => Promise<string | void>) => {
    setBusy(label); setMessage(""); setError("");
    try { const done = await task(); await refresh(); if (done) setMessage(done); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  };

  const scenes = entries.filter(e => ["scene", "native-scene"].includes(e.kind) && !isAuto(e));
  const autos = entries.filter(isAuto).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /** Build the "check before" window for any kind of saved state. */
  const recall = (e: Entry) => run(`recall-${e.id}`, async () => {
    if (e.kind === "parameter-backup") {
      const plan = await api<Plan>("/api/console/restore", "POST", { backupId: e.id });
      setPending({ plan: { ...plan, title: `Revenir à « ${e.name} »`, explanation: `La console reprend les réglages sauvegardés le ${when(e.createdAt)}. Seuls les réglages concernés par cette sauvegarde bougent.` },
        apply: async () => { const r = await api<{ failed?: unknown[] }>("/api/console/apply", "POST", { token: plan.token, confirm: true, tolerant: true }); return r.failed?.length ? `Rappel fait, ${r.failed.length} réglage(s) non confirmé(s) par la console.` : `« ${e.name} » est rappelée.`; } });
      return;
    }
    if (e.kind === "scene" && mode === "real") {
      // Complete scene on the real console: only the settings that differ are sent (48 V excluded).
      const p = await api<{ token: string; changes: Change[]; fxSlots: number[] }>("/api/mixer-sync/preview", "POST", { sourceId: e.id, includePhantom: false });
      setPending({ plan: { token: p.token, title: `Rappeler « ${e.name} »`, explanation: `Toute la console reprend la scène du ${when(e.createdAt)}${p.fxSlots.length ? ` (effets ${p.fxSlots.join(", ")} compris)` : ""}. Le 48 V n’est jamais changé. Baisse le son de la sono avant : volumes, mutes et routages peuvent bouger.`, inputs: [], changes: p.changes },
        apply: async () => { await api("/api/mixer-sync/apply", "POST", { token: p.token, confirm: true, allowPhantom: false }); return `« ${e.name} » est rappelée. La console d’avant est gardée dans les sauvegardes automatiques.`; } });
      return;
    }
    // Simulation, or a .scn file: recall through the library (48 V only with an explicit yes).
    const p = await api<{ token: string }>(`/api/library/${e.id}/preview`, "POST", {excludePhantom:true});
    setPending({ plan: { token: p.token, title: `Rappeler « ${e.name} »`, explanation: `Le 48 V reste inchangé pour les scènes BandPilot. Toute la console reprend ${e.kind === "native-scene" ? "ce fichier .scn" : "cette scène"}. Baisse le son de la sono avant : volumes, mutes et routages peuvent bouger.`, inputs: [], changes: [], detailsUnavailable: true },
      apply: async () => {
        const native = e.kind === "native-scene";
        const allowPhantom = native && confirm(tx("Ce fichier .scn contient aussi l’alimentation 48 V des micros. L’appliquer peut faire claquer la sono : vérifie que les sorties sont basses. Continuer ?"));
        if (native && !allowPhantom) return "Rappel annulé : rien n’a changé.";
        const r = await api<{ ok?: boolean }>(`/api/library/${e.id}/apply`, "POST", { token: p.token, confirm: true, allowPhantom });
        return r.ok === false ? "Rappel envoyé, mais certaines valeurs relues diffèrent : vérifie la console." : `« ${e.name} » est rappelée.`;
      } });
  });

  const applyPending = async () => {
    if (!pending) return; setApplying(true);
    try { const done = await pending.apply(); setPending(null); setMessage(done); await refresh(); } catch (e) { setPending(null); setError((e as Error).message); } finally { setApplying(false); }
  };
  const remove = (e: Entry) => { if (confirm(tx(`Supprimer « ${e.name} » ?`))) void run(`del-${e.id}`, async () => { await api(`/api/library/${e.id}`, "DELETE"); }); };
  const removeOldAutos = () => { const old = autos.slice(10); if (old.length && confirm(tx(`Supprimer les ${old.length} sauvegardes automatiques les plus anciennes ? Les 10 plus récentes sont gardées.`))) void run("clean", async () => { for (const e of old) await api(`/api/library/${e.id}`, "DELETE"); return `${old.length} anciennes sauvegardes supprimées.`; }); };
  const download = (e: Entry) => {
    const native = e.kind === "native-scene";
    const blob = new Blob([native ? String(e.data) : JSON.stringify(e, null, 2)], { type: native ? "text/plain" : "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = e.name.replace(/[^\p{L}\p{N}_-]/gu, "_") + (native ? ".scn" : ".json"); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importFile = (file: File) => run("import", async () => {
    if (file.size > 900000) throw Error("Fichier trop volumineux");
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".scn")) await api("/api/library", "POST", { kind: "native-scene", name: file.name, data: text });
    else { const v = JSON.parse(text); if (v.kind !== "scene") throw Error("Ce fichier n’est pas une scène BandPilot"); await api("/api/library", "POST", { kind: v.kind, name: v.name, data: v.data }); }
    return `« ${file.name} » est importée. Clique sur « Rappeler… » pour l’envoyer à la console.`;
  });

  const row = (e: Entry) => <div key={e.id} className="scene-row">
    <div><b>{e.name}</b><small>{tx(KIND_LABEL[e.kind] ?? e.kind)} · {tx(when(e.createdAt))}</small></div>
    <div className="scene-actions">
      {admin && <button type="button" className="primary" disabled={!!busy || !canWrite} title={tx(canWrite ? "Voir ce qui va changer, puis confirmer" : "Active le contrôle de la console dans Réglages")} onClick={() => void recall(e)}>{tx(busy === `recall-${e.id}` ? "Lecture de la console…" : "Rappeler…")}</button>}
      <button type="button" disabled={!!busy} onClick={() => download(e)}>{tx("Exporter")}</button>
      {admin && <button type="button" disabled={!!busy} onClick={() => remove(e)}>{tx("Supprimer")}</button>}
    </div>
  </div>;

  return <section className="studio-panel pad studio-control scenes-page">
    <h2>{tx("Scènes")}</h2>
    <p>{tx("Une scène, c’est une photo de toute la console : volumes, égaliseurs, effets, retours… Garde une bonne balance pour la retrouver au prochain concert.")}</p>
    {admin && <fieldset disabled={!!busy} className="scene-save">
      <label>{tx("Nom de la scène")}<input value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder={tx("Ex. : Concert salle des fêtes")} /></label>
      <button type="button" className="primary" disabled={!name.trim()} onClick={() => void run("save", async () => { await api("/api/library", "POST", { kind: "scene", name: name.trim(), complete: true }); setName(""); return `Scène « ${name.trim()} » sauvegardée.`; })}>{tx(busy === "save" ? "Lecture de toute la console…" : "Sauvegarder l’état actuel")}</button>
      <details className="scene-more"><summary>{tx("Plus d’options")}</summary>
        <button type="button" disabled={!name.trim()} onClick={() => void run("save", async () => { await api("/api/library", "POST", { kind: "scene", name: name.trim(), complete: true, excludePhantom: true }); setName(""); return `Scène « ${name.trim()} » sauvegardée sans le 48 V.`; })}>{tx("Sauvegarder sans le 48 V (pour ReaCue)")}</button>
        <button type="button" disabled={!name.trim()} onClick={() => void run("save", async () => { await api("/api/library/capture-native", "POST", { name: name.trim() }); setName(""); return `Fichier .scn « ${name.trim()} » créé : tu peux l’exporter et l’ouvrir dans X-AIR Edit.`; })}>{tx("Créer un fichier .scn (compatible X-AIR Edit)")}</button>
        <label className="scene-import">{tx("Importer une scène (.json ou .scn)")}<input type="file" accept=".json,.scn" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importFile(f); }} /></label>
      </details>
    </fieldset>}
    {(message || error) && <p className={error ? "scene-msg error" : "scene-msg"} role={error ? "alert" : "status"}>{tx(error || message)}</p>}
    <section className="scene-list" aria-label={tx("Fiches de balance")}>
      <h3>{tx("Fiches de balance")}</h3>
      <p>{tx("Retrouve une scène validée, ses retours et les points à revérifier à la prochaine balance.")}</p>
      {admin&&<form className="scene-save" onSubmit={event=>{
        event.preventDefault();
        void run("balance-sheet",async()=>{
          await api("/api/library","POST",{kind:"balance-sheet",name:group.trim(),data:{sceneId:sheetScene,notes:sheetNotes}});
          return "Fiche de balance enregistrée.";
        });
      }}>
        <label>{tx("Nom du groupe")}<input required maxLength={120} value={group} onChange={e=>setGroup(e.target.value)}/></label>
        <label>{tx("Scène validée")}<select required value={sheetScene} onChange={e=>setSheetScene(e.target.value)}>
          <option value="">{tx("Choisir une scène complète")}</option>
          {scenes.filter(e=>e.kind==="scene"&&(e.data as {version?:number})?.version===2).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
        </select></label>
        <label>{tx("Notes de répétition et points à vérifier")}<textarea maxLength={4000} value={sheetNotes} onChange={e=>setSheetNotes(e.target.value)}/></label>
        <button disabled={!!busy||!group.trim()||!sheetScene}>{tx("Enregistrer la fiche")}</button>
      </form>}
      {entries.filter(e=>e.kind==="balance-sheet").sort((a,b)=>(b.data as BalanceSheet).updatedAt.localeCompare((a.data as BalanceSheet).updatedAt)).map(e=>{
        const sheet=e.data as BalanceSheet, scene=scenes.find(s=>s.id===sheet.sceneId);
        return <article className="scene-row" key={e.id}>
          <div><b>{e.name}</b><small>{scene?.name??tx("Scène indisponible")} · {when(sheet.updatedAt)}</small><p style={{whiteSpace:"pre-wrap"}}>{sheet.notes}</p>{sheet.patchChanged&&<p role="status">{tx("Le câblage ou les retours déclarés ont changé depuis cette fiche. Vérifie la fiche technique avant le rappel.")}</p>}</div>
          {admin&&<div className="scene-actions">
            <button type="button" disabled={!scene||!!busy} onClick={()=>{if(scene)void recall(scene);}}>{tx("Préparer le rappel")}</button>
            <button type="button" onClick={()=>{setGroup(e.name);setSheetScene(scene?.id??"");setSheetNotes(sheet.notes);}}>{tx("Modifier")}</button>
            <button type="button" disabled={!!busy} onClick={()=>remove(e)}>{tx("Supprimer")}</button>
          </div>}
        </article>;
      })}
    </section>
    <h3>{tx("Tes scènes (")}{tx(scenes.length)})</h3>
    {scenes.length ? <div className="scene-list">{tx(scenes.map(row))}</div> : <p className="scene-empty">{tx("Aucune scène pour l’instant. Donne un nom ci-dessus et sauvegarde l’état actuel de la console.")}</p>}
    <details className="scene-autos">
      <summary>{tx("Sauvegardes automatiques (")}{tx(autos.length)}{tx(") — faites par l’appli juste avant chaque changement")}</summary>
      <p>{tx("Elles servent à revenir en arrière. Les 10 plus récentes sont affichées.")}</p>
      <div className="scene-list">{tx(autos.slice(0, 10).map(row))}</div>
      {admin && autos.length > 10 && <button type="button" disabled={!!busy} onClick={removeOldAutos}>{tx("Supprimer les ")}{tx(autos.length - 10)}{tx(" plus anciennes")}</button>}
    </details>
    {pending && <PlanDialog plan={pending.plan} busy={applying} canApply={canWrite} mode={mode} onClose={() => setPending(null)} onApply={() => void applyPending()} />}
  </section>;
}
