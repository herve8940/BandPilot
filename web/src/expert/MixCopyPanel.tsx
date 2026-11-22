import {useEffect,useState} from 'react';
import {tx} from '../i18n';
import {busLinkAddress} from '../../../shared/monitor-pairs';
import type {Values} from '../xair/controls';
type Plan={token:string;changes:{address:string;before:string|number;after:string|number}[];undoId?:string};
async function api(path:string,data:unknown){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),v=await r.json();if(!r.ok)throw Error(v.error);return v;}
export function MixCopyPanel({values,outputs,target,writable}:{values:Values;outputs:number;target:number;writable:boolean}){
 const [source,setSource]=useState(1),[plan,setPlan]=useState<Plan|null>(null),[backup,setBackup]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setPlan(null);setBackup(null);},[target,outputs]);
 const buses=Array.from({length:outputs},(_,i)=>i+1).filter(n=>n%2===1||values[busLinkAddress(n)]!==1);
 const title=(b:number)=>`${tx('Bus')} ${b}${values[busLinkAddress(b)]===1?`–${b+1} · ${tx('Stéréo')}`:''}`;
 const setting=(address:string)=>{const m=/^(\/ch\/(\d+)|\/rtn\/(aux|[1-4]))\/mix\/\d+\/(level|pan)$/.exec(address);if(!m)return address;const prefix=m[1]!,name=values[`${prefix}/config/name`];return `${typeof name==='string'&&name.trim()?name:m[2]?tx('Entrée ')+Number(m[2]):m[3]==='aux'?'Aux':'FX '+m[3]} · ${tx(m[4]==='pan'?'Panorama':'Niveau')}`;};
 const display=(value:string|number,address:string)=>typeof value==='number'?`${Number(value.toFixed(2))}${address.endsWith('/level')?' dB':' %'}`:value;
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <details className="monitor-copy"><summary>{tx('Copier un mix vers ce retour')}</summary><p>{tx('Copie les niveaux d’envoi et, pour une paire stéréo, les panoramas. Les volumes généraux, EQ, compresseurs et points de prélèvement restent propres à chaque retour.')}</p><fieldset disabled={!writable||busy}><label>{tx('Mix source')}<select value={source} onChange={e=>{setSource(Number(e.target.value));setPlan(null);}}>{buses.map(b=><option value={b} key={b}>{title(b)}</option>)}</select></label><span> → {title(target)}</span><button disabled={source===target} onClick={()=>void run(async()=>setPlan(await api('/api/monitor/copy/preview',{source,target})))}>{tx('Prévisualiser la copie')}</button>{backup&&<button onClick={()=>void run(async()=>setPlan({...await api(`/api/library/${backup}/preview`,{}),undoId:backup}))}>{tx('Préparer l’annulation')}</button>}</fieldset>
 {plan&&<div><h3>{tx('Réglages qui seront remplacés')}</h3><ul>{plan.changes.filter(c=>c.before!==c.after).map(c=><li key={c.address}>{setting(c.address)} : {display(c.before,c.address)} → {display(c.after,c.address)}</li>)}</ul><button disabled={!writable||busy} onClick={()=>{if(!confirm(tx('Appliquer ces changements au retour sélectionné ?')))return;void run(async()=>{const result=await api(plan.undoId?`/api/library/${plan.undoId}/apply`:'/api/monitor/copy/apply',{token:plan.token,confirm:true});setBackup(result.backupId);setPlan(null);});}}>{tx('Confirmer et appliquer')}</button><button onClick={()=>setPlan(null)}>{tx('Annuler')}</button></div>}{error&&<p role="alert">{tx(error)}</p>}</details>;
}
