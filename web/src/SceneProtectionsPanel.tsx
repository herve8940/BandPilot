import {useEffect,useRef,useState} from 'react';
import {ShieldCheck} from 'lucide-react';
import {SCENE_RECALL_LABELS,SCENE_RECALL_SECTIONS,type SceneRecallSection} from '../../shared/scene-recall';
import {PROTECTION_NOTICE,PROTECTION_SCOPE,type SceneProtections} from '../../shared/scene-protections';
import {presetApi,type PresetOptions} from './preset-controls';
import {tx} from './i18n';
import './scene-protections.css';

export type ProtectedSelection={channel:number;section:SceneRecallSection}[];
export function SceneProtectionSummary({excluded=[]}:{excluded?:ProtectedSelection}){
 if(!excluded.length)return null;
 const channels=[...new Set(excluded.map(e=>e.channel))].sort((a,b)=>a-b);
 return <aside className="scene-protected-summary" aria-label={tx('Conservés par les protections')}><b>{tx('Conservés par les protections')}</b><ul>{channels.map(channel=><li key={channel}>{tx('Canal')} {channel} · {SCENE_RECALL_SECTIONS.filter(s=>excluded.some(e=>e.channel===channel&&e.section===s)).map(s=>tx(SCENE_RECALL_LABELS[s])).join(', ')}</li>)}</ul></aside>;
}
export function SceneProtectionsPanel({disabled=false,onSaved}:{disabled?:boolean;onSaved:()=>void}){
 const [open,setOpen]=useState(false);
 const [options,setOptions]=useState<PresetOptions|null>(null),[saved,setSaved]=useState<SceneProtections|null>(null),[draft,setDraft]=useState<SceneProtections['rules']>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),working=useRef(false);
 const load=async()=>{
  const o=await presetApi<PresetOptions>('/api/library/preset-options');setOptions(o);
  if(o.family!=='xair'){setSaved(null);return;}
  const p=await presetApi<SceneProtections>('/api/library/scene-protections');
  if(p.model!==o.model)throw Error('Connexion modifiée ou opération interrompue');
  setSaved(p);setDraft(p.rules);
 };
 const run=async(task:()=>Promise<void>)=>{if(working.current)return;working.current=true;setBusy(true);setError('');setMessage('');try{await task();}catch(e){setError((e as Error).message);}finally{working.current=false;setBusy(false);}};
 useEffect(()=>{void run(load);},[]);
 const dirty=!!saved&&JSON.stringify(draft)!==JSON.stringify(saved.rules);
 const toggle=(channel:number,section:SceneRecallSection)=>{
  setMessage('');setDraft(old=>{
   const sections=new Set(old.find(r=>r.channel===channel)?.sections??[]);sections.has(section)?sections.delete(section):sections.add(section);
   return [...old.filter(r=>r.channel!==channel),...(sections.size?[{channel,sections:SCENE_RECALL_SECTIONS.filter(s=>sections.has(s))}]:[])].sort((a,b)=>a.channel-b.channel);
  });
 };
 return <details className="scene-protections" onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary><ShieldCheck size={18}/>{tx('Protections des scènes')}{saved&&<span>{saved.rules.length?tx('{{0}} entrée(s) protégée(s)').replace('{{0}}',String(saved.rules.length)):tx('Aucune protection active')}</span>}</summary>
  {open&&<div><p>{tx(PROTECTION_NOTICE)}</p><p className="scene-protection-hint">{tx(PROTECTION_SCOPE)}</p>
  {options?.family==='xair'&&saved?<form onSubmit={e=>{e.preventDefault();void run(async()=>{const p=await presetApi<SceneProtections>('/api/library/scene-protections',{...saved,rules:draft});setSaved(p);setDraft(p.rules);setMessage('Protections enregistrées. Aucun réglage audio envoyé.');onSaved();});}}>
   <p><b>{saved.model}</b> · {tx('Cocher pour conserver')}</p>
   <fieldset disabled={disabled||busy}>
    <div className="scene-protection-grid">{options.channels.map(c=><section key={c.channel}><h4>{tx('Canal')} {c.channel}{c.name?' · '+c.name:''}</h4><div>{SCENE_RECALL_SECTIONS.map(s=><label key={s}><input type="checkbox" aria-label={`${tx('Canal')} ${c.channel} · ${tx(SCENE_RECALL_LABELS[s])}`} checked={draft.some(r=>r.channel===c.channel&&r.sections.includes(s))} onChange={()=>toggle(c.channel,s)}/>{tx(SCENE_RECALL_LABELS[s])}</label>)}</div></section>)}</div>
    <footer><button type="button" disabled={!draft.length} onClick={()=>{setDraft([]);setMessage('');}}>{tx('Retirer toutes les protections')}</button><button type="button" disabled={!dirty} onClick={()=>{setDraft(saved.rules);setMessage('');setError('');}}>{tx('Annuler les modifications')}</button><button type="submit" className="primary" disabled={!dirty}>{tx('Enregistrer les protections')}</button></footer>
   </fieldset>
   {dirty&&<p role="status">{tx('Modifications non enregistrées : les protections actives restent inchangées.')}</p>}
  </form>:options&&<p>{tx('Protections disponibles pour X-Air / M-Air uniquement.')}</p>}
  <button type="button" disabled={busy||disabled} onClick={()=>void run(load)}>{tx('Recharger les protections')}</button>
  {message&&<p role="status">{tx(message)}</p>}{error&&<p role="alert" className="scene-msg error">{tx(error)}</p>}
 </div>}
 </details>;
}
