import {useMixerModel} from './MixerModel';
import {MIXER_MODELS,type MixerModelId} from '../../shared/mixer-models';
import {MixerSyncPanel} from './MixerSyncPanel';
import {useEffect,useState} from 'react';
type Device={host:string;port:number;name:string;model:string};
type Status={mode:'real'|'simulation';host?:string;port?:number;connected:boolean;writesEnabled:boolean};
async function request(path:string,data?:unknown){
 const r=await fetch(path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const result=await r.json();if(!r.ok)throw Error(result.error??'Connexion impossible');return result;
}
export function ConnectionPanel({status}:{status:Status}){
 const model=useMixerModel();
 const [simulationModel,setSimulationModel]=useState<MixerModelId>(model.id);
 const [version,setVersion]=useState("");useEffect(()=>{void fetch("/api/version").then(r=>r.json()).then(d=>setVersion(d.version)).catch(()=>undefined);},[]);
 const [permission,setPermission]=useState<'loading'|'admin'|'restricted'|'error'>('loading'),[authAttempt,setAuthAttempt]=useState(0),[authError,setAuthError]=useState('');
 const admin=permission==='admin';
 const [working,setWorking]=useState(false),[devices,setDevices]=useState<Device[]>([]),[message,setMessage]=useState(''),[error,setError]=useState(''),[host,setHost]=useState('');
 useEffect(()=>{let active=true;setPermission('loading');setAuthError('');void request('/api/auth').then(a=>{if(active)setPermission(a.user?.role==='admin'?'admin':'restricted');}).catch(e=>{if(active){setPermission('error');setAuthError(e.message);}});return()=>{active=false;};},[authAttempt]);
 const run=async(action:()=>Promise<void>)=>{setWorking(true);setError('');setMessage('');try{await action();}catch(e){setMessage('');setError((e as Error).message);}finally{setWorking(false);}};
 const connect=async(device:Device)=>{
  setMessage('Connexion à '+device.name+'…');
  await request('/api/connection',{mode:'real',host:device.host,port:device.port,enableWrites:false});
  setMessage(device.model+' connectée en lecture seule. Adresse mémorisée.');
 };
 const scan=()=>run(async()=>{
  setDevices([]);setMessage('Recherche de ta console sur le réseau local…');
  const result=await request('/api/discovery');setDevices(result.devices);
  if(result.devices.length===1)await connect(result.devices[0]);
  else setMessage(result.devices.length?'Plusieurs consoles détectées : choisis ta console.':'Aucune console trouvée. Vérifie que la table est allumée et sur le même réseau que l’ordinateur. Sur Mac : Réglages Système › Confidentialité et sécurité › Réseau local › active BandPilot, puis relance l’application. Sur Windows : autorise BandPilot dans le pare-feu (réseaux privés).');
 });
 return <section className="studio-panel pad studio-control"><h2>Connexion à ma console</h2><p>{model.brand} {model.label} · {model.channels} canaux · {model.monitorOutputs} sorties de retour physiques</p>
  <p>{status.mode==='simulation'?'Mode simulation':`${status.connected?'Connectée':'Connexion perdue / en attente'} · ${status.host??''} · ${status.writesEnabled?'Contrôle activé':'Lecture seule'}`}</p>
  {admin?<><fieldset disabled={working}>
   <button onClick={()=>void scan()}>{working?'Connexion en cours…':'Détecter et connecter ma console'}</button>
   <select aria-label="Modèle à simuler" value={simulationModel} onChange={e=>setSimulationModel(e.target.value as MixerModelId)}>{Object.values(MIXER_MODELS).map(m=><option key={m.id} value={m.id}>{m.brand} {m.label}</option>)}</select>
   <button onClick={()=>void run(async()=>{await request('/api/connection',{mode:'simulation',model:simulationModel});setMessage('Simulation activée.');})}>Passer en simulation</button>
  </fieldset>
  <p role="status" aria-live="polite">{message}</p><p role="alert">{error}</p>
  {devices.length>1&&<div className="song-list">{devices.map(d=><div key={d.host}><div><b>{d.name}</b><small>{d.host} · {d.model}</small></div><button disabled={working} onClick={()=>void run(()=>connect(d))}>Se connecter</button></div>)}</div>}
  {status.mode==='real'&&<button disabled={working||!status.connected} onClick={()=>{
   const enableWrites=!status.writesEnabled;
   if(enableWrites&&!window.confirm('Activer le contrôle de cette console ? Les commandes modifieront le son. Vérifie le niveau des sorties et des retours.'))return;
   void run(async()=>{await request('/api/connection',{mode:'real',host:status.host,port:status.port,enableWrites});setMessage(enableWrites?'Contrôle activé.':'Lecture seule activée.');});
  }}>{status.writesEnabled?'Désactiver le contrôle':'Activer le contrôle'}</button>}
  <MixerSyncPanel status={status}/>
  <details><summary>Connexion manuelle si la recherche est bloquée</summary><form onSubmit={e=>{e.preventDefault();void run(async()=>{await request('/api/connection',{mode:'real',host,enableWrites:false});setMessage('Modèle détecté et connexion en lecture seule.');});}}><fieldset disabled={working}><label>Adresse IP<input required placeholder="192.168.1.1 · détection des deux ports" value={host} onChange={e=>setHost(e.target.value)}/></label><button>Se connecter</button></fieldset></form></details>
  <p className="app-version">BandPilot <b>{version||"…"}</b></p>
  <p><a href="/api/diagnostics/log" download="xr18-studio-diagnostic.log">Télécharger le journal de diagnostic</a></p>
  <p>Après un essai de connexion, télécharge ce fichier pour le joindre au support. Il contient les adresses IP locales et les réponses d’identité de la console, sans clé API ni mot de passe.</p>
  <p>La connexion ne modifie aucun réglage audio. Le mode et l’adresse sont conservés au prochain démarrage.</p></>:permission==='loading'?<p role="status">Vérification des droits de la session…</p>:permission==='error'?<div><p role="alert">Impossible de vérifier les droits de la session : {authError}</p><button onClick={()=>setAuthAttempt(n=>n+1)}>Réessayer la vérification des droits</button></div>:<p>La connexion à la console est gérée par l’administrateur.</p>}
 </section>;
}
