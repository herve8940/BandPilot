import {BATCH_SETTINGS,batchPath,batchUsesBand,batchFromWire,batchToWire} from '../../../shared/batch-edit';
import {SurfaceCommand} from './SurfaceCommand';
import type {ConsoleCommand} from '../../../shared/console-command';
import {LiveGroupFader} from '../LiveGroupFader';
import {CommandUndo} from './CommandActivation';
import {useEffect,useState,type DragEvent} from 'react';
import {surfaceFile,parseSurfaceFile,surfaceStripAllowed,SURFACE_FILE_LIMIT,SURFACE_COLUMNS,SURFACE_ROWS,SURFACE_LIMIT,WIDGET_LIMIT,SURFACE_INVALID,SURFACE_OVERLAP,SURFACE_WIDGETS,validateSurfaces,widgetsOverlap,type ExpertSurface,type ExpertSurfaces,type SurfaceWidget,type SurfaceWidgetKind} from '../../../shared/expert-surfaces';
import {tx} from '../i18n';
import {presetApi,type LibraryEntry} from '../preset-controls';
import {Fader,Meter,num,type SetFn,type Values} from '../xair/controls';
import {faderAddress,onAddress,stripName,type Strip} from '../xair/strips';
import {useAirStrips} from '../xair/model-strips';
import {faderToDb,formatDb} from '../xairMath';
import './studio-additions.css';

const path='/api/expert-surfaces';
const labels:Record<SurfaceWidgetKind,string>={fader:'Fader',mute:'Mute',send:'Niveau d’envoi',meter:'Vumètre',channel:'Ouvrir le canal',title:'Titre',parameter:'Paramètre de canal',group:'Fader de groupe logiciel',command:'Commande favorite'};
const fields=[['x','Colonne'],['y','Ligne'],['width','Largeur'],['height','Hauteur']] as const;
const widgetName=(widget:SurfaceWidget,strip:Strip,values:Values)=>
 widget.label||(widget.kind==='title'?tx('Titre'):widget.kind==='group'?tx('Fader de groupe logiciel'):stripName(strip,values)+(widget.kind==='send'?` → ${tx('Bus')} ${widget.bus}`:''));

