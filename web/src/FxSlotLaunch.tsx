import {useEffect,useRef,useState} from 'react';
import {FX_SCHEMAS,tempoTap} from '../../shared/fx-parameters';
import {FxConsole} from './FxConsole';
import {FxRackFace} from './FxRackFace';
import {FX_INFO} from './xairHelp';
import {tx} from './i18n';

function SlotDialog({slot,bpm,close}:{slot:number;bpm:number|null;close:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close();},[]);
 return <dialog ref={ref} className="fx-rack-dialog" aria-label={tx('Réglages du module')+' · FX '+slot} onCancel={close}>
  <div className="fx-dialog-bar"><strong>{tx('Réglages du module')} · FX {slot}</strong><button type="button" onClick={close}>{tx('Fermer')}</button></div>
  <FxConsole initialSlot={slot} initialBpm={bpm??120}/>
 </dialog>;
}
export function FxSlotLaunch({slot,algorithm,canTap}:{slot:number;algorithm:number;canTap:boolean}){
 const [open,setOpen]=useState(false),[bpm,setBpm]=useState<number|null>(null),taps=useRef<number[]>([]);
 useEffect(()=>{taps.current=[];setBpm(null);},[algorithm]);
 const info=FX_INFO[algorithm];
 return <div className="fx-slot-launch">
  <button className="fx-open-face" type="button" aria-haspopup="dialog" title={tx('Réglages du module')} aria-label={'FX '+slot+' · '+tx(info?.name??'Réglages du module')} onClick={()=>setOpen(true)}>{info?<FxRackFace algorithm={algorithm}/>:tx('Lire le slot')}</button>
  {FX_SCHEMAS[algorithm]?.tempoIndex!==undefined&&<div className="fx-slot-tempo"><button type="button" disabled={!canTap} aria-label={tx('Taper le tempo')+' · FX '+slot} onClick={()=>{const next=tempoTap(taps.current,performance.now());taps.current=next.taps;setBpm(next.bpm);}}>Tap</button><output aria-live="polite">{bpm!==null?bpm+' BPM':''}</output></div>}
  {open&&<SlotDialog slot={slot} bpm={bpm} close={()=>setOpen(false)}/>}
 </div>;
}
