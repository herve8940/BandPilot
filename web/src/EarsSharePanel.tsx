import {tx, getLocale} from "./i18n";
import {useMixerModel} from './MixerModel';
import { useCallback, useEffect, useState } from "react";
import { Copy, Printer, QrCode, RefreshCw, Trash2, UserPlus, Wifi, WifiOff } from "lucide-react";
import { stripColor } from "./xairMath";
import { num, useLiveMixer } from "./xair/controls";
import { BUSES, stripName } from "./xair/strips";
import { MonitorPanel } from "./MonitorPanel";
import "./ears-share.css";

interface Share { id: string; name: string; bus: number; token: string; url: string | null; connected: number }
interface Status { running: boolean; port: number; addresses: string[]; clients: number; shares: Share[] }

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(`/api/ears-share${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json(); if (!r.ok) throw Error(d.error ?? "Opération refusée"); return d as T;
}

function QrCard({ share, running, host, busLabel, busColor, onChange, onError }: { share: Share; running: boolean; host: string; busLabel: string; busColor: string; onChange: (s: Status) => void; onError: (m: string) => void }) {
  const [qr, setQr] = useState<{ url: string; svg: string } | null>(null);
  useEffect(() => {
    let active = true; setQr(null);
    if (running) void api<{ url: string; svg: string }>(`/musicians/${share.id}/qr?host=${encodeURIComponent(host)}`).then(d => { if (active) setQr(d); }).catch(e => onError((e as Error).message));
    return () => { active = false; };
  }, [running, host, share.id, share.token]);
  return <article className="es-card" style={{ "--c": busColor } as React.CSSProperties}>
    <header><div><b>{share.name}</b><span className="es-bus"><i />{tx(busLabel)}</span></div>
      <span className={share.connected ? "es-live on" : "es-live"}>{tx(share.connected ? `${share.connected} téléphone${share.connected > 1 ? "s" : ""}` : "Non connecté")}</span></header>
    <div className="es-qr">{qr ? <div dangerouslySetInnerHTML={{ __html: qr.svg }} /> : <div className="es-qr-off"><QrCode size={42} /><span>{tx(running ? "Génération…" : "Démarre le partage pour afficher le QR code")}</span></div>}</div>
    <p className="es-hint">{tx("Scanner avec l’appareil photo du téléphone, sur le même Wi-Fi que cet ordinateur.")}</p>
    {qr && <div className="es-url"><code>{tx(qr.url)}</code><button type="button" title={tx("Copier le lien")} onClick={() => void navigator.clipboard?.writeText(qr.url).catch(() => onError("Copie impossible : sélectionne le lien à la main."))}><Copy size={15} /></button></div>}
    <div className="es-actions">
      <button type="button" onClick={() => { if (confirm(tx(`Créer un nouveau lien pour ${share.name} ? L’ancien QR code cessera de fonctionner.`))) void api<Status>(`/musicians/${share.id}/regenerate`, "POST").then(onChange).catch(e => onError((e as Error).message)); }}><RefreshCw size={15} />{tx("Nouveau lien")}</button>
      <button type="button" className="danger" onClick={() => { if (confirm(tx(`Retirer l’accès de ${share.name} ?`))) void api<Status>(`/musicians/${share.id}`, "DELETE").then(onChange).catch(e => onError((e as Error).message)); }}><Trash2 size={15} />{tx("Retirer")}</button>
    </div>
  </article>;
}

export function EarsSharePanel() {
 const model=useMixerModel();
  const { values } = useLiveMixer();
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [bus, setBus] = useState(1);
  const [host, setHost] = useState("");
  const [working, setWorking] = useState(false);
  const refresh = useCallback(() => api<Status>("").then(s => { setStatus(s); setHost(h => h && s.addresses.includes(h) ? h : s.addresses[0] ?? ""); }).catch(e => setMessage((e as Error).message)), []);
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 4000); return () => clearInterval(t); }, [refresh]);
  const run = async (fn: () => Promise<Status>) => { setWorking(true); setMessage(""); try { const s = await fn(); setStatus(s); setHost(h => h || s.addresses[0] || ""); } catch (e) { setMessage((e as Error).message); } finally { setWorking(false); } };
  const busLabel = (n: number) => stripName(BUSES[n - 1]!, values);
  const busColor = (n: number) => stripColor(num(values, `/bus/${n}/config/color`, n));
  const running = !!status?.running;

  return <div className="es">
    <section className="es-hero">
      <div className="es-hero-icon">{running ? <Wifi size={26} /> : <WifiOff size={26} />}</div>
      <div className="es-hero-text">
        <h2>{tx("Les retours sur le téléphone de chaque musicien")}</h2>
        <p>{tx("Chaque musicien scanne ")}<b>{tx("son")}</b>{tx(" QR code et règle ")}<b>{tx("son")}</b>{tx(" retour : le niveau de chaque instrument, son volume général, le mute et ses réglages enregistrés. Il ne peut rien changer d’autre. Le niveau est plafonné à 0 dB et monte progressivement.")}</p>
        {running && <p className="es-addr">{tx("Partage actif sur ")}<b>{tx("http://")}{tx(host || status?.addresses[0])}:{tx(status?.port)}</b>{status && status.addresses.length > 1 && <>{tx(" · réseau ")}<select value={host} onChange={e => setHost(e.target.value)} aria-label={tx("Adresse réseau")}>{status.addresses.map(a => <option key={a} value={a}>{tx(a)}</option>)}</select></>}</p>}
      </div>
      <div className="es-hero-actions">
        <button type="button" className={running ? "btn danger" : "btn primary"} disabled={working} onClick={() => void run(() => api<Status>(running ? "/stop" : "/start", "POST"))}>{tx(running ? "Arrêter le partage" : "Démarrer le partage")}</button>
        {running && !!status?.shares.length && <button type="button" className="btn ghost" onClick={() => window.print()}><Printer size={16} />{tx("Imprimer les QR")}</button>}
      </div>
    </section>
    {message && <p className="es-message" role="alert">{tx(message)}</p>}
    {running && !status?.addresses.length && <p className="es-message">{tx("Aucun réseau local détecté : connecte cet ordinateur au Wi-Fi du groupe.")}</p>}

    <form className="es-add" onSubmit={e => { e.preventDefault(); void run(() => api<Status>("/musicians", "POST", { name, bus })).then(() => setName("")); }}>
      <UserPlus size={18} />
      <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={tx("Prénom du musicien")} aria-label={tx("Prénom du musicien")} required />
      <select value={bus} onChange={e => setBus(Number(e.target.value))} aria-label={tx("Retour du musicien")}>{BUSES.slice(0, model.monitorOutputs).map((b, i) => <option key={b.id} value={i + 1}>{tx("Bus ")}{tx(i + 1)} · {tx(busLabel(i + 1))}</option>)}</select>
      <button type="submit" className="btn primary" disabled={working || !name.trim()}>{tx("Ajouter")}</button>
    </form>

    <div className="es-grid">{status?.shares.map(s => <QrCard key={s.id} share={s} running={running} host={host} busLabel={busLabel(s.bus)} busColor={busColor(s.bus)} onChange={setStatus} onError={setMessage} />)}</div>
    {status && !status.shares.length && <p className="es-empty">{tx("Ajoute un musicien et choisis son retour (bus) pour créer son QR code.")}</p>}

    <details className="es-help">
      <summary>{tx("Comment ça marche ? Sécurité et réseau")}</summary>
      <ul>
        <li>{tx("L’ordinateur et les téléphones doivent être sur le ")}<b>{tx("même Wi-Fi")}</b>{tx(" (routeur du groupe ou de la salle). Le partage ne passe pas par Internet.")}</li>
        <li>{tx("Au premier démarrage, le système peut demander d’autoriser BandPilot dans le pare-feu : accepte pour les réseaux privés.")}</li>
        <li>{tx("Le lien est personnel : quiconque l’a peut régler ce retour. En cas de perte du téléphone, clique ")}<b>{tx("Nouveau lien")}</b>{tx(" : l’ancien QR cesse aussitôt de fonctionner.")}</li>
        <li>{tx("La connexion n’est pas chiffrée (HTTP local) : utilise un Wi-Fi privé protégé par mot de passe, pas un réseau public.")}</li>
        <li>{tx("Le contrôle doit être activé dans Réglages pour que les musiciens puissent agir ; sinon leur page est en lecture seule.")}</li>
        <li>{tx("Arrêter le partage déconnecte tous les téléphones. Il faut le redémarrer à chaque lancement de l’application.")}</li>
      </ul>
    </details>
    <details className="es-help"><summary>{tx("Réglage manuel par pas (comptes musiciens)")}</summary><MonitorPanel /></details>
  </div>;
}
