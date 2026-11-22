import {useEffect,useMemo,useRef,useState} from 'react';
import {sheetPosition,type SheetCue,type SheetFrame} from '../../../shared/bandstudio-sheet';
import {Maximize2,Minimize2,RotateCcw,ArrowRight,Sun} from 'lucide-react';
import {tx} from '../i18n';

const modes={chords:'Accords',lyrics:'Paroles',both:'Les deux'} as const;
type Mode=keyof typeof modes;
function upcoming(cues:SheetCue[],position:number,count:number,frame:SheetFrame|null){
 let current=-1;
 for(let i=0;i<cues.length&&cues[i]!.start<=position;i++)if(position<cues[i]!.end)current=i;
 const index=current>=0?current:cues.findIndex(cue=>cue.start>position);
 let rows=index<0?[]:cues.slice(index,index+count);
 if(frame?.loop&&frame.loopStart!==undefined&&frame.loopEnd!==undefined){
  const left=frame.loopStart,right=frame.loopEnd;
  rows=rows.filter(c=>c.start<right);
  if(rows.length<count)rows.push(...cues.filter(c=>c.end>left&&c.start<right).slice(0,count-rows.length));
 }
 return {current:current>=0,rows};
}
export function SongSheet({token,manager,visible,awake,keepAwake}:{token:string;manager:boolean;visible:boolean;awake:boolean;keepAwake:()=>Promise<void>}){
 const key='bp-sheet-mode-'+token;
 const [mode,setMode]=useState<Mode>(()=>{try{const m=localStorage.getItem(key);return m&&Object.hasOwn(modes,m)?m as Mode:'both';}catch{return 'both';}});
 const [frame,setFrame]=useState<(SheetFrame&{anchor:number})|null>(null),[error,setError]=useState(false),[preview,setPreview]=useState('');
 const [confirming,setConfirming]=useState(false);
 const panel=useRef<HTMLElement>(null);
 const [expanded,setExpanded]=useState(false);
 const full=visible&&expanded;
 useEffect(()=>{
  if(!full)return;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false);};
  const changed=()=>{if(!document.fullscreenElement)setExpanded(false);};
  window.addEventListener('keydown',escape);document.addEventListener('fullscreenchange',changed);
  return ()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',escape);document.removeEventListener('fullscreenchange',changed);};
 },[full]);
 function toggleFull(){
  if(full){if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});setExpanded(false);return;}
  void keepAwake();setExpanded(true);
  if(panel.current?.requestFullscreen)void panel.current.requestFullscreen().catch(()=>{/* use the full viewport */});
 }
 const endpoint='/ears-api/'+encodeURIComponent(token)+'/sheet';
 useEffect(()=>{
  const abort=new AbortController();
  let previous:SheetFrame|null=null,timer:ReturnType<typeof setTimeout>,reading=false;
  const poll=async()=>{
   if(abort.signal.aborted||document.hidden||reading)return;
   reading=true;
   try{
    const query=new URLSearchParams();
    if(previous)query.set('known',previous.revision);
    if(manager&&preview)query.set('preview','1');
    const requested=performance.now();
    const response=await fetch(endpoint+'?'+query,{signal:abort.signal});
    if(!response.ok)throw Error();
    const next:SheetFrame|null=await response.json();
    if(abort.signal.aborted)return;
    if(preview&&next?.project!==preview){setPreview('');setFrame(null);return;}
    if(next&&!next.sheet&&previous?.revision===next.revision)next.sheet=previous.sheet;
    const arrived=performance.now();
    const flight=next?Math.max(0,arrived-requested-(next.serverMs??0))/2:0;
    const age=next?Math.max(0,(next.sentAt??next.sampledAt)-next.sampledAt)+flight:0;
    previous=next;setFrame(next&&{...next,anchor:arrived-age});setError(false);
   }catch{if(!abort.signal.aborted){previous=null;setFrame(null);setError(true);}}
   finally{reading=false;if(!abort.signal.aborted)timer=setTimeout(poll,previous?.playing?110:260);}
  };
  const wake=()=>{clearTimeout(timer);void poll();};
  void poll();document.addEventListener('visibilitychange',wake);
  return()=>{abort.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',wake);};
 },[endpoint,manager,preview]);
 async function approve(reset=false){
  if(!frame||(!frame.preview&&!reset)||confirming)return;
  setConfirming(true);
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:frame.project,revision:frame.revision,reset})});
   if(!r.ok)throw Error();
   setPreview('');
  }catch{setError(true);}finally{setConfirming(false);}
 }
 const boundaries=useMemo(()=>[...(frame?.sheet?.chords??[]),...(frame?.sheet?.lyrics??[])]
  .flatMap(c=>[c.start,c.end]).sort((a,b)=>a-b),[frame?.sheet]);
 const [,tick]=useState(0);
 useEffect(()=>{
  if(!frame?.playing||frame.rate<=0)return;
  let timer:ReturnType<typeof setTimeout>;
  const schedule=()=>{
   const age=performance.now()-frame.anchor;
   if(age>=650)return;
   const pos=sheetPosition(frame,age);
   const boundary=Math.min(boundaries.find(t=>t>pos)??Infinity,frame.loop?frame.loopEnd??Infinity:Infinity,...(frame.cue?[frame.cue.twoAt,frame.cue.oneAt,frame.cue.at].filter(t=>t>pos):[]));
   const wait=(boundary-pos)*1000/frame.rate;
   if(wait>=0&&age+wait<=650)timer=setTimeout(()=>{tick(n=>n+1);schedule();},Math.max(1,wait));
  };
  schedule();return()=>clearTimeout(timer);
 },[frame,boundaries]);
 const position=frame?sheetPosition(frame,performance.now()-frame.anchor):0;
 const chords=upcoming(frame?.sheet?.chords??[],position,5,frame);
 const lyrics=upcoming(frame?.sheet?.lyrics??[],position,2,frame);
 const cue=frame?.playing?frame.cue:undefined;
 const showCue=cue&&position>=cue.twoAt&&position<cue.at;
 const notice=showCue?<aside className="ea-section-cue" role="status">
  {cue.repeatSection?<RotateCcw aria-hidden="true"/>:<ArrowRight aria-hidden="true"/>}
  <div><small>{tx(cue.repeatSection?'Reprise de boucle':'À suivre')}</small><strong>{cue.name||tx('Début de boucle')}</strong></div>
  <b>{tx(position<cue.oneAt?'2 mesures':'1 mesure')}</b>
 </aside>:null;
 if(!visible)return notice&&<div className="ea-cue-float">{notice}</div>;
 return <section ref={panel} className={'ea-song-sheet'+(full?' ea-sheet-full':'')} aria-label={tx('Mon morceau')}>
  <div className="ea-score-tools">
   <button type="button" aria-pressed={full} onClick={toggleFull}>{full?<Minimize2/>:<Maximize2/>}{tx(full?'Quitter le plein écran':'Plein écran')}</button>
   {awake?<small><Sun/>{tx('Écran actif')}</small>:<button type="button" onClick={()=>void keepAwake()}><Sun/>{tx('Garder l’écran allumé')}</button>}
  </div>
  <div className="sh-seg ea-sheet-modes" role="group" aria-label={tx('Affichage')}>
   {(Object.keys(modes) as Mode[]).map(k=><button type="button" key={k} aria-pressed={mode===k} className={mode===k?'on':''} onClick={()=>{setMode(k);try{localStorage.setItem(key,k);}catch{/* session only */}}}>{tx(modes[k])}</button>)}
  </div>
  {error&&<p role="status">{tx('Connexion à REAPER…')}</p>}
  {frame?<><header><h2>{frame.title}</h2></header>
   <div className="ea-score-location">{notice??<div className="ea-current-section"><small>{tx(frame.loop?'En boucle':'Section en cours')}</small><strong>{frame.section||'—'}</strong></div>}</div>
   {mode!=='lyrics'&&<section className="ea-profiles ea-score-chords"><header className="ea-chord-meta"><h3>{tx('Accords')}</h3>
    <span>{[frame.sheet?.key&&tx('Tonalité')+' '+frame.sheet.key,frame.sheet?.capo!==undefined&&(frame.sheet.capo===0?tx('Sans capo'):tx('Capo')+' '+frame.sheet.capo)].filter(Boolean).join(' · ')}</span></header>
    <div>{chords.rows.map((c,i)=><b key={i} data-start={c.start} aria-current={i===0&&chords.current?'true':undefined}>{c.text}</b>)}</div>
    {!frame.sheet?.chords.length&&<small>{tx('Aucun accord dans cette fiche.')}</small>}
   </section>}
   {mode!=='chords'&&<section className="ea-profiles ea-score-lyrics"><h3>{tx('Paroles')}</h3>
    {lyrics.rows.map((l,i)=><p key={i} data-start={l.start} aria-current={i===0&&lyrics.current?'true':undefined}>{l.text}</p>)}
    {!frame.sheet?.lyrics.length&&<small>{tx('Aucune parole dans cette fiche.')}</small>}
   </section>}
   {manager&&frame.sourceApproved&&<button type="button" disabled={confirming} onClick={()=>void approve(true)}>{tx('Revenir à la fiche exportée')}</button>}
   {manager&&frame.canPreview&&<div className="ea-profiles">{frame.preview?
    <><small>{tx('Vérifie le calage avant de partager cette fiche avec le groupe.')}</small><button disabled={confirming} onClick={()=>void approve()}>{tx('Valider le calage')}</button><button onClick={()=>setPreview('')}>{tx('Annuler')}</button></>:
    <button onClick={()=>setPreview(frame.project)}>{tx('Vérifier la fiche source BandStudio')}</button>}</div>}
  </>:!error&&<p>{tx('En attente du morceau dans REAPER.')}</p>}
 </section>;
}
