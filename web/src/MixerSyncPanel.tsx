import {tx, getLocale} from "./i18n";
import './mixer-sync.css';
import {useEffect,useState} from 'react';
type Status={mode:'real'|'simulation';connected:boolean;writesEnabled:boolean;host?:string};
type Source={id:string;name:string;createdAt:string};
type Preview={token:string;sourceName:string;changes:{address:string;before:string|number;after:string|number}[];fxSlots:number[];phantom:boolean};
async function api(path:string,data?:unknown){const response=await fetch('/api/mixer-sync'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error??'Synchronisation impossible');return result;}
export function MixerSyncPanel({status}:{status:Status}){
 const [direction,setDirection]=useState<'pull'|'push'>('pull');
 const [sources,setSources]=useState<Source[]>([]),[sourceId,setSourceId]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[includePhantom,setIncludePhantom]=useState(false),[confirmPhantom,setConfirmPhantom]=useState(false);
 const load=(data:{sources:Source[];id?:string})=>{setSources(data.sources);setSourceId(old=>data.id??(data.sources.some(s=>s.id===old)?old:data.sources[0]?.id??''));};
 useEffect(()=>{setPreview(null);setConfirmPhantom(false);void api('').then(load).catch(e=>setError(e.message));},[status.mode,status.connected,status.writesEnabled,status.host]);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setMessage('Lecture des paramètres… Ne manipule pas les autres applications pendant cette opération.');try{await action();}catch(e){setMessage('');setError((e as Error).message);setPreview(null);}finally{setBusy(false);}}
 const connected=status.mode==='real'&&status.connected;
 return <section aria-label={tx("Synchronisation du mixeur")} className="mixer-sync">
 <h3>{tx(connected?'Étape après connexion : choisir le sens de synchronisation':'Préparer la synchronisation')}</h3>
 <p>{tx("La connexion reste en lecture seule au départ. Aucun réglage PC n’est envoyé automatiquement.")}</p>
 <fieldset disabled={busy}>
 {status.mode==='simulation'&&<><p>{tx("La préparation PC en simulation est conservée automatiquement avant une connexion réelle. Tu peux aussi en conserver une copie ici. Une préparation en simulation contient aussi les valeurs par défaut des paramètres non réglés : vérifie l’aperçu avant tout envoi.")}</p><button onClick={()=>void run(async()=>{load(await api('/save-pc',{}));setMessage('Préparation PC conservée. Tu peux maintenant connecter la console.');})}>{tx("Conserver ma préparation PC")}</button></>}
 <h4>{tx("Sens de synchronisation")}</h4>
 <label><input type="radio" name="sync-direction" checked={direction==='pull'} onChange={()=>{setDirection('pull');setPreview(null);}}/>{tx(" Table → PC — récupérer les réglages actuels de la console")}</label>
 <label><input type="radio" name="sync-direction" checked={direction==='push'} onChange={()=>{setDirection('push');setPreview(null);}}/>{tx(" PC → Table — envoyer une copie PC sauvegardée")}</label>
 <p>{tx("Table → PC est le choix conseillé après des changements dans X Air ou une autre application. Les anciennes copies PC sont conservées.")}</p>
 <div hidden={direction!=='push'}>
 <label className="sync-source">{tx("État PC ou scène complète à envoyer")}<select aria-label={tx("État PC à synchroniser")} value={sourceId} onChange={e=>{setSourceId(e.target.value);setPreview(null);}}><option value="">{tx("Choisir une copie PC")}</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name} · {tx(new Date(s.createdAt).toLocaleString(getLocale()))}</option>)}</select></label>
 {!sources.length&&<p>{tx("Aucune copie PC : utiliser Table → PC ou conserver une préparation en simulation.")}</p>}
 <label><input type="checkbox" checked={includePhantom} onChange={e=>{setIncludePhantom(e.target.checked);setPreview(null);setConfirmPhantom(false);}}/>{tx(" Inclure les éventuels changements d’alimentation 48 V (exclus par défaut)")}</label>
 </div>
 <button disabled={!connected||(direction==='push'&&(!status.writesEnabled||!sourceId))} onClick={()=>void run(async()=>{
  setPreview(null);setConfirmPhantom(false);
  if(direction==='pull'){const result=await api('/pull',{});load(result);setMessage(`Table → PC terminée : ${result.count} paramètres et les quatre effets conservés sur le PC.${result.missing?.length?` ${result.missing.length} réglage(s) sans réponse de la console, ignoré(s) : ${result.missing.slice(0,4).join(', ')}${result.missing.length>4?'…':''}.`:''}`);}
  else{setPreview(await api('/preview',{sourceId,includePhantom}));setMessage('Aperçu prêt. Rien n’a été envoyé à la table.');}
 })}>{tx("Synchroniser ")}{tx(direction==='pull'?'Table → PC':'PC → Table')}</button>
 {connected&&direction==='push'&&!status.writesEnabled&&<p>{tx("Pour préparer PC → Table, active d’abord le contrôle avec le bouton ci-dessus. Table → PC fonctionne en lecture seule.")}</p>}
 </fieldset>
 <p role="status" aria-live="polite">{tx(message)}</p><p role="alert">{tx(error)}</p>
 {preview&&<section aria-label={tx("Aperçu PC vers Table")}><h4>{tx("PC → Table : ")}{tx(preview.sourceName)}</h4><p>{tx(preview.changes.length)}{tx(" paramètres différents · effets concernés : ")}{tx(preview.fxSlots.join(', ')||'aucun')}{tx(". Sauvegarde de la table avant écriture. L’envoi peut modifier volumes, mutes, gains et routages ; mets les sorties à faible niveau.")}</p>
 <details><summary>{tx("Voir tous les changements (valeurs actuelles → valeurs PC)")}</summary><div style={{maxHeight:300,overflow:'auto'}}>{preview.changes.map(c=><p key={c.address}><code>{tx(c.address)}</code> : {tx(String(c.before))} → {tx(String(c.after))}</p>)}{preview.fxSlots.map(slot=><p key={slot}>{tx("FX ")}{tx(slot)}{tx(" : algorithme et vecteur de paramètres de la copie PC")}</p>)}</div></details>
 {preview.phantom&&<label><input type="checkbox" checked={confirmPhantom} onChange={e=>setConfirmPhantom(e.target.checked)}/>{tx(" Je confirme séparément les changements de 48 V")}</label>}
 <p>{tx("Ne manipule pas X Air ou une autre application pendant l’envoi. Une erreur peut laisser une modification partielle ; la sauvegarde restera disponible dans les scènes.")}</p>
 <button disabled={busy||(preview.phantom&&!confirmPhantom)} onClick={()=>{if(!window.confirm(`Envoyer « ${preview.sourceName} » du PC vers la table ? Les réglages audio vont changer.`))return;void run(async()=>{const result=await api('/apply',{token:preview.token,confirm:true,allowPhantom:confirmPhantom});setPreview(null);setMessage(`PC → Table terminée. Sauvegarde avant envoi : ${result.backupId}`);});}}>{tx("Confirmer PC → Table")}</button>
 <button disabled={busy} onClick={()=>setPreview(null)}>{tx("Annuler")}</button></section>}
 <p>{tx("Tu peux revenir ici à tout moment pour resynchroniser. Les données reçues en direct restent celles de la table ; une copie PC sauvegardée ne change pas automatiquement.")}</p>
 </section>;
}
