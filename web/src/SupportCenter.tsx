import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bug,Download,RefreshCw,X} from 'lucide-react';
import {sanitizeDiagnostic} from '../../shared/diagnostic-report';
import {tx} from './i18n';
import {isAndroid} from './platform';
import './support.css';
type Result={error?:string;[key:string]:any};
type Bridge={directIssue?:boolean;status():Promise<Result>;connect(token:string|null):Promise<Result>;prepare(input:{summary:string;description:string}):Promise<Result>;export(id:string):Promise<Result>;send(id:string):Promise<Result>;browser(id:string):Promise<Result>;checkUpdate(force?:boolean):Promise<Result>;openUpdate():Promise<Result>};
declare global{interface Window{bandpilotSupport?:Bridge}}
const REPO='https://github.com/herve8940/BandPilot';
async function checked(promise:Promise<Result>){const result=await promise;if(result.error)throw Error(result.error);return result;}
export function SupportCenter(){
 const bridge=window.bandpilotSupport;
 const [admin,setAdmin]=useState(false),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[latestError,setLatestError]=useState('');
 const [summary,setSummary]=useState(''),[description,setDescription]=useState(''),[report,setReport]=useState<{id:string;content:string}|null>(null),[reviewed,setReviewed]=useState(false),[issue,setIssue]=useState(''),[configured,setConfigured]=useState(false),[credential,setCredential]=useState('');
 const [update,setUpdate]=useState<Result|null>(null),[dismissed,setDismissed]=useState(false),[version,setVersion]=useState({version:'',build:''});
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  let alive=true;
  void fetch('/api/auth').then(r=>r.json()).then(async auth=>{if(!alive)return;const allowed=auth.user?.role==='admin';setAdmin(allowed);if(allowed&&bridge){void checked(bridge.status()).then(s=>{if(alive)setConfigured(s.configured);}).catch(()=>{});void checked(bridge.checkUpdate()).then(s=>{if(alive)setUpdate(s);}).catch(()=>{});}}).catch(()=>{});
  void fetch('/api/version').then(r=>r.json()).then(v=>{if(alive)setVersion(v);}).catch(()=>{});
  const onError=(e:Event)=>{const message=(e as CustomEvent).detail?.message;if(typeof message==='string')setLatestError(String(sanitizeDiagnostic(message)));};
  window.addEventListener('bandpilot-error',onError);return()=>{alive=false;window.removeEventListener('bandpilot-error',onError);};
 },[]);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const start=()=>{if(!summary&&latestError)setSummary(latestError.slice(0,140));setOpen(true);};
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
 if(!admin)return null;
 return <><button type="button" className="support-open" aria-label={tx('Signaler un problème')} title={tx('Signaler un problème')} onClick={start}><Bug size={16}/><span>{tx('Signaler un problème')}</span></button>{createPortal(<>
  {update?.available&&!dismissed&&<aside className="update-notice" role="status"><div><b>{tx('Mise à jour disponible')} · {update.version}</b><p>{tx('Un nouvel installateur BandPilot est prêt. Tu peux terminer ta session avant de l’installer.')}</p></div><button type="button" onClick={()=>void checked(bridge!.openUpdate()).catch(e=>{setError(e.message);setOpen(true);})}><Download size={16}/>{tx('Télécharger')}</button><button type="button" aria-label={tx('Plus tard')} onClick={()=>setDismissed(true)}><X size={16}/></button></aside>}
  {latestError&&!open&&<aside className="support-error-note" role="status"><span>{tx('Un problème a été enregistré dans le diagnostic.')}</span><button type="button" onClick={start}>{tx('Signaler')}</button><button type="button" aria-label={tx('Fermer')} onClick={()=>setLatestError('')}><X size={14}/></button></aside>}
  <dialog ref={dialog} className="support-dialog" aria-labelledby="support-title" onCancel={e=>{e.preventDefault();if(!busy)setOpen(false);}}>
   <header><div><h2 id="support-title">{tx('Signaler un problème')}</h2><p>BandPilot {version.version} · {version.build||'source'}</p></div><button type="button" disabled={busy} aria-label={tx('Fermer')} onClick={()=>setOpen(false)}><X/></button></header>
   <label>{tx('Que se passe-t-il ?')}<input maxLength={140} value={summary} disabled={busy} onChange={e=>{setSummary(e.target.value);setReport(null);}}/></label>
   <label>{tx('Étapes pour retrouver le problème')}<textarea rows={3} maxLength={1500} value={description} disabled={busy} onChange={e=>{setDescription(e.target.value);setReport(null);}}/></label>
   <p>{tx('Le rapport contient la version, la connexion et les erreurs récentes. Les clés, adresses réseau et chemins personnels sont masqués. Aucun enregistrement audio ni fiche de contacts n’est joint.')}</p>
   <button type="button" className="primary" disabled={busy||!summary.trim()} onClick={()=>void prepare()}>{tx('Préparer le rapport')}</button>
   {report&&<section><details open><summary>{tx('Aperçu du rapport à partager')}</summary><pre>{report.content}</pre></details><label className="support-review"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/>{tx('J’ai vérifié ce rapport et je veux le publier dans les issues publiques de BandPilot.')}</label><div className="support-actions"><button type="button" disabled={busy} onClick={()=>void download()}>{tx('Enregistrer le fichier debug')}</button>{bridge&&configured&&<button type="button" className="primary" disabled={busy||!reviewed||!!issue} onClick={()=>void run(async()=>{const r=await checked(bridge.send(report.id));setIssue(r.url);setNotice('Issue GitHub créée.');})}>{tx('Créer l’issue sur GitHub')}</button>}<button type="button" disabled={busy||!reviewed} onClick={()=>void browser()}>{tx('Créer dans le navigateur')}</button></div></section>}
   {issue&&<p><a href={issue} target="_blank" rel="noreferrer">{tx('Ouvrir l’issue créée')}</a></p>}
   {bridge&&bridge.directIssue!==false&&<details><summary>{tx('Connexion GitHub pour l’envoi direct')}</summary><p>{tx('Crée un jeton personnel limité au dépôt herve8940/BandPilot avec la permission Issues en lecture et écriture. Il sera conservé dans le coffre chiffré de cet ordinateur.')}</p><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">{tx('Ouvrir les réglages GitHub')}</a>{configured?<p>{tx('GitHub connecté')} <button type="button" disabled={busy} onClick={()=>void run(async()=>{await checked(bridge.connect(null));setConfigured(false);})}>{tx('Déconnecter GitHub')}</button></p>:<form onSubmit={e=>{e.preventDefault();void run(async()=>{try{const r=await checked(bridge.connect(credential));setConfigured(r.configured);}finally{setCredential('');}});}}><label>{tx('Jeton GitHub')}<input type="password" autoComplete="off" value={credential} disabled={busy} onChange={e=>setCredential(e.target.value)}/></label><button disabled={busy||!credential}>{tx('Connecter GitHub')}</button></form>}</details>}
   {bridge&&<div className="support-actions"><button type="button" disabled={busy} onClick={()=>void run(async()=>{const s=await checked(bridge.checkUpdate(true));setUpdate(s);setDismissed(false);setNotice(s.available?'Mise à jour disponible':isAndroid?'Aucune mise à jour Android plus récente n’est publiée.':'Tu utilises la dernière version publiée disponible pour cet ordinateur.');})}><RefreshCw size={16}/>{tx('Vérifier les mises à jour')}</button>{update?.available&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{await checked(bridge.openUpdate());})}>{tx('Télécharger la mise à jour')}</button>}</div>}
   {notice&&<p role="status">{tx(notice)}</p>}{error&&<p role="alert" className="coach-error">{tx(error)}</p>}{busy&&<p role="status">{tx('Opération en cours…')}</p>}
  </dialog>
 </>,document.body)}</>;
}
