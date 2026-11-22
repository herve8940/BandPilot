import {STEREO_LINK_NOTICE} from '../../shared/stereo-link';
import {useEffect,useId,useRef,useState} from 'react';
import {BookmarkPlus,RotateCcw,SlidersHorizontal,Undo2,X} from 'lucide-react';
import {PRESET_SECTIONS,type ChannelPreset,type PresetSection} from '../../shared/channel-preset';
import {tx} from './i18n';
import {PlanDialog,type Plan} from './SoundCoach';
import {presetApi,PresetSections,type LibraryEntry} from './preset-controls';
import './channel-presets.css';
import {MIXER_MODELS,type MixerModelId} from '../../shared/mixer-models';

/** Key this component by model and channel so a pending recall cannot follow a new selection. */
export function ChannelPresetActions({channel,name,model,online,canWrite,mode}:{channel:number;name:string;model:string;online:boolean;canWrite:boolean;mode:'real'|'simulation'}) {
  const panelId=useId(),formRef=useRef<HTMLDivElement>(null),operation=useRef(false);
  const [admin,setAdmin]=useState(false),[view,setView]=useState<'save'|'restore'|null>(null);
  const [entries,setEntries]=useState<LibraryEntry[]>([]),[presetId,setPresetId]=useState(''),[presetName,setPresetName]=useState('');
  const [sections,setSections]=useState<PresetSection[]>([...PRESET_SECTIONS]);
  const [stereo,setStereo]=useState(false),pair=channel%2?channel:channel-1;
  const supportsStereo=MIXER_MODELS[model as MixerModelId]?.family==='xair';
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [pending,setPending]=useState<{plan:Plan;path:string}|null>(null),[backupId,setBackupId]=useState('');
  useEffect(()=>{let active=true;void presetApi<{user:{role:string}|null}>('/api/auth').then(result=>{if(active)setAdmin(result.user?.role==='admin');}).catch(()=>{});return()=>{active=false;};},[]);
  useEffect(()=>{if(view)formRef.current?.querySelector<HTMLElement>('input:not([type=checkbox]),select')?.focus();},[view]);
  const run=async(task:()=>Promise<void>)=>{
    if(operation.current)return;
    operation.current=true;setBusy(true);setError('');setMessage('');
    try{await task();}catch(cause){const error=cause as Error&{backupId?:string};setError(error.message);if(error.backupId)setBackupId(error.backupId);}finally{operation.current=false;setBusy(false);}
  };
  const preset=entries.find(entry=>entry.id===presetId),data=preset?.data as ChannelPreset|undefined;
  const open=(next:'save'|'restore')=>{
    setView(next);setError('');setMessage('');setPending(null);
    if(next==='save'){setPresetName(name);setSections([...PRESET_SECTIONS]);setStereo(false);}
    else void run(async()=>{
      const library=await presetApi<LibraryEntry[]>('/api/library');
      const compatible=library.filter(entry=>entry.kind==='channel-preset'&&(entry.data as ChannelPreset).model===model);
      setEntries(compatible);setPresetId('');setSections([]);
    });
  };
  if(!admin)return null;
  return <section className="channel-preset-tools" aria-label={tx('Presets de cette entrée')}>
    <header>
      <div className="preset-tools-label"><SlidersHorizontal size={18} aria-hidden="true"/><div><b>{tx('Presets de cette entrée')}</b><small>{tx('Canal')} {channel} · {name}</small></div></div>
      <div className="preset-tools-buttons">
        <button type="button" disabled={busy||!online} aria-expanded={view==='save'} aria-controls={panelId} onClick={()=>open('save')}><BookmarkPlus size={16} aria-hidden="true"/>{tx('Sauvegarder')}</button>
        <button type="button" disabled={busy} aria-expanded={view==='restore'} aria-controls={panelId} onClick={()=>open('restore')}><RotateCcw size={16} aria-hidden="true"/>{tx('Restaurer')}</button>
      </div>
    </header>
    {view&&<div id={panelId} ref={formRef} className="preset-tools-content">
      <div className="preset-form-title"><h3>{tx(view==='save'?'Sauvegarder cette entrée':'Restaurer sur cette entrée')}</h3><button type="button" disabled={busy} aria-label={tx('Fermer')} onClick={()=>setView(null)}><X size={16}/></button></div>
      <p className="preset-note">{tx('EQ, compresseur et gate uniquement. Gain, 48 V, volumes, retours et routage restent inchangés.')}</p>
      <form onSubmit={event=>{event.preventDefault();void run(async()=>{
        if(view==='save'){
          if(!online||!sections.length||!presetName.trim())return;
          await presetApi('/api/library/capture-channel',{name:presetName.trim(),channel:stereo?pair:channel,sections,...(stereo?{stereo:true}:{})});
          setMessage('Preset sauvegardé. Retrouve-le dans Scènes et presets.');setView(null);
        }else if(preset&&canWrite&&sections.length){
          const dest=data?.version===2?pair:channel;
          const plan=await presetApi<Plan>(`/api/library/${preset.id}/preview`,{channel:dest,sections});
          if(!plan.token){setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}
          setPending({path:`/api/library/${preset.id}/apply`,plan:{...plan,title:`Rappeler « ${preset.name} »`,explanation:tx(data?.version===2?'Seuls les traitements cochés seront appliqués aux deux entrées.':'Seuls les traitements cochés seront appliqués au canal choisi.'),inputs:[data?.version===2?`${tx('Paire stéréo')} ${pair}–${pair+1}`:`${tx('Canal')} ${channel} · ${name}`]}});
        }
      });}}>
        <fieldset disabled={busy}>
          {view==='save'&&supportsStereo&&<label>{tx('Type de preset')}<select value={stereo?'stereo':'mono'} onChange={e=>setStereo(e.target.value==='stereo')}><option value="mono">{tx('Traitements d’un canal')}</option><option value="stereo">{tx('Paire stéréo')} {pair}–{pair+1}</option></select></label>}
          {view==='save'?<label>{tx('Nom du preset')}<input required maxLength={120} value={presetName} onChange={event=>setPresetName(event.target.value)}/></label>:<label>{tx('Preset à restaurer')}<select required value={presetId} onChange={event=>{setPresetId(event.target.value);setSections([...(entries.find(entry=>entry.id===event.target.value)?.data as ChannelPreset|undefined)?.sections??[]]);}}><option value="">{tx('Choisir un preset')}</option>{entries.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
          {(view==='save'||data)&&<PresetSections selected={sections} available={view==='save'?PRESET_SECTIONS:data?.sections} onChange={setSections}/>}
          {(view==='save'?stereo:data?.version===2)&&<p className="preset-note">{tx('Paire stéréo')} {pair}–{pair+1} · {tx('Les côtés gauche et droit sont sauvegardés séparément. La destination doit avoir le même état de liaison. Les liaisons ne sont pas modifiées.')}</p>}{(view==='save'?stereo:data?.version===2)&&<p className="preset-note">{tx(STEREO_LINK_NOTICE)}</p>}
          {view==='restore'&&!entries.length&&!busy&&<p>{tx('Aucun preset compatible. Sauvegarde cette entrée ou importe un preset dans Scènes et presets.')}</p>}
          {view==='restore'&&!canWrite&&<p>{tx('Pour appliquer, connecte la console et active son contrôle dans Réglages.')}</p>}
          <div className="preset-form-footer"><span>{tx(view==='save'?'Sauvegarde dans la bibliothèque, sans modifier le son.':'Les presets sont des points de départ : vérifie les seuils avec ton instrument.')}</span><button className="primary" disabled={busy||!sections.length||(view==='save'?(!online||!presetName.trim()):(!canWrite||!preset))}>{view==='save'?<BookmarkPlus size={16}/>:<RotateCcw size={16}/>} {tx(busy?'Lecture de la console…':view==='save'?'Sauvegarder le preset':'Prévisualiser le preset…')}</button></div>
        </fieldset>
      </form>
    </div>}
    {message&&<p role="status" className="preset-feedback">{tx(message)}</p>}
    {error&&<p role="alert" className="preset-feedback error">{tx(error)}</p>}
    {backupId&&<button className="preset-undo" type="button" disabled={busy||!canWrite} onClick={()=>void run(async()=>{
      const plan=await presetApi<Plan>(`/api/library/${backupId}/preview`,{});
      if(!plan.token){setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}
      setPending({path:`/api/library/${backupId}/apply`,plan:{...plan,title:tx('Revenir au réglage précédent'),inputs:[]}});
    })}><Undo2 size={16}/>{tx('Revenir au réglage précédent')}</button>}
    {pending&&<PlanDialog plan={pending.plan} busy={busy} canApply={canWrite&&online} mode={mode} onClose={()=>{setPending(null);setError('');}} error={error} onApply={()=>void run(async()=>{
      if(!canWrite||!online)return;
      const result=await presetApi<{backupId:string;ok?:boolean}>(pending.path,{token:pending.plan.token,confirm:true});
      setBackupId(result.backupId);setPending(null);setView(null);
      setMessage(result.ok===false?'Rappel envoyé, mais certaines valeurs relues diffèrent : vérifie la console.':'Preset restauré sur cette entrée. Tu peux revenir au réglage précédent.');
    })}/>}
  </section>;
}
