import {RecallScopeMatrix,narrowScopes} from './RecallScopeMatrix';
import {OutputSceneRecallPanel} from './OutputSceneRecallPanel';
import {useEffect,useRef,useState} from 'react';
import {CheckSquare,RotateCcw,ShieldCheck,Undo2,X} from 'lucide-react';
import {SCENE_RECALL_LABELS,SCENE_RECALL_NOTICE,SCENE_RECALL_SECTIONS,SCENE_MAPPING_NOTICE,SCENE_MAPPING_INVALID,type SceneRecallSection,type SceneChannelMapping,type SceneRecallScope} from '../../shared/scene-recall';
import {PlanDialog,type Plan} from './SoundCoach';
import {presetApi,type LibraryEntry} from './preset-controls';
import {tx} from './i18n';
import {SceneProtectionSummary,type ProtectedSelection} from './SceneProtectionsPanel';
import './scene-recall.css';

type Options={model:string;family:string;channels:{channel:number;name:string;savedName?:string}[];destinations?:{channel:number;name:string}[]};
export function SceneRecallPanel({entry,mode,canWrite,onClose,onUpdated}:{entry:LibraryEntry;mode:'real'|'simulation';canWrite:boolean;onClose:()=>void;onUpdated:()=>Promise<void>}){
  const ref=useRef<HTMLElement>(null),working=useRef(false);
  const [options,setOptions]=useState<Options|null>(null),[channels,setChannels]=useState<number[]>([]);
  const [sections,setSections]=useState<SceneRecallSection[]>(['eq','compressor','gate']);
  const [destinations,setDestinations]=useState<Record<number,number>>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[backupId,setBackupId]=useState('');
  const [perChannel,setPerChannel]=useState<Record<string,SceneRecallSection[]>>({});
  const [scopeSaved,setScopeSaved]=useState(false);
  const scopePath=`/api/library/${entry.id}/recall-scope/inputs`;
  const [midiName,setMidiName]=useState('');
  const [excluded,setExcluded]=useState<ProtectedSelection>([]);
  useEffect(()=>{setExcluded([]);},[channels,sections,destinations]);
  const [pending,setPending]=useState<{plan:Plan;path:string}|null>(null);
  useEffect(()=>{
    let active=true;ref.current?.scrollIntoView?.({block:'nearest'});ref.current?.focus();
    void presetApi<Options>(entry.kind==='native-scene'?`/api/library/${entry.id}/selective-options`:'/api/library/preset-options').then(result=>{if(active)setOptions(result);}).catch(cause=>{if(active)setError(cause.message);});
    void presetApi<SceneRecallScope|null>(scopePath).then(scope=>{
      if(active&&scope&&Array.isArray(scope.channels)&&Array.isArray(scope.sections))setScopeSaved(true);
    }).catch(()=>{});
    return()=>{active=false;};
  },[]);
  const run=async(task:()=>Promise<void>)=>{
    if(working.current)return;working.current=true;setBusy(true);setError('');setMessage('');
    try{await task();}catch(cause){const error=cause as Error&{backupId?:string};setPending(null);setError(error.message);if(error.backupId)setBackupId(error.backupId);await onUpdated().catch(()=>{});}
    finally{working.current=false;setBusy(false);}
  };
  const scene=entry.data as {model?:string;values:Record<string,string|number>};
  const compatible=options?.family==='xair'&&(scene.model?scene.model===options.model:['XR18','MR18','X18'].includes(options?.model??''));
  const available=(options?.channels??[]).filter(c=>entry.kind==='native-scene'||Object.keys(scene.values).some(a=>a.startsWith(`/ch/${String(c.channel).padStart(2,'0')}/`)));
  const targets=options?.destinations??options?.channels??[];
  const mapping=channels.map(source=>({source,target:destinations[source]??source}));
  const mappingInvalid=new Set(mapping.map(m=>m.target)).size!==mapping.length||mapping.some(m=>!targets.some(t=>t.channel===m.target));
  const sourceName=(source:number)=>available.find(c=>c.channel===source)?.savedName??String(scene.values?.[`/ch/${String(source).padStart(2,'0')}/config/name`]??'');
  const inputLabel=(channel:number,name='')=>`${tx('Canal')} ${channel}${name?' · '+name:''}`;
  const mappingLabel=({source,target}:SceneChannelMapping)=>`${tx('Dans la scène')} : ${inputLabel(source,sourceName(source))} → ${tx('Sur la console')} : ${inputLabel(target,targets.find(t=>t.channel===target)?.name)}`;
  const overrides=narrowScopes(perChannel,channels.map(String),sections);
  const selectedScope=()=>({channels,sections,...(mapping.some(m=>m.source!==m.target)?{mapping}:{}),...(Object.keys(overrides).length?{perChannel:overrides}:{})});
  const loadScope=async()=>{
    const scope=await presetApi<SceneRecallScope|null>(scopePath);
    if(!scope)return;
    setChannels(scope.channels);setSections(scope.sections);setPerChannel(scope.perChannel??{});
    setDestinations(Object.fromEntries((scope.mapping??[]).map(({source,target})=>[source,target])));
    setExcluded([]);setPending(null);
    setMessage('Périmètre chargé. Prévisualise avant de rappeler.');
  };
  const saveMidi=async()=>{
    await presetApi('/api/library/midi-scenes',{name:midiName.trim()||entry.name,model:options?.model,sourceId:entry.id,scope:selectedScope()});
    setMidiName('');
    setMessage('Sélection MIDI enregistrée. Ouvre le menu MIDI pour lui affecter une touche.');
    window.dispatchEvent(new Event('bandpilot-midi-scenes-changed'));
  };
  const prepare=async(id:string,restore=false)=>{
    const remapped=mapping.some(m=>m.source!==m.target);
    const p=await presetApi<{token:string|null;changes:Plan['changes'];stereoLink?:Plan['stereoLink'];mapping?:SceneChannelMapping[];excluded?:ProtectedSelection}>(`/api/library/${id}/${restore?'preview':'selective-preview'}`,restore?{}:{scope:selectedScope()});
    setExcluded(p.excluded??[]);
    if(!p.token){setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}
    setPending({path:`/api/library/${id}/${restore?'apply':'selective-apply'}`,plan:{...p,token:p.token,title:tx(restore?'Annuler le rappel sélectif':'Vérifier le rappel sélectif'),explanation:tx(restore?'Seuls les réglages de cette sauvegarde seront restaurés.':SCENE_RECALL_NOTICE)+(remapped&&!restore?' '+tx(SCENE_MAPPING_NOTICE):''),inputs:restore?[]:remapped?(p.mapping??mapping).map(mappingLabel):channels.map(ch=>inputLabel(ch))}});
  };
  return <section ref={ref} tabIndex={-1} className="scene-recall-panel" aria-label={tx('Rappel sélectif')}>
    <header><span className="library-icon"><CheckSquare size={22}/></span><div><span className="library-eyebrow">{tx('RAPPELER SEULEMENT CE QUI EST UTILE')}</span><h3>{entry.name}</h3></div><button type="button" disabled={busy} aria-label={tx('Fermer le rappel sélectif')} onClick={onClose}><X size={18}/></button></header>
    <p className="scene-recall-notice"><ShieldCheck size={19}/><span>{tx(SCENE_RECALL_NOTICE)}</span></p>
    {options&&!compatible?<p role="status">{tx('Cette scène ne permet pas un rappel sélectif sur le modèle actuel.')}</p>:<form onSubmit={event=>{event.preventDefault();if(canWrite&&compatible&&channels.length&&sections.length&&!mappingInvalid)void run(()=>prepare(entry.id));}}>
      <fieldset disabled={busy||!compatible}>
        <div className="scene-recall-columns">
          <section><div className="scene-recall-heading"><h4>{tx('1. Choisir les entrées')}</h4><div><button type="button" onClick={()=>setChannels(available.map(c=>c.channel))}>{tx('Tout sélectionner')}</button><button type="button" onClick={()=>setChannels([])}>{tx('Tout désélectionner')}</button></div></div>
            <div className="scene-recall-channels">{available.map(c=>{
              const saved=c.savedName??String(scene.values?.[`/ch/${String(c.channel).padStart(2,'0')}/config/name`]??'');
              return <label key={c.channel} className={channels.includes(c.channel)?'selected':''}><input type="checkbox" checked={channels.includes(c.channel)} onChange={event=>setChannels(old=>event.target.checked?[...old,c.channel].sort((a,b)=>a-b):old.filter(n=>n!==c.channel))}/><span><b>{tx('Canal')} {c.channel}{saved?` · ${saved}`:''}</b>{c.name&&c.name!==saved&&<small>{tx('Actuellement :')} {c.name}</small>}</span></label>;
            })}</div><p className="scene-recall-hint">{tx('Pour une paire stéréo liée, sélectionne les deux entrées. Les liaisons existantes seront vérifiées avant le rappel.')}</p>
          </section>
          <section><h4>{tx('2. Choisir les réglages')}</h4><div className="scene-recall-sections">{SCENE_RECALL_SECTIONS.map(s=><label key={s} className={sections.includes(s)?'selected':''}><input type="checkbox" checked={sections.includes(s)} onChange={event=>setSections(old=>event.target.checked?[...old,s]:old.filter(v=>v!==s))}/><span>{tx(SCENE_RECALL_LABELS[s])}</span></label>)}</div></section>
        </div>
        {channels.length>0&&<section className="scene-recall-mapping" aria-label={tx('Destinations du rappel')}>
          <div className="scene-recall-heading"><h4>{tx('3. Vérifier les destinations')}</h4><button type="button" onClick={()=>{setDestinations({});setPending(null);setError('');setMessage('');}}>{tx('Garder les numéros de la scène')}</button></div>
          <p className="scene-recall-hint">{tx(SCENE_MAPPING_NOTICE)}</p>
          <div className="scene-mapping-rows">{mapping.map(m=><label key={m.source}>
            <span><small>{tx('Dans la scène')}</small><b>{inputLabel(m.source,sourceName(m.source))}</b></span><span aria-hidden="true">→</span>
            <span><small>{tx('Sur la console')}</small><select aria-label={tx('Destination pour l’entrée {{0}}').replace('{{0}}',String(m.source))} aria-invalid={mapping.filter(other=>other.target===m.target).length>1} value={m.target} onChange={e=>{setDestinations(old=>({...old,[m.source]:Number(e.target.value)}));setPending(null);setError('');setMessage('');}}>{targets.map(t=><option key={t.channel} value={t.channel}>{inputLabel(t.channel,t.name)}</option>)}</select></span>
          </label>)}</div>
          {mappingInvalid&&<p role="alert" className="scene-msg error">{tx(SCENE_MAPPING_INVALID)}</p>}
        </section>}
        <RecallScopeMatrix rows={channels.map(ch=>({id:String(ch),label:inputLabel(ch,sourceName(ch))}))} sections={sections} labels={SCENE_RECALL_LABELS} selections={overrides}
          onSelect={(id,keys)=>setPerChannel({...overrides,[id]:keys})}/>
        <div className="scope-actions">
          {scopeSaved&&<button type="button" onClick={()=>void run(loadScope)}>{tx('Charger le périmètre mémorisé')}</button>}
          <button type="button" disabled={!channels.length||!sections.length||mappingInvalid} onClick={()=>void run(async()=>{
            await presetApi(scopePath,{model:options?.model,scope:selectedScope()});setScopeSaved(true);
            setMessage('Périmètre de rappel mémorisé. Aucun réglage envoyé.');
          })}>{tx('Mémoriser ce périmètre')}</button>
        </div>
        <footer><span>{tx('La sélection prépare un aperçu. Elle ne change pas le son.')}</span><button type="submit" className="primary" disabled={busy||!canWrite||!channels.length||!sections.length||mappingInvalid}><RotateCcw size={16}/>{tx(busy?'Lecture de la console…':'Prévisualiser la sélection')}</button></footer>
      </fieldset>
    </form>}
    {compatible&&<details className="scene-midi-setup">
      <summary>{tx('Affecter cette sélection au MIDI')}</summary>
      <p>{tx('Enregistre les entrées et réglages choisis, puis affecte un bouton ou une pédale dans le menu MIDI.')}</p>
      <label>{tx('Nom de la commande MIDI')}<input value={midiName} maxLength={120} placeholder={entry.name} disabled={busy} onChange={e=>setMidiName(e.target.value)}/></label>
      <button type="button" disabled={busy||!channels.length||!sections.length||mappingInvalid} onClick={()=>void run(saveMidi)}>{tx('Enregistrer la sélection MIDI')}</button>
    </details>}
    {compatible&&<OutputSceneRecallPanel entry={entry} canWrite={canWrite&&!busy} onUpdated={onUpdated}/>}
    <SceneProtectionSummary excluded={excluded}/>
    {message&&<p role="status" className="scene-msg">{tx(message)}</p>}
    {error&&<p role="alert" className="scene-msg error">{tx(error)}</p>}
    {backupId&&<button type="button" disabled={busy||!canWrite} onClick={()=>void run(()=>prepare(backupId,true))}><Undo2 size={16}/>{tx('Annuler le rappel sélectif')}</button>}
    {pending&&<PlanDialog plan={pending.plan} busy={busy} canApply={canWrite} mode={mode} onClose={()=>setPending(null)} onApply={()=>void run(async()=>{
      if(!canWrite)return;
      const result=await presetApi<{backupId:string}>(pending.path,{token:pending.plan.token,confirm:true});
      setBackupId(result.backupId);setPending(null);setMessage('Sélection appliquée. Les réglages précédents sont dans l’historique.');await onUpdated();
    })}/>}
  </section>;
}
