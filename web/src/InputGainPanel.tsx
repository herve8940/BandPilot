import {tx, getLocale} from "./i18n";
import {useEffect,useState} from 'react';
import './input-gain.css';
type Parameter={address:string;min?:number;max?:number;state?:{value:number|string;display:number|string}};
type Preview={token:string;phantom:boolean;changes:{address:string;before:number|string;after:number|string}[]};
async function api(path:string,data?:unknown){const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw Error(d.error??'Action impossible');return d;}
export function InputGainPanel({channel,name,canWrite,onEq,onDynamics,onSends}:{channel:number;name:string;canWrite:boolean;onEq:()=>void;onDynamics:()=>void;onSends:()=>void}){
 const [parameters,setParameters]=useState<Parameter[]>([]),[draft,setDraft]=useState<Record<string,number>>({}),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const prefix='/ch/'+String(channel).padStart(2,'0');
 async function read(){
  const collected:Parameter[]=[];
  for(const group of [prefix+'/config',prefix+'/preamp']){await api('/api/console/refresh',{prefix:group});collected.push(...(await api('/api/console/parameters?prefix='+encodeURIComponent(group+'/'))).parameters);}
  const usb=collected.find(p=>p.address===prefix+'/preamp/rtnsw')?.state?.value;
  const source=collected.find(p=>p.address===prefix+'/config/insrc')?.state?.value;
  if(usb===0&&typeof source==='number'&&source>=0&&source<16){const hp='/headamp/'+String(source+1).padStart(2,'0');await api('/api/console/refresh',{prefix:hp});collected.push(...(await api('/api/console/parameters?prefix='+encodeURIComponent(hp+'/'))).parameters);}
  return collected;
 }
 useEffect(()=>{setParameters([]);setDraft({});setPreview(null);setError('');setNotice('Sélectionne « Lire l’entrée » pour recevoir les réglages et identifier le préampli utilisé.');},[channel]);
 const get=(address:string)=>parameters.find(p=>p.address===address),value=(address:string)=>get(address)?.state?.value;
 const usb=value(prefix+'/preamp/rtnsw')===1,source=value(prefix+'/config/insrc');
 const headamp=typeof source==='number'&&source>=0&&source<16?'/headamp/'+String(source+1).padStart(2,'0'):undefined;
 const gainAddress=usb?prefix+'/preamp/rtntrim':headamp?headamp+'/gain':undefined;
 const gain=gainAddress?get(gainAddress):undefined;
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError((e as Error).message);setPreview(null);}finally{setBusy(false);}}
 const change=(address:string,next:number)=>{setDraft(d=>({...d,[address]:next}));setPreview(null);};
 return <section className="studio-panel input-gain"><div className="panel-title"><div><b>{tx("Entrée · Canal ")}{tx(channel)} — {name}</b><small>{tx("Gain, 48 V, polarité et coupe-bas")}</small></div></div><div className="gain-body">
 <p><b>{tx("Gain d’entrée")}</b>{tx(" : adapte le niveau du signal reçu. ")}<b>{tx("Fader")}</b>{tx(" : règle sa place dans le mix. Augmenter le gain peut aussi augmenter les retours et modifier l’action du compresseur.")}</p>
 <button disabled={busy} onClick={()=>void run(async()=>{setParameters(await read());setDraft({});setPreview(null);setNotice('Entrée actualisée. Aucun réglage modifié.');})}>{tx("Lire l’entrée")}</button>
 {gain?.state&&gainAddress?<fieldset disabled={busy||!canWrite}><label>{tx(usb?'Trim du retour USB (dB)':`Gain du préampli physique IN ${Number(source)+1} (dB)`)}<input aria-label={tx("Gain ou trim de l’entrée")} type="number" min={gain.min} max={gain.max} step="0.5" value={draft[gainAddress]??Number(gain.state.display)} onChange={e=>change(gainAddress,Number(e.target.value))}/></label><small>{tx("Valeur lue : ")}{tx(Number(gain.state.display).toFixed(1))}{tx(" dB · plage ")}{tx(gain.min)}{tx(" à ")}{tx(gain.max)}{tx(" dB")}</small></fieldset>:<p>{tx("Gain non lu ou entrée analogique désactivée : aucune valeur n’est inventée.")}</p>}
 {!usb&&headamp&&get(headamp+'/phantom')?.state&&<label className="gain-toggle"><input type="checkbox" disabled={busy||!canWrite} checked={(draft[headamp+'/phantom']??value(headamp+'/phantom'))===1} onChange={e=>change(headamp+'/phantom',e.target.checked?1:0)}/>{tx(" Alimentation 48 V du préampli IN ")}{tx(Number(source)+1)} · {tx(value(headamp+'/phantom')===1?'actuellement active':'actuellement coupée')}</label>}
 {['invert','hpon'].map((key,i)=>get(prefix+'/preamp/'+key)?.state&&<label className="gain-toggle" key={key}><input type="checkbox" disabled={busy||!canWrite} checked={(draft[prefix+'/preamp/'+key]??value(prefix+'/preamp/'+key))===1} onChange={e=>change(prefix+'/preamp/'+key,e.target.checked?1:0)}/>{tx(i===0?'Inversion de polarité Ø':'Coupe-bas activé')}</label>)}
 {get(prefix+'/preamp/hpf')?.state&&<label>{tx("Fréquence du coupe-bas (Hz)")}<input type="number" min="20" max="400" step="1" disabled={busy||!canWrite} value={draft[prefix+'/preamp/hpf']??Math.round(Number(get(prefix+'/preamp/hpf')!.state!.display))} onChange={e=>change(prefix+'/preamp/hpf',Number(e.target.value))}/></label>}
 {!usb&&gain?.state&&<p>{tx("Ce gain et le 48 V concernent la prise physique indiquée, y compris les autres canaux qui l’utilisent. Le routage du canal est relu avant toute application.")}</p>}
 <div className="gain-actions"><button disabled={busy||!canWrite||!Object.keys(draft).length} onClick={()=>void run(async()=>{setPreview(await api('/api/console/preview',{values:draft}));setNotice('Aperçu uniquement : rien n’a été appliqué.');})}>{tx("Prévisualiser")}</button><button disabled={busy} onClick={()=>{setDraft({});setPreview(null);}}>{tx("Annuler la saisie")}</button></div>
 {preview&&<div className="gain-preview"><b>{tx("Avant → Après")}</b>{preview.changes.map(c=><p key={c.address}><code>{tx(c.address)}</code> : {tx(String(c.before))} → {tx(String(c.after))}</p>)}<button disabled={busy||!canWrite} onClick={()=>{if(!confirm(tx('Appliquer ces réglages d’entrée ? Le niveau dans le mix et les retours peut changer.')))return;const allowPhantom=preview.phantom?confirm(tx('Confirmer séparément le changement du 48 V sur la prise physique indiquée ?')):false;if(preview.phantom&&!allowPhantom)return;void run(async()=>{const routing=await read();for(const suffix of ['/config/insrc','/preamp/rtnsw','/config/rtnsrc'])if(routing.find(p=>p.address===prefix+suffix)?.state?.value!==value(prefix+suffix))throw Error('La source du canal a changé. Relire l’entrée et recommencer.');const result=await api('/api/console/apply',{token:preview.token,confirm:true,allowPhantom});setParameters(await read());setDraft({});setPreview(null);setNotice('Réglages appliqués. Sauvegarde : '+result.backupId);});}}>{tx("Confirmer les réglages d’entrée")}</button></div>}
 <p role="status">{tx(notice)}</p><p role="alert">{tx(error)}</p><div className="gain-actions"><button onClick={onEq}>{tx("Égaliseur")}</button><button onClick={onDynamics}>{tx("Gate / Compresseur")}</button><button onClick={onSends}>{tx("Envois / Retours")}</button></div>
 <p>{tx("Faire jouer ou chanter au niveau habituel, puis ajuster progressivement. Les vumètres OSC ne permettent pas à eux seuls de certifier l’absence de saturation à chaque étage.")}</p>
 </div></section>;
}
