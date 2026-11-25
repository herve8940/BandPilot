import {reportUIError} from './diagnostics';
import {tx} from './i18n';
import {useEffect,useState} from 'react';
import {Plus,Repeat2,Waves} from 'lucide-react';
import {GUIDED_AMBIENCES,VOCAL_DOSES,ambiencesForSource} from '../../shared/vocal-ambiences';
import type {Profile} from './CoachSetup';
import './vocal-ambience.css';
type Effect={id?:string;slot:number;choice:{channel:number;ambience:string;mainDb?:number;doses:Record<string,number>};phase:string;error?:string;conflict?:string;sameConsole:boolean;sourceMissing?:boolean;savedHost?:string;currentHost?:string};
type State={supported:boolean;capacity?:number;voices:{channel:number;name:string;source?:string}[];monitors:{bus:number;name:string}[];sessions?:Effect[];session:Effect|null};
type Preview={token:string;mainDb?:number;slot:number;voice:string;ambience:{name:string;description:string};monitors:{bus:number;name:string;db:number}[];message:string};
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
export function VocalAmbience({canApply,simulation,mixerProfile,initialChannel}:{canApply:boolean;simulation:boolean;mixerProfile?:Profile;initialChannel?:number}){
 const [state,setState]=useState<State|null>(null),[channel,setChannel]=useState(0),[ambience,setAmbience]=useState('natural'),[doses,setDoses]=useState<Record<string,number>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[message,setMessage]=useState('');
 const [readings,setReadings]=useState<Record<string,number>|null>(null);
 const [mainDb,setMainDb]=useState(-90);
 const scoped=(s:State):State=>mixerProfile?{...s,voices:mixerProfile.inputs,monitors:mixerProfile.musicians??[]}:s;
 const adopt=(incoming:State,selected:Effect|null=incoming.session,preferredChannel=initialChannel)=>{
  const s=scoped({...incoming,session:selected});
  const voice=s.voices.find(v=>v.channel===selected?.choice.channel)??s.voices.find(v=>v.channel===preferredChannel)??s.voices[0];
  const presets=ambiencesForSource(voice?.source);
  setReadings(null);setPreview(null);setState(s);setChannel(voice?.channel??0);
  setMainDb(selected?.choice.mainDb??-90);
  setAmbience(presets.find(a=>a.id===selected?.choice.ambience)?.id??presets[0]?.id??'natural');
  setDoses(Object.fromEntries(s.monitors.map(m=>[String(m.bus),selected?.choice.doses[String(m.bus)]??(selected?-90:-18)])));
 };
 const refresh=async()=>{
  const s=await api('') as State;
  const selected=state?.session;
  adopt(s,s.sessions?(s.sessions.find(item=>item.id===selected?.id)??null):s.session,channel);
 };
 useEffect(()=>{
  let alive=true;
  void api('').then((s:State)=>{
   if(!alive)return;
   const selected=s.sessions&&initialChannel!==undefined?s.sessions.find(item=>item.sameConsole&&item.choice.channel===initialChannel)??null:s.session;
   adopt(s,selected);
  }).catch(e=>{if(alive)setError(e.message);});
  return()=>{alive=false;};
 },[mixerProfile,initialChannel]);
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
 const target=state?.sessions?{sessionId:session?.id??null}:{};
 const action=async(path:string,data:Record<string,unknown>={})=>{
  const next=await api(path,{...data,...target}) as State;
  if(next?.voices)adopt(next);else await refresh();
 };
 const readLevels=async()=>{
  const result=await api('/read-doses',target) as State&{readings?:Record<string,number>};
  setState(scoped(result));setReadings(result.readings??null);setPreview(null);
  if(result.session)setDoses(result.session.choice.doses);
  if(!result.session?.conflict)setMessage('Dosages des musiciens relus.');
 };
 const presets=ambiencesForSource(state?.voices.find(v=>v.channel===channel)?.source);
 const changed=()=>{setPreview(null);setMessage('');};
 const otherSource=mixerProfile&&session&&!state?.voices.some(v=>v.channel===session.choice.channel);
 const effects=state?.sessions??(session?[session]:[]);
 const capacity=state?.capacity??4;
 const occupied=effects.filter(effect=>effect.sameConsole).length;
 const select=(effect:Effect|null,source=channel)=>{
  if(!state)return;
  setError('');setMessage('');adopt(state,effect,source);
 };
 return <section className="vocal-kit" aria-label={tx("Effets de la balance")}>
 <header className="fx-rack-heading"><div><h3>{tx('Effets de la balance')}</h3><p>{tx('Combine plusieurs effets sur une entrée ou répartis-les entre les instruments.')}</p></div>
 {state?.supported&&effects.length>0&&<button type="button" className="fx-rack-add" disabled={busy||!canApply||occupied>=capacity} onClick={()=>select(null)}><Plus size={16}/>{tx('Ajouter un effet')}</button>}</header>
 {effects.length>0&&<div className="balance-fx-rack" role="group" aria-label={tx('Effets configurés')}>{effects.map(effect=>{
  const preset=GUIDED_AMBIENCES.find(a=>a.id===effect.choice.ambience);
  const Icon=preset?.algorithm===10?Repeat2:Waves;
  const source=state?.voices.find(v=>v.channel===effect.choice.channel)?.name??(tx('Entrée')+' '+effect.choice.channel);
  return <button key={effect.id??effect.slot} type="button" disabled={busy} aria-pressed={!!session && (effect.id?session.id===effect.id:session.slot===effect.slot)} onClick={()=>select(effect)}>
   <span className="balance-fx-slot"><Icon size={16}/> FX {effect.slot}</span>
   <strong>{tx(preset?.name??effect.choice.ambience)}</strong><span>{source}</span>
   {(!effect.sameConsole||effect.conflict||effect.phase!=='kept')&&<small>{tx(!effect.sameConsole||effect.conflict?'suivi en pause':effect.phase==='trial'?'à écouter':'récupération nécessaire')}</small>}
  </button>;
 })}</div>}
 {state?.supported&&<p className="balance-fx-editing"><strong>{session?tx('Modifier l’effet')+' · FX '+session.slot:tx('Nouvel effet')}</strong>
 {occupied>=capacity&&<span>{tx('Tous les emplacements FX sont utilisés.')}</span>}</p>}
 {error&&<p className="coach-error" role="alert">{tx(error)}</p>}{message&&<p className="coach-message" role="status">{tx(message)}</p>}
 {!state&&<p role="status">{tx("Lecture de la préparation…")}</p>}
 {state&&!state.voices.length&&<p>{tx(mixerProfile?"Aucune source compatible parmi les tranches cochées.":"Ajoute une voix ou un instrument compatible dans « Préparer mon groupe » pour commencer.")}</p>}
 {state&&!state.supported&&<p>{tx('Ambiances vocales disponibles sur X-Air / M-Air')}</p>}
 {otherSource&&<p>{tx('L’ambiance en cours concerne une autre source.')}</p>}
 {session&&<div className="vocal-current"><b>{tx(GUIDED_AMBIENCES.find(a=>a.id===session.choice.ambience)?.name)}{tx(" · ")}{tx(conflict?'suivi en pause':session.phase==='kept'?'ambiance conservée':session.phase==='trial'?'à écouter':'récupération nécessaire')}{tx(" · effet ")}{session.slot}</b>{!conflict&&Object.keys(session.choice.doses).length>0&&<p>{tx(state?.sessions?"Sur le téléphone, règle le retour FX correspondant à cet emplacement.":"Sur le téléphone, le fader « Voix FX » ou « Ambiance FX » dose cet effet dans le retour du musicien.")}</p>}{wrongConsole&&<p role="alert">{tx("Retrouve la console de cette ambiance avant de la modifier")}</p>}{wrongConsole&&<p>{tx("Adresse sauvegardée")} : {session.savedHost||"—"} · {tx("Adresse actuelle")} : {session.currentHost||"—"}</p>}{session.sourceMissing&&<p role="alert">{tx("La source de cette ambiance ne figure plus dans ton groupe. Choisis une autre source après récupération, ou archive cet ancien suivi.")}</p>}{session.error&&<p role="alert">{tx(session.error)}</p>}
 {conflict&&<div className="vocal-conflict" role="status"><b>{tx(conflict)}</b><p>{tx("Tu peux relire les niveaux de cet effet ou terminer le suivi pour garder le mix actuel.")}</p></div>}
 {conflict&&readings&&<div><b>{tx("Niveaux actuels du retour d’effet")}</b><ul>{Object.entries(readings).map(([bus,db])=><li key={bus}>{state?.monitors.find(m=>String(m.bus)===bus)?.name??tx(`Retour ${bus}`)} · {doseName(db)}</li>)}</ul></div>}<div className="coach-actions">
 {wrongConsole&&session.phase!=='recovery'&&<button type="button" disabled={busy} onClick={()=>{if(confirm(tx('Vérifier que la console connectée contient exactement cette ambiance ? Aucun réglage audio ne sera modifié.')))void run(async()=>{await action('/reconnect',{confirm:true});setMessage('Ambiance retrouvée sur la console connectée.');});}}>{tx('Vérifier et retrouver cette ambiance')}</button>}
 {(wrongConsole||session.sourceMissing||session.phase==='recovery'||conflict)&&<button type="button" disabled={busy} onClick={()=>{if(confirm(tx('Archiver seulement le suivi de cette ambiance ? Les effets restent tels quels dans la console ; aucune restauration ne sera envoyée.')))void run(async()=>{await action('/archive',{confirm:true});setMessage('Ancien suivi archivé. Les effets de la console sont inchangés.');});}}>{tx(conflict?'Terminer le suivi':'Archiver cet ancien suivi')}</button>}
 {!conflict&&session.phase==='trial'&&<button type="button" className="primary" disabled={busy||!canApply||wrongConsole} onClick={()=>void run(async()=>{await action('/keep');setMessage('Ambiance conservée.');})}>{tx("Garder cette ambiance")}</button>}
 {!conflict&&trial&&<button type="button" disabled={busy||!canApply||wrongConsole} onClick={()=>{if(confirm(tx('Revenir aux réglages précédant cet essai vocal ?')))void run(async()=>{await action('/undo',{confirm:true});setPreview(null);setMessage('Réglages précédents restaurés.');});}}>{tx("Revenir avant l’essai")}</button>}
 {session.phase!=='recovery'&&<button type="button" disabled={busy||wrongConsole} onClick={()=>void run(readLevels)}>{tx("Relire les dosages des musiciens")}</button>}
 {!conflict&&session.phase==='kept'&&<button type="button" disabled={busy||!canApply||wrongConsole} onClick={()=>{if(confirm(tx('Retirer cette ambiance et restaurer les réglages précédant sa création ?')))void run(async()=>{await action('/undo',{all:true,confirm:true});setPreview(null);setMessage('Ambiance retirée, réglages d’origine restaurés.');});}}>{tx("Retirer l’ambiance")}</button>}
 </div></div>}
 {!conflict&&!!state?.voices.length&&state.supported&&<><label>{tx("1 · La source")}<select aria-label={tx("Source à traiter")} disabled={busy||wrongConsole||(!state.sessions&&!!trial)} value={channel} onChange={e=>select(null,Number(e.target.value))}>{state.voices.map(v=><option value={v.channel} key={v.channel}>{v.name}</option>)}</select></label>
 <fieldset disabled={busy||!!trial||wrongConsole||!!(session&&session.choice.channel!==channel)||(!session&&occupied>=capacity)}>
 <p><b>{tx("2 · Le caractère recherché")}</b></p><div className="vocal-styles">{presets.map(a=><button type="button" key={a.id} aria-pressed={ambience===a.id} className={ambience===a.id?'selected':''} onClick={()=>{setAmbience(a.id);changed();}}><b>{tx(a.name)}</b><small>{tx(a.style)}</small><span>{tx(a.description)}</span></button>)}</div>
 <div className="vocal-dose-title"><b>{tx('3 · Dosage de l’effet')}</b>{state.monitors.length>0&&<button type="button" onClick={()=>{setDoses(Object.fromEntries(state.monitors.map(m=>[String(m.bus),-18])));changed();}}>{tx("Discret pour tous")}</button>}</div>
 <div className="vocal-doses"><label><span>{tx('Façade')}</span><select aria-label={tx('Dosage en façade')} value={mainDb} onChange={e=>{setMainDb(Number(e.target.value));changed();}}>{VOCAL_DOSES.map(d=><option key={d.db} value={d.db}>{tx(d.name)}</option>)}</select></label>{state.monitors.map(m=><label key={m.bus}><span>{m.name}<small>{tx("Retour ")}{m.bus}</small></span><select aria-label={tx(`Ambiance pour ${m.name}`)} value={doses[String(m.bus)]??-90} onChange={e=>{setDoses({...doses,[String(m.bus)]:Number(e.target.value)});changed();}}>{!VOCAL_DOSES.some(d=>d.db===doses[String(m.bus)])&&doses[String(m.bus)]!==undefined&&<option value={doses[String(m.bus)]}>{tx("Actuel (")}{doseName(doses[String(m.bus)]!)}{tx(")")}</option>}{VOCAL_DOSES.map(d=><option key={d.db} value={d.db}>{tx(d.name)}</option>)}</select></label>)}</div>
 <p className="coach-note">{tx(state.monitors.length?'Commence avec un dosage discret.':'Choisis un dosage en façade pour essayer l’effet. Tu peux ajouter les retours à l’étape Retours.')}</p>
 <button type="button" className="primary" disabled={!canApply||(!state.monitors.length&&mainDb===-90)} onClick={()=>void run(async()=>setPreview(await api('/preview',{...target,channel,ambience,doses,...(mainDb>-90&&{mainDb}),...(mixerProfile&&{mixerProfile})})))}>{tx("Préparer mon ambiance")}</button></fieldset></>}
 {preview&&!trial&&<section className="vocal-preview" aria-label={tx("Proposition d’ambiance")}><h4>{preview.voice}{tx(" · ")}{tx(preview.ambience.name)}</h4><p>{tx(preview.message)}</p><ul>{(preview.mainDb??-90)>-90&&<li>{tx('Façade')} · {doseName(preview.mainDb!)}</li>}{preview.monitors.map(m=><li key={m.bus}>{m.name}{tx(" : ")}{doseName(m.db)}</li>)}</ul><p>{tx("Emplacement FX ")}{preview.slot}{tx(" vérifié. Les réglages précédents seront sauvegardés avant l’essai.")}</p><div className="coach-actions"><button type="button" className="primary" disabled={busy||!canApply||wrongConsole} onClick={()=>{if(confirm(tx(`Essayer « ${tx(preview.ambience.name)} » sur ${preview.voice} ?`)))void run(async()=>{await action('/apply',{token:preview.token,confirm:true});setPreview(null);setMessage(simulation?'Essai en simulation, aucun son réel.':'Écoute l’effet puis garde ou annule l’essai.');});}}>{tx(simulation?'Essayer en simulation':(preview.mainDb??-90)>-90?'Essayer l’effet':'Essayer dans les ears')}</button><button type="button" disabled={busy} onClick={()=>setPreview(null)}>{tx("Annuler")}</button></div></section>}
 </section>;
}