export function SurfaceEditor({values,set,canWrite,rehearsal,openChannel,mode='real'}:{mode?:'real'|'simulation';values:Values;set:SetFn;canWrite:boolean;rehearsal:boolean;openChannel:(strip:Strip)=>void}){
 const {model,ALL,INPUTS,MAIN}=useAirStrips();
 const channels=INPUTS.filter(s=>s.kind==='ch');
 const [library,setLibrary]=useState<ExpertSurfaces|null>(null),[selected,setSelected]=useState('');
 const [draft,setDraft]=useState<ExpertSurface|null>(null),[editing,setEditing]=useState(''),[kind,setKind]=useState<SurfaceWidgetKind>('fader');
 const [commands,setCommands]=useState<LibraryEntry[]>([]);
 const [pendingImport,setPendingImport]=useState<ExpertSurface[]|null>(null),[backup,setBackup]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=async()=>{
  const next=await presetApi<ExpertSurfaces>(path+'?model='+encodeURIComponent(model.id));
  setLibrary(next);setSelected(previous=>next.surfaces.some(s=>s.id===previous)?previous:next.surfaces[0]?.id??'');
 };
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[model.id]);
 const saved=library?.surfaces.find(s=>s.id===selected);
 const current=draft??saved;
 const widget=draft?.widgets.find(w=>w.id===editing);
 const needsCommands=kind==='command'||!!current?.widgets.some(w=>w.kind==='command');
 useEffect(()=>{if(!needsCommands)return;let alive=true;void presetApi<LibraryEntry[]>('/api/library/commands').then(list=>{if(alive)setCommands(Array.isArray(list)?list.filter(e=>(e.data as ConsoleCommand).model===model.id):[]);}).catch(()=>{if(alive)setCommands([]);});return()=>{alive=false;};},[needsCommands,model.id]);
 const stripFor=(widget:SurfaceWidget)=>widget.strip?ALL.find(s=>s.id===widget.strip)??MAIN:channels[widget.channel-1]??MAIN;
 const patch=(next:Partial<SurfaceWidget>)=>{
  setError('');setDraft(d=>d?{...d,widgets:d.widgets.map(w=>w.id===editing?{...w,...next}:w)}:d);
 };
 const add=()=>{
  if(!draft||draft.widgets.length>=WIDGET_LIMIT||kind==='command'&&!commands.length)return;
  const width=['title','group','command'].includes(kind)?4:kind==='parameter'?3:2,height=['group','command'].includes(kind)?4:['fader','send','parameter'].includes(kind)?3:1;
  // The first free rectangle keeps each added control usable immediately.
  for(let y=0;y<=SURFACE_ROWS-height;y++)for(let x=0;x<=SURFACE_COLUMNS-width;x++){
   const next:SurfaceWidget={id:crypto.randomUUID(),kind,label:'',channel:1,bus:1,x,y,width,height,...(kind==='command'?{commandId:commands[0]!.id}:{}),...(kind==='parameter'?{setting:'hpon' as const,band:1}:{}),...(kind==='group'?{members:[1,2],mix:0}:{})};
   if(draft.widgets.some(w=>widgetsOverlap(w,next)))continue;
   setDraft({...draft,widgets:[...draft.widgets,next]});setEditing(next.id);setError('');return;
  }
  setError(SURFACE_OVERLAP);
 };
 const store=async(surfaces:ExpertSurface[],active:string)=>{
  if(!library||busy)return;
  setError('');setMessage('');setBusy(true);
  try{
   const data=validateSurfaces({...library,surfaces});
   const updated=await presetApi<ExpertSurfaces>(path,data);
   setLibrary(updated);setSelected(active||updated.surfaces[0]?.id||'');setDraft(null);setEditing('');setMessage('Surfaces enregistrées.');
  }catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 };
 const save=()=>{
  if(!library||!draft)return;
  const previous=library.surfaces.some(s=>s.id===draft.id);
  void store(previous?library.surfaces.map(s=>s.id===draft.id?draft:s):[...library.surfaces,draft],draft.id);
 };
 const drop=(event:DragEvent<HTMLDivElement>)=>{
  if(!draft||busy)return;
  const id=event.dataTransfer.getData('text/bandpilot-widget');
  const moved=draft.widgets.find(w=>w.id===id);
  if(!moved)return;
  event.preventDefault();
  const r=event.currentTarget.getBoundingClientRect();
  const x=Math.max(0,Math.min(SURFACE_COLUMNS-moved.width,Math.floor((event.clientX-r.left)/r.width*SURFACE_COLUMNS)));
  const y=Math.max(0,Math.min(SURFACE_ROWS-moved.height,Math.floor((event.clientY-r.top)/r.height*SURFACE_ROWS)));
  const next={...moved,x,y};
  if(draft.widgets.some(w=>w.id!==id&&widgetsOverlap(w,next))){setError(SURFACE_OVERLAP);return;}
  setDraft({...draft,widgets:draft.widgets.map(w=>w.id===id?next:w)});setEditing(id);setError('');
 };
 return <section className="surface-editor" aria-label={tx('Surfaces')}>
  <header><h2>{tx('Surfaces')}</h2><p>{tx('Compose une surface de contrôle. L’édition et l’enregistrement de la disposition sont sans effet sur le son.')}</p></header>
  <div className="feature-actions">
   {draft?<>
    <label>{tx('Nom de la surface')} <input maxLength={48} value={draft.name} disabled={busy} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <button type="button" disabled={busy||!draft.name.trim()} onClick={save}>{tx('Enregistrer la surface')}</button>
    <button type="button" disabled={busy} onClick={()=>{setDraft(null);setEditing('');setError('');}}>{tx('Annuler')}</button>
   </>:<>
    {!!library?.surfaces.length&&<label>{tx('Surface active')} <select value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setMessage('');}}>
     {library.surfaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>}
    <button type="button" disabled={!library||busy||library.surfaces.length>=SURFACE_LIMIT} onClick={()=>{setDraft({id:crypto.randomUUID(),name:'',widgets:[]});setMessage('');setError('');}}>{tx('Nouvelle surface')}</button>
    {saved&&<><button type="button" disabled={busy} onClick={()=>{setDraft(saved);setError('');setMessage('');}}>{tx('Modifier la surface')}</button>
     <button type="button" disabled={busy} onClick={()=>{if(library&&confirm(tx('Supprimer cette surface ?')))void store(library.surfaces.filter(s=>s.id!==saved.id),'');}}>{tx('Supprimer la surface')}</button></>}
    <button type="button" disabled={busy} onClick={()=>{setError('');void refresh().catch(e=>setError(e.message));}}>{tx('Recharger')}</button>
   </>}
  </div>
  {!draft&&<div className="feature-actions">
   <button type="button" disabled={!library||busy} onClick={()=>{if(!library)return;const url=URL.createObjectURL(new Blob([JSON.stringify(surfaceFile(library),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`BandPilot-surfaces-${model.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>{tx('Exporter les surfaces')}</button>
   <label>{tx('Importer des surfaces')}<input type="file" accept=".json,application/json" disabled={!library||busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';setPendingImport(null);setError('');if(!file)return;try{if(file.size>SURFACE_FILE_LIMIT)throw Error(SURFACE_INVALID);setPendingImport(parseSurfaceFile(await file.text(),model.id));}catch(err){setError((err as Error).message);}}}/></label>
   {pendingImport&&<div><p>{tx('Remplacer les surfaces enregistrées par celles du fichier ? Les groupes resteront désactivés.')}</p><ul>{pendingImport.map(s=><li key={s.id}>{s.name} · {s.widgets.length}</li>)}</ul><button disabled={busy} onClick={()=>{void store(pendingImport,'');setPendingImport(null);}}>{tx('Remplacer les surfaces')}</button><button onClick={()=>setPendingImport(null)}>{tx('Annuler')}</button></div>}
  </div>}
  <CommandUndo backup={backup} canWrite={canWrite&&!busy} mode={mode} beforeUndo={()=>window.dispatchEvent(new Event('bandpilot-console-reset'))}/>
  {draft&&<div className="surface-inspector">
   <div className="feature-actions">
    <label>{tx('Type de commande')} <select value={kind} disabled={busy} onChange={e=>setKind(e.target.value as SurfaceWidgetKind)}>
     {SURFACE_WIDGETS.map(k=><option key={k} value={k}>{tx(labels[k])}</option>)}
    </select></label>
    <button type="button" disabled={busy||draft.widgets.length>=WIDGET_LIMIT||kind==='command'&&!commands.length} onClick={add}>{tx('Ajouter un élément')}</button>
   </div>
   {kind==='command'&&!commands.length&&<p>{tx('Enregistre d’abord une commande pour cette console dans Commandes favorites.')}</p>}
   {widget&&<div className="feature-actions">
    <label>{tx('Libellé')} <input maxLength={48} value={widget.label} disabled={busy} onChange={e=>patch({label:e.target.value})}/></label>
    {['fader','mute','send','meter','channel'].includes(widget.kind)&&<label>{tx('Tranche')} <select value={widget.strip??(widget.channel?'ch'+widget.channel:'lr')} disabled={busy} onChange={e=>patch({strip:e.target.value})}>
     {ALL.filter(s=>surfaceStripAllowed(model.id,widget.kind,s.id)).map(s=><option key={s.id} value={s.id}>{s.short} · {stripName(s,values)}{s.kind==='bus'&&Number(s.id.slice(3))>model.monitorOutputs?' · '+tx('Bus interne'):''}</option>)}
    </select></label>}
    {widget.kind==='parameter'&&<label>{tx('Canal')}<select value={widget.channel} disabled={busy} onChange={e=>patch({channel:Number(e.target.value)})}>{channels.map(s=><option key={s.id} value={Number(s.short)}>{s.short} · {stripName(s,values)}</option>)}</select></label>}
    {widget.kind==='command'&&<label>{tx('Commande favorite')}<select value={widget.commandId} disabled={busy} onChange={e=>patch({commandId:e.target.value})}>{!commands.some(c=>c.id===widget.commandId)&&<option value={widget.commandId}>{tx('Commande indisponible sur cet appareil')}</option>}{commands.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    {widget.kind==='send'&&<label>{tx('Bus')} <select value={widget.bus} disabled={busy} onChange={e=>patch({bus:Number(e.target.value)})}>
     {Array.from({length:model.monitorOutputs},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}
    </select></label>}
    {widget.kind==='parameter'&&<>
     <label>{tx('Réglage commun')}<select value={widget.setting} disabled={busy} onChange={e=>patch({setting:e.target.value as SurfaceWidget['setting']})}>{Object.entries(BATCH_SETTINGS).filter(([k])=>k!=='tap').map(([k,s])=><option key={k} value={k}>{tx(s.label)}</option>)}</select></label>
     {widget.setting&&batchUsesBand(widget.setting)&&<label>{tx('Bande EQ')}<select value={widget.band} disabled={busy} onChange={e=>patch({band:Number(e.target.value)})}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>}
    </>}
    {widget.kind==='group'&&<>
     <label>{tx('Mix du groupe')}<select value={widget.mix} disabled={busy} onChange={e=>patch({mix:Number(e.target.value)})}><option value={0}>{tx('Façade')}</option>{Array.from({length:model.monitorOutputs},(_,i)=><option key={i} value={i+1}>{tx('Bus')} {i+1}</option>)}</select></label>
     <fieldset disabled={busy}><legend>{tx('Entrées du groupe')}</legend>{channels.map(s=><label key={s.id}><input type="checkbox" checked={widget.members?.includes(Number(s.short))??false} onChange={e=>patch({members:e.target.checked?[...widget.members!,Number(s.short)]:widget.members!.filter(ch=>ch!==Number(s.short))})}/>{s.short} · {stripName(s,values)}</label>)}</fieldset>
    </>}
    {fields.map(([k,label])=>{
     const position=k==='x'||k==='y',min=k==='width'||k==='height'&&['fader','send','group'].includes(widget.kind)?2:1;
     const max=k==='width'?SURFACE_COLUMNS-widget.x:k==='height'?SURFACE_ROWS-widget.y:k==='x'?SURFACE_COLUMNS-widget.width+1:SURFACE_ROWS-widget.height+1;
     return <label key={k}>{tx(label)} <input type="number" min={min} max={max} disabled={busy} value={widget[k]+Number(position)} onChange={e=>{
      const n=e.target.valueAsNumber;if(Number.isInteger(n)&&n>=min&&n<=max)patch({[k]:n-Number(position)});
     }}/></label>;
    })}
    <button type="button" disabled={busy} onClick={()=>{setDraft({...draft,widgets:draft.widgets.filter(w=>w.id!==widget.id)});setEditing('');setError('');}}>{tx('Retirer l’élément')}</button>
   </div>}
  </div>}
  {error&&<p role="alert">{tx(error)}</p>}{message&&<p role="status">{tx(message)}</p>}
  {!current&&library&&<p>{tx('Crée une surface pour réunir les commandes que tu utilises souvent.')}</p>}
  {current&&<div className="surface-scroll"><div className={'surface-grid'+(draft?' editing':'')}
   style={{gridTemplateColumns:`repeat(${SURFACE_COLUMNS}, minmax(0,1fr))`,gridTemplateRows:`repeat(${draft?SURFACE_ROWS:Math.max(1,...current.widgets.map(w=>w.y+w.height))}, 66px)`}}
   onDragOver={e=>{if(draft&&e.dataTransfer.types.includes('text/bandpilot-widget'))e.preventDefault();}} onDrop={drop}>
   {current.widgets.map(w=>{
    const strip=stripFor(w),command=commands.find(c=>c.id===w.commandId),name=w.kind==='command'?(w.label||command?.name||tx('Commande favorite')):widgetName(w,strip,values),disabled=!canWrite||rehearsal&&strip.kind==='lr';
    const address=faderAddress(strip,w.kind==='send'?w.bus:0),level=num(values,address,0),on=onAddress(strip);
    const known=Object.hasOwn(values,address),muted=num(values,on,0)===0;
    const invalid=current.widgets.some(other=>w.id!==other.id&&widgetsOverlap(w,other));
    return <article key={w.id} className={'surface-widget'+(['group','parameter','command'].includes(w.kind)?' surface-widget-expanded':'')+(editing===w.id?' active':'')+(invalid?' invalid':'')} style={{gridColumn:`${w.x+1} / span ${w.width}`,gridRow:`${w.y+1} / span ${w.height}`}}>
     {draft?<button type="button" className="surface-move" draggable={!busy} aria-pressed={editing===w.id} disabled={busy}
      onClick={()=>setEditing(w.id)} onDragStart={e=>{e.dataTransfer.setData('text/bandpilot-widget',w.id);e.dataTransfer.effectAllowed='move';setEditing(w.id);}}>
      <strong>{name}</strong><span>{tx(labels[w.kind])}</span></button>:<>
      {w.kind!=='mute'&&w.kind!=='channel'&&<strong>{name}</strong>}
      {(w.kind==='fader'||w.kind==='send')&&<><Fader value={level} disabled={disabled||!known} onChange={v=>set(address,v)} label={name}/><small>{known?formatDb(faderToDb(level)):'—'}</small></>}
      {w.kind==='mute'&&<button type="button" disabled={disabled||!Object.hasOwn(values,on)} aria-pressed={muted} onClick={()=>set(on,muted?1:0)}>{tx('Mute')} · {name}</button>}
      {w.kind==='parameter'&&<SurfaceParameter widget={w} values={values} set={set} disabled={disabled}/>}
      {w.kind==='group'&&<><small>{tx(w.mix?'Bus':'Façade')} {w.mix||''} · {w.members!.join(', ')}</small><LiveGroupFader key={`${library?.revision}:${selected}:${w.id}`} model={model.id} selection={{channels:w.members!,target:w.mix?'send':'fader',...(w.mix?{bus:w.mix}:{})}} disabled={!canWrite||rehearsal&&w.mix===0} compact onBackup={setBackup}/></>}
      {w.kind==='command'&&<SurfaceCommand key={`${library?.revision}:${selected}:${w.id}:${w.commandId}`} entry={command} canWrite={canWrite&&!rehearsal} mode={mode}/>}
      {w.kind==='meter'&&<Meter indexes={strip.meters} wide/>}
      {w.kind==='channel'&&<button type="button" onClick={()=>openChannel(strip)}>{name} ↗</button>}
     </>}
    </article>;
   })}
  </div></div>}
  {draft&&<p className="surface-hint">{tx('Clique sur un élément pour régler sa position ou fais-le glisser sur la grille.')}</p>}
 </section>;
}

function SurfaceParameter({widget:w,values,set,disabled}:{widget:SurfaceWidget;values:Values;set:SetFn;disabled:boolean}){
 const setting=w.setting!,definition=BATCH_SETTINGS[setting],address=`/ch/${String(w.channel).padStart(2,'0')}/`+batchPath(setting,1,w.band!);
 const wire=Number(values[address]),known=Number.isFinite(wire),toggle=definition.max===1;
 const display=batchFromWire(setting,wire);
 const send=(v:number)=>set(address,batchToWire(setting,v));
 const label=tx(definition.label)+(batchUsesBand(setting)?' '+w.band:'');
 return toggle?<button type="button" aria-label={label} aria-pressed={known&&wire===1} disabled={disabled||!known} onClick={()=>send(wire===1?0:1)}>{label} · {known?(wire===1?'ON':'OFF'):'—'}</button>:<label>{label}<input type="range" min={definition.min} max={definition.max} step={definition.step} value={known?display:definition.min} disabled={disabled||!known} onChange={e=>send(Number(e.target.value))}/><output>{known?(setting==='hpf'?Math.round(display):Math.round(display*100)/100):'—'}</output></label>;
}
