import {useEffect,useRef,useState} from 'react';
import {commandIsTimed,type ConsoleCommand} from '../../../shared/console-command';
import {presetApi,type LibraryEntry} from '../preset-controls';
import {PlanDialog,type Plan} from '../SoundCoach';
import {CommandActivationDialog,CommandUndo,useCommandControl} from './CommandActivation';
import {tx} from '../i18n';

/** A saved button is inert until its preview is explicitly confirmed. */
export function SurfaceCommand({entry,canWrite,mode}:{entry:LibraryEntry|undefined;canWrite:boolean;mode:'real'|'simulation'}){
 const control=useCommandControl(canWrite);
 const locked=useRef(false);
 const [plan,setPlan]=useState<Plan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[backup,setBackup]=useState('');
 useEffect(()=>{if(!canWrite)setPlan(null);},[canWrite]);
 const run=async(task:()=>Promise<void>)=>{if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await task();}catch(e){const problem=e as Error&{backupId?:string};setError(problem.message);if(problem.backupId)setBackup(problem.backupId);}finally{locked.current=false;setBusy(false);}};
 return <div className="surface-command">
  <button type="button" disabled={!entry||!canWrite||busy||control.busy||control.active} onClick={()=>void run(async()=>{
   if(!entry)return;
   if(commandIsTimed(entry.data as ConsoleCommand)){await control.prepare([entry.id],'once');return;}
   const p=await presetApi<Plan>(`/api/library/commands/${entry.id}/preview`,{});
   if(p.token)setPlan({...p,title:entry.name,explanation:tx('Cette commande rappelle uniquement les réglages affichés. Vérifie les canaux et les valeurs avant de confirmer.'),inputs:[]});
  })}>{tx(entry?'Prévisualiser les changements':'Commande indisponible sur cet appareil')}</button>
  {control.active&&<button type="button" onClick={control.stop}>{tx('Arrêter les commandes actives')}</button>}
  <CommandActivationDialog control={control} canWrite={canWrite}/>
  <CommandUndo backup={control.backup||backup} canWrite={canWrite&&!busy} mode={mode} beforeUndo={control.stop}/>
  {plan&&entry&&<PlanDialog plan={plan} busy={busy} canApply={canWrite} mode={mode} error={error} onClose={()=>setPlan(null)} onApply={()=>void run(async()=>{
   const result=await presetApi<{backupId:string}>(`/api/library/commands/${entry.id}/apply`,{token:plan.token,confirm:true});setBackup(result.backupId);setPlan(null);
  })}/>}
  {(error||control.error)&&!plan&&!control.pending&&<p role="alert">{tx(error||control.error)}</p>}
 </div>;
}
