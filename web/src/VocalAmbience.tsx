import {reportUIError} from './diagnostics';
import {tx} from './i18n';
import {useEffect,useState} from 'react';
import {GUIDED_AMBIENCES,VOCAL_DOSES,ambiencesForSource} from '../../shared/vocal-ambiences';
import './vocal-ambience.css';
type State={supported:boolean;voices:{channel:number;name:string;source?:string}[];monitors:{bus:number;name:string}[];session:null|{slot:number;choice:{channel:number;ambience:string;doses:Record<string,number>};phase:string;error?:string;conflict?:string;sameConsole:boolean;sourceMissing?:boolean;savedHost?:string;currentHost?:string}};
type Preview={token:string;slot:number;voice:string;ambience:{name:string;description:string};monitors:{bus:number;name:string;db:number}[];message:string};
class AmbienceConflict extends Error {
 constructor(readonly state:State){super(state.session?.conflict);}
}
async function api(path:string,data?:unknown){
 const response=await fetch('/api/coach/vocal-fx'+path,{
  method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
 });
 const value=await response.json();
 if(response.status===409&&value.code==='ambience-conflict'&&value.state?.session?.conflict)throw new AmbienceConflict(value.state);
 if(!response.ok)throw Error(value.error??'Ambiance indisponible');
 return value;
}
const doseName=(db:number)=>tx(VOCAL_DOSES.find(d=>d.db===db)?.name)??`${db.toFixed(1)} dB`;
export function VocalAmbience({canApply,simulation}:{canApply:boolean;simulation:boolean}){
 const [state,setState]=useState<State|null>(null),[channel,setChannel]=useState(0),[ambience,setAmbience]=useState('natural'),[doses,setDoses]=useState<Record<string,number>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[message,setMessage]=useState('');
 const [readings,setReadings]=useState<Record<string,number>|null>(null);
 const adopt=(s:State)=>{setReadings(null);setState(s);const voice=s.voices.find(v=>v.channel===s.session?.choice.channel)??s.voices[0];setChannel(voice?.channel??0);const presets=ambiencesForSource(voice?.source);setAmbience(presets.some(a=>a.id===s.session?.choice.ambience)?s.session!.choice.ambience:presets[0]?.id??'natural');setDoses(Object.fromEntries(s.monitors.map(m=>[String(m.bus),s.session?.choice.doses[String(m.bus)]??-18])));};
 const refresh=async()=>{const s=await api('') as State;adopt(s);return s;};
 useEffect(()=>{let alive=true;void api('').then((s:State)=>{if(!alive)return;adopt(s);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 const run=async(fn:()=>Promise<void>)=>{
  setBusy(true);setError('');setMessage('');
  try{await fn();}catch(e){
   setPreview(null);
   if(e instanceof AmbienceConflict){adopt(e.state);return;}
   reportUIError('ambience.action',e);setError((e as Error).message);await refresh().catch(()=>{});
  }finally{setBusy(false);}
 };
 const session=state?.session,wrongConsole=session?.sameConsole===false,trial=session?.phase==='trial'||session?.phase==='recovery';
 const conflict=!wrongConsole&&session?.conflict;
 const readLevels=async()=>{
  const result=await api('/read-doses',{}) as State&{readings?:Record<string,number>};
  setState(result);setReadings(result.readings??null);setPreview(null);
  if(result.session)setDoses(result.session.choice.doses);
  if(!result.session?.conflict)setMessage('Dosages des musiciens relus.');
 };
 const presets=ambiencesForSource(state?.voices.find(v=>v.channel===channel)?.source);
 const changed=()=>{setPreview(null);setMessage('');};
 return <section className="vocal-kit" aria-label={tx("Ambiance de la voix")}><header><span className="coach-eyebrow">{tx("BOÎTE À OUTILS · EFFETS")}</span><h3>{tx("Une ambiance, chacun son dosage")}</h3><p>{tx("Choisis une ambiance adaptée à la source. Chaque retour garde son propre dosage et son signal direct.")}</p></header>
 {error&&<p className="coach-error" role="alert">{tx(error)}</p>}{message&&<p className="coach-message" role="status">{tx(message)}</p>}
 {!state&&<p role="status">{tx("Lecture de la préparation…")}</p>}
 {state&&!state.voices.length&&<p>{tx("Ajoute une voix ou un instrument compatible dans « Préparer mon groupe » pour commencer.")}</p>}
 {state&&!state.monitors.length&&<p>{tx("Prépare les musiciens et leurs retours à l’étape « Préparer les retours ».")}</p>}
 {session&&<div className="vocal-current"><b>{tx(GUIDED_AMBIENCES.find(a=>a.id===session.choice.ambience)?.name)}{tx(" · ")}{tx(conflict?'suivi en pause':session.phase==='kept'?'ambiance conservée':session.phase==='trial'?'à écouter':'récupération nécessaire')}{tx(" · effet ")}{session.slot}</b>{!conflict&&<p>{tx("Sur le téléphone, le fader « Voix FX » ou « Ambiance FX » dose cet effet dans le retour du musicien.")}</p>}{wrongConsole&&<p role="alert">{tx("Retrouve la console de cette ambiance avant de la modifier")}</p>}{wrongConsole&&<p>{tx("Adresse sauvegardée")} : {session.savedHost||"—"} · {tx("Adresse actuelle")} : {session.currentHost||"—"}</p>}{session.sourceMissing&&<p role="alert">{tx("La source de cette ambiance ne figure plus dans ton groupe. Choisis une autre source après récupération, ou archive cet ancien suivi.")}</p>}{session.error&&<p role="alert">{tx(session.error)}</p>}
 {conflict&&<div className="vocal-conflict" role="status"><b>{tx(conflict)}</b><p>{tx("Tu peux relire les niveaux de cet effet ou terminer le suivi pour garder le mix actuel.")}</p></div>}
 {conflict&&readings&&<div><b>{tx("Niveaux actuels du retour d’effet")}</b><ul>{Object.entries(readings).map(([bus,db])=><li key={bus}>{state?.monitors.find(m=>String(m.bus)===bus)?.name??tx(`Retour ${bus}`)} · {doseName(db)}</li>)}</ul></div>}<div className="coach-actions">
 {wrongConsole&&session.phase!=='recovery'&&<button type="button" disabled={busy} onClick={()=>{if(confirm(tx('Vérifier que la console connectée contient exactement cette ambiance ? Aucun réglage audio ne sera modifié.')))void run(async()=>{await api('/reconnect',{confirm:true});await refresh();setMessage('Ambiance retrouvée sur la console connectée.');});}}>{tx('Vérifier et retrouver cette ambiance')}</button>}
 {(wrongConsole||session.sourceMissing||session.phase==='recovery'||conflict)&&<button type="button" disabled={busy} onClick={()=>{if(confirm(tx('Archiver seulement le suivi de cette ambiance ? Les effets restent tels quels dans la console ; aucune restauration ne sera envoyée.')))void run(async()=>{await api('/archive',{confirm:true});await refresh();setMessage('Ancien suivi archivé. Les effets de la console sont inchangés.');});}}>{tx(conflict?'Terminer le suivi':'Archiver cet ancien suivi')}</button>}
 {!conflict&&session.phase==='trial'&&<button type="button" className="primary" disabled={busy||!canApply||wrongConsole} onClick={()=>void run(async()=>{await api('/keep',{});await refresh();setMessage('Ambiance conservée. Chaque musicien peut doser son effet.');})}>{tx("Garder cette ambiance")}</button>}
 {!conflict&&trial&&<button type="button" disabled={busy||!canApply||wrongConsole} onClick={()=>{if(confirm(tx('Revenir aux réglages précédant cet essai vocal ?')))void run(async()=>{await api('/undo',{confirm:true});await refresh();setPreview(null);setMessage('Réglages précédents restaurés.');});}}>{tx("Revenir avant l’essai")}</button>}
 {session.phase!=='recovery'&&<button type="button" disabled={busy||wrongConsole} onClick={()=>void run(readLevels)}>{tx("Relire les dosages des musiciens")}</button>}
 {!conflict&&session.phase==='kept'&&<button type="button" disabled={busy||!canApply||wrongConsole} onClick={()=>{if(confirm(tx('Retirer cette ambiance et restaurer les réglages précédant sa création ?')))void run(async()=>{await api('/undo',{all:true,confirm:true});await refresh();setPreview(null);setMessage('Ambiance retirée, réglages d’origine restaurés.');});}}>{tx("Retirer l’ambiance")}</button>}
 </div></div>}
 {!conflict&&!!state?.voices.length&&!!state?.monitors.length&&<fieldset disabled={busy||!!trial||wrongConsole}><label>{tx("1 · La source")}<select aria-label={tx("Source à traiter")} value={channel} onChange={e=>{const next=Number(e.target.value);setChannel(next);setAmbience(ambiencesForSource(state.voices.find(v=>v.channel===next)?.source)[0]?.id??'natural');changed();}}>{state.voices.map(v=><option value={v.channel} key={v.channel}>{v.name}</option>)}</select></label>
 <p><b>{tx("2 · Le caractère recherché")}</b></p><div className="vocal-styles">{presets.map(a=><button type="button" key={a.id} aria-pressed={ambience===a.id} className={ambience===a.id?'selected':''} onClick={()=>{setAmbience(a.id);changed();}}><b>{tx(a.name)}</b><small>{tx(a.style)}</small><span>{tx(a.description)}</span></button>)}</div>
 <div className="vocal-dose-title"><b>{tx("3 · Dans les oreilles de chacun")}</b><button type="button" onClick={()=>{setDoses(Object.fromEntries(state.monitors.map(m=>[String(m.bus),-18])));changed();}}>{tx("Discret pour tous")}</button></div>
 <div className="vocal-doses">{state.monitors.map(m=><label key={m.bus}><span>{m.name}<small>{tx("Retour ")}{m.bus}</small></span><select aria-label={`Ambiance pour ${m.name}`} value={doses[String(m.bus)]??-90} onChange={e=>{setDoses({...doses,[String(m.bus)]:Number(e.target.value)});changed();}}>{!VOCAL_DOSES.some(d=>d.db===doses[String(m.bus)])&&doses[String(m.bus)]!==undefined&&<option value={doses[String(m.bus)]}>{tx("Actuel (")}{doseName(doses[String(m.bus)]!)}{tx(")")}</option>}{VOCAL_DOSES.map(d=><option key={d.db} value={d.db}>{tx(d.name)}</option>)}</select></label>)}</div>
 <p className="coach-note">{tx("Commence discret et vérifie que les mots ou les attaques restent nets. L’effet est réservé aux retours.")}</p>
 <button type="button" className="primary" disabled={!canApply||!state.supported} onClick={()=>void run(async()=>setPreview(await api('/preview',{channel,ambience,doses})))}>{tx("Préparer mon ambiance")}</button></fieldset>}
 {preview&&!trial&&<section className="vocal-preview" aria-label={tx("Proposition d’ambiance")}><h4>{preview.voice}{tx(" · ")}{tx(preview.ambience.name)}</h4><p>{tx(preview.message)}</p><ul>{preview.monitors.map(m=><li key={m.bus}>{m.name}{tx(" : ")}{doseName(m.db)}</li>)}</ul><p>{tx("Emplacement FX ")}{preview.slot}{tx(" vérifié. Les réglages précédents seront sauvegardés avant l’essai.")}</p><div className="coach-actions"><button type="button" className="primary" disabled={busy||!canApply||wrongConsole} onClick={()=>{if(confirm(`Essayer « ${tx(preview.ambience.name)} » sur ${preview.voice} dans les retours affichés ?`))void run(async()=>{await api('/apply',{token:preview.token,confirm:true});await refresh();setPreview(null);setMessage(simulation?'Essai en simulation, aucun son réel.':'Joue ou chante quelques phrases, écoute les retours puis garde ou annule.');});}}>{tx(simulation?'Essayer en simulation':'Essayer dans les ears')}</button><button type="button" disabled={busy} onClick={()=>setPreview(null)}>{tx("Annuler")}</button></div></section>}
 </section>;
}
