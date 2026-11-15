import {useEffect,useState,useSyncExternalStore} from 'react';
import {BarChart3} from 'lucide-react';
import {tx,useLanguage} from './i18n';
import './usage-stats.css';

/** Anonymous usage counter: one notice for the administrator, then a switch in Settings. */
export type UsageState = {available:boolean;enabled:boolean;noticeSeen:boolean;canEdit:boolean};
const PRIVACY_URL = 'https://herve8940.github.io/BandPilot/PRIVACY.html';

let current: UsageState | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const publish = (state: UsageState | null) => {current = state;for (const listener of listeners) listener();};
async function request(method = 'GET', payload?: unknown) {
 const response = await fetch('/api/usage-stats', {method, headers: {'Content-Type': 'application/json'}, body: payload === undefined ? undefined : JSON.stringify(payload)});
 const data = await response.json();
 if (!response.ok) throw Error(data.error ?? 'Préférence non enregistrée');
 publish(data as UsageState);
}
function useUsageState() {
 const state = useSyncExternalStore(listener => {listeners.add(listener);return () => listeners.delete(listener);}, () => current, () => null);
 useEffect(() => {if (!current && !loading) loading = request().catch(() => undefined).finally(() => {loading = null;});}, []);
 return state;
}

export function UsageNotice() {
 useLanguage();
 const state = useUsageState();
 const [busy, setBusy] = useState(false);
 if (!state?.available || !state.canEdit || state.noticeSeen) return null;
 const answer = async (enabled: boolean) => {setBusy(true);try {await request('POST', {noticeSeen: true, enabled});} catch {/* Shown again next time. */} finally {setBusy(false);}};
 return <div className="usage-notice" role="region" aria-label={tx('Statistiques anonymes')}>
  <BarChart3 size={16} aria-hidden="true"/>
  <p><b>{tx('Aide-nous à savoir combien de musiciens utilisent BandPilot')}</b> {tx('BandPilot envoie au plus une fois par jour un numéro aléatoire, sa version, la plateforme et le modèle de console. Rien d’autre : ni nom, ni réglages, ni audio.')} <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">{tx('En savoir plus')}</a></p>
  <div className="usage-notice-actions">
   <button type="button" disabled={busy} onClick={() => void answer(false)}>{tx('Désactiver')}</button>
   <button type="button" className="primary" disabled={busy} onClick={() => void answer(true)}>{tx('OK')}</button>
  </div>
 </div>;
}

export function UsageSettings() {
 useLanguage();
 const state = useUsageState();
 const [error, setError] = useState('');
 if (!state?.available) return null;
 const toggle = async (enabled: boolean) => {setError('');try {await request('POST', {noticeSeen: true, enabled});} catch (e) {setError((e as Error).message);}};
 return <section className="studio-panel pad studio-control usage-settings" aria-label={tx('Statistiques anonymes')} style={{marginBottom: 20}}>
  <h2>{tx('Statistiques anonymes')}</h2>
  <label className="usage-switch"><input type="checkbox" checked={state.enabled} disabled={!state.canEdit} onChange={e => void toggle(e.target.checked)}/> {tx('Compter anonymement cette installation')}</label>
  <p>{tx('Au plus une fois par jour : un numéro aléatoire, la version, la plateforme et le modèle de console. Désactiver efface ce numéro.')} <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">{tx('En savoir plus')}</a></p>
  {!state.canEdit && <p>{tx('Seul un administrateur peut modifier ce réglage.')}</p>}
  {error && <p role="alert">{tx(error)}</p>}
 </section>;
}
