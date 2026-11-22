import {PortableScenesPanel} from './PortableScenesPanel';
import {OutputProtectionsPanel} from './OutputProtectionsPanel';
import {OutputSceneRecallPanel} from './OutputSceneRecallPanel';
import {SceneProtectionsPanel} from './SceneProtectionsPanel';
import {Layers, SlidersHorizontal, ClipboardList, History, Upload, Save, Download, Trash2, RotateCcw} from "lucide-react";
import {tx, getLocale} from "./i18n";
import "./studio-control.css";
import { useEffect, useRef, useState } from "react";
import { PlanDialog, type Plan } from "./SoundCoach";
import {ChannelPresetsPanel} from './ChannelPresetsPanel';
import {parseLibraryFile} from './library-files';
import type {ChannelPreset,PresetSection} from '../../shared/channel-preset';
import {SceneRecallPanel} from './SceneRecallPanel';

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
const isAuto = (e: Entry) => ['parameter-backup','fx-backup','scene-recall-backup','output-recall-backup','channel-operation-backup','mix-preparation-backup','portable-scene-backup'].includes(e.kind) || (['scene','native-scene'].includes(e.kind) && /^(Avant |Sauvegarde (complète avant|avant))/.test(e.name));
const KIND_LABEL: Record<string, string> = { scene: "Scène complète", "native-scene": "Fichier .scn", "parameter-backup": "Sauvegarde automatique", 'fx-backup':'Sauvegarde FX', 'output-recall-backup':'Sauvegarde des sorties et FX','scene-recall-backup':'Sauvegarde du rappel sélectif','channel-operation-backup':'Sauvegarde des entrées','mix-preparation-backup':'Sauvegarde de préparation du mix','portable-scene-backup':'Sauvegarde du rappel portable' };

