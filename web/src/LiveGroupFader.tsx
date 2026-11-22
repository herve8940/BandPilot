import {useEffect,useRef,useState} from 'react';
import {tx} from './i18n';
import {presetApi} from './preset-controls';
import type {GroupSelection} from '../../shared/adjustment-group';
type Props={model:string;selection:GroupSelection;disabled:boolean;onBackup:(id:string)=>void;compact?:boolean};
export function LiveGroupFader(props:Props){return <LiveFader key={JSON.stringify([props.model,props.selection])} {...props}/>;}
function LiveFader({model,selection,disabled,onBackup,compact=false}:Props){
 const [armed,setArmed]=useState(false),[offset,setOffset]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[followMembers,setFollowMembers]=useState(compact);
 const session=useRef<{token:string;sequence:number}|null>(null),queued=useRef<number|null>(null),moving=useRef(false),alive=useRef(true),generation=useRef(0);
 const stop=()=>{generation.current++;const s=session.current;session.current=null;queued.current=null;if(alive.current)setArmed(false);if(s)void presetApi('/api/library/live-group/stop',{token:s.token}).catch(()=>{});};
 useEffect(()=>{
  alive.current=true;
  const hidden=()=>{if(document.hidden)stop();};
  window.addEventListener('bandpilot-console-reset',stop);document.addEventListener('visibilitychange',hidden);
  return()=>{alive.current=false;stop();window.removeEventListener('bandpilot-console-reset',stop);document.removeEventListener('visibilitychange',hidden);};
 },[]);
 useEffect(()=>{if(disabled)stop();},[disabled]);
 const move=async(value:number)=>{
  setOffset(value);queued.current=value;if(moving.current)return;moving.current=true;setBusy(true);
  try{while(queued.current!==null&&session.current&&alive.current){const next=queued.current;queued.current=null;const s=session.current;const r=await presetApi<{sequence:number;backupId?:string}>('/api/library/live-group/move',{token:s.token,sequence:s.sequence+1,offset:next});if(alive.current&&r.backupId)onBackup(r.backupId);if(session.current===s)s.sequence=r.sequence;}}
  catch(e){const err=e as Error&{backupId?:string};if(alive.current){setError(err.message);if(err.backupId)onBackup(err.backupId);stop();}}finally{moving.current=false;if(alive.current)setBusy(false);}
 };
 const arm=async()=>{
  if(!confirm(tx('Activer le fader continu pour cette sélection ? Ses mouvements changeront immédiatement le son.')))return;
  const ticket=++generation.current;setBusy(true);setError('');
  try{
   const s=await presetApi<{token:string;sequence:number}>('/api/library/live-group/start',{model,selection,followMembers,confirm:true});
   if(!alive.current||ticket!==generation.current){void presetApi('/api/library/live-group/stop',{token:s.token}).catch(()=>{});return;}
   session.current=s;setOffset(0);setArmed(true);
  }catch(e){if(alive.current&&ticket===generation.current)setError((e as Error).message);}finally{if(alive.current)setBusy(false);}
 };
 if(!['fader','send'].includes(selection.target))return null;
 return <section className={compact?"bank-group-fader":"live-group-fader"}>{!compact&&<><h4>{tx(selection.target==='send'?'Fader de groupe du retour':'Fader de groupe logiciel')}</h4><p>{tx('Après activation, ce fader règle directement les entrées sélectionnées. Les écarts et les niveaux à −∞ sont conservés. Arrêter conserve le dernier réglage ; le retour arrière utilise la sauvegarde.')}</p>
 <label className="group-follow"><input type="checkbox" checked={followMembers} disabled={armed||busy||disabled} onChange={e=>setFollowMembers(e.target.checked)}/>{tx('Conserver les retouches individuelles')}</label>
 <p>{tx(followMembers?'Au prochain mouvement, le groupe conserve les nouveaux écarts. Le retour arrière annule uniquement le dernier mouvement du groupe.':'Une retouche individuelle arrête le groupe. Le retour arrière retrouve les niveaux du début de l’activation.')}</p></>}
 {!armed?<><button type="button" disabled={disabled||busy||selection.channels.length<2} onClick={()=>void arm()}>{tx('Activer le fader continu')}</button>{busy&&<button type="button" onClick={stop}>{tx('Annuler l’activation')}</button>}</>:<><label>{tx('Décalage (dB)')}<input aria-label={tx('Fader de groupe continu')} type="range" min={-12} max={12} step={.5} value={offset} disabled={disabled} onChange={e=>void move(Number(e.target.value))}/><output>{offset>0?'+':''}{offset.toFixed(1)} dB</output></label><button type="button" onClick={stop}>{tx('Arrêter le fader continu')}</button></>}
 {error&&<p role="alert">{tx(error)}</p>}
 </section>;
}
