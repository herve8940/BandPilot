import {useEffect,useRef,useState} from 'react';
import {MIXER_MODELS} from '../../shared/mixer-models';
import {PORTABLE_LABELS,PORTABLE_MODEL,PORTABLE_SECTIONS,type PortableScene,type PortableSection} from '../../shared/portable-scene';
import {tx} from './i18n';
import {presetApi,type LibraryEntry,type PresetOptions} from './preset-controls';
import {useMixerModel} from './MixerModel';
import type {Plan} from './SoundCoach';
import './expert/studio-additions.css';

type Props={
 entries:LibraryEntry[];sources:LibraryEntry[];admin:boolean;busy:boolean;canWrite:boolean;
 run:(label:string,task:()=>Promise<string|void>)=>Promise<void>;
 onPreview:(entry:LibraryEntry,plan:Plan)=>void;onExport:(entry:LibraryEntry)=>void;onRemove:(entry:LibraryEntry)=>void;
};

export function PortableScenesPanel({entries,sources,admin,busy,canWrite,run,onPreview,onExport,onRemove}:Props){
 const model=useMixerModel();
 const [name,setName]=useState(''),[sourceId,setSourceId]=useState(''),[nativeSource,setNativeSource]=useState('');
 const [recall,setRecall]=useState('');
 const source=sources.find(e=>e.id===sourceId);
 const sourceNeedsModel=source&&(source.kind==='native-scene'||!(source.data as {model?:string}).model);
 const available=model.family==='xair';
 const editing=entries.find(e=>e.id===recall);
 const canCapture=admin&&!busy&&name.trim()&&(source?(!sourceNeedsModel||!!nativeSource):available);
 const capture=()=>void run('portable-capture',async()=>{
  const saved=await presetApi<LibraryEntry>('/api/library/capture-portable',{
   name:name.trim(),model:model.id,...(source?{sourceId:source.id,nativeSource}:{}),
  });
  setName('');setRecall(saved.id);
  return 'Scène portable enregistrée.';
 });
 return <section className="portable-scenes" aria-label={tx('Scènes portables')}>
  <header className="library-section-heading"><div><h3>{tx('Scènes portables')}</h3>
   <p>{tx(PORTABLE_MODEL)} {tx('Transfère les noms, couleurs, niveaux, mutes, panoramas et EQ de pistes mono. Le format JSON peut être importé sur un autre BandPilot.')}</p></div></header>
  {admin&&<fieldset className="scene-save feature-actions" disabled={busy}>
   <label>{tx('Nom de la scène')}<input value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
   <label>{tx('Source de la scène')}<select value={sourceId} onChange={e=>{setSourceId(e.target.value);setNativeSource('');}}>
    <option value="">{tx('Console actuelle')} · {model.label}</option>
    {sources.map(e=><option key={e.id} value={e.id}>{e.name}{e.kind==='native-scene'?' · .scn':''}</option>)}
   </select></label>
   {sourceNeedsModel&&<label>{tx('Modèle de la scène source')}<select value={nativeSource} onChange={e=>setNativeSource(e.target.value)}>
    <option value="">{tx('Choisir')}</option>
    {Object.values(MIXER_MODELS).filter(m=>source.kind==='native-scene'?['XR18','MR18','X18'].includes(m.id):m.family==='xair').map(m=><option key={m.id} value={m.id}>{m.brand} {m.label}</option>)}
   </select></label>}
   <button type="button" className="primary" disabled={!canCapture} onClick={capture}>{tx('Créer une scène portable')}</button>
  </fieldset>}
  {entries.length===0&&<p>{tx('Aucune scène portable dans la bibliothèque.')}</p>}
  <div className="portable-scene-list">
   {entries.map(e=>{
    const scene=e.data as PortableScene,sourceModel=MIXER_MODELS[scene.source];
    return <article className="scene-row" key={e.id}>
     <div className="scene-row-title"><b>{e.name}</b><small>{sourceModel.brand} {sourceModel.label} · {scene.tracks.length} {tx('pistes')}</small></div>
     {admin&&<div className="feature-actions">
      <button type="button" disabled={busy||!available} onClick={()=>setRecall(recall===e.id?'':e.id)}>{tx(recall===e.id?'Fermer':'Affecter les pistes')}</button>
      <button type="button" disabled={busy} onClick={()=>onExport(e)}>{tx('Exporter')}</button>
      <button type="button" disabled={busy} onClick={()=>onRemove(e)}>{tx('Supprimer')}</button>
     </div>}
    </article>;
   })}
  </div>
  {admin&&editing&&available&&<PortableMapping key={editing.id+':'+model.id} entry={editing} busy={busy} canWrite={canWrite} run={run} onPreview={onPreview}/>}
 </section>;
}