export function ScenesPage({ mode, canWrite }: { mode: "real" | "simulation"; canWrite: boolean }) {
  const [section,setSection]=useState("scenes");
  const [outputBackup,setOutputBackup]=useState<Entry|null>(null);
  const [selective,setSelective]=useState<Entry|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => { void api<{ user: { role: string } | null }>("/api/auth").then(a => setAdmin(a.user?.role === "admin")).catch(() => undefined); }, []);
  const [entries, setEntries] = useState<Entry[]>([]), [name, setName] = useState(""), [busy, setBusy] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null), [applying, setApplying] = useState(false);
  const [group,setGroup]=useState(""),[sheetScene,setSheetScene]=useState(""),[sheetNotes,setSheetNotes]=useState("");
  const refresh = async () => setEntries(await api<Entry[]>("/api/library"));
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
  const run = async (label: string, task: () => Promise<string | void>) => {
    setBusy(label); setMessage(""); setError("");
    try { const done = await task(); await refresh(); if (done) setMessage(done); }
    catch (e) { setError((e as Error).message); await refresh().catch(()=>undefined); }
    finally { setBusy(""); }
  };

  const scenes = entries.filter(e => ["scene", "native-scene"].includes(e.kind) && !isAuto(e));
  const autos = entries.filter(isAuto).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /** Build the "check before" window for any kind of saved state. */
  const recall = (e: Entry,slot?:number) => run(`recall-${e.id}`, async () => {
    if(e.kind==='output-recall-backup'){setOutputBackup(e);return;}
    if(e.kind==='scene-recall-backup'||e.kind==='channel-operation-backup'||e.kind==='mix-preparation-backup'||e.kind==='portable-scene-backup'){
      const p=await api<{token:string|null;changes:Change[];stereoLink?:Plan['stereoLink'];excluded?:Plan['excluded']}>(`/api/library/${e.id}/preview`,'POST',{});
      if(!p.token)return p.excluded?.length?'Les protections conservent les réglages concernés. Aucun changement à appliquer.':'Rien ne change dans la sélection. Aucun réglage envoyé.';
      setPending({plan:{...p,token:p.token,title:tx(e.kind==='channel-operation-backup'?'Revenir au réglage précédent':'Annuler le rappel sélectif'),explanation:tx('Seuls les réglages de cette sauvegarde seront restaurés.'),inputs:[]},apply:async()=>{await api(`/api/library/${e.id}/apply`,'POST',{token:p.token,confirm:true});return 'Sélection appliquée. Les réglages précédents sont dans l’historique.';}});return;
    }
    if(e.kind==='fx'||e.kind==='fx-backup'){
      const p=await api<{token:string;slot:number}>(`/api/library/${e.id}/preview`, 'POST', {slot});
      setPending({plan:{token:p.token,title:`Rappeler « ${e.name} »`,explanation:tx('Ce preset remplace l’effet de l’emplacement indiqué. Tous les canaux qui l’utilisent sont concernés. Les envois et retours restent inchangés.'),inputs:[`FX ${p.slot}`],changes:[],detailsUnavailable:true},apply:async()=>{await api(`/api/library/${e.id}/apply`,'POST',{token:p.token,confirm:true});return 'Effet rappelé. Le réglage précédent est sauvegardé.';}});return;
    }
    if (e.kind === "parameter-backup") {
      const plan = await api<Plan>("/api/console/restore", "POST", { backupId: e.id });
      setPending({ plan: { ...plan, title: `Revenir à « ${e.name} »`, explanation: `La console reprend les réglages sauvegardés le ${when(e.createdAt)}. Seuls les réglages concernés par cette sauvegarde bougent.` },
        apply: async () => { const r = await api<{ failed?: unknown[] }>("/api/console/apply", "POST", { token: plan.token, confirm: true, tolerant: true }); return r.failed?.length ? `Rappel fait, ${r.failed.length} réglage(s) non confirmé(s) par la console.` : `« ${e.name} » est rappelée.`; } });
      return;
    }
    if(e.kind==='native-scene'){
      const p=await api<{token:string;changes:Change[];fxSlots:number[];omitted:string[]}>(`/api/library/${e.id}/preview`,'POST');
      setPending({plan:{token:p.token,title:`Rappeler « ${e.name} »`,
        explanation:tx('Les réglages présents dans ce fichier .scn seront rappelés, effets compris. Le 48 V reste inchangé. Baisse le son de la sono avant : volumes, mutes et routages peuvent bouger.')+(p.omitted.length?' '+tx('Les entrées 17 à 24 sans préampli physique restent uniquement dans le fichier exporté.'):''),
        inputs:p.fxSlots.map(slot=>`FX ${slot}`),changes:p.changes,fxChanged:p.fxSlots.length>0},apply:async()=>{
          await api(`/api/library/${e.id}/apply`,'POST',{token:p.token,confirm:true});
          return 'Scène .scn rappelée, effets compris. L’état précédent est dans les sauvegardes automatiques. Le 48 V est resté inchangé.';
        }});return;
    }
    if (e.kind === "scene" && mode === "real") {
      // Complete scene on the real console: only the settings that differ are sent (48 V excluded).
      const p = await api<{ token: string; changes: Change[]; fxSlots: number[] }>("/api/mixer-sync/preview", "POST", { sourceId: e.id, includePhantom: false });
      setPending({ plan: { token: p.token, title: `Rappeler « ${e.name} »`, explanation: `Toute la console reprend la scène du ${when(e.createdAt)}${p.fxSlots.length ? ` (effets ${p.fxSlots.join(", ")} compris)` : ""}. Le 48 V n’est jamais changé. Baisse le son de la sono avant : volumes, mutes et routages peuvent bouger.`, inputs: [], changes: p.changes },
        apply: async () => { await api("/api/mixer-sync/apply", "POST", { token: p.token, confirm: true, allowPhantom: false }); return `« ${e.name} » est rappelée. La console d’avant est gardée dans les sauvegardes automatiques.`; } });
      return;
    }
    // BandPilot scene in simulation: phantom power remains unchanged.
    const p = await api<{ token: string }>(`/api/library/${e.id}/preview`, "POST", {excludePhantom:true});
    setPending({ plan: { token: p.token, title: `Rappeler « ${e.name} »`, explanation: tx('Le 48 V reste inchangé pour les scènes BandPilot. Toute la console reprend cette scène. Baisse le son de la sono avant : volumes, mutes et routages peuvent bouger.'), inputs: [], changes: [], detailsUnavailable: true },
      apply: async () => {
        const r = await api<{ ok?: boolean }>(`/api/library/${e.id}/apply`, "POST", { token: p.token, confirm: true, allowPhantom:false });
        return r.ok === false ? "Rappel envoyé, mais certaines valeurs relues diffèrent : vérifie la console." : `« ${e.name} » est rappelée.`;
      } });
  });

  const applyPending = async () => {
    if (!pending) return; setApplying(true);
    try { const done = await pending.apply(); setPending(null); setMessage(done); await refresh(); }
    catch (e) { setPending(null); setError((e as Error).message); await refresh().catch(()=>undefined); }
    finally { setApplying(false); }
  };
  const remove = (e: Entry) => { if (confirm(tx(`Supprimer « ${e.name} » ?`))) void run(`del-${e.id}`, async () => { await api(`/api/library/${e.id}`, "DELETE"); }); };
  const removeOldAutos = () => { const old = autos.slice(10); if (old.length && confirm(tx(`Supprimer les ${old.length} sauvegardes automatiques les plus anciennes ? Les 10 plus récentes sont gardées.`))) void run("clean", async () => { for (const e of old) await api(`/api/library/${e.id}`, "DELETE"); return `${old.length} anciennes sauvegardes supprimées.`; }); };
  const download = (e: Entry) => { void run('export',async()=>{
    const native = e.kind === "native-scene";
    const content=native ? String(e.data) : JSON.stringify(e.kind==='fx-backup'?{...e,kind:'fx'}:e, null, 2);
    const filename=e.name.replace(/[^\p{L}\p{N}_-]/gu, "_") + (native ? ".scn" : ".json");
    const desktop=(window as unknown as {bandpilotFiles?:{save:(input:{filename:string;content:string})=>Promise<{saved?:boolean;cancelled?:boolean;error?:string}>}}).bandpilotFiles;
    if(desktop){const result=await desktop.save({filename,content});if(result.error)throw Error(result.error);return result.saved?'Fichier exporté.':undefined;}
    const blob = new Blob([content], { type: native ? "text/plain" : "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'Export lancé dans les téléchargements.';
  });};
  const importFile = (file: File) => run("import", async () => {
    if (file.size > 900000) throw Error("Fichier trop volumineux");
    const text = await file.text();
    const parsed=parseLibraryFile(file.name,text);
    await api('/api/library','POST',parsed);
    if(parsed.kind==='portable-scene')setSection('portable');
    return 'Import terminé dans ta bibliothèque. Aucun réglage envoyé à la console.';
  });
  const recallPreset=(e:Entry,channel:number,sections:PresetSection[])=>{void run(`recall-${e.id}`,async()=>{
    const p=await api<{token:string;changes:Change[]}>(`/api/library/${e.id}/preview`,'POST',{channel,sections});
    if(!p.token)return 'Rien ne change dans la sélection. Aucun réglage envoyé.';
    const stereo=(e.data as ChannelPreset).version===2;
    setPending({plan:{...p,title:`Rappeler « ${e.name} »`,explanation:tx(stereo?'Seuls les traitements cochés seront appliqués aux deux entrées.':'Seuls les traitements cochés seront appliqués au canal choisi.'),inputs:[stereo?`${tx('Paire stéréo')} ${channel}–${channel+1}`:`${tx('Canal')} ${channel}`]},apply:async()=>{await api(`/api/library/${e.id}/apply`,'POST',{token:p.token,confirm:true});return 'Preset appliqué. Les réglages précédents sont dans les sauvegardes automatiques.';}});
  });};

  const row = (e: Entry) => <div key={e.id} className="scene-row">
    <span className="library-icon">{isAuto(e)?<History size={20}/>:<Layers size={20}/>}</span><div className="scene-row-title"><b>{isAuto(e)?tx(e.name):e.name}</b><small>{tx(KIND_LABEL[e.kind] ?? e.kind)} · {tx(when(e.createdAt))}</small></div>
    <div className="scene-actions">
      {admin && <button type="button" className="primary" disabled={!!busy || !canWrite} title={tx(canWrite ? "Voir ce qui va changer, puis confirmer" : "Active le contrôle de la console dans Réglages")} onClick={() => void recall(e)}><RotateCcw size={15}/>{tx(busy === `recall-${e.id}` ? "Lecture de la console…" : "Rappeler…")}</button>}
      {admin&&(e.kind==='native-scene'||e.kind==='scene'&&(e.data as {version?:number})?.version===2)&&<button type="button" disabled={!!busy||applying||!canWrite} onClick={()=>setSelective(e)}><SlidersHorizontal size={15}/>{tx('Rappel sélectif…')}</button>}
      {!['scene-recall-backup','output-recall-backup','channel-operation-backup','mix-preparation-backup','portable-scene-backup'].includes(e.kind)&&<button type="button" disabled={!!busy} onClick={() => download(e)}><Download size={15}/>{tx("Exporter")}</button>}
      {admin && <button type="button" disabled={!!busy} onClick={() => remove(e)}><Trash2 size={15}/>{tx("Supprimer")}</button>}
    </div>
  </div>;

  return <section className="studio-panel pad studio-control scenes-page">
    <header className="library-header">
      <div className="library-title"><span className="library-emblem"><Layers size={26}/></span><div><span className="library-eyebrow">{tx('TES RÉGLAGES, À PORTÉE DE MAIN')}</span><h2>{tx("Scènes et presets")}</h2><p>{tx('Une balance complète ou le son d’un instrument, à retrouver au bon moment.')}</p></div></div>
      {admin&&<div className="scene-import-toolbar"><button type="button" disabled={!!busy||applying} onClick={()=>fileInput.current?.click()}><Upload size={17}/>{tx('Importer une scène ou un preset')}</button><input ref={fileInput} type="file" hidden aria-label={tx('Importer une scène ou un preset')} disabled={!!busy} accept=".json,.scn" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importFile(file);}}/><small>.json · .scn</small></div>}
    </header>
    <nav className="library-nav" aria-label={tx('Bibliothèque de réglages')}>
      {[{id:'scenes',label:'Scènes complètes',count:scenes.length,Icon:Layers},{id:'portable',label:'Scènes portables',count:entries.filter(e=>e.kind==='portable-scene').length,Icon:Layers},{id:'presets',label:'Presets par piste',count:entries.filter(e=>['channel-preset','fx'].includes(e.kind)).length,Icon:SlidersHorizontal},{id:'sheets',label:'Fiches de balance',count:entries.filter(e=>e.kind==='balance-sheet').length,Icon:ClipboardList},{id:'history',label:'Historique',count:autos.length,Icon:History}].map(({id,label,count,Icon})=><button key={id} type="button" aria-pressed={section===id} onClick={()=>setSection(id)}><Icon size={18}/><span>{tx(label)}</span><small>{count}</small></button>)}
    </nav>
    {(message || error) && <p className={error ? "scene-msg error" : "scene-msg"} role={error ? "alert" : "status"}>{tx(error || message)}</p>}
    {error&&/partiel/.test(error)&&autos.length>0&&<button type="button" onClick={()=>setSection('history')}><History size={16}/>{tx('Voir les sauvegardes automatiques')}</button>}
    <div hidden={section!=='scenes'} className="library-section">
    {admin&&<SceneProtectionsPanel disabled={!!busy||applying} onSaved={()=>{setPending(null);}}/>}
    {admin&&<OutputProtectionsPanel/>}
    {outputBackup&&<><button type="button" onClick={()=>setOutputBackup(null)}>{tx('Fermer')}</button><OutputSceneRecallPanel key={outputBackup.id} entry={outputBackup} canWrite={canWrite} onUpdated={refresh}/></>}
    {selective&&<SceneRecallPanel key={`${selective.id}-${mode}`} entry={selective} mode={mode} canWrite={canWrite} onClose={()=>setSelective(null)} onUpdated={refresh}/>}
    <div className="library-section-heading"><div><h3>{tx('Scènes complètes')}</h3><p>{tx("Une scène, c’est une photo de toute la console : volumes, égaliseurs, effets, retours… Garde une bonne balance pour la retrouver au prochain concert.")}</p></div></div>
    <div className="library-capture">
    {admin && <fieldset disabled={!!busy} className="scene-save">
      <label>{tx("Nom de la scène")}<input value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder={tx("Ex. : Concert salle des fêtes")} /></label>
      <button type="button" className="primary" disabled={!name.trim()} onClick={() => void run("save", async () => { await api("/api/library", "POST", { kind: "scene", name: name.trim(), complete: true }); setName(""); return `Scène « ${name.trim()} » sauvegardée.`; })}><Save size={17}/>{tx(busy === "save" ? "Lecture de toute la console…" : "Sauvegarder l’état actuel")}</button>
      <details className="scene-more"><summary>{tx("Plus d’options")}</summary>
        <button type="button" disabled={!name.trim()} onClick={() => void run("save", async () => { await api("/api/library", "POST", { kind: "scene", name: name.trim(), complete: true, excludePhantom: true }); setName(""); return `Scène « ${name.trim()} » sauvegardée sans le 48 V.`; })}>{tx("Sauvegarder sans le 48 V (pour ReaCue)")}</button>
        <button type="button" disabled={!name.trim()} onClick={() => void run("save", async () => { await api("/api/library/capture-native", "POST", { name: name.trim() }); setName(""); return `Fichier .scn « ${name.trim()} » créé : tu peux l’exporter et l’ouvrir dans X-AIR Edit.`; })}>{tx("Créer un fichier .scn (compatible X-AIR Edit)")}</button>
      </details>
    </fieldset>}
    </div>
    <div className="library-section-heading"><h3>{tx('Tes scènes (')}{scenes.length})</h3></div>
    {scenes.length ? <div className="scene-list">{scenes.map(row)}</div> : <p className="library-empty">{tx("Aucune scène pour l’instant. Donne un nom ci-dessus et sauvegarde l’état actuel de la console.")}</p>}
    </div>
    {section==='portable'&&<PortableScenesPanel key={mode} entries={entries.filter(e=>e.kind==='portable-scene')}
      sources={scenes.filter(e=>e.kind==='native-scene'||(e.data as {version?:number}).version===2)}
      admin={admin} busy={!!busy||applying} canWrite={canWrite} run={run} onExport={download} onRemove={remove}
      onPreview={(e,plan)=>setPending({plan,apply:async()=>{
        await api(`/api/library/${e.id}/apply`,'POST',{token:plan.token,confirm:true});
        return 'Sélection appliquée. Les réglages précédents sont dans l’historique.';
      }})}/>}
    <div hidden={section!=='presets'} className="library-section"><ChannelPresetsPanel entries={entries} admin={admin} busy={!!busy||applying} canWrite={canWrite} run={run} onRecall={recallPreset} onRecallFx={(e,slot)=>void recall(e,slot)} onExport={download} onRemove={remove}/></div>
    <div hidden={section!=='sheets'} className="library-section">
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
    </div>
    <div hidden={section!=='history'} className="library-section">
    <details className="scene-autos" open>
      <summary>{tx("Sauvegardes automatiques (")}{tx(autos.length)}{tx(") — faites par l’appli juste avant chaque changement")}</summary>
      <p>{tx("Elles servent à revenir en arrière. Les 10 plus récentes sont affichées.")}</p>
      <div className="scene-list">{tx(autos.slice(0, 10).map(row))}</div>
      {admin && autos.length > 10 && <button type="button" disabled={!!busy} onClick={removeOldAutos}>{tx("Supprimer les ")}{tx(autos.length - 10)}{tx(" plus anciennes")}</button>}
    </details>
    </div>
    {pending && <PlanDialog plan={pending.plan} busy={applying} canApply={canWrite} mode={mode} onClose={() => setPending(null)} onApply={() => void applyPending()} />}
  </section>;
}
