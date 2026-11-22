import {MIXER_MODELS,type MixerModelId} from '../../shared/mixer-models';
import {presetApi} from './preset-controls';
import {STEREO_LINK_NOTICE} from '../../shared/stereo-link';
import {useEffect, useState} from 'react';
import {tx, getLocale} from './i18n';
import {BookmarkPlus, SlidersHorizontal, Sparkles, Search, Download, Trash2, ChevronRight} from 'lucide-react';
import {PresetSections as Sections, PRESET_LABELS as LABELS, type LibraryEntry as Entry, type PresetOptions as Options} from './preset-controls';
import {PRESET_SECTIONS, type ChannelPreset, type PresetSection} from '../../shared/channel-preset';
import './channel-presets.css';

function PresetRow({entry,options,admin,disabled,canWrite,onRecall,onExport,onRemove,onConvert}:{entry:Entry;options:Options|null;onConvert:(e:Entry,channel:number)=>void;admin:boolean;disabled:boolean;canWrite:boolean;onRecall:(e:Entry,channel:number,sections:PresetSection[])=>void;onExport:(e:Entry)=>void;onRemove:(e:Entry)=>void}) {
  const p=entry.data as ChannelPreset;
  const [channel,setChannel]=useState(1),[sections,setSections]=useState(p.sections),[expanded,setExpanded]=useState(false);
  const compatible=options?.model===p.model;
  return <article className="preset-card preset-row">
    <header className="preset-card-head"><span className="library-icon"><SlidersHorizontal size={21}/></span><div><small>{p.model} · {tx(p.version===2?'Paire stéréo':'Canal')} {p.sourceChannel}{p.version===2?`–${p.sourceChannel+1}`:''}</small><h4>{entry.name}</h4></div></header>
    {p.version===2&&<p className="preset-note">{tx(p.linked?'Paire liée sur la console':'Deux entrées indépendantes')}</p>}
    <div className="preset-tags">{p.sections.map(section=><span key={section}>{tx(LABELS[section])}</span>)}</div>
    <small className="preset-date">{new Date(entry.createdAt).toLocaleDateString(getLocale(),{dateStyle:'medium'})}</small>
    {options&&!compatible&&<p className="preset-note">{tx('Choisis le modèle de console du preset pour le rappeler.')}</p>}
    {admin&&!compatible&&options?.family==='xair'&&MIXER_MODELS[p.model as MixerModelId]?.family==='xair'&&<div className="preset-convert"><p>{tx('Créer une copie compatible conserve les traitements. Aucun réglage audio n’est envoyé et le preset original est conservé.')}</p><label>{tx('Canal repère de la copie')}<select value={channel} disabled={disabled} onChange={e=>setChannel(Number(e.target.value))}>{options.channels.filter(c=>p.version!==2||c.channel%2===1&&c.channel<options.channels.length).map(c=><option key={c.channel} value={c.channel}>{c.channel}{p.version===2?`–${c.channel+1}`:''}</option>)}</select></label><button type="button" disabled={disabled} onClick={()=>onConvert(entry,channel)}>{tx('Créer une copie pour')} {options.model}</button></div>}
    <footer className="preset-card-actions">{admin&&<button type="button" disabled={disabled||!compatible} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{tx('Restaurer')}<ChevronRight size={16}/></button>}<div><button type="button" title={tx('Exporter')} aria-label={`${tx('Exporter')} · ${entry.name}`} disabled={disabled} onClick={()=>onExport(entry)}><Download size={16}/></button>{admin&&<button type="button" title={tx('Supprimer')} aria-label={`${tx('Supprimer')} · ${entry.name}`} disabled={disabled} onClick={()=>onRemove(entry)}><Trash2 size={16}/></button>}</div></footer>
    {admin&&<fieldset hidden={!expanded} disabled={disabled} className="preset-recall">
      <label>{tx(p.version===2?'Paire de destination':'Canal de destination')}<select value={channel} onChange={e=>setChannel(Number(e.target.value))}>{options?.channels.filter(c=>p.version!==2||c.channel%2===1&&options.channels.some(other=>other.channel===c.channel+1)).map(c=><option key={c.channel} value={c.channel}>{tx(p.version===2?'Paire stéréo':'Canal')} {c.channel}{p.version===2?`–${c.channel+1}`:''}{c.name?` · ${c.name}`:''}</option>)}</select></label>
      <Sections selected={sections} available={p.sections} onChange={setSections}/>
      <button type="button" className="primary" disabled={!canWrite||!compatible||!sections.length} onClick={()=>onRecall(entry,channel,sections)}>{tx('Prévisualiser le preset…')}</button>
    </fieldset>}
  </article>;
}

