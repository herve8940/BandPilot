import {useEffect,useRef,useState} from 'react';
import type {ConsoleCommand,CommandControlMode,CommandStep} from '../../../shared/console-command';
import {SCENE_RECALL_LABELS,SCENE_RECALL_NOTICE,type SceneRecallScope} from '../../../shared/scene-recall';
import {SceneProtectionSummary,type ProtectedSelection} from '../SceneProtectionsPanel';
import {COMMAND_TARGETS,commandRules} from '../../../shared/console-command';
import {useMixerModel} from '../MixerModel';
import {presetApi} from '../preset-controls';
import {tx} from '../i18n';
import {friendly,PlanDialog,type Plan} from '../SoundCoach';

type Preparation={token:string;mode:CommandControlMode;commands:{id:string;name:string;data:ConsoleCommand;changes:(Plan['changes'][number]&{at?:number})[];offChanges?:(Plan['changes'][number]&{at?:number})[]}[];scenes?:{id:string;name:string;sceneName:string;scope:SceneRecallScope;targets:Plan['changes'];excluded:ProtectedSelection}[]};
type Pulse={active:boolean;sequence:number;pending:{id:string;remainingMs:number}[];results:{id:string;backupId?:string;written:number}[]};
const base='/api/library/command-control/';
export function commandStepLabel(s:CommandStep){return `${tx('Canal')} ${s.channel} · ${tx(COMMAND_TARGETS[s.target])}${s.target==='send'?` ${s.bus}`:s.target==='eq'?` ${s.band}`:''} : ${s.target==='mute'?tx(s.value?'Muet':'Actif'):s.value+' dB'}`;}
export function commandTiming(c:ConsoleCommand){
 const delay=`${tx('Délai')} : ${(c.delayMs??0)/1000} s`;
 const rules=commandRules(c);
 if(!rules.length)return delay;
 const descriptions=rules.map(rule=>`${commandStepLabel({...rule,value:rule.threshold})} · ${tx(rule.comparison==='above'?'Au-dessus du seuil':'Au-dessous du seuil')} · ${tx('Hystérésis')} : ${rule.hysteresis}`);
 const match=rules.length>1?tx(c.conditionSet?.match==='any'?'Au moins une condition':'Toutes les conditions')+' · ':'';
 return match+descriptions.join(' / ')+' · '+delay;
}
/** The server never owns a free-running timer: only this visible, armed view renews its lease. */
export function useCommandControl(canWrite:boolean,callbacks?:{onArmed?:()=>void;onStopped?:()=>void}){
 const model=useMixerModel(),[active,setActive]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<Preparation|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[backup,setBackup]=useState(''),[waiting,setWaiting]=useState(0);
 const mounted=useRef(true),generation=useRef(0),session=useRef<{token:string;sequence:number}|null>(null),inFlight=useRef(false),queue=useRef<string[]>([]),cb=useRef(callbacks);cb.current=callbacks;
 const release=(token:string)=>void fetch(base+'stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),keepalive:true}).catch(()=>{});
 const stop=()=>{generation.current++;queue.current=[];const s=session.current;session.current=null;if(s)release(s.token);if(mounted.current){setActive(false);setPending(null);setWaiting(0);setBusy(false);}cb.current?.onStopped?.();};
 const execute=async(id?:string)=>{
  if(!session.current||inFlight.current)return;
  const s=session.current,epoch=generation.current;inFlight.current=true;
  try{
   const r=await presetApi<Pulse>(base+'pulse',{token:s.token,...(id?{id,sequence:s.sequence+1}:{})});
   // Preserve recovery information even if Stop was pressed while a write finished.
   const saved=[...r.results].reverse().find(x=>x.backupId)?.backupId;if(saved&&mounted.current)setBackup(saved);
   if(epoch!==generation.current)return;
   s.sequence=r.sequence;setWaiting(r.pending.length);
   if(r.results.length)setMessage('Commande exécutée. Les réglages précédents sont dans l’historique.');
   if(!r.active)stop();
  }catch(e){const err=e as Error&{backupId?:string};if(err.backupId&&mounted.current)setBackup(err.backupId);if(epoch===generation.current){stop();setError(err.message);}}
  finally{inFlight.current=false;}
 };
 const executor=useRef(execute);executor.current=execute;
 useEffect(()=>{mounted.current=true;const reset=()=>stop(),hidden=()=>{if(document.hidden)stop();};window.addEventListener('bandpilot-console-reset',reset);document.addEventListener('visibilitychange',hidden);return()=>{mounted.current=false;stop();window.removeEventListener('bandpilot-console-reset',reset);document.removeEventListener('visibilitychange',hidden);};},[]);
 useEffect(()=>{if(!canWrite)stop();},[canWrite]);
 useEffect(()=>{if(!active)return;const timer=setInterval(()=>{if(!inFlight.current)void executor.current(queue.current.shift());},400);return()=>clearInterval(timer);},[active]);
 const prepare=async(ids:string[],mode:CommandControlMode)=>{stop();const epoch=generation.current;setBusy(true);setError('');setMessage('');try{const p=await presetApi<Preparation>(base+'prepare',{model:model.id,ids,mode});if(epoch===generation.current&&mounted.current)setPending(p);}catch(e){if(epoch===generation.current)setError((e as Error).message);}finally{if(epoch===generation.current)setBusy(false);}};
 const accept=async()=>{if(!pending||!canWrite)return;const epoch=generation.current;setBusy(true);setError('');try{const s=await presetApi<{token:string;sequence:number}>(base+'arm',{token:pending.token,confirm:true});if(epoch!==generation.current||!mounted.current){release(s.token);return;}session.current=s;setPending(null);setActive(true);cb.current?.onArmed?.();}catch(e){if(epoch===generation.current)setError((e as Error).message);}finally{if(epoch===generation.current)setBusy(false);}};
 const fire=(id:string)=>{if(!session.current)return;if(queue.current.length>=8){stop();setError('Trop de commandes MIDI en attente. Réactive le contrôle.');return;}if(inFlight.current)queue.current.push(id);else void execute(id);};
 return {active,busy,pending,error,message,backup,waiting,prepare,accept,stop,fire};
}
export function CommandActivationDialog({control,canWrite}:{control:ReturnType<typeof useCommandControl>;canWrite:boolean}){
 const p=control.pending,dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(p&&dialog.current&&!dialog.current.open){if(typeof dialog.current.showModal==='function')dialog.current.showModal();else dialog.current.setAttribute('open','');}},[p]);
 if(!p)return null;
 return <dialog ref={dialog} onCancel={e=>{e.preventDefault();control.stop();}} className="command-activation" aria-labelledby="command-activation-title"><h2 id="command-activation-title">{tx('Activer ces commandes ?')}</h2><p>{tx(p.mode==='automatic'?'Après activation, chaque franchissement de seuil peut modifier le son. Une condition déjà vraie doit redevenir fausse avant son premier déclenchement.':p.mode==='once'?'Après confirmation, la commande sera exécutée une fois après son délai.':'Après activation, les messages MIDI affectés peuvent exécuter ces commandes sans nouvelle confirmation.')}</p><p>{tx('Fermer cette vue, masquer la fenêtre ou perdre la connexion désactive les commandes. Arrêter annule les délais en attente ; les réglages déjà appliqués restent dans l’historique.')}</p><div className="command-activation-list">{p.commands.map(c=><article key={c.id}><h3>{c.name}</h3><p>{commandTiming(c.data)}</p><ul>{c.changes.map(x=><li key={x.address}>{friendly(x.address)} : {String(x.before)} → <strong>{String(x.after)}</strong>{!!x.at&&<> · {x.at/1000} s</>}</li>)}</ul>{!!c.offChanges?.length&&<><h4>{tx('Quand la condition devient fausse')}</h4><ul>{c.offChanges.map(x=><li key={x.address}>{friendly(x.address)} → <strong>{String(x.after)}</strong>{!!x.at&&<> · {x.at/1000} s</>}</li>)}</ul></>}</article>)}{p.scenes?.map(scene=><article key={scene.id}>
  <h3>{scene.name}</h3>
  <p>{tx('Rappel sélectif')} · {scene.sceneName}</p>
  <p>{(scene.scope.mapping??scene.scope.channels.map(channel=>({source:channel,target:channel}))).map(({source,target})=>source===target?`${tx('Canal')} ${target}`:`${tx('Canal')} ${source} → ${target}`).join(' · ')}</p>
  <p>{scene.scope.sections.map(section=>tx(SCENE_RECALL_LABELS[section])).join(' · ')}</p>
  <SceneProtectionSummary excluded={scene.excluded}/>
  <details><summary>{tx('Valeurs cibles de la scène')} ({scene.targets.length})</summary>
  <ul>{scene.targets.map(target=><li key={target.address}>{tx(friendly(target.address))} → <strong>{String(target.after)}</strong></li>)}</ul></details>
 </article>)}</div>{!!p.scenes?.length&&<p>{tx(SCENE_RECALL_NOTICE)}</p>}{control.error&&<p role="alert">{tx(control.error)}</p>}<div className="command-actions"><button type="button" onClick={control.stop}>{tx('Annuler, ne rien changer')}</button><button type="button" disabled={control.busy||!canWrite} onClick={()=>void control.accept()}>{tx('Confirmer l’activation')}</button></div></dialog>;
}
export function CommandUndo({backup,canWrite,mode='real',beforeUndo}:{backup:string;canWrite:boolean;mode?:string;beforeUndo:()=>void}){
 const [plan,setPlan]=useState<Plan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!backup)return null;
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <><button type="button" disabled={busy||!canWrite} onClick={()=>{beforeUndo();void run(async()=>{const p=await presetApi<Plan>(`/api/library/${backup}/preview`,{});if(p.token)setPlan({...p,title:tx('Revenir au réglage précédent'),explanation:tx('Seuls les réglages de cette sauvegarde seront restaurés.'),inputs:[]});});}}>{tx('Annuler la dernière commande')}</button>{plan&&<PlanDialog plan={plan} busy={busy} canApply={canWrite} mode={mode} error={error} onClose={()=>setPlan(null)} onApply={()=>void run(async()=>{await presetApi(`/api/library/${backup}/apply`,{token:plan.token,confirm:true});setPlan(null);})}/>} {error&&!plan&&<p role="alert">{tx(error)}</p>}</>;
}
