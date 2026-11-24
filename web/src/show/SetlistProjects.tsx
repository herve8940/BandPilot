import {useEffect,useRef,useState} from 'react';
import type {RehearsalStatus} from '../../../shared/rehearsal-desk';
import {tx} from '../i18n';
import {deskApi} from './rehearsal-api';

export function SetlistProjects({remaining,onAdded}:{remaining:number;onAdded:(ids:string[])=>Promise<void>}){
 const [state,setState]=useState<RehearsalStatus|null>(null),[selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const pending=useRef(false);
 async function refresh(signal?:AbortSignal){
  try{const data=await deskApi<RehearsalStatus>('state?files=1',undefined,undefined,signal);
   if(!signal?.aborted){setState(data);setMessage('');setSelected(ids=>ids.filter(id=>data.tabs.some(t=>t.id===id)));}
  }catch{if(!signal?.aborted)setMessage('Impossible de lire les projets de Répéter.');}
 }
 useEffect(()=>{const abort=new AbortController();void refresh(abort.signal);return ()=>abort.abort();},[]);
 async function add(){
  if(pending.current||!selected.length||selected.length>remaining)return;
  pending.current=true;setBusy(true);setMessage('');
  try{
   const projects=state!.tabs.filter(t=>selected.includes(t.id)).map(t=>t.id);
   const {songIds}=await deskApi<{songIds:string[]}>('import-songs',{projects});
   await onAdded(songIds);setSelected([]);setMessage('Morceaux ajoutés à la setlist.');
  }catch(e){setMessage((e as Error).message);}finally{pending.current=false;setBusy(false);}
 }
 return <section className="concert-import" aria-label={tx('Projets ouverts dans Répéter')}>
  <div><h3>{tx('Projets ouverts dans Répéter')}</h3>{state&&state.tabs.length>1&&<button type="button" disabled={busy} onClick={()=>setSelected(selected.length===state.tabs.length?[]:state.tabs.map(tab=>tab.id))}>{tx(selected.length===state.tabs.length?'Tout désélectionner':'Tout sélectionner')}</button>}<button type="button" disabled={busy} onClick={()=>void refresh()}>{tx('Actualiser')}</button></div>
  {state?.tabs.length?<fieldset disabled={busy}><legend>{tx('Choisis les morceaux à ajouter.')}</legend>
   {state.tabs.map(t=><label key={t.id}><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,t.id]:ids.filter(id=>id!==t.id))}/><span>{t.number} · {t.title||tx('Sans titre')}</span></label>)}
   <button type="button" disabled={!selected.length||selected.length>remaining} onClick={()=>void add()}>{tx('Ajouter à la setlist')}{selected.length>0?' ('+selected.length+')':''}</button></fieldset>:
   <p>{tx(state?'Ouvre les projets dans REAPER, puis actualise la liste.':'Lecture des projets…')}</p>}
  {selected.length>remaining&&<p role="status">{tx('La setlist accepte jusqu’à 100 morceaux.')}</p>}
  {message&&<p role="status">{tx(message)}</p>}
 </section>;
}
