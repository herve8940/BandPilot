import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bug,Download,RefreshCw,X} from 'lucide-react';
import {sanitizeDiagnostic} from '../../shared/diagnostic-report';
import {tx,useLanguage} from './i18n';
import {isAndroid} from './platform';
import './support.css';
import {DiscordHelp,DiscordIncident} from './DiscordSupport';
type Result={error?:string;[key:string]:any};
type Bridge={copyText?(text:string):Promise<Result>;directIssue?:boolean;status():Promise<Result>;connect(token:string|null):Promise<Result>;prepare(input:{summary:string;description:string}):Promise<Result>;export(id:string):Promise<Result>;send(id:string):Promise<Result>;browser(id:string):Promise<Result>;checkUpdate(force?:boolean):Promise<Result>;openUpdate():Promise<Result>;setAutomaticUpdates?(value:boolean):Promise<Result>;installUpdate?():Promise<Result>;exportLogs?():Promise<Result>;onUpdate?(callback:(state:Result)=>void):()=>void};
declare global{interface Window{bandpilotSupport?:Bridge}}
const REPO='https://github.com/herve8940/BandPilot';
async function checked(promise:Promise<Result>){const result=await promise;if(result.error)throw Error(result.error);return result;}
export function SupportButton({onClick=()=>window.dispatchEvent(new Event('bandpilot-open-support'))}:{onClick?:()=>void}){
 useLanguage();
 const label=tx(isAndroid?'Aide, logs et mises à jour':'Aide et incidents');
 return <button type="button" className="support-open" aria-label={label} title={label} onClick={onClick}><Bug size={16}/><span>{label}</span></button>;
}
export function SupportCenter(){
 useLanguage();
 const bridge=window.bandpilotSupport;
 const [admin,setAdmin]=useState(false),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[latestError,setLatestError]=useState('');
 const [summary,setSummary]=useState(''),[description,setDescription]=useState(''),[report,setReport]=useState<{id:string;content:string}|null>(null),[reviewed,setReviewed]=useState(false),[issue,setIssue]=useState(''),[configured,setConfigured]=useState(false),[credential,setCredential]=useState('');
 const [update,setUpdate]=useState<Result|null>(null),[dismissed,setDismissed]=useState(false),[version,setVersion]=useState({version:'',build:''});
 const [logs,setLogs]=useState<string|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const updateVersion=useRef<string|undefined>(undefined);
 useEffect(()=>{
  let alive=true;
  const unsubscribe=bridge?.onUpdate?.(state=>{if(alive){setUpdate(state);if(state.version!==updateVersion.current){setDismissed(false);updateVersion.current=state.version;}}});
  void fetch('/api/auth').then(r=>r.json()).then(async auth=>{if(!alive)return;const allowed=auth.user?.role==='admin';setAdmin(allowed);if(allowed&&bridge){void checked(bridge.status()).then(s=>{if(alive)setConfigured(s.configured);}).catch(()=>{});void checked(bridge.checkUpdate()).then(s=>{if(alive)setUpdate(s);}).catch(()=>{});}}).catch(()=>{});
  void fetch('/api/version').then(r=>r.json()).then(v=>{if(alive&&v&&typeof v.version==='string')setVersion({version:v.version,build:typeof v.build==='string'?v.build:''});}).catch(()=>{});
  const onError=(e:Event)=>{const message=(e as CustomEvent).detail?.message;if(typeof message==='string')setLatestError(String(sanitizeDiagnostic(message)));};
  window.addEventListener('bandpilot-error',onError);return()=>{alive=false;unsubscribe?.();window.removeEventListener('bandpilot-error',onError);};
 },[]);
 useEffect(()=>{if(open)dialog.current?.showModal();else if(dialog.current?.open)dialog.current.close();},[open]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const start=()=>{if(!summary&&latestError)setSummary(latestError.slice(0,140));setOpen(true);};
 useEffect(()=>{window.addEventListener('bandpilot-open-support',start);return()=>window.removeEventListener('bandpilot-open-support',start);},[summary,latestError]);
 const prepare=()=>run(async()=>{
  setIssue('');setReviewed(false);
  if(bridge){const r=await checked(bridge.prepare({summary,description}));setReport({id:r.id,content:r.content});}
  else{const r=await fetch('/api/diagnostics/report');if(!r.ok)throw Error('Diagnostic indisponible');const data=await r.json();data.id=crypto.randomUUID();data.summary=sanitizeDiagnostic(summary);data.description=sanitizeDiagnostic(description);setReport({id:data.id,content:JSON.stringify(data,null,2)});}
 });
 const download=()=>run(async()=>{
  if(!report)return;
  if(bridge){const r=await checked(bridge.export(report.id));if(r.saved)setNotice('Rapport enregistré.');}
  else{const url=URL.createObjectURL(new Blob([report.content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`BandPilot-debug-${report.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 });
 const browser=()=>run(async()=>{
  if(!report||!reviewed)return;
  if(bridge)await checked(bridge.browser(report.id));
  else{await navigator.clipboard.writeText(report.content);window.open(`${REPO}/issues/new?title=${encodeURIComponent('[BandPilot] '+summary)}`,'_blank','noopener,noreferrer');}
  setNotice('Rapport copié. Colle-le dans la description GitHub, puis clique sur Create pour ouvrir l’issue.');
 });
 const showLogs=()=>run(async()=>{const response=await fetch('/api/diagnostics/report');if(!response.ok)throw Error('Diagnostic indisponible');const data=await response.json();setLogs((data.events??[]).map((event:unknown)=>JSON.stringify(event)).join('\n'));});
 const exportLogs=()=>run(async()=>{if(bridge?.exportLogs){const result=await checked(bridge.exportLogs());if(result.saved)setNotice('Journal enregistré.');return;}const response=await fetch('/api/diagnostics/log');if(!response.ok)throw Error('Journal indisponible.');const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='BandPilot-diagnostic.log';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const installUpdate=()=>run(async()=>{if(!bridge?.installUpdate||!window.confirm(tx('Installer maintenant ? La connexion à la console sera suspendue. Android demandera confirmation.')))return;const result=await checked(bridge.installUpdate());if(result.permissionRequired)setNotice('Autorise BandPilot à installer ses mises à jour, puis reviens et appuie sur Installer.');else setNotice('Installation ouverte. Si tu annules, réactive le contrôle de la console dans Réglages.');});
 const updateMessage=update?.phase==='downloading'?'Téléchargement automatique en cours…':update?.phase==='ready'?(bridge?.installUpdate?'La mise à jour est prête. Installe-la après ta session ; Android demandera confirmation.':'La mise à jour sera installée automatiquement quand tu quitteras BandPilot.'):update?.updateError?'La mise à jour automatique a échoué. Réessaie ou utilise le téléchargement manuel.':update?.automaticEnabled&&!update?.automatic?'Cette installation nécessite une mise à jour manuelle.':'Un nouvel installateur BandPilot est prêt. Tu peux terminer ta session avant de l’installer.';
 const manualUpdate=update?.available&&update.phase!=='downloading'&&update.phase!=='ready'&&(!update.automaticEnabled||!update.automatic||update.updateError);
 const canInstall=update?.phase==='ready'&&!!bridge?.installUpdate;
 return <><SupportButton onClick={start}/>{createPortal(<>
  {admin&&update?.available&&!dismissed&&<aside className="update-notice" role="status"><div><b>{tx('Mise à jour disponible')} · {update.version}</b><p>{tx(updateMessage)}{update.phase==='downloading'&&` ${update.progress??0}%`}</p></div>{manualUpdate&&<button type="button" onClick={()=>void checked(bridge!.openUpdate()).catch(e=>{setError(e.message);setOpen(true);})}><Download size={16}/>{tx('Télécharger')}</button>}{canInstall&&<button type="button" disabled={busy} onClick={()=>void installUpdate()}>{tx('Installer')}</button>}<button type="button" aria-label={tx('Plus tard')} onClick={()=>setDismissed(true)}><X size={16}/></button></aside>}
  {latestError&&!open&&<aside className="support-error-note" role="status"><span>{tx('Un problème a été enregistré dans le diagnostic.')}</span><button type="button" onClick={start}>{tx('Signaler')}</button><button type="button" aria-label={tx('Fermer')} onClick={()=>setLatestError('')}><X size={14}/></button></aside>}
  <dialog ref={dialog} className="support-dialog" aria-labelledby="support-title" onCancel={e=>{e.preventDefault();if(!busy)setOpen(false);}}>
   <header><div><h2 id="support-title">{tx(isAndroid?'Aide, logs et mises à jour':'Aide et incidents')}</h2><p>BandPilot {version.version} · {version.build||'source'}</p></div><button type="button" disabled={busy} aria-label={tx('Fermer')} onClick={()=>setOpen(false)}><X/></button></header>
   <DiscordHelp/>
   <h3>{tx('Signaler un incident sur Discord')}</h3>

   <label>{tx('Que se passe-t-il ?')}<input maxLength={140} value={summary} disabled={busy} onChange={e=>{setSummary(e.target.value);setReport(null);}}/></label>
   <label>{tx('Étapes pour retrouver le problème')}<textarea rows={3} maxLength={1500} value={description} disabled={busy} onChange={e=>{setDescription(e.target.value);setReport(null);}}/></label>
   <DiscordIncident summary={summary} description={description} version={version} disabled={busy}/>
   {admin&&<details className="support-advanced"><summary>{tx('Diagnostic détaillé et suivi GitHub')}</summary>
   <p>{tx('Pour un problème reproductible, tu peux aussi préparer un rapport détaillé et ouvrir une issue GitHub.')}</p>
   <section aria-label={tx('Journal de diagnostic')}><h3>{tx('Journal de diagnostic')}</h3><p>{tx('Consulte les événements récents ou enregistre le journal complet. Les informations sensibles sont masquées.')}</p><div className="support-actions"><button type="button" disabled={busy} onClick={()=>void showLogs()}>{tx('Afficher les logs')}</button><button type="button" disabled={busy} onClick={()=>void exportLogs()}>{tx('Exporter les logs')}</button></div>{logs!==null&&<pre aria-label={tx('Événements récents')}>{logs||tx('Aucun événement récent.')}</pre>}</section>
   <p>{tx('Le rapport contient la version, la connexion et les erreurs récentes. Les clés, adresses réseau et chemins personnels sont masqués. Aucun enregistrement audio ni fiche de contacts n’est joint.')}</p>
   <button type="button" className="primary" disabled={busy||!summary.trim()} onClick={()=>void prepare()}>{tx('Préparer le rapport')}</button>
   {report&&<section><details open><summary>{tx('Aperçu du rapport à partager')}</summary><pre>{report.content}</pre></details><label className="support-review"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/>{tx('J’ai vérifié ce rapport et je veux le publier dans les issues publiques de BandPilot.')}</label><div className="support-actions"><button type="button" disabled={busy} onClick={()=>void download()}>{tx('Enregistrer le fichier debug')}</button>{bridge&&configured&&<button type="button" className="primary" disabled={busy||!reviewed||!!issue} onClick={()=>void run(async()=>{const r=await checked(bridge.send(report.id));setIssue(r.url);setNotice('Issue GitHub créée.');})}>{tx('Créer l’issue sur GitHub')}</button>}<button type="button" disabled={busy||!reviewed} onClick={()=>void browser()}>{tx('Créer dans le navigateur')}</button></div></section>}
   {issue&&<p><a href={issue} target="_blank" rel="noreferrer">{tx('Ouvrir l’issue créée')}</a></p>}
   {bridge&&bridge.directIssue!==false&&<details><summary>{tx('Connexion GitHub pour l’envoi direct')}</summary><p>{tx('Crée un jeton personnel limité au dépôt herve8940/BandPilot avec la permission Issues en lecture et écriture. Il sera conservé dans le coffre chiffré de cet ordinateur.')}</p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">{tx('Ouvrir les réglages GitHub')}</a>{configured?<p>{tx('GitHub connecté')} <button type="button" disabled={busy} onClick={()=>void run(async()=>{await checked(bridge.connect(null));setConfigured(false);})}>{tx('Déconnecter GitHub')}</button></p>:<form onSubmit={e=>{e.preventDefault();void run(async()=>{try{const r=await checked(bridge.connect(credential));setConfigured(r.configured);}finally{setCredential('');}});}}><label>{tx('Jeton GitHub')}<input type="password" autoComplete="off" value={credential} disabled={busy} onChange={e=>setCredential(e.target.value)}/></label><button disabled={busy||!credential}>{tx('Connecter GitHub')}</button></form>}</details>}
   </details>}
   {admin&&bridge&&<div className="support-actions"><button type="button" disabled={busy} onClick={()=>void run(async()=>{const s=await checked(bridge.checkUpdate(true));setUpdate(s);setDismissed(false);setNotice(s.updateError?'Impossible de vérifier les mises à jour. Réessaie plus tard.':s.invalidVersion?'Version locale non reconnue. Utilise le téléchargement manuel.':s.available?'Mise à jour disponible':isAndroid?'Aucune mise à jour Android plus récente n’est publiée.':'Tu utilises la dernière version publiée disponible pour cet ordinateur.');})}><RefreshCw size={16}/>{tx('Vérifier les mises à jour')}</button>{manualUpdate&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{await checked(bridge.openUpdate());})}>{tx('Télécharger la mise à jour')}</button>}</div>}
   {admin&&bridge?.setAutomaticUpdates&&<label className="support-review"><input type="checkbox" checked={update?.automaticEnabled??true} disabled={busy} onChange={e=>{const enabled=e.target.checked;void run(async()=>{setUpdate(await checked(bridge.setAutomaticUpdates!(enabled)));});}}/>{tx(bridge.installUpdate?'Télécharger automatiquement les mises à jour Android':'Télécharger automatiquement les mises à jour et les installer à la fermeture')}</label>}
   {admin&&canInstall&&<button type="button" disabled={busy} onClick={()=>void installUpdate()}>{tx('Installer')}</button>}
   {admin&&bridge?.installUpdate&&<p>{tx('Recherche automatique à l’ouverture puis toutes les six heures pendant l’utilisation. Le téléchargement automatique est facultatif. L’installation demande toujours ton accord.')}</p>}
   {admin&&bridge?.setAutomaticUpdates&&<p>{tx('Les nouvelles versions sont proposées après leurs tests. Aucune mise à jour ne ferme une session en cours.')}</p>}
   {notice&&<p role="status">{tx(notice)}</p>}{error&&<p role="alert" className="coach-error">{tx(error)}</p>}{busy&&<p role="status">{tx('Opération en cours…')}</p>}
  </dialog>
 </>,document.body)}</>;
}
