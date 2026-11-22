import {useEffect,useState} from 'react';
import type {AdjustmentGroup,GroupSelection} from '../../../shared/adjustment-group';
import {LiveGroupFader} from '../LiveGroupFader';
import {presetApi} from '../preset-controls';
import {PlanDialog,type Plan} from '../SoundCoach';
import {tx} from '../i18n';
import {CommandUndo} from './CommandActivation';

export function useBankGroups(model:string){
 const [groups,setGroups]=useState<AdjustmentGroup[]>([]);
 useEffect(()=>{
  let alive=true;
  const load=()=>void presetApi<AdjustmentGroup[]>('/api/adjustment-groups?model='+encodeURIComponent(model)).then(result=>{
   if(alive)setGroups(Array.isArray(result)?result.filter(g=>g.model===model&&(g.target==='fader'||g.target==='send')):[]);
  }).catch(()=>{if(alive)setGroups([]);});
  setGroups([]);load();
  window.addEventListener('bandpilot-groups-changed',load);
  return()=>{alive=false;window.removeEventListener('bandpilot-groups-changed',load);};
 },[model]);
 return groups.filter(group=>group.model===model);
}

export function GroupStrip({group,layer,canWrite,mode,onSpill}:{group:AdjustmentGroup;layer:number;canWrite:boolean;mode:'real'|'simulation';onSpill:()=>void}){
 const [backup,setBackup]=useState(''),[plan,setPlan]=useState<Plan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const selection:GroupSelection={channels:group.channels,target:layer?'send':'fader',...(layer?{bus:layer}:{})};
 const run=async(task:()=>Promise<void>)=>{
  setBusy(true);setError('');setMessage('');
  try{await task();}catch(cause){const e=cause as Error&{backupId?:string};setError(e.message);if(e.backupId)setBackup(e.backupId);}
  finally{setBusy(false);}
 };
 return <article role="listitem" className="bank-group-strip">
  <button type="button" className="name" onClick={onSpill} title={tx('Afficher uniquement les pistes du groupe')}>{group.name} ↓</button>
  <small>{layer?`${tx('Bus')} ${layer}` : tx('Façade')} · {group.channels.join(', ')}</small>
  <LiveGroupFader model={group.model} selection={selection} disabled={!canWrite||busy||!!plan} onBackup={setBackup} compact/>
  <button type="button" disabled={!canWrite||busy} onClick={()=>void run(async()=>{
   const result=await presetApi<Plan>('/api/library/group-mute/preview',{model:group.model,selection});
   if(!result.token){setMessage('Les pistes ou envois sélectionnés sont déjà coupés.');return;}
   setPlan({...result,title:tx('Couper le groupe'),explanation:tx(layer?'Les niveaux des envois vers ce retour passent à −∞. Ils sont sauvegardés pour le rétablissement. Un retour stéréo lié est traité sur ses deux bus.':'Les mutes des canaux seront activés. Ils peuvent également couper ces pistes dans les retours, selon le trajet de la console.'),inputs:[]});
  })}>{tx('Couper le groupe…')}</button>
  <CommandUndo backup={backup} canWrite={canWrite&&!busy} mode={mode} beforeUndo={()=>{}}/>
  {message&&<p role="status">{tx(message)}</p>}{error&&!plan&&<p role="alert">{tx(error)}</p>}
  {plan&&<PlanDialog plan={plan} busy={busy} canApply={canWrite} mode={mode} error={error} onClose={()=>setPlan(null)} onApply={()=>void run(async()=>{
   const result=await presetApi<{backupId:string}>('/api/library/group-adjust/apply',{token:plan.token,confirm:true});
   setBackup(result.backupId);setPlan(null);
  })}/>}
 </article>;
}
