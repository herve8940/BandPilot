import {useEffect,useRef,useState} from 'react';
import {GROUP_TARGETS,groupSelection,type AdjustmentGroup,type GroupSelection} from '../../shared/adjustment-group';
import {tx} from './i18n';
import {presetApi} from './preset-controls';

export function SavedAdjustmentGroups({model,value,onLoad,disabled=false,fixedBus}:{model:string;value:GroupSelection;onLoad:(group:GroupSelection)=>void;disabled?:boolean;fixedBus?:number}){
 const [groups,setGroups]=useState<AdjustmentGroup[]>([]),[selected,setSelected]=useState(''),[name,setName]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[removing,setRemoving]=useState(false);
 const active=useRef(true),inFlight=useRef(false);
 const refresh=async()=>{const data=await presetApi<AdjustmentGroup[]>(`/api/adjustment-groups?model=${encodeURIComponent(model)}`);if(!Array.isArray(data))throw Error('Liste des groupes indisponible. Réessaie.');if(active.current){setGroups(data);setReady(true);}};
 useEffect(()=>{active.current=true;void refresh().catch(e=>{if(active.current)setError(e.message);});return()=>{active.current=false;};},[model]);
 const run=async(fn:()=>Promise<void>)=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');try{await fn();}catch(e){if(active.current)setError((e as Error).message);}finally{inFlight.current=false;if(active.current)setBusy(false);}};
 const available=groups.filter(g=>fixedBus===undefined||g.target==='send'&&g.bus===fixedBus),current=available.find(g=>g.id===selected);
 let valid=false;try{groupSelection(model,value);valid=true;}catch{}
 const save=async(replace:boolean)=>{const group=await presetApi<AdjustmentGroup>('/api/adjustment-groups',{model,name,...value,...(replace&&current?{id:current.id,revision:current.revision}:{})});if(!active.current)return;window.dispatchEvent(new window.Event('bandpilot-groups-changed'));setGroups(old=>[...old.filter(g=>g.id!==group.id),group]);setSelected(group.id);setName(group.name);setNotice('Groupe enregistré. Aucun réglage audio envoyé.');setRemoving(false);};
 return <section className="saved-adjustment-groups" aria-label={tx('Mes groupes')}>
  <div className="saved-group-heading"><strong>{tx('Mes groupes')}</strong><span>{tx('Sélections mémorisées')} · {model}</span></div>
  <p>{tx('Retrouve tes pistes et leur destination. Charger ou enregistrer un groupe ne modifie pas le son.')}</p>
  <div className="saved-group-fields">
   <label>{tx('Groupe mémorisé')}<select value={selected} disabled={disabled||busy||!ready} onChange={e=>{const id=e.target.value,g=available.find(g=>g.id===id);setSelected(id);setName(g?.name??'');setRemoving(false);setError('');setNotice('');if(g)onLoad(groupSelection(model,g));}}><option value="">{tx('Nouvelle sélection')}</option>{available.map(g=><option key={g.id} value={g.id}>{g.name} · {tx(GROUP_TARGETS[g.target])}{g.bus?` ${g.bus}`:g.band?` ${g.band}`:''}</option>)}</select></label>
   <label>{tx('Nom du groupe')}<input type="text" maxLength={60} value={name} disabled={disabled||busy} onChange={e=>{setName(e.target.value);setRemoving(false);setNotice('');}}/></label>
  </div>
  <div className="saved-group-actions">
   <button type="button" disabled={disabled||busy||!ready||!valid||!name.trim()} onClick={()=>void run(()=>save(false))}>{tx('Enregistrer un nouveau groupe')}</button>
   {current&&<><button type="button" disabled={disabled||busy||!valid||!name.trim()} onClick={()=>void run(()=>save(true))}>{tx('Mettre à jour ce groupe')}</button><button type="button" disabled={disabled||busy} onClick={()=>setRemoving(!removing)}>{tx('Supprimer ce groupe…')}</button></>}
   <button type="button" disabled={disabled||busy} onClick={()=>void run(async()=>{await refresh();if(active.current){setSelected('');setName('');setRemoving(false);setNotice('Liste rechargée. Sélectionne un groupe pour retrouver sa version enregistrée.');}})}>{tx('Recharger la liste')}</button>
  </div>
  {removing&&current&&<div className="saved-group-remove"><p>{tx('Supprimer ce groupe mémorisé ? Les réglages de la console restent inchangés.')} <strong>{current.name}</strong></p><button type="button" disabled={disabled||busy} onClick={()=>void run(async()=>{await presetApi('/api/adjustment-groups/remove',{model,id:current.id,revision:current.revision});if(active.current){window.dispatchEvent(new window.Event('bandpilot-groups-changed'));setGroups(old=>old.filter(g=>g.id!==current.id));setSelected('');setName('');setRemoving(false);setNotice('Groupe supprimé. La sélection actuelle reste disponible.');}})}>{tx('Confirmer la suppression du groupe')}</button><button type="button" disabled={busy} onClick={()=>setRemoving(false)}>{tx('Annuler')}</button></div>}
  <p className="group-adjust-hint">{tx('Les entrées sont mémorisées par numéro pour ce modèle. Vérifie leurs noms et la destination avant chaque application.')}</p>
  {notice&&<p role="status">{tx(notice)}</p>}{error&&<p role="alert" className="error">{tx(error)}</p>}
 </section>;
}
