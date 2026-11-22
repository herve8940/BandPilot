import {useEffect,useRef,useState} from 'react';
import {COMMAND_TARGETS,commandRules,commandIsTimed,type CommandCondition,type CommandStep,type ConsoleCommand} from '../../../shared/console-command';
import {useMixerModel} from '../MixerModel';
import {presetApi,type LibraryEntry} from '../preset-controls';
import {tx} from '../i18n';
import {PlanDialog,type Plan} from '../SoundCoach';
import {CommandActivationDialog,CommandUndo,commandTiming,commandStepLabel,useCommandControl} from './CommandActivation';
export function ConsoleCommands({canWrite,mode}:{canWrite:boolean;mode:'real'|'simulation'}){
 const model=useMixerModel();return <CommandsEditor key={model.id} canWrite={canWrite} mode={mode}/>;
}
function CommandsEditor({canWrite,mode}:{canWrite:boolean;mode:'real'|'simulation'}){
 const model=useMixerModel();
 const [open,setOpen]=useState(false),[admin,setAdmin]=useState(false),[entries,setEntries]=useState<LibraryEntry[]>([]),[name,setName]=useState(''),[steps,setSteps]=useState<CommandStep[]>([]),[channel,setChannel]=useState(1),[target,setTarget]=useState<CommandStep['target']>('fader'),[value,setValue]=useState('-10'),[bus,setBus]=useState(1),[band,setBand]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[backup,setBackup]=useState('');
 const [delay,setDelay]=useState('0'),[conditionEnabled,setConditionEnabled]=useState(false),[conditionChannel,setConditionChannel]=useState(1),[conditionTarget,setConditionTarget]=useState<'fader'|'send'|'mute'>('fader'),[conditionBus,setConditionBus]=useState(1),[comparison,setComparison]=useState<'above'|'below'>('above'),[threshold,setThreshold]=useState('-10'),[hysteresis,setHysteresis]=useState('0.5'),[automatic,setAutomatic]=useState<string[]>([]);
 const [offSteps,setOffSteps]=useState<CommandStep[]>([]),[extraRules,setExtraRules]=useState<CommandCondition[]>([]);
 const [match,setMatch]=useState<'all'|'any'>('all');
 const [pending,setPending]=useState<{plan:Plan;path:string}|null>(null),working=useRef(false);
 const control=useCommandControl(canWrite);
 const load=async()=>{setEntries(await presetApi<LibraryEntry[]>('/api/library/commands'));window.dispatchEvent(new Event('bandpilot-commands-changed'));};
 const run=async(fn:()=>Promise<void>)=>{if(working.current)return;working.current=true;setBusy(true);setError('');setMessage('');try{await fn();}catch(e){setError((e as Error).message);}finally{working.current=false;setBusy(false);}};
 useEffect(()=>{void presetApi<{user:{role:string}|null}>('/api/auth').then(a=>setAdmin(a.user?.role==='admin')).catch(()=>{});},[]);
 useEffect(()=>{if(admin&&open)void run(load);},[admin,open]);
 if(!admin||model.family!=='xair')return null;
 const limits=target==='fader'||target==='send'?[-90,10]:target==='eq'?[-15,15]:target==='compressor'?[-60,0]:target==='gate'?[-80,0]:[0,1];
 const valid=value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=limits[0]!&&Number(value)<=limits[1]!&&(target!=='mute'||[0,1].includes(Number(value)));
 const automationValid=delay.trim()!==''&&Number.isFinite(Number(delay))&&Number(delay)>=0&&Number(delay)<=30&&Number.isInteger(Number(delay)*1000)&&(!conditionEnabled||(threshold.trim()!==''&&Number.isFinite(Number(threshold))&&Number(threshold)>=(conditionTarget==='mute'?0:-90)&&Number(threshold)<=(conditionTarget==='mute'?1:10)&&(conditionTarget!=='mute'||[0,1].includes(Number(threshold)))&&hysteresis.trim()!==''&&Number.isFinite(Number(hysteresis))&&Number(hysteresis)>=0&&Number(hysteresis)<=12));
 const rule:CommandCondition={channel:conditionChannel,target:conditionTarget,...(conditionTarget==='send'?{bus:conditionBus}:{}),comparison,threshold:Number(threshold),hysteresis:conditionTarget==='mute'?0:Number(hysteresis)};
 const timeValid=[...steps,...offSteps].every(step=>(step.delayMs??0)+Number(delay)*1000<=30000);
 const currentStep=():CommandStep=>({channel,target,value:Number(value),...(target==='send'?{bus}:{}),...(target==='eq'?{band}:{})});
 const timedSteps=(list:CommandStep[],update:(steps:CommandStep[])=>void)=>list.map((step,index)=><li key={index}>
  {commandStepLabel(step)}
  <label>{tx('Délai de cette étape (s)')}<input type="number" min={0} max={30} step={0.1} value={(step.delayMs??0)/1000} onChange={e=>{
   const ms=Math.round(Number(e.target.value)*1000);
   if(Number.isFinite(ms)&&ms>=0&&ms<=30000)update(list.map((item,i)=>i===index?{...item,delayMs:ms}:item));
  }}/></label>
  <button type="button" onClick={()=>update(list.filter((_,i)=>i!==index))}>{tx('Retirer')}</button>
 </li>);
 const locked=busy||control.active||control.busy;
 const channels=Array.from({length:model.channels},(_,i)=><option key={i} value={i+1}>{i+1}</option>),buses=Array.from({length:model.monitorOutputs},(_,i)=><option key={i} value={i+1}>{i+1}</option>);
 const prepare=async(e:LibraryEntry)=>{control.stop();if(commandIsTimed(e.data as ConsoleCommand)){await control.prepare([e.id],'once');return;}const p=await presetApi<Plan>(`/api/library/commands/${e.id}/preview`,{});if(!p.token){setMessage('Rien ne change dans la sélection. Aucun réglage envoyé.');return;}setPending({plan:{...p,title:e.name,explanation:tx('Cette commande rappelle uniquement les réglages affichés. Vérifie les canaux et les valeurs avant de confirmer.'),inputs:[]},path:`/api/library/commands/${e.id}/apply`});};
 const save=()=>run(async()=>{
  const advanced=extraRules.length>0||offSteps.length>0;
  const data:ConsoleCommand={version:1,model:model.id,steps,delayMs:Math.round(Number(delay)*1000),
   ...(conditionEnabled?(advanced?{conditionSet:{match,rules:[rule,...extraRules],...(offSteps.length?{offSteps}:{})}}:{condition:rule}):{})};
  await presetApi('/api/library/commands',{name:name.trim(),data});setSteps([]);setOffSteps([]);setExtraRules([]);setName('');await load();setMessage('Commande enregistrée. Aucun réglage audio envoyé.');
 });
 return <details className="midi-controls console-commands" onToggle={e=>{setOpen(e.currentTarget.open);if(!e.currentTarget.open)control.stop();}}><summary>{tx('Commandes favorites et macros')}</summary>{open&&<>
 <p>{tx('Prépare plusieurs réglages dans une commande nommée. L’enregistrement ne change pas le son. Prévisualise l’exécution manuelle ou active explicitement le déclenchement MIDI ou automatique.')}</p>
 <fieldset disabled={locked}><label>{tx('Nom')}<input maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><label>{tx('Canal')}<select value={channel} onChange={e=>setChannel(Number(e.target.value))}>{channels}</select></label>
 <label>{tx('Réglage commun')}<select value={target} onChange={e=>{const next=e.target.value as CommandStep['target'];setTarget(next);setValue(next==='mute'?'1':next==='eq'?'0':'-10');}}>{Object.entries(COMMAND_TARGETS).map(([t,label])=><option value={t} key={t}>{tx(label)}</option>)}</select></label>
 {target==='send'&&<label>{tx('Bus')}<select value={bus} onChange={e=>setBus(Number(e.target.value))}>{buses}</select></label>}{target==='eq'&&<label>{tx('Bande EQ')}<select value={band} onChange={e=>setBand(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>}
 <label>{tx('Valeur')}<input type="number" min={limits[0]} max={limits[1]} step={target==='mute'?1:.5} value={value} aria-invalid={!valid} onChange={e=>setValue(e.target.value)}/>{target==='mute'?tx('1 = muet, 0 = actif'):'dB'}</label>
 <button type="button" disabled={!valid||steps.length>=64} onClick={()=>setSteps(old=>[...old,currentStep()])}>{tx('Ajouter à la commande')}</button>
 {conditionEnabled&&<button type="button" disabled={!valid||offSteps.length>=64} onClick={()=>setOffSteps(old=>[...old,currentStep()])}>{tx('Ajouter quand la condition devient fausse')}</button>}
 <ol>{timedSteps(steps,setSteps)}</ol>
 {conditionEnabled&&offSteps.length>0&&<><h4>{tx('Quand la condition devient fausse')}</h4><ol>{timedSteps(offSteps,setOffSteps)}</ol></>}
 <details className="command-trigger-editor"><summary>{tx('Délai et condition automatique')}</summary><label>{tx('Délai avant exécution (secondes)')}<input type="number" min={0} max={30} step={0.1} value={delay} onChange={e=>setDelay(e.target.value)}/></label><label><input type="checkbox" checked={conditionEnabled} onChange={e=>setConditionEnabled(e.target.checked)}/>{tx('Ajouter une condition automatique')}</label>
 {conditionEnabled&&<div className="command-condition"><label>{tx('Canal observé')}<select value={conditionChannel} onChange={e=>setConditionChannel(Number(e.target.value))}>{channels}</select></label><label>{tx('Réglage observé')}<select value={conditionTarget} onChange={e=>{const t=e.target.value as 'fader'|'send'|'mute';setConditionTarget(t);setThreshold(t==='mute'?'0':'-10');setHysteresis(t==='mute'?'0':'0.5');}}>{(['fader','send','mute'] as const).map(t=><option key={t} value={t}>{tx(COMMAND_TARGETS[t])}</option>)}</select></label>
 {conditionTarget==='send'&&<label>{tx('Bus')}<select value={conditionBus} onChange={e=>setConditionBus(Number(e.target.value))}>{buses}</select></label>}
 <label>{tx('Comparaison')}<select value={comparison} onChange={e=>setComparison(e.target.value as 'above'|'below')}><option value="above">{tx('Au-dessus du seuil')}</option><option value="below">{tx('Au-dessous du seuil')}</option></select></label><label>{tx('Seuil de déclenchement')}<input type="number" value={threshold} step={conditionTarget==='mute'?1:.5} min={conditionTarget==='mute'?0:-90} max={conditionTarget==='mute'?1:10} onChange={e=>setThreshold(e.target.value)}/>{conditionTarget==='mute'?tx('1 = muet, 0 = actif'):'dB'}</label>
 {conditionTarget!=='mute'&&<label>{tx('Hystérésis (dB)')}<input type="number" min={0} max={12} step={.1} value={hysteresis} onChange={e=>setHysteresis(e.target.value)}/></label>}<p>{tx('La condition observe un réglage de fader ou de mute, pas le niveau audio mesuré. Le délai exige que la condition reste vraie. L’hystérésis évite les répétitions autour du seuil.')}</p></div>}
 {conditionEnabled&&<section className="command-condition-set">
 <label>{tx('Combinaison des conditions')}<select value={match} onChange={e=>setMatch(e.target.value as 'all'|'any')}>
  <option value="all">{tx('Toutes les conditions')}</option><option value="any">{tx('Au moins une condition')}</option>
 </select></label>
 <button type="button" disabled={!automationValid||extraRules.length>=7} onClick={()=>setExtraRules(old=>[...old,rule])}>{tx('Copier cette condition dans la liste')}</button>
 {!!extraRules.length&&<p>{tx('Les conditions copiées s’ajoutent à celle affichée dans le formulaire.')}</p>}
 <ul>{extraRules.map((item,index)=><li key={index}>{commandStepLabel({...item,value:item.threshold})} · {tx(item.comparison==='above'?'Au-dessus du seuil':'Au-dessous du seuil')}
  <button type="button" onClick={()=>setExtraRules(old=>old.filter((_,i)=>i!==index))}>{tx('Retirer')}</button></li>)}</ul>
 </section>}
 <p>{tx('Une condition ne s’active jamais à l’enregistrement. Les exécutions manuelles et MIDI utilisent le délai et ignorent la condition automatique.')}</p></details>
 <button type="button" disabled={!name.trim()||!steps.length||!automationValid||!timeValid} onClick={()=>void save()}>{tx('Enregistrer la commande')}</button></fieldset>
 <div>{entries.map(e=><article className="command-card" key={e.id}><h4>{e.name}</h4><p>{commandTiming(e.data as ConsoleCommand)}</p>{commandRules(e.data as ConsoleCommand).length>0&&<label><input type="checkbox" disabled={control.active||control.busy} checked={automatic.includes(e.id)} onChange={event=>setAutomatic(old=>event.target.checked?[...old,e.id]:old.filter(id=>id!==e.id))}/>{tx('Inclure dans les commandes automatiques')}</label>}
 <details><summary>{tx('Réglages')}</summary><ul>{(e.data as ConsoleCommand).steps.map((s,i)=><li key={i}>{commandStepLabel(s)}</li>)}</ul></details><button type="button" disabled={locked||!canWrite} onClick={()=>void run(()=>prepare(e))}>{tx('Prévisualiser les changements')}</button><button type="button" disabled={locked} onClick={()=>{if(!confirm(tx('Supprimer cette commande ?')))return;void run(async()=>{const r=await fetch(`/api/library/commands/${e.id}`,{method:'DELETE'});if(!r.ok)throw Error((await r.json()).error);await load();});}}>{tx('Supprimer')}</button></article>)}</div>
 <div className="command-automation-actions"><button type="button" disabled={busy||control.busy||!canWrite||(!control.active&&!automatic.some(id=>entries.some(e=>e.id===id)))} aria-pressed={control.active} onClick={()=>control.active?control.stop():void control.prepare(automatic.filter(id=>entries.some(e=>e.id===id)),'automatic')}>{tx(control.active?'Arrêter les commandes actives':'Préparer les commandes automatiques')}</button>{control.waiting>0&&<p role="status">{tx('Commandes en attente')} : {control.waiting}</p>}</div>
 <CommandActivationDialog control={control} canWrite={canWrite}/><CommandUndo backup={control.backup} canWrite={canWrite} mode={mode} beforeUndo={control.stop}/>{control.message&&<p role="status">{tx(control.message)}</p>}{control.error&&!control.pending&&<p role="alert">{tx(control.error)}</p>}
 {backup&&<button type="button" disabled={locked||!canWrite} onClick={()=>void run(async()=>{const p=await presetApi<Plan>(`/api/library/${backup}/preview`,{});if(p.token)setPending({plan:{...p,title:tx('Revenir au réglage précédent'),explanation:tx('Seuls les réglages de cette sauvegarde seront restaurés.'),inputs:[]},path:`/api/library/${backup}/apply`});})}>{tx('Revenir au réglage précédent')}</button>}
 {pending&&<PlanDialog plan={pending.plan} busy={busy} canApply={canWrite} mode={mode} error={error} onClose={()=>setPending(null)} onApply={()=>void run(async()=>{const r=await presetApi<{backupId:string}>(pending.path,{token:pending.plan.token,confirm:true});setBackup(r.backupId);setPending(null);setMessage('Sélection appliquée. Les réglages précédents sont dans l’historique.');})}/>}
 {message&&<p role="status">{tx(message)}</p>}{error&&!pending&&<p role="alert">{tx(error)}</p>}</>}</details>;
}
