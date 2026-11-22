import {useEffect,useState} from 'react';
import {tx} from '../i18n';
import {useMixerModel} from '../MixerModel';
import type {Strip} from '../xair/strips';
import './measurement-tools.css';
export type ReductionPoint={at:number;db:number|null};
export function reductionPath(points:ReductionPoint[],end:number,seconds:number){let previous:number|null=null;return points.filter(p=>p.at>=end-seconds*1000&&p.at<=end).map(p=>{if(p.db===null){previous=null;return '';}const move=previous===null||p.at-previous>1500;previous=p.at;return `${move?'M':'L'}${((p.at-(end-seconds*1000))/(seconds*1000)*600).toFixed(1)} ${(-Math.max(-30,Math.min(0,p.db))/30*100).toFixed(1)}`;}).join(' ');}
export function GainReduction({strip,kind='comp'}:{strip:Strip;kind?:'comp'|'gate'}){
 const model=useMixerModel(),key=model.id+':'+strip.id+':'+kind;
 const supported=model.family==='xair'&&(strip.kind==='ch'&&Number(strip.short)<=model.channels||kind==='comp'&&(strip.kind==='lr'||strip.kind==='bus'&&Number(strip.prefix.split('/')[2])<=model.monitorOutputs));
 const [state,setState]=useState<{key:string;db:number|null;points:ReductionPoint[];connection:unknown;now:number}>({key,db:null,points:[],connection:null,now:Date.now()});
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!supported)return;const t=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(t);},[supported]);
 const [history,setHistory]=useState(false),[seconds,setSeconds]=useState(30),[held,setHeld]=useState<{points:ReductionPoint[];now:number}|null>(null);
 useEffect(()=>{setState({key,db:null,points:[],connection:null,now:Date.now()});setHeld(null);setHistory(false);},[key]);
 useEffect(()=>{if(!supported)return;let active=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{let frame:any=null,id:unknown=null;try{const r=await fetch('/api/dynamics',{signal:AbortSignal.timeout(2000)});if(r.ok){const body=await r.json();frame=body.frame;id=body.connectionId;}}catch{}
   if(!active)return;const now=Date.now();const value=frame&&Number.isFinite(frame.at)&&now-frame.at<2000&&frame.at<=now+1000?(strip.kind==='ch'?frame[kind]?.[Number(strip.short)-1]:strip.kind==='bus'?frame.bus?.[Number(strip.prefix.split('/')[2])-1]:frame.lr):null;
   const db=typeof value==='number'&&Number.isFinite(value)?Math.min(0,value):null;
   setState(old=>{const same=old.key===key&&old.connection===id;const points=same?old.points:[];const at=db===null?now:frame.at;
    const next=history&&(!points.length||at>points[points.length-1]!.at)?[...points,{at,db}]:points;
    return {key,db,connection:id,points:next.filter(p=>p.at>now-60000).slice(-240),now};});
   timer=setTimeout(()=>void poll(),500);
  };void poll();return()=>{active=false;clearTimeout(timer);};
 },[key,supported,history]);
 useEffect(()=>{setHeld(null);},[state.connection]);
 if(!supported)return null;
 const current=state.key===key?{...state,db:now-state.now<2000?state.db:null,now}: {db:null,points:[],now},shown=state.key===key?(held??current):current;
 const points=shown.points.filter(p=>p.at>=shown.now-seconds*1000),valid=points.filter(p=>p.db!==null);
 const peak=valid.length?Math.max(...valid.map(p=>-p.db!)):null;
 return <section className="measurement-card" aria-label={tx(kind==='gate'?'Réduction de gain du gate':'Réduction de gain du compresseur')}>
  <div className="visual-gain-reduction"><span>{tx(kind==='gate'?'Réduction du gate':'Réduction du compresseur')}</span><div role="meter" aria-label={tx('Réduction de gain')} aria-valuemin={0} aria-valuemax={30} aria-valuenow={current.db===null?undefined:Math.min(30,-current.db)} aria-valuetext={current.db===null?tx('Mesure indisponible'):`${current.db.toFixed(1)} dB`}><i style={{width:`${current.db===null?0:Math.min(100,-current.db/30*100)}%`}}/></div><output>{current.db===null?'—':`${current.db.toFixed(1)} dB`}</output></div>
  <button type="button" className="measurement-history-toggle" aria-expanded={history} onClick={()=>{setHistory(!history);setHeld(null);setState(s=>({...s,points:[]}));}}>{tx(history?'Masquer l’historique':'Historique de réduction du gain')}</button>
  {history&&<div className="reduction-history"><div className="measurement-actions"><label>{tx('Fenêtre de mesure')}<select aria-label={tx('Fenêtre de mesure')} value={seconds} onChange={e=>setSeconds(Number(e.target.value))}>{[15,30,60].map(s=><option key={s} value={s}>{s} s</option>)}</select></label><button type="button" disabled={!held&&!valid.length} aria-pressed={!!held} onClick={()=>setHeld(held?null:{points:[...current.points],now:current.now})}>{tx(held?'Reprendre le direct':'Figer l’historique')}</button><button type="button" onClick={()=>{setHeld(null);setState(s=>({...s,points:[]}));}}>{tx('Effacer l’historique')}</button><span className="measurement-state">{tx(held?'Historique figé':current.db===null?'Mesure indisponible':'Mesure en direct')}</span></div>
   <svg viewBox="-34 -10 650 134" role="img" aria-label={tx('Réduction du gain dans le temps')} preserveAspectRatio="none">{[0,10,20,30].map(v=><g key={v}><line x1={0} x2={600} y1={v/30*100} y2={v/30*100}/><text x={-7} y={v/30*100+4} textAnchor="end">{v===0?'0':`−${v}`}</text></g>)}<path d={reductionPath(points,shown.now,seconds)}/><text x={0} y={120}>−{seconds} s</text><text x={600} y={120} textAnchor="end">0 s</text></svg>
   <p>{tx('Réduction maximale dans cette fenêtre :')} {peak===null?'—':`${peak.toFixed(1)} dB`}</p><p className="measurement-help">{tx('Mesures reçues de la console. Les interruptions restent visibles ; un traitement désactivé ou sans mesure ne prouve pas que le signal est correct.')}</p>
  </div>}
 </section>;
}
