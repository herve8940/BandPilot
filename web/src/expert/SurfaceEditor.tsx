import {useEffect,useState,type DragEvent} from 'react';
import {SURFACE_COLUMNS,SURFACE_ROWS,SURFACE_LIMIT,WIDGET_LIMIT,SURFACE_INVALID,SURFACE_OVERLAP,SURFACE_WIDGETS,validateSurfaces,widgetsOverlap,type ExpertSurface,type ExpertSurfaces,type SurfaceWidget,type SurfaceWidgetKind} from '../../../shared/expert-surfaces';
import {tx} from '../i18n';
import {presetApi} from '../preset-controls';
import {Fader,Meter,num,type SetFn,type Values} from '../xair/controls';
import {faderAddress,onAddress,stripName,type Strip} from '../xair/strips';
import {useAirStrips} from '../xair/model-strips';
import {faderToDb,formatDb} from '../xairMath';
import './studio-additions.css';

const path='/api/expert-surfaces';
const labels:Record<SurfaceWidgetKind,string>={fader:'Fader',mute:'Mute',send:'Niveau d’envoi',meter:'Vumètre',channel:'Ouvrir le canal',title:'Titre'};
const fields=[['x','Colonne'],['y','Ligne'],['width','Largeur'],['height','Hauteur']] as const;
const widgetName=(widget:SurfaceWidget,strip:Strip,values:Values)=>
 widget.label||(widget.kind==='title'?tx('Titre'):stripName(strip,values)+(widget.kind==='send'?` → ${tx('Bus')} ${widget.bus}`:''));

export function SurfaceEditor({values,set,canWrite,rehearsal,openChannel}:{values:Values;set:SetFn;canWrite:boolean;rehearsal:boolean;openChannel:(strip:Strip)=>void}){
 const {model,INPUTS,MAIN}=useAirStrips();
 const channels=INPUTS.filter(s=>s.kind==='ch');
 const [library,setLibrary]=useState<ExpertSurfaces|null>(null),[selected,setSelected]=useState('');
 const [draft,setDraft]=useState<ExpertSurface|null>(null),[editing,setEditing]=useState(''),[kind,setKind]=useState<SurfaceWidgetKind>('fader');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=async()=>{
  const next=await presetApi<ExpertSurfaces>(path+'?model='+encodeURIComponent(model.id));
  setLibrary(next);setSelected(previous=>next.surfaces.some(s=>s.id===previous)?previous:next.surfaces[0]?.id??'');
 };
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[model.id]);
 const saved=library?.surfaces.find(s=>s.id===selected);
 const current=draft??saved;
 const widget=draft?.widgets.find(w=>w.id===editing);
 const stripFor=(channel:number)=>channels[channel-1]??MAIN;
 const patch=(next:Partial<SurfaceWidget>)=>{
  setError('');setDraft(d=>d?{...d,widgets:d.widgets.map(w=>w.id===editing?{...w,...next}:w)}:d);
 };
 const add=()=>{
  if(!draft||draft.widgets.length>=WIDGET_LIMIT)return;
  const width=kind==='title'?4:2,height=kind==='fader'||kind==='send'?3:1;
  // The first free rectangle keeps each added control usable immediately.
  for(let y=0;y<=SURFACE_ROWS-height;y++)for(let x=0;x<=SURFACE_COLUMNS-width;x++){
   const next:SurfaceWidget={id:crypto.randomUUID(),kind,label:'',channel:1,bus:1,x,y,width,height};
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
  {draft&&<div className="surface-inspector">
   <div className="feature-actions">
    <label>{tx('Type de commande')} <select value={kind} disabled={busy} onChange={e=>setKind(e.target.value as SurfaceWidgetKind)}>
     {SURFACE_WIDGETS.map(k=><option key={k} value={k}>{tx(labels[k])}</option>)}
    </select></label>
    <button type="button" disabled={busy||draft.widgets.length>=WIDGET_LIMIT} onClick={add}>{tx('Ajouter un élément')}</button>
   </div>
   {widget&&<div className="feature-actions">
    <label>{tx('Libellé')} <input maxLength={48} value={widget.label} disabled={busy} onChange={e=>patch({label:e.target.value})}/></label>
    {widget.kind!=='title'&&<label>{tx('Canal')} <select value={widget.channel} disabled={busy} onChange={e=>patch({channel:Number(e.target.value)})}>
     {!['send','channel'].includes(widget.kind)&&<option value={0}>{tx('Façade')}</option>}
     {channels.map(s=><option key={s.id} value={Number(s.short)}>{s.short} · {stripName(s,values)}</option>)}
    </select></label>}
    {widget.kind==='send'&&<label>{tx('Bus')} <select value={widget.bus} disabled={busy} onChange={e=>patch({bus:Number(e.target.value)})}>
     {Array.from({length:model.monitorOutputs},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}
    </select></label>}
    {fields.map(([k,label])=>{
     const position=k==='x'||k==='y',min=k==='width'||k==='height'&&['fader','send'].includes(widget.kind)?2:1;
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
    const strip=stripFor(w.channel),name=widgetName(w,strip,values),disabled=!canWrite||rehearsal&&w.channel===0;
    const address=faderAddress(strip,w.kind==='send'?w.bus:0),level=num(values,address,0),on=onAddress(strip);
    const known=Object.hasOwn(values,address),muted=num(values,on,0)===0;
    const invalid=current.widgets.some(other=>w.id!==other.id&&widgetsOverlap(w,other));
    return <article key={w.id} className={'surface-widget'+(editing===w.id?' active':'')+(invalid?' invalid':'')} style={{gridColumn:`${w.x+1} / span ${w.width}`,gridRow:`${w.y+1} / span ${w.height}`}}>
     {draft?<button type="button" className="surface-move" draggable={!busy} aria-pressed={editing===w.id} disabled={busy}
      onClick={()=>setEditing(w.id)} onDragStart={e=>{e.dataTransfer.setData('text/bandpilot-widget',w.id);e.dataTransfer.effectAllowed='move';setEditing(w.id);}}>
      <strong>{name}</strong><span>{tx(labels[w.kind])}</span></button>:<>
      {w.kind!=='mute'&&w.kind!=='channel'&&<strong>{name}</strong>}
      {(w.kind==='fader'||w.kind==='send')&&<><Fader value={level} disabled={disabled||!known} onChange={v=>set(address,v)} label={name}/><small>{known?formatDb(faderToDb(level)):'—'}</small></>}
      {w.kind==='mute'&&<button type="button" disabled={disabled||!Object.hasOwn(values,on)} aria-pressed={muted} onClick={()=>set(on,muted?1:0)}>{tx('Mute')} · {name}</button>}
      {w.kind==='meter'&&<Meter indexes={strip.meters} wide/>}
      {w.kind==='channel'&&<button type="button" onClick={()=>openChannel(strip)}>{name} ↗</button>}
     </>}
    </article>;
   })}
  </div></div>}
  {draft&&<p className="surface-hint">{tx('Clique sur un élément pour régler sa position ou fais-le glisser sur la grille.')}</p>}
 </section>;
}