function FxRow({entry,disabled,admin,canWrite,onRecall,onExport,onRemove}:{entry:Entry;disabled:boolean;admin:boolean;canWrite:boolean;onRecall:(e:Entry,slot:number)=>void;onExport:(e:Entry)=>void;onRemove:(e:Entry)=>void}){
  const [slot,setSlot]=useState((entry.data as {slot:number}).slot);
  return <article className="scene-row"><div><b>{entry.name}</b><small>{tx('Effet FX')}</small></div><div className="scene-actions">{admin&&<><label>{tx('Destination FX')}<select value={slot} disabled={disabled} onChange={e=>setSlot(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>FX {n}</option>)}</select></label><button disabled={disabled||!canWrite} onClick={()=>onRecall(entry,slot)}>{tx('Rappeler…')}</button></>}<button disabled={disabled} onClick={()=>onExport(entry)}>{tx('Exporter')}</button>{admin&&<button disabled={disabled} onClick={()=>onRemove(entry)}>{tx('Supprimer')}</button>}</div></article>;
}
export function ChannelPresetsPanel({entries,admin,busy,canWrite,run,onRecall,onRecallFx,onExport,onRemove}:{entries:Entry[];admin:boolean;busy:boolean;canWrite:boolean;run:(key:string,task:()=>Promise<string|void>)=>Promise<void>;onRecall:(e:Entry,channel:number,sections:PresetSection[])=>void;onRecallFx:(e:Entry,slot:number)=>void;onExport:(e:Entry)=>void;onRemove:(e:Entry)=>void}) {
  const [options,setOptions]=useState<Options|null>(null),[loadError,setLoadError]=useState('');
  const [search,setSearch]=useState('');
  const [name,setName]=useState(''),[channel,setChannel]=useState(1),[sections,setSections]=useState<PresetSection[]>([...PRESET_SECTIONS]),[source,setSource]=useState(''),[kind,setKind]=useState('channel'),[slot,setSlot]=useState(1);
  useEffect(()=>{let active=true;fetch('/api/library/preset-options').then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);if(active)setOptions(v);}).catch(e=>{if(active)setLoadError(e.message);});return()=>{active=false;};},[entries]);
  const scenes=entries.filter(e=>e.kind==='scene'&&(e.data as {version?:number}).version===2);
  const sourceValues=(scenes.find(e=>e.id===source)?.data as {values?:Record<string,string|number>}|undefined)?.values;
  const presets=entries.filter(e=>e.kind==='channel-preset');
  const matches=(entry:Entry)=>entry.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const fx=entries.filter(e=>e.kind==='fx');
  return <section className="channel-presets" aria-label={tx('Presets ciblés')}>
    <div className="library-section-heading"><div><span className="library-eyebrow">{tx('TA BIBLIOTHÈQUE SONORE')}</span><h3>{tx('Presets par piste')}</h3></div><span className="library-count">{presets.length+fx.length}</span></div>
    <p>{tx('Garde le traitement d’un instrument et retrouve-le sur le canal de ton choix. Les gains, volumes, retours et routages restent inchangés.')}</p>
    {loadError&&<p role="alert">{tx(loadError)}</p>}
    {admin&&<details className="preset-create" open={presets.length+fx.length===0?true:undefined}><summary><BookmarkPlus size={18}/>{tx('Créer un preset')}<span>{tx('Canal ou effet FX')}</span></summary><form onSubmit={e=>{e.preventDefault();void run('save-preset',async()=>{
      const payload={name:name.trim(),...(kind==='fx'?{slot}:{channel,sections,...(kind==='stereo'?{stereo:true}:{}),...(source?{sourceId:source}:{})})};
      const r=await fetch(kind==='fx'?'/api/library/capture-fx':'/api/library/capture-channel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await r.json();if(!r.ok)throw Error(result.error);setName('');return 'Preset sauvegardé dans ta bibliothèque. Tu peux maintenant l’exporter.';
    });}}><fieldset disabled={busy||!options} className="preset-save">
      <label>{tx('Type de preset')}<select value={kind} onChange={e=>{setKind(e.target.value);if(e.target.value==='stereo'&&channel%2===0)setChannel(channel-1);}}><option value="channel">{tx('Traitements d’un canal')}</option>{options?.family==='xair'&&<><option value="stereo">{tx('Traitements d’une paire stéréo')}</option><option value="fx">{tx('Effet FX')}</option></>}</select></label>
      <label>{tx('Nom du preset')}<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder={tx('Ex. : Voix douce, basse précise…')}/></label>
      {kind!=='fx'?<>
        <label>{tx('Prendre les réglages depuis')}<select value={source} onChange={e=>setSource(e.target.value)}><option value="">{tx('État actuel de la console')}</option>{scenes.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label>{tx(kind==='stereo'?'Paire source':'Canal source')}<select value={channel} onChange={e=>setChannel(Number(e.target.value))}>{options?.channels.filter(c=>kind!=='stereo'||c.channel%2===1&&options.channels.some(other=>other.channel===c.channel+1)).map(c=>{const label=sourceValues?sourceValues[`/ch/${String(c.channel).padStart(2,'0')}/config/name`]:c.name;return <option key={c.channel} value={c.channel}>{tx(kind==='stereo'?'Paire stéréo':'Canal')} {c.channel}{kind==='stereo'?`–${c.channel+1}`:''}{label?` · ${label}`:''}</option>;})}</select></label>
        {kind==='stereo'&&<p className="preset-note">{tx('Les côtés gauche et droit sont sauvegardés séparément. La destination doit avoir le même état de liaison. Les liaisons ne sont pas modifiées.')}</p>}{kind==='stereo'&&<p className="preset-note">{tx(STEREO_LINK_NOTICE)}</p>}
        <Sections selected={sections} onChange={setSections}/>
        <p className="preset-note">{tx('Les seuils de compression et de gate sont conservés : vérifie-les avec le niveau de ton instrument après le rappel.')}</p>
      </>:<><label>{tx('Emplacement FX')}<select value={slot} onChange={e=>setSlot(Number(e.target.value))}>{[1,2,3,4].map(n=><option value={n} key={n}>FX {n}</option>)}</select></label><p className="preset-note">{tx('L’effet est sauvegardé seul, sans les envois ni les retours. Au rappel, choisis son emplacement : tous les canaux qui l’utilisent seront concernés.')}</p></>}
      <button className="primary" disabled={!name.trim()||(kind!=='fx'&&!sections.length)}>{tx('Sauvegarder le preset')}</button>
    </fieldset></form></details>}
    {(presets.length>0||fx.length>0)&&<label className="library-search"><Search size={18}/><input type="search" aria-label={tx('Rechercher un preset')} placeholder={tx('Rechercher un preset')} value={search} onChange={e=>setSearch(e.target.value)}/></label>}
    <div className="preset-grid">{presets.filter(matches).map(e=><PresetRow key={e.id} entry={e} options={options} admin={admin} disabled={busy} canWrite={canWrite} onRecall={onRecall} onExport={onExport} onRemove={onRemove} onConvert={(entry,channel)=>{if(!options||!confirm(tx('Créer une copie pour ce modèle sans changer le son ?')))return;void run('convert-preset',async()=>{await presetApi('/api/library/convert-channel',{sourceId:entry.id,model:options.model,channel,name:`${entry.name.slice(0,105)} · ${options.model}`,confirm:true});return 'Copie compatible enregistrée. Prévisualise son rappel avant de l’appliquer.';});}}/>)}</div>
    {fx.length>0&&<div className="library-section-heading"><h3><Sparkles size={18}/>{tx('Effets FX')}</h3></div>}
    <div className="scene-list">{fx.filter(matches).map(e=><FxRow key={e.id} entry={e} disabled={busy} admin={admin} canWrite={canWrite&&options?.family==='xair'} onRecall={onRecallFx} onExport={onExport} onRemove={onRemove}/>)}</div>
    {search&&!presets.some(matches)&&!fx.some(matches)&&<p className="library-empty" role="status">{tx('Aucun preset ne correspond à ta recherche.')}</p>}
    {!presets.length&&!fx.length&&<p className="library-empty">{tx('Aucun preset personnel pour l’instant. Sauvegarde un traitement ou importe un fichier de preset.')}</p>}
  </section>;
}
