import {useRef,useState} from 'react';
import {AcousticMeasurement} from './AcousticMeasurement';
import type {AcousticPoint} from '../../../shared/acoustic-measurement';
import {parseRoomCurve} from '../../../shared/room-eq';
import {tx} from '../i18n';
import {presetApi} from '../preset-controls';
import {PlanDialog,type Plan} from '../SoundCoach';
import {CommandUndo} from './CommandActivation';

type Common={model:string;canWrite:boolean;mode:'real'|'simulation'};
function useMixPreparation({canWrite,mode}:Common){
 const [plan,setPlan]=useState<Plan|null>(null),[backup,setBackup]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const locked=useRef(false);
 const run=async(task:()=>Promise<void>)=>{
  if(locked.current)return;
  locked.current=true;setBusy(true);setError('');setMessage('');
  try{await task();}catch(cause){const problem=cause as Error&{backupId?:string};setError(problem.message);if(problem.backupId)setBackup(problem.backupId);}
  finally{locked.current=false;setBusy(false);}
 };
 const prepare=(path:string,data:unknown,title:string,explanation:string)=>run(async()=>{
  const result=await presetApi<Plan>(path,data);
  if(!result.token){setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}
  setPlan({...result,title:tx(title),explanation:tx(explanation),inputs:[]});
 });
 const result=<>
  {message&&<p role="status">{tx(message)}</p>}{error&&!plan&&<p role="alert">{tx(error)}</p>}
  <CommandUndo backup={backup} canWrite={canWrite&&!busy} mode={mode} beforeUndo={()=>{}}/>
  {plan&&<PlanDialog plan={plan} busy={busy} canApply={canWrite} mode={mode} error={error} onClose={()=>setPlan(null)} onApply={()=>void run(async()=>{
   const result=await presetApi<{backupId:string}>('/api/library/group-adjust/apply',{token:plan.token,confirm:true});
   setBackup(result.backupId);setPlan(null);setMessage('Sélection appliquée. Les réglages précédents sont dans l’historique.');
  })}/>}
 </>;
 return {result,busy,prepare,run};
}

export function GainCompensationPanel(props:Common&{channel:number}){
 const {channel,model,canWrite}=props;
 const [delta,setDelta]=useState('-2');
 const view=useMixPreparation(props);
 const gain=Number(delta);
 return <details className="mix-preparation">
  <summary>{tx('Gain compensé')}</summary>
  <p>{tx('Prépare un changement de gain sur ce canal et compense son fader, ses envois avant fader et les seuils actifs. Le niveau pris à la source pour l’enregistrement peut changer.')}</p>
  <label>{tx('Variation de gain (dB)')} <input type="number" min={-6} max={6} step=".5" value={delta} disabled={view.busy} onChange={e=>setDelta(e.target.value)}/></label>
  <button type="button" disabled={!canWrite||view.busy||!gain||Math.abs(gain)>6||!Number.isInteger(gain*2)} onClick={()=>void view.prepare(
   '/api/library/gain-compensation/preview',{model,channel,delta:gain},'Gain compensé',
   'Vérifie la source, les seuils et les niveaux compensés. Écoute le résultat à faible niveau après application.'
  )}>{tx('Prévisualiser la sélection')}</button>
  {view.result}
 </details>;
}

export function RoomEqPanel(props:Common&{outputs:number;peak?:number}){
 const {model,canWrite,outputs,peak}=props;
 const [target,setTarget]=useState('/lr'),[cut,setCut]=useState(peak===undefined?3:1.5);
 const [file,setFile]=useState<File|null>(null),[measured,setMeasured]=useState<AcousticPoint[]|null>(null),[open,setOpen]=useState(false);
 const view=useMixPreparation(props);
 const prepare=async()=>{
  let curve=measured??undefined;
  if(peak===undefined&&!curve){
   if(!file)return;
   try{
    if(file.size>200000)throw Error('Fichier de mesure trop volumineux.');
    curve=parseRoomCurve(await file.text());
   }catch(error){await view.run(async()=>{throw error;});return;}
  }
  await view.prepare('/api/library/room-eq/preview',{model,target,maxCut:cut,...(curve?{curve}:{peak})},
   peak===undefined?'Correction d’EQ mesurée':'Atténuation d’un pic',
   'L’aperçu propose uniquement des atténuations sur le GEQ actif. Vérifie le retour ou la façade sélectionnés avant d’appliquer.');
 };
 return <details className="mix-preparation" onToggle={e=>{setOpen(e.currentTarget.open);if(!e.currentTarget.open)setMeasured(null);}}>
  <summary>{tx(peak===undefined?'Correction d’EQ mesurée':'Préparer une atténuation sur le GEQ')}</summary>
  <p>{tx(peak===undefined?'Importe une réponse mesurée avec un micro sur l’enceinte choisie. Le fichier doit contenir les fréquences en Hz et les niveaux en dB. Mesure avec le GEQ actuel.':'Vérifie à l’écoute que le pic vient du retour ou de la façade sélectionnés.')}{peak!==undefined&&<> · {Math.round(peak)} Hz</>}</p>
  <div className="preparation-fields">
   {peak===undefined&&<label>{tx('Fichier de mesure')}<input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" disabled={view.busy} onChange={e=>{setMeasured(null);setFile(e.target.files?.[0]??null);}}/></label>}
   <label>{tx('Sortie à corriger')}<select value={target} disabled={view.busy} onChange={e=>{setMeasured(null);setTarget(e.target.value);}}>
    <option value="/lr">{tx('Façade')}</option>{Array.from({length:outputs},(_,i)=><option key={i} value={'/bus/'+(i+1)}>{tx('Bus')} {i+1}</option>)}
   </select></label>
   <label>{tx('Atténuation maximale (dB)')}<select value={cut} disabled={view.busy} onChange={e=>setCut(Number(e.target.value))}>
    {Array.from({length:peak===undefined?12:6},(_,i)=>(i+1)/2).map(n=><option key={n}>{n}</option>)}
   </select></label>
  </div>
  {peak===undefined&&open&&<AcousticMeasurement key={target} curve={measured} onCurve={curve=>{setMeasured(curve);if(curve)setFile(null);}}/>}
  <button type="button" disabled={!canWrite||view.busy||peak===undefined&&!file&&!measured} onClick={()=>void prepare()}>{tx('Prévisualiser la sélection')}</button>
  {view.result}
 </details>;
}
