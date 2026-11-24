import {MonitorRingPass} from './MonitorRingPass';
import {busLinkAddress} from '../../../shared/monitor-pairs';
import {RoomEqPanel} from './MixPreparation';
import {ResonanceGuide} from './ResonanceGuide';
import {useEffect,useRef,useState} from 'react';
import {tx} from '../i18n';
import {useMixerModel} from '../MixerModel';
import {stripName,type Strip} from '../xair/strips';
import type {Values} from '../xair/controls';
import './measurement-tools.css';
type Frame={bands:number[];at:number};
const valid=(f:Frame|null):f is Frame=>!!f&&Array.isArray(f.bands)&&f.bands.length===100&&f.bands.every(Number.isFinite)&&Number.isFinite(f.at);
async function api(path:string,data?:unknown){const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(4000)});const v=await r.json();if(!r.ok)throw Error(v.error||'Erreur');return v;}
const target=(s:Strip)=>({kind:s.kind,n:s.kind==='ch'?Number(s.short):s.kind==='bus'?Number(s.prefix.split('/')[2]):s.kind==='fxrtn'?Number(s.prefix.split('/')[2]):0});
export function spectrumPoints(bands:number[],width:number,height:number){return bands.map((v,i)=>`${(i/(bands.length-1)*width).toFixed(1)},${(Math.max(0,Math.min(90,-v))/90*height).toFixed(1)}`).join(' ');}
/** Opt-in measurement only. Captures are scoped to this source, position and connection. */
export function useEqSpectrum(strip:Strip,values:Values,showEqLegend=true,canWrite=false){
 const model=useMixerModel(),key=model.id+':'+strip.id;
 const [post,setPost]=useState(false),[busy,setBusy]=useState(false),[running,setRunning]=useState(false),[error,setError]=useState('');
 const [live,setLive]=useState<Frame|null>(null),[held,setHeld]=useState<Frame|null>(null),[reference,setReference]=useState<Frame|null>(null);
 const [physical,setPhysical]=useState(false);
 const [ringReady,setRingReady]=useState<string|null>(null);
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!running)return;const t=setInterval(()=>setNow(Date.now()),400);return()=>clearInterval(t);},[running]);
 const token=useRef<string|null>(null),epoch=useRef(0),connection=useRef<number|null>(null),scope=useRef(key);
 const reset=()=>{setPhysical(false);setRingReady(null);setLive(null);setHeld(null);setReference(null);};
 const stop=async()=>{const t=token.current;token.current=null;setRunning(false);setLive(null);if(t)await api('/api/eq-rta/stop',{token:t});};
 useEffect(()=>{scope.current=key;reset();setPost(false);setError('');setRunning(false);setBusy(false);connection.current=null;const generation=++epoch.current;
  return()=>{if(epoch.current===generation)epoch.current++;const t=token.current;token.current=null;if(t)void api('/api/eq-rta/stop',{token:t}).catch(()=>{});};
 },[key]);
 useEffect(()=>{if(!running)return;let disposed=false,timer:ReturnType<typeof setTimeout>;const generation=epoch.current;
  const poll=async()=>{const t=token.current;if(!t)return;try{const result=await api('/api/eq-rta/read',{token:t});if(disposed||generation!==epoch.current)return;
    if(connection.current!==result.connectionId){connection.current=result.connectionId;reset();}
    setPhysical(result.mode==='real');
    setRingReady(typeof result.ringReadyId==='string'?result.ringReadyId:null);
    setLive(valid(result.frame)&&Date.now()-result.frame.at<1500&&result.frame.at<=Date.now()+1000?result.frame:null);
   }catch(e){if(disposed||generation!==epoch.current)return;setError((e as Error).message);reset();void stop().catch(()=>{});return;}
   if(!disposed)timer=setTimeout(()=>void poll(),400);
  };void poll();return()=>{disposed=true;clearTimeout(timer);};
 },[running,key]);
 const start=async()=>{setBusy(true);setError('');reset();const generation=epoch.current;try{const result=await api('/api/eq-rta/start',{target:target(strip),post});
   if(generation!==epoch.current){void api('/api/eq-rta/stop',{token:result.token}).catch(()=>{});return;}
   token.current=result.token;connection.current=result.connectionId;setRunning(true);
  }catch(e){if(generation===epoch.current)setError((e as Error).message);}finally{if(generation===epoch.current)setBusy(false);}};
 const supported=model.family==='xair'&&['ch','bus','lr','aux','fxrtn'].includes(strip.kind);
 const fresh=scope.current===key&&live&&now-live.at<1500?live:null;
 const frame=scope.current===key?(held??fresh):null,ref=scope.current===key?reference:null;
 const bus=strip.kind==='bus'?Number(strip.prefix.split('/')[2]):0;
 const busLink=bus>0?values[busLinkAddress(bus)]:undefined;
 const ringPass=physical&&canWrite&&token.current&&fresh&&!held&&bus>=1&&bus<=model.monitorOutputs&&(busLink===0||busLink===1)&&[1,2].includes(Number(values[strip.prefix+'/eq/mode']))&&values[strip.prefix+'/eq/on']===1;
 const controls=supported?<section className="eq-spectrum-tools" aria-label={tx('Spectre dans l’égaliseur')}>
  <div className="measurement-heading"><div><strong>{tx('Spectre RTA')}</strong><span>{stripName(strip,values)}</span></div><span className={'measurement-state '+(held?'frozen':fresh?'live':'')}>{tx(held?'Spectre figé':fresh?'Mesure en direct':running?'En attente de mesure':'Spectre arrêté')}</span></div>
  <div className="measurement-actions"><label>{tx('Point de mesure')}<select aria-label={tx('Point de mesure')} value={post?'post':'pre'} disabled={running||busy} onChange={e=>{setPost(e.target.value==='post');reset();}}><option value="pre">{tx('Avant EQ')}</option><option value="post">{tx('Après EQ')}</option></select></label>
   <button type="button" disabled={busy} onClick={()=>{if(running){setBusy(true);void stop().catch(e=>setError(e.message)).finally(()=>setBusy(false));}else void start();}}>{tx(busy?'Patiente…':running?'Arrêter le RTA':'Afficher le RTA')}</button>
   <button type="button" disabled={!held&&!fresh} aria-pressed={!!held} onClick={()=>setHeld(held?null:structuredClone(fresh))}>{tx(held?'Reprendre le direct':'Figer le spectre')}</button>
   <button type="button" disabled={!frame} onClick={()=>setReference(structuredClone(frame))}>{tx('Garder comme référence')}</button>
   {ref&&<button type="button" onClick={()=>setReference(null)}>{tx('Effacer la référence')}</button>}
  </div>
  <p className="measurement-help">{tx('Un seul analyseur est partagé par la console. Son ancienne source est rétablie à l’arrêt, sauf si une autre application l’a changée. Aucun réglage audio n’est envoyé.')}</p>
  <p className="measurement-help">{tx('Le spectre mesure le signal électrique, pas la salle ni le niveau à l’oreille.')}</p>
  <div className="measurement-legend"><span className="spectrum-live">{tx('Spectre : −90 à 0 dBFS')}</span>{showEqLegend&&<span>{tx('Courbe EQ : −18 à +18 dB')}</span>}{ref&&<span className="spectrum-reference">{tx('Référence personnelle capturée')}</span>}{held&&<time dateTime={new Date(held.at).toISOString()}>{tx('Capture figée à')} {new Date(held.at).toLocaleTimeString()}</time>}</div>
  <ResonanceGuide scope={`${key}:${post}:${connection.current}`} frame={held?null:fresh} correction={canWrite?hz=><RoomEqPanel key={key} model={model.id} outputs={model.monitorOutputs} canWrite={canWrite} mode='real' peak={hz}/>:undefined}/>
  {ringPass&&<MonitorRingPass key={key+':'+busLink} token={token.current!} bus={bus} linked={busLink===1} detected={ringReady}/>}
  {error&&<p className="measurement-error" role="alert">{tx(error)}</p>}
 </section>:null;
 const overlay=(width:number,height:number)=><g className="eq-spectrum-overlay" pointerEvents="none" aria-label={tx('Spectre mesuré, échelle indépendante en dBFS')}>
  {frame&&<><polygon points={`0,${height} ${spectrumPoints(frame.bands,width,height)} ${width},${height}`} className="spectrum-area"/><polyline points={spectrumPoints(frame.bands,width,height)} className={held?'spectrum-held':'spectrum-line'}/></>}
  {ref&&<polyline points={spectrumPoints(ref.bands,width,height)} className="spectrum-reference-line"/>}
  {(frame||ref)&&[0,-30,-60,-90].map(db=><text key={db} x={width-5} y={Math.max(12,Math.min(height-5,-db/90*height))} textAnchor="end" className="spectrum-axis">{db} dBFS</text>)}
 </g>;
 return {controls,overlay};
}