function PortableMapping({entry,busy,canWrite,run,onPreview}:{entry:LibraryEntry;busy:boolean;canWrite:boolean;run:Props['run'];onPreview:Props['onPreview']}){
 const scene=entry.data as PortableScene,model=useMixerModel();
 const [mapping,setMapping]=useState<Record<number,number>>({}),[sections,setSections]=useState<PortableSection[]>([]);
 const [targets,setTargets]=useState<PresetOptions['channels']>([]),panel=useRef<HTMLElement>(null);
 useEffect(()=>{
  panel.current?.scrollIntoView({block:'nearest'});
  let active=true;
  void presetApi<PresetOptions>('/api/library/preset-options').then(options=>{if(active&&options.model===model.id)setTargets(options.channels);}).catch(()=>undefined);
  return()=>{active=false;};
 },[model.id]);
 const channels=Object.entries(mapping).filter(([,target])=>target>0).map(([source,target])=>({source:Number(source),target}));
 const duplicate=new Set(channels.map(m=>m.target)).size!==channels.length;
 const preview=()=>void run('portable-preview',async()=>{
  const plan=await presetApi<Omit<Plan,'token'|'title'|'explanation'|'inputs'>&{token:string|null}>(`/api/library/${entry.id}/preview`,{model:model.id,mapping:channels,sections});
  if(!plan.token)return plan.excluded?.length?'Les protections conservent les réglages concernés. Aucun changement à appliquer.':'Rien ne change dans la sélection. Aucun réglage envoyé.';
  onPreview(entry,{...plan,token:plan.token,title:tx('Rappel portable')+' · '+entry.name,
   explanation:tx('Vérifie les destinations, le patch et les retours avant le rappel. Les traitements et les niveaux peuvent modifier le son des retours qui utilisent ces pistes.'),
   inputs:channels.map(({source,target})=>`${tx('Canal')} ${source} → ${model.label} ${target}`)});
 });
 return <section ref={panel} className="portable-scenes" aria-label={tx('Affecter les pistes')}>
  <h4>{entry.name} → {model.brand} {model.label}</h4>
  <p>{tx('Associe les entrées que tu veux rappeler et coche les réglages à transférer. Les pistes stéréo liées demandent un rappel natif ou sélectif.')}</p>
  <fieldset disabled={busy} className="feature-actions">
   <legend>{tx('Réglages à transférer')}</legend>
   {PORTABLE_SECTIONS.map(s=><label key={s} className="portable-toggle"><input type="checkbox" checked={sections.includes(s)} onChange={e=>setSections(e.target.checked?[...sections,s]:sections.filter(x=>x!==s))}/>{tx(PORTABLE_LABELS[s])}</label>)}
  </fieldset>
  <div className="feature-actions">
   <button type="button" disabled={busy} onClick={()=>setMapping(Object.fromEntries(scene.tracks.filter(track=>!track.linked&&track.channel<=model.channels).map(track=>[track.channel,track.channel])))}>{tx('Garder les mêmes numéros')}</button>
   <button type="button" disabled={busy||!channels.length} onClick={()=>setMapping({})}>{tx('Effacer les affectations')}</button>
  </div>
  <div className="portable-mapping">
   {scene.tracks.map(track=><label key={track.channel}>
    <span>{tx('Canal')} {track.channel}{track.name?' · '+track.name:''}</span>
    {track.linked?<small>{tx('Piste stéréo liée')}</small>:<select value={mapping[track.channel]??0} disabled={busy} onChange={e=>setMapping({...mapping,[track.channel]:Number(e.target.value)})}>
     <option value={0}>{tx('Ignorer cette piste')}</option>
     {Array.from({length:model.channels},(_,i)=><option key={i} value={i+1}>{tx('Canal')} {i+1}{targets[i]?.name?' · '+targets[i]!.name:''}</option>)}
    </select>}
   </label>)}
  </div>
  {duplicate&&<p role="alert">{tx('Chaque destination doit être unique.')}</p>}
  <div><button type="button" disabled={busy||!canWrite||duplicate||!sections.length||!channels.length} onClick={preview}>{tx('Prévisualiser le rappel portable')}</button></div>
 </section>;
}
