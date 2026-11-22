import {RecallScopeMatrix,narrowScopes} from './RecallScopeMatrix';
import {friendly} from './SoundCoach';
import {useEffect,useState,useRef} from 'react';
import {OUTPUT_SECTIONS,OUTPUT_LABELS,type OutputSection,type OutputScope} from '../../shared/output-recall';
import {FX_NAMES,FX_SCHEMAS,fxFromWire,type FxVector} from '../../shared/fx-parameters';
import {fxParameterLabel} from './FxGraphicEq';
import {presetApi,type LibraryEntry} from './preset-controls';
import {tx} from './i18n';
type Options={model:string;targets:{id:string;label:string}[];fx:{slot:number;algorithm:number}[]};
type Plan={token:string|null;changes:{address:string;before:string|number;after:string|number}[];fx:{slot:number;before:FxVector;after:FxVector}[];excluded:string[]};
const valueText=(a:string,v:string|number)=>a.endsWith('/eq/mode')?['PEQ','GEQ','True EQ'][Number(v)]??String(v):typeof v==='number'?Number(v.toFixed(2)):v;
const fxText=(f:FxVector,i:number)=>{const p=FX_SCHEMAS[f.algorithm]?.parameters[i],v=f.parameters[i];if(!v)return '—';if(!p)return String(v.value);return p.scale==='enum'?tx(p.options[v.value]??'?'):`${Number(fxFromWire(p,v.value).toFixed(2))} ${p.unit??''}`;};
export function OutputSceneRecallPanel({entry,canWrite,onUpdated}:{entry:LibraryEntry;canWrite:boolean;onUpdated:()=>Promise<void>}){
 const restore=entry.kind==='output-recall-backup';
 const [open,setOpen]=useState(restore);
 const [perTarget,setPerTarget]=useState<Record<string,OutputSection[]>>({});
 const [scopeSaved,setScopeSaved]=useState(false);
 const scopePath=`/api/library/${entry.id}/recall-scope/outputs`;
 const [options,setOptions]=useState<Options|null>(null),[targets,setTargets]=useState<string[]>([]),[sections,setSections]=useState<OutputSection[]>(['eq','compressor']),[slots,setSlots]=useState<number[]>([]),[plan,setPlan]=useState<Plan|null>(null),[backup,setBackup]=useState(''),[source,setSource]=useState(entry.id),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),working=useRef(false);
 useEffect(()=>{if(restore)return;let alive=true;void presetApi<Options>(`/api/library/${entry.id}/output-options`).then(o=>{if(!Array.isArray(o.targets)||!Array.isArray(o.fx))throw Error('Sélection des sorties ou des FX invalide.');if(alive)setOptions(o);}).catch(e=>{if(alive)setError(e.message);});void presetApi<OutputScope|null>(scopePath).then(scope=>{if(alive&&scope&&Array.isArray(scope.targets)&&Array.isArray(scope.fxSlots))setScopeSaved(true);}).catch(()=>{});return()=>{alive=false;};},[entry.id]);
 useEffect(()=>setPlan(null),[targets,sections,slots,perTarget]);
 const run=async(fn:()=>Promise<void>)=>{if(working.current)return;working.current=true;setBusy(true);setError('');setMessage('');try{await fn();}catch(e){const err=e as Error&{backupId?:string};setPlan(null);setError(err.message);if(err.backupId)setBackup(err.backupId);}finally{working.current=false;setBusy(false);}};
 const overrides=narrowScopes(perTarget,targets,sections);
 const scope=()=>({targets,sections,fxSlots:slots,...(Object.keys(overrides).length?{perTarget:overrides}:{})});
 const valid=!!(targets.length||slots.length)&&(!targets.length||!!sections.length);
 const prepare=async(id=entry.id)=>{setPlan(await presetApi<Plan>(`/api/library/${id}/output-preview`,{scope:scope()}));setSource(id);};
 return <details className="scene-recall-panel output-scene-recall" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{tx('Rappel des sorties et FX')}</summary>{open&&<><p>{tx('Choisis les bus, le Main, les retours FX et les slots à rappeler. Les entrées, leurs envois, les gains, le 48 V, le routage et les insertions ne changent pas. Un slot FX est partagé par tous ses utilisateurs.')}</p><fieldset disabled={busy}>
 {!restore&&options&&<><div className="scene-recall-channels">{options.targets.map(t=><label key={t.id}><input type="checkbox" checked={targets.includes(t.id)} onChange={e=>setTargets(old=>e.target.checked?[...old,t.id]:old.filter(v=>v!==t.id))}/>{tx(t.label)}</label>)}</div><div className="scene-recall-sections">{OUTPUT_SECTIONS.map(s=><label key={s}><input type="checkbox" checked={sections.includes(s)} onChange={e=>setSections(old=>e.target.checked?[...old,s]:old.filter(v=>v!==s))}/>{tx(OUTPUT_LABELS[s])}</label>)}</div><div className="scene-recall-channels">{options.fx.map(f=><label key={f.slot}><input type="checkbox" checked={slots.includes(f.slot)} onChange={e=>setSlots(old=>e.target.checked?[...old,f.slot]:old.filter(v=>v!==f.slot))}/>FX {f.slot} · {FX_NAMES[f.algorithm]}</label>)}</div></>}
 {!restore&&options&&<>
 <RecallScopeMatrix rows={options.targets.filter(t=>targets.includes(t.id)).map(t=>({id:t.id,label:tx(t.label)}))} sections={sections} labels={OUTPUT_LABELS} selections={overrides}
  onSelect={(id,keys)=>setPerTarget({...overrides,[id]:keys})}/>
 <div className="scope-actions">
 {scopeSaved&&<button type="button" onClick={()=>void run(async()=>{
  const saved=await presetApi<OutputScope|null>(scopePath);if(!saved)return;
  setTargets(saved.targets);setSections(saved.sections);setSlots(saved.fxSlots);setPerTarget(saved.perTarget??{});
  setMessage('Périmètre chargé. Prévisualise avant de rappeler.');
 })}>{tx('Charger le périmètre mémorisé')}</button>}
 <button type="button" disabled={!valid} onClick={()=>void run(async()=>{
  await presetApi(scopePath,{model:options.model,scope:scope()});setScopeSaved(true);setMessage('Périmètre de rappel mémorisé. Aucun réglage envoyé.');
 })}>{tx('Mémoriser ce périmètre')}</button>
 </div></>}
 <button type="button" disabled={!canWrite||!restore&&!valid} onClick={()=>void run(()=>prepare())}>{tx('Prévisualiser la sélection')}</button>{backup&&<button type="button" disabled={!canWrite} onClick={()=>void run(()=>prepare(backup))}>{tx('Annuler le rappel sélectif')}</button>}
 </fieldset>
 {plan&&<div className="output-recall-preview"><h4>{tx('Vérifier le rappel sélectif')}</h4>{plan.excluded.length>0&&<p>{tx('Conservés par les protections')} : {plan.excluded.join(', ')}</p>}<div className="output-recall-diff"><ul>{plan.changes.map(c=><li key={c.address}>{friendly(c.address)} : {valueText(c.address,c.before)} → <b>{valueText(c.address,c.after)}</b></li>)}</ul>{plan.fx.map(f=><section key={f.slot}><h4>FX {f.slot} · {FX_NAMES[f.before.algorithm]} → {FX_NAMES[f.after.algorithm]}</h4><ul>{f.after.parameters.map((p,i)=>f.before.algorithm!==f.after.algorithm||JSON.stringify(p)!==JSON.stringify(f.before.parameters[i])?<li key={i}>{fxParameterLabel(f.after.algorithm,i)} : {fxText(f.before,i)} → <b>{fxText(f.after,i)}</b></li>:null)}</ul></section>)}</div>
 {plan.token?<button type="button" disabled={busy||!canWrite} onClick={()=>void run(async()=>{const result=await presetApi<{backupId:string}>(`/api/library/${source}/output-apply`,{token:plan.token,confirm:true});setBackup(result.backupId);setPlan(null);setMessage('Sélection appliquée. Les réglages précédents sont dans l’historique.');await onUpdated();})}>{tx('Confirmer et appliquer')}</button>:<p>{tx('Rien ne change dans la sélection. Aucun réglage envoyé.')}</p>}<button type="button" disabled={busy} onClick={()=>setPlan(null)}>{tx('Annuler')}</button></div>}
 {message&&<p role="status">{tx(message)}</p>}{error&&<p role="alert">{tx(error)}</p>}</>}</details>;
}
