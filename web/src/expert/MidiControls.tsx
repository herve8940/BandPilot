import {useEffect,useRef,useState} from 'react';
import {useMixerModel} from '../MixerModel';
import {tx} from '../i18n';
import {presetApi,type LibraryEntry} from '../preset-controls';
import type {Values,SetFn} from '../xair/controls';
import {midiSignal,midiTargets,midiPickup,validMidiBindings,midiCommandId,relativeMidiLevel,midiFeedback,MIDI_ENCODERS,type MidiBinding} from './midi-controls';
import {CommandActivationDialog,CommandUndo,useCommandControl} from './CommandActivation';
type Bridge={get:()=>Record<string,MidiBinding[]>|null;set:(v:Record<string,MidiBinding[]>)=>boolean};
const bridge=()=> (window as Window&{bandpilotControllerMappings?:Bridge}).bandpilotControllerMappings;
const key='bandpilot-midi-mappings-v1';
function read(){try{return bridge()?.get()??JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
type Props={values:Values;set:SetFn;canWrite:boolean;openInitially?:boolean;mode?:'real'|'simulation'};
export function MidiControls(props:Props){const model=useMixerModel();return <MidiEditor key={model.id} {...props}/>;}
function MidiEditor({values,set,canWrite,openInitially=false,mode='real'}:Props){
 const model=useMixerModel(),targets=midiTargets(model);
 const [bindings,setBindings]=useState<MidiBinding[]>(()=>{try{return validMidiBindings(read()[model.id]??[],model);}catch{return [];}});
 const [opened,setOpened]=useState(openInitially);
 const [access,setAccess]=useState<MIDIAccess|null>(null),[ports,setPorts]=useState<MIDIInput[]>([]),[outputs,setOutputs]=useState<MIDIOutput[]>([]),[device,setDevice]=useState(''),[output,setOutput]=useState(''),[feedback,setFeedback]=useState(false),[target,setTarget]=useState(targets[0]!.address),[learn,setLearn]=useState(false),[armed,setArmed]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[commands,setCommands]=useState<LibraryEntry[]>([]),[scenes,setScenes]=useState<LibraryEntry[]>([]),[ccMode,setCcMode]=useState<keyof typeof MIDI_ENCODERS>('absolute'),[stepDb,setStepDb]=useState(.5),[increment,setIncrement]=useState(1),[decrement,setDecrement]=useState(127);
 const current=useRef({values,set,canWrite,bindings,armed,learn,target,ccMode,stepDb,increment,decrement});current.current={values,set,canWrite,bindings,armed,learn,target,ccMode,stepDb,increment,decrement};
 const alive=useRef(true),pickup=useRef(new Map<string,{previous?:number;acquired:boolean;down:boolean;observed?:number;lastWire?:number;lastProgram?:number}>()),sent=useRef(new Map<string,number>()),feedbackValues=useRef(new Map<string,string>());
 const disarmLocal=()=>{current.current.armed=false;if(alive.current)setArmed(false);pickup.current.clear();feedbackValues.current.clear();};
 const commandControl=useCommandControl(canWrite,{onArmed:()=>{current.current.armed=true;setArmed(true);},onStopped:disarmLocal});
 const disarm=()=>{disarmLocal();commandControl.stop();};
 const controller=useRef(commandControl);controller.current=commandControl;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;current.current.armed=false;};},[]);
 useEffect(()=>{if(!canWrite)disarm();},[canWrite]);
 useEffect(()=>{const reset=()=>{disarm();setLearn(false);},hidden=()=>{if(document.hidden)reset();};window.addEventListener('bandpilot-console-reset',reset);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('bandpilot-console-reset',reset);document.removeEventListener('visibilitychange',hidden);};},[]);
 const loadScenes=()=>void presetApi<LibraryEntry[]>('/api/library/midi-scenes').then(list=>{if(alive.current&&Array.isArray(list))setScenes(list);}).catch(()=>{});
 useEffect(()=>{
  loadScenes();
  window.addEventListener('bandpilot-midi-scenes-changed',loadScenes);
  return()=>window.removeEventListener('bandpilot-midi-scenes-changed',loadScenes);
 },[]);
 const removeScene=async(id:string)=>{
  disarm();
  setLearn(false);
  try{
   const response=await fetch('/api/library/midi-scenes/'+id,{method:'DELETE'});
   if(!response.ok)throw Error((await response.json()).error);
   if(target==='command:'+id)setTarget(targets[0]!.address);
   if(bindings.some(binding=>binding.target==='command:'+id))save(bindings.filter(binding=>binding.target!=='command:'+id));
   window.dispatchEvent(new Event('bandpilot-midi-scenes-changed'));
  }catch(error){setError((error as Error).message);}
 };
 const loadCommands=()=>void presetApi<LibraryEntry[]>('/api/library/commands').then(list=>{if(alive.current&&Array.isArray(list))setCommands(list);}).catch(()=>{});
 useEffect(()=>{loadCommands();window.addEventListener('bandpilot-commands-changed',loadCommands);return()=>window.removeEventListener('bandpilot-commands-changed',loadCommands);},[]);
 const save=(next:MidiBinding[])=>{disarm();setError('');try{const checked=validMidiBindings(next,model),all={...read(),[model.id]:checked};let stored=false;try{localStorage.setItem(key,JSON.stringify(all));stored=true;}catch{/* Native bridge can persist. */}const native=bridge();if(native)stored=native.set(all);setBindings(checked);current.current.bindings=checked;setMessage(stored?'Affectations enregistrées. Aucun réglage audio envoyé.':'Affichage conservé pour cette session uniquement. Réessaie l’enregistrement.');}catch(e){setError((e as Error).message);}};
 useEffect(()=>{
  if(!access)return;
  let topology='',priorInputs:MIDIInput[]=[],priorOutputs:MIDIOutput[]=[];const refresh=()=>{const next=[...access.inputs.values()].filter(p=>p.state==='connected'),out=[...access.outputs.values()].filter(p=>p.state==='connected'),signature=JSON.stringify([next.map(p=>p.id),out.map(p=>p.id)]);if(signature!==topology||next.some((p,i)=>p!==priorInputs[i])||out.some((p,i)=>p!==priorOutputs[i])){topology=signature;disarm();setLearn(false);}priorInputs=next;priorOutputs=out;setPorts(old=>old.length===next.length&&old.every((p,i)=>p===next[i])?old:next);setOutputs(old=>old.length===out.length&&old.every((p,i)=>p===out[i])?old:out);};refresh();access.addEventListener('statechange',refresh);
  return()=>access.removeEventListener('statechange',refresh);
 },[access]);
 useEffect(()=>{
  const port=ports.find(p=>p.id===device);if(!port)return;
  const receive=(event:MIDIMessageEvent)=>{
   const signal=midiSignal(event.data),c=current.current;if(!signal)return;
   const echo=event.data&&sent.current.get([...event.data].join(','));if(typeof echo==='number'&&performance.now()-echo<120)return;
   if(c.learn){
    if(signal.kind==='note'&&!signal.pressed)return;
    const t=targets.find(t=>t.address===c.target),command=midiCommandId(c.target);
    if(signal.kind==='note'&&!t?.toggle&&!command){setError('Une note MIDI peut piloter un mute, une commande ou une scène. Utilise CC ou Pitch Bend pour un fader.');return;}
    if(signal.kind==='pitch'&&(t?.toggle||command)||signal.kind==='program'&&!command){setError('Program Change déclenche une commande ou une scène. Pitch Bend pilote un niveau.');return;}
    if(signal.kind==='cc'&&c.ccMode!=='absolute'&&(t?.toggle||command)){setError('Un encodeur relatif doit piloter un niveau.');return;}
    const binding:MidiBinding={id:crypto.randomUUID(),device:port.id,kind:signal.kind,channel:signal.channel,number:signal.number,target:c.target,...(signal.kind==='cc'?{ccMode:c.ccMode,...(c.ccMode!=='absolute'?{stepDb:c.stepDb}:{}),...(c.ccMode==='custom'?{increment:c.increment,decrement:c.decrement}:{})}:{})};
    const next=c.bindings.filter(b=>!(b.device===port.id&&b.kind===signal.kind&&b.channel===signal.channel&&b.number===signal.number));save([...next,binding]);current.current.learn=false;setLearn(false);return;
   }
   if(!c.armed||!c.canWrite)return;
   const b=c.bindings.find(b=>b.device===port.id&&b.kind===signal.kind&&b.channel===signal.channel&&b.number===signal.number);if(!b)return;
   const state=pickup.current.get(b.id)??{acquired:false,down:false},command=midiCommandId(b.target);
   if(command){
    const press=signal.kind==='program'?performance.now()-(state.lastProgram??-Infinity)>300:signal.pressed&&!state.down;
    state.down=signal.pressed;if(signal.kind==='program')state.lastProgram=performance.now();pickup.current.set(b.id,state);
    if(press)controller.current.fire(command);return;
   }
   const v=c.values[b.target];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)return;
   const base=state.observed===v&&state.lastWire!==undefined?state.lastWire:v;
   const toggle=targets.find(t=>t.address===b.target)!.toggle;let next:number|undefined;
   if(toggle){if(signal.pressed&&!state.down)next=base===1?0:1;state.down=signal.pressed;}
   else if(b.kind==='cc'&&b.ccMode&&b.ccMode!=='absolute')next=relativeMidiLevel(base,signal.raw,b);
   else {state.acquired=state.acquired||midiPickup(state.previous,signal.value,v);state.previous=signal.value;if(state.acquired)next=signal.value;}
   if(next!==undefined&&next!==base){state.lastWire=next;state.observed=v;c.set(b.target,next);}pickup.current.set(b.id,state);
  };
  port.addEventListener('midimessage',receive);void port.open().catch(e=>{if(alive.current){disarm();setError(e.message);}});
  return()=>{port.removeEventListener('midimessage',receive);void port.close().catch(()=>{});};
 },[ports,device]);
 useEffect(()=>{
  const port=outputs.find(p=>p.id===output);if(!armed||!canWrite||!feedback||!port)return;
  try{for(const b of bindings.filter(b=>b.device===device)){const bytes=midiFeedback(b,values[b.target]);if(!bytes)continue;const signature=bytes.join(',');if(feedbackValues.current.get(b.id)===signature)continue;sent.current.set(signature,performance.now());feedbackValues.current.set(b.id,signature);port.send(bytes);}for(const [key,at]of sent.current)if(performance.now()-at>500)sent.current.delete(key);}catch(e){disarm();setError((e as Error).message);}
 },[values,bindings,armed,canWrite,feedback,output,outputs,device]);
 if(model.family!=='xair')return null;
 const activeBindings=bindings.filter(b=>b.device===device),ids=[...new Set(activeBindings.flatMap(b=>midiCommandId(b.target)??[]))];
 const arm=()=>{setError('');pickup.current.clear();if(ids.length)void commandControl.prepare(ids,'midi');else{current.current.armed=true;setArmed(true);}};
 return <details className="midi-controls" open={opened} onToggle={e=>{setOpened(e.currentTarget.open);if(!e.currentTarget.open){disarm();setLearn(false);}else {loadCommands();loadScenes();}}}><summary>{tx('MIDI et pédaliers')}</summary><p>{tx('Faders : CC absolus ou Pitch Bend avec reprise de position. Encodeurs : choisis leur format relatif. Notes, CC et Program Change peuvent déclencher les commandes favorites.')}{' '}{tx('Ces messages peuvent aussi rappeler une sélection de scène.')}</p>
 <button type="button" onClick={async()=>{setError('');try{if(!navigator.requestMIDIAccess)throw Error('MIDI indisponible dans ce navigateur.');const a=await navigator.requestMIDIAccess({sysex:false});if(alive.current)setAccess(a);}catch(e){if(alive.current)setError((e as Error).message);}}}>{tx('Connecter un périphérique MIDI')}</button>
 <label>{tx('Périphérique MIDI')}<select value={device} onChange={e=>{disarm();setLearn(false);setDevice(e.target.value);}}><option value="">—</option>{ports.map(p=><option key={p.id} value={p.id}>{p.name??p.id}</option>)}</select></label>
 <label>{tx('Commande à piloter')}<select value={target} onChange={e=>{disarm();setLearn(false);setTarget(e.target.value);}}>{targets.map(t=><option key={t.address} value={t.address}>{t.label}</option>)}{commands.map(c=><option key={c.id} value={'command:'+c.id}>{tx('Commande favorite')} · {c.name}</option>)}{scenes.map(scene=><option key={scene.id} value={'command:'+scene.id}>{tx('Rappel sélectif')} · {scene.name}</option>)}</select></label>
 <label>{tx('Format des commandes CC')}<select value={ccMode} onChange={e=>{disarm();setLearn(false);setCcMode(e.target.value as keyof typeof MIDI_ENCODERS);}}>{Object.entries(MIDI_ENCODERS).map(([value,label])=><option key={value} value={value}>{tx(label)}</option>)}</select></label>
 {ccMode!=='absolute'&&<><label>{tx('Pas de l’encodeur')}<select value={stepDb} onChange={e=>{disarm();setStepDb(Number(e.target.value));}}>{[.1,.5,1,2].map(n=><option value={n} key={n}>{n} dB</option>)}</select></label><p>{tx('Le format relatif doit correspondre à celui configuré sur ton contrôleur. Les valeurs sont limitées à la plage du fader.')}</p></>}
 {ccMode==='custom'&&<div className="midi-custom-values">{[['Valeur pour augmenter',increment,setIncrement],['Valeur pour diminuer',decrement,setDecrement]].map(([label,value,change])=><label key={String(label)}>{tx(String(label))}<input type="number" min={0} max={127} value={Number(value)} onChange={e=>{disarm();(change as (n:number)=>void)(Number(e.target.value));}}/></label>)}</div>}
 <button type="button" disabled={!ports.some(p=>p.id===device)||armed||commandControl.busy} onClick={()=>{disarm();setError('');current.current.learn=!learn;setLearn(!learn);}}>{tx(learn?'Annuler l’apprentissage':'Apprendre la prochaine commande')}</button>{learn&&<p role="status">{tx('Bouge une commande MIDI. Aucun réglage audio ne sera envoyé pendant l’apprentissage.')}</p>}
 <ul className="midi-bindings">{bindings.map(b=><li key={b.id}><span>{b.kind.toUpperCase()} {b.channel}/{b.number}{b.ccMode&&b.ccMode!=='absolute'?` · ${tx(MIDI_ENCODERS[b.ccMode])}`:''} → {targets.find(t=>t.address===b.target)?.label??commands.find(c=>c.id===midiCommandId(b.target))?.name??scenes.find(scene=>scene.id===midiCommandId(b.target))?.name??tx('Commande indisponible')}{b.device!==device&&` · ${tx('Autre périphérique')}`}</span>{b.target.endsWith('/mix/on')&&['cc','note'].includes(b.kind)&&<label><input type="checkbox" checked={b.feedback===true} onChange={e=>save(bindings.map(x=>x.id===b.id?{...x,feedback:e.target.checked}:x))}/>{tx('Voyant du mute')}</label>}<button type="button" onClick={()=>save(bindings.filter(x=>x.id!==b.id))}>{tx('Supprimer')}</button></li>)}</ul>
 <details className="midi-output"><summary>{tx('Retour des voyants MIDI')}</summary><label>{tx('Sortie MIDI')}<select value={output} onChange={e=>{disarm();setOutput(e.target.value);setFeedback(false);}}><option value="">—</option>{outputs.map(p=><option key={p.id} value={p.id}>{p.name??p.id}</option>)}</select></label><label><input type="checkbox" checked={feedback} disabled={!outputs.some(p=>p.id===output)} onChange={e=>{disarm();setFeedback(e.target.checked);}}/>{tx('Envoyer l’état des mutes aux voyants')}</label><p>{tx('Notes ou CC : 127 = muet, 0 = actif, mêmes canal et numéro que l’entrée. Aucun SysEx, moteur, écran ou protocole MCU/HUI. Vérifie le format attendu par ton contrôleur.')}</p></details>
 <button type="button" disabled={!ports.some(p=>p.id===device)||!canWrite||learn||!activeBindings.length||commandControl.busy} aria-pressed={armed} onClick={()=>armed?disarm():arm()}>{tx(armed?'Désactiver le contrôle MIDI':'Activer le contrôle MIDI')}</button>
 <details className="midi-scenes"><summary>{tx('Sélections de scène MIDI')}</summary>
  <p>{tx('Crée tes sélections dans Scènes → Rappel sélectif.')}</p>
  {!!scenes.length&&<ul>{scenes.map(scene=><li key={scene.id}><span>{scene.name}</span><button type="button" disabled={armed||commandControl.busy} onClick={()=>void removeScene(scene.id)}>{tx('Retirer la sélection MIDI')}</button></li>)}</ul>}
 </details>
 <p>{tx('L’activation vaut pour cette vue ouverte. La fermeture désactive le contrôle. Les affectations enregistrées ne modifient pas le son.')}</p>
 {commandControl.waiting>0&&<p role="status">{tx('Commandes en attente')} : {commandControl.waiting}</p>}
 <CommandActivationDialog control={commandControl} canWrite={canWrite}/><CommandUndo backup={commandControl.backup} canWrite={canWrite} mode={mode} beforeUndo={disarm}/>
 {(message||commandControl.message)&&<p role="status">{tx(commandControl.message||message)}</p>}{(error||commandControl.error)&&<p role="alert">{tx(error||commandControl.error)}</p>}</details>;
}
