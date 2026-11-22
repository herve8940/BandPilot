import {LiveGroupFader} from './LiveGroupFader';
import {STEREO_LINK_NOTICE} from '../../shared/stereo-link';
import {GROUP_TARGETS,type GroupSelection} from '../../shared/adjustment-group';
import {SavedAdjustmentGroups} from './SavedAdjustmentGroups';
import {useEffect,useRef,useState} from 'react';
import {SlidersHorizontal,Undo2} from 'lucide-react';
import {MIXER_MODELS,type MixerModelId} from '../../shared/mixer-models';
import {tx} from './i18n';
import {presetApi,type PresetOptions} from './preset-controls';
import {PlanDialog,type Plan} from './SoundCoach';
import './grouped-adjustments.css';

type GroupedProps={model:string;canWrite:boolean;mode:'real'|'simulation';fixedBus?:number;onSpill?:(channels:number[])=>void};
export function GroupedAdjustments(props:GroupedProps){return <GroupedEditor key={`${props.model}:${props.mode}:${props.fixedBus??'all'}`} {...props}/>;}
function GroupedEditor({model,canWrite,mode,fixedBus,onSpill}:GroupedProps){
  const [admin,setAdmin]=useState(false),[open,setOpen]=useState(false),[options,setOptions]=useState<PresetOptions|null>(null);
  const [channels,setChannels]=useState<number[]>([]),[target,setTarget]=useState<GroupSelection['target']>(fixedBus===undefined?'fader':'send'),[delta,setDelta]=useState('-1'),[bus,setBus]=useState(fixedBus??1),[band,setBand]=useState(1);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[backup,setBackup]=useState(''),[muteBackup,setMuteBackup]=useState<{id:string;send:boolean}|null>(null);
  const [pending,setPending]=useState<{plan:Plan;path:string;kind?:'mute'|'restore-mutes'}|null>(null),operation=useRef(false);
  useEffect(()=>{let active=true;void presetApi<{user:{role:string}|null}>('/api/auth').then(v=>{if(active)setAdmin(v.user?.role==='admin');}).catch(()=>{});return()=>{active=false;};},[]);
  useEffect(()=>{let active=true;if(open)void presetApi<PresetOptions>('/api/library/preset-options').then(v=>{if(active){if(v.model!==model)throw Error('Connexion modifiée');setOptions(v);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[open,model]);
  const run=async(task:()=>Promise<void>)=>{
    if(operation.current)return;operation.current=true;setBusy(true);setError('');setMessage('');
    try{await task();}catch(e){const error=e as Error&{backupId?:string};setError(error.message);if(error.backupId){setBackup(error.backupId);if(pending?.kind==='mute')setMuteBackup({id:error.backupId,send:target==='send'});}}finally{operation.current=false;setBusy(false);}
  };
  if(!admin||MIXER_MODELS[model as MixerModelId]?.family!=='xair')return null;
  const valid=!!options&&channels.length>=2&&channels.every(n=>options.channels.some(c=>c.channel===n))&&Number.isFinite(Number(delta))&&Number(delta)!==0&&Math.abs(Number(delta))<=12;
  const labels=GROUP_TARGETS;
  const selection:GroupSelection={channels,target,...(target==='eq'?{band}:{}),...(target==='send'?{bus}:{})};
  return <section className="group-adjustments" aria-label={tx('Réglages groupés')}>
    <button type="button" aria-expanded={open} disabled={busy} onClick={()=>setOpen(!open)}><SlidersHorizontal size={17}/>{tx('Réglages groupés')}</button>
    {open&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{
      if(!canWrite||!valid)return;
      const plan=await presetApi<Plan&{skippedSilent:number;buses:number[]}>('/api/library/group-adjust/preview',{model,channels,target,delta:Number(delta),...(target==='eq'?{band}:{}),...(target==='send'?{bus}:{})});
      if(!plan.token){setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}
      setPending({path:'/api/library/group-adjust/apply',plan:{...plan,title:tx('Réglages groupés'),explanation:`${tx(labels[target]!)}${target==='send'?` · ${tx('Bus')} ${plan.buses.join('–')}`:target==='eq'?` ${band}`:''} · ${Number(delta)>0?'+':''}${Number(delta)} dB. ${tx('Les écarts entre les entrées sont conservés, dans la précision de la console.')}${plan.skippedSilent?` ${tx('Niveaux déjà à −∞ conservés :')} ${plan.skippedSilent}.`:''}`,inputs:channels.map(n=>`${tx('Canal')} ${n} · ${options?.channels.find(c=>c.channel===n)?.name??''}`)}});
    });}}>
      <p>{tx('Choisis plusieurs entrées et décale le même réglage en dB. Vérifie l’aperçu avant d’appliquer. Tu peux mémoriser cette sélection dans Mes groupes.')}</p>
      <SavedAdjustmentGroups model={model} value={selection} fixedBus={fixedBus} disabled={busy} onLoad={g=>{setChannels(g.channels);setTarget(g.target);setBus(g.bus??fixedBus??1);setBand(g.band??1);setDelta('-1');setPending(null);setError('');setMessage('Groupe chargé. Vérifie la sélection et choisis le décalage avant de prévisualiser.');}}/>
      <fieldset disabled={busy||!options}>
        <legend>{tx('Entrées à modifier')}</legend>
        <div className="group-adjust-channels">{options?.channels.map(c=><label key={c.channel}><input type="checkbox" checked={channels.includes(c.channel)} onChange={e=>setChannels(e.target.checked?[...channels,c.channel].sort((a,b)=>a-b):channels.filter(n=>n!==c.channel))}/><span>{c.channel} · {c.name||tx('Canal')}</span></label>)}</div>
        <div className="group-adjust-fields">
          <label>{tx('Réglage commun')}<select value={target} disabled={fixedBus!==undefined} onChange={e=>setTarget(e.target.value as GroupSelection['target'])}>{Object.entries(labels).map(([id,label])=><option value={id} key={id}>{tx(label)}</option>)}</select></label>
          {target==='send'&&<label>{tx('Retour de destination')}<select value={bus} disabled={fixedBus!==undefined} onChange={e=>setBus(Number(e.target.value))}>{Array.from({length:options?.monitorOutputs??0},(_,i)=>i+1).map(n=><option key={n} value={n}>{tx('Bus')} {n}</option>)}</select></label>}
          {target==='eq'&&<label>{tx('Bande EQ')}<select value={band} onChange={e=>setBand(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
          <label>{tx('Décalage (dB)')}<input type="number" min="-12" max="12" step="0.5" required value={delta} onChange={e=>setDelta(e.target.value)}/></label>
        </div>
        <p className="group-adjust-hint">{tx(STEREO_LINK_NOTICE)}</p><p className="group-adjust-hint">{tx('Sélectionne les deux entrées d’une paire liée. Un retour stéréo lié est traité sur ses deux bus. Les niveaux à −∞ restent à −∞.')}</p>
        <button type="submit" className="primary" disabled={busy||!canWrite||!valid}>{tx(busy?'Lecture de la console…':'Prévisualiser les réglages…')}</button>
      </fieldset>
      <div className="group-actions">
        {onSpill&&<button type="button" disabled={!options||channels.length<2} onClick={()=>onSpill(channels)}>{tx('Afficher uniquement les pistes du groupe')}</button>}
        {['fader','send'].includes(target)&&<button type="button" disabled={busy||!canWrite||!options||channels.length<2} onClick={()=>void run(async()=>{
          const plan=await presetApi<Plan>('/api/library/group-mute/preview',{model,selection});
          if(!plan.token){setMessage('Les pistes ou envois sélectionnés sont déjà coupés.');return;}
          setPending({path:'/api/library/group-adjust/apply',kind:'mute',plan:{...plan,title:tx('Couper le groupe'),explanation:tx(target==='send'?'Les niveaux des envois vers ce retour passent à −∞. Ils sont sauvegardés pour le rétablissement. Un retour stéréo lié est traité sur ses deux bus.':'Les mutes des canaux seront activés. Ils peuvent également couper ces pistes dans les retours, selon le trajet de la console.'),inputs:[]}});
        })}>{tx('Couper le groupe…')}</button>}
        {muteBackup&&<button type="button" disabled={busy||!canWrite} onClick={()=>void run(async()=>{
          const plan=await presetApi<Plan>(`/api/library/${muteBackup.id}/preview`,{});
          if(!plan.token){setMuteBackup(null);setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}
          setPending({path:`/api/library/${muteBackup.id}/apply`,kind:'restore-mutes',plan:{...plan,title:tx(muteBackup.send?'Rétablir les envois précédents':'Rétablir les mutes précédents'),explanation:tx(muteBackup.send?'Vérifie les niveaux à restaurer. Les envois déjà à −∞ avant la coupure le restent.':'Vérifie les changements : les pistes déjà coupées avant cette action le restent. Les niveaux ne changent pas.'),inputs:[]}});
        })}>{tx(muteBackup.send?'Rétablir les envois précédents':'Rétablir les mutes précédents')}</button>}
      </div>
      <LiveGroupFader model={model} selection={selection} disabled={busy||!!pending||!canWrite||!options} onBackup={setBackup}/>
    </form>}
    {message&&<p role="status">{tx(message)}</p>}{error&&!pending&&<p className="error" role="alert">{tx(error)}</p>}
    {backup&&<button type="button" disabled={busy||!canWrite} onClick={()=>void run(async()=>{
      const plan=await presetApi<Plan>(`/api/library/${backup}/preview`,{});
      if(!plan.token){setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}
      setPending({path:`/api/library/${backup}/apply`,plan:{...plan,title:tx('Revenir au réglage précédent'),explanation:tx('Seuls les réglages de cette sauvegarde seront restaurés.'),inputs:[]}});
    })}><Undo2 size={16}/>{tx('Revenir au réglage précédent')}</button>}
    {pending&&<PlanDialog plan={pending.plan} busy={busy} canApply={canWrite} mode={mode} error={error} onClose={()=>{setPending(null);setError('');}} onApply={()=>void run(async()=>{
      if(!canWrite)return;
      const result=await presetApi<{backupId:string;ok:boolean}>(pending.path,{token:pending.plan.token,confirm:true});
      setBackup(result.backupId);if(pending.kind==='mute')setMuteBackup({id:result.backupId,send:target==='send'});if(pending.kind==='restore-mutes')setMuteBackup(null);setPending(null);setMessage(result.ok?'Réglages appliqués. Le réglage précédent est disponible ici et dans l’historique.':'Rappel envoyé, mais certaines valeurs relues diffèrent : vérifie la console.');
    })}/>}
  </section>;
}
