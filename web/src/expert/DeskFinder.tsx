import {useEffect, useId, useRef, useState} from 'react';
import {ArrowRight, Search, X} from 'lucide-react';
import {tx} from '../i18n';

export type DeskDestination = {id:string; label:string; context:string; terms:string; open:()=>void};
const normalize = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function DeskFinder({destinations,onClose}:{destinations:DeskDestination[];onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [query,setQuery]=useState(''), [active,setActive]=useState(0);
  const id=useId();
  const words=normalize(query).trim().split(/\s+/);
  const results=destinations.filter(d=>words.every(w=>normalize(d.label+' '+d.context+' '+d.terms).includes(w))).slice(0,32);
  const index=Math.min(active,Math.max(0,results.length-1));
  useEffect(()=>{const el=dialog.current;el?.showModal();return ()=>el?.close();},[]);
  useEffect(()=>{dialog.current?.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});},[index,query]);
  const choose=(d:DeskDestination)=>{onClose();d.open();};
  return <dialog className="desk-finder" ref={dialog} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label={tx("Accès direct")}>
    <div className="finder-input"><Search size={20}/><input autoFocus role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={results.length?id+'-'+index:undefined}
      aria-label={tx("Chercher une tranche, un traitement ou une vue")} placeholder={tx("Chercher une tranche, un traitement ou une vue")} value={query}
      onChange={e=>{setQuery(e.target.value);setActive(0);}} onKeyDown={e=>{
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(Math.max(0,Math.min(results.length-1,index+(e.key==='ArrowDown'?1:-1))));}
        if(e.key==='Enter'&&results[index]){e.preventDefault();choose(results[index]);}
      }}/><button aria-label={tx("Fermer")} onClick={onClose}><X size={18}/></button></div>
    <div className="finder-results" role="listbox" id={id} aria-label={tx("Accès direct")}>{results.map((d,i)=><button key={d.id} role="option" tabIndex={-1} id={id+'-'+i} aria-selected={i===index} onClick={()=>choose(d)}><span>{d.label}</span><small>{d.context}</small><ArrowRight size={15}/></button>)}</div>
    {!results.length&&<p role="status">{tx("Aucun résultat")}</p>}
  </dialog>;
}
