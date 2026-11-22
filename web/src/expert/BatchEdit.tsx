import {useState} from 'react';
import {BATCH_SETTINGS,BATCH_TAPS,type BatchSetting} from '../../../shared/batch-edit';
import {type MixerProfile} from '../../../shared/mixer-models';
import {tx} from '../i18n';
import {presetApi,type LibraryEntry} from '../preset-controls';
import {PlanDialog,type Plan} from '../SoundCoach';
import {CommandUndo} from './CommandActivation';
import {type Values} from '../xair/controls';

type Link={channels:number[];setting:Exclude<BatchSetting,'tap'>;band:number};
export function BatchEdit({model,values,writable,mode,links,onLinks}:{model:MixerProfile;values:Values;writable:boolean;mode:'real'|'simulation';links:Link[];onLinks:(links:Link[])=>void}){
 const [channels,setChannels]=useState<number[]>([]);
 const [setting,setSetting]=useState<BatchSetting>('hpon'),[bus,setBus]=useState(1),[band,setBand]=useState(1),[value,setValue]=useState('1');
 const [plan,setPlan]=useState<Plan|null>(null),[backup,setBackup]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const definition=BATCH_SETTINGS[setting],isToggle=definition.min===0&&definition.max===1;
 const select=(channel:number,enabled:boolean)=>setChannels(old=>enabled?[...old,channel].sort((a,b)=>a-b):old.filter(c=>c!==channel));
 const run=async(task:()=>Promise<void>)=>{
  setBusy(true);setError('');setMessage('');
  try{await task();}catch(cause){const failure=cause as Error&{backupId?:string};setError(failure.message);if(failure.backupId)setBackup(failure.backupId);}
  finally{setBusy(false);}
 };
 const prepare=()=>run(async()=>{
  const result=await presetApi<Plan>('/api/library/batch-edit/preview',{model:model.id,channels,setting,bus,band,value:Number(value)});
  if(!result.token){setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}
  setPlan({...result,title:tx('Modifier plusieurs pistes'),explanation:tx('Appliquer cette valeur aux pistes cochées.'),inputs:[]});
 });
 return <details className="batch-edit">
  <summary>{tx('Modifier plusieurs pistes')}</summary>
  <fieldset disabled={busy}>
   <legend>{tx('Entrées à modifier')}</legend>
   <div className="batch-choices">
    {Array.from({length:model.channels},(_,i)=>i+1).map(channel=><label key={channel}>
     <input type="checkbox" checked={channels.includes(channel)} onChange={e=>select(channel,e.target.checked)}/>
     {channel} · {values[`/ch/${String(channel).padStart(2,'0')}/config/name`]||tx('Canal')}
    </label>)}
   </div>
   <div className="batch-fields">
    <label>{tx('Réglage commun')}<select value={setting} onChange={e=>{
     const next=e.target.value as BatchSetting;
     setSetting(next);
     setValue(BATCH_SETTINGS[next].max===1?'1':next==='hpf'?'80':'0');
    }}>{Object.entries(BATCH_SETTINGS).map(([key,s])=><option key={key} value={key}>{tx(s.label)}</option>)}</select></label>
    {setting==='tap'&&<label>{tx('Bus')}<select value={bus} onChange={e=>setBus(Number(e.target.value))}>{Array.from({length:model.monitorOutputs},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>}
    {setting==='eqGain'&&<label>{tx('Bande EQ')}<select value={band} onChange={e=>setBand(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>}
    <label>{tx('Valeur')}{setting==='tap'||isToggle?<select value={value} onChange={e=>setValue(e.target.value)}>
     {(setting==='tap'?BATCH_TAPS:['OFF','ON']).map((label,index)=><option value={index} key={label}>{tx(label)}</option>)}
    </select>:<input type="number" value={value} min={definition.min} max={definition.max} step={definition.step} onChange={e=>setValue(e.target.value)}/>}</label>
   </div>
   <div className="group-actions">
    <button type="button" disabled={!writable||channels.length<2||!value.trim()||Number(value)<definition.min||Number(value)>definition.max} onClick={()=>void prepare()}>{tx('Prévisualiser la sélection')}</button>
    {setting!=='tap'&&<button type="button" disabled={channels.length<2||links.some(link=>link.setting===setting&&(setting!=='eqGain'||link.band===band)&&link.channels.some(channel=>channels.includes(channel)))} onClick={()=>onLinks([...links,{channels,setting,band}])}>{tx('Mémoriser un lien de pistes')}</button>}
   </div>
  </fieldset>
  {links.map((link,index)=><p key={index}>{tx(BATCH_SETTINGS[link.setting].label)} · {link.channels.join(', ')}{link.setting==='eqGain'?' · '+link.band:''} <button type="button" onClick={()=>onLinks(links.filter((_,i)=>i!==index))}>{tx('Retirer le lien')}</button></p>)}
  {!!links.length&&<p>{tx('Les liens s’appliquent dans le mode Expert après activation. Seuls les paramètres liés changent ensemble.')}</p>}
  {message&&<p role="status">{tx(message)}</p>}{error&&!plan&&<p role="alert">{tx(error)}</p>}
  <CommandUndo backup={backup} canWrite={writable} mode={mode} beforeUndo={()=>{}}/>
  {plan&&<PlanDialog plan={plan} canApply={writable} busy={busy} mode={mode} error={error} onClose={()=>setPlan(null)} onApply={()=>void run(async()=>{
   const result=await presetApi<LibraryEntry&{backupId:string}>('/api/library/group-adjust/apply',{token:plan.token,confirm:true});
   setBackup(result.backupId);setPlan(null);setMessage('Sélection appliquée. Les réglages précédents sont dans l’historique.');
  })}/>}
 </details>;
}
export type {Link};
