import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,ChevronLeft,ChevronRight,Circle,Flag,Pause,Play,Square} from 'lucide-react';
import {rehearsalInputs} from '../../../shared/rehearsal-inputs';
import type {ConfiguredInput,RehearsalCommand,RehearsalMarker,RehearsalProject,RehearsalSource,RehearsalTab} from '../../../shared/rehearsal-desk';
import {tx,getLocale} from '../i18n';
import {deskApi,deskCommand,deskState,type DeskStatus} from './rehearsal-api';
import {call,clock,sectionName} from './api';
import {Player} from './Player';
import './rehearsal-desk.css';

const markerLabel=(m:RehearsalMarker)=>clock(m.pos)+' · '+(m.name||tx('Repère'))+(m.ending?' · '+tx('Fin'):'');
const sources:Record<RehearsalSource,string>={original:'Original',backing:'Pistes d’accompagnement',take:'Prises'};
const songName=(tab:RehearsalTab)=>tab.title||tx('Sans titre');
function songSections(marks:RehearsalMarker[]){
 const ends=new Map(marks.filter(m=>m.ending).map(m=>[m.id,m]));
 const sections=marks.flatMap(left=>{
  if(!left.id.startsWith('r'))return [];
  const right=ends.get('e'+left.id.slice(1));
  const name=sectionName(left.name).trim()||tx('Section');
  return right&&right.pos>left.pos?[{left,right,name}]:[];
 }).sort((a,b)=>a.left.pos-b.left.pos||a.right.pos-b.right.pos);
 const totals=new Map<string,number>(),seen=new Map<string,number>();
 for(const s of sections)totals.set(s.name,(totals.get(s.name)??0)+1);
 return sections.map(s=>{
  const number=(seen.get(s.name)??0)+1;
  seen.set(s.name,number);
  return {...s,label:totals.get(s.name)!>1?s.name+' '+number:s.name};
 });
}


type GuideTrack=NonNullable<RehearsalProject['guides']>[number];
function GuideFader({track,disabled,apply}:{track:GuideTrack;disabled:boolean;apply:(volume:number)=>void}){
 const dragging=useRef(false);
 const [draft,setDraft]=useState<number|null>(null);
 const db=track.volume>0?20*Math.log10(track.volume):-Infinity;
 const held=draft??db;
 const gainText=held<=-61?'−∞ dB':(held>0?'+':'')+held.toFixed(1)+' dB';
 const commit=(value:number)=>apply(value<=-61?0:10**(value/20));
 return <label className="bp-guide-fader"><span>{track.name}</span>
  <output>{track.mute?tx('Coupé')+' · ':''}{gainText}</output>
  <input type="range" min="-61" max="12" step="0.5" value={Math.max(-61,Math.min(12,held))} disabled={disabled}
   aria-label={track.name} aria-valuetext={gainText}
   onPointerDown={e=>{dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);}}
   onChange={e=>{const value=e.currentTarget.valueAsNumber;if(dragging.current)setDraft(value);else commit(value);}}
   onPointerUp={e=>{if(dragging.current&&draft!==null&&!disabled)commit(e.currentTarget.valueAsNumber);dragging.current=false;setDraft(null);}}
   onPointerCancel={()=>{dragging.current=false;setDraft(null);}}/>
 </label>;
}

export function RehearsalDesk({token,visible=true,requestedSong=""}:{token?:string;visible?:boolean;requestedSong?:string}){
 const phone=token!==undefined;
 const [requestDismissed,setRequestDismissed]=useState(false);
 const [query,setQuery]=useState(''),[state,setState]=useState<DeskStatus|null>(null),[error,setError]=useState(''),[network,setNetwork]=useState('');
 const [working,setWorking]=useState(false),[message,setMessage]=useState('');
 const [configured,setConfigured]=useState<ConfiguredInput[]>([]),[inputError,setInputError]=useState('');
 useEffect(()=>{
  if(!visible)return;
  const abort=new AbortController();
  let fetching=false;
  const refresh=async()=>{
   if(document.hidden||fetching)return;
   fetching=true;
   try{
    const inputs=await deskApi<ConfiguredInput[]>('configured-inputs',undefined,token,abort.signal);
    if(!abort.signal.aborted){setConfigured(inputs);setInputError('');}
   }catch{
    if(!abort.signal.aborted){setConfigured([]);setInputError('Impossible de lire les pistes configurées dans BandPilot.');}
   }finally{fetching=false;}
  };
  setConfigured([]);setInputError('');
  void refresh();
  const timer=setInterval(refresh,60000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{abort.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[token,visible]);
 const latest=useRef<DeskStatus|null>(null);
 const inFlight=useRef(false),epoch=useRef(0);
 useEffect(()=>{
  if(!visible)return;
  let timer:ReturnType<typeof setTimeout>|undefined,polling=false;
  const abort=new AbortController();
  const poll=async()=>{
   if(abort.signal.aborted||polling||document.hidden)return;
   polling=true;
   const generation=epoch.current;
   try{
    if(!inFlight.current){
     const prior=latest.current;
     const next=await deskState(prior?.revision,token,abort.signal);
     if(next.position!==undefined&&prior?.project&&next.revision===prior.revision){
      next.project={...prior.project,pos:next.position};
     }
     if(!abort.signal.aborted&&generation===epoch.current){latest.current=next;setState(next);setNetwork('');}
    }
   }catch(cause){
    if(abort.signal.aborted||generation!==epoch.current)return;
    const err=cause as Error&{status?:number};
    setNetwork(err.message);
    if(err.status===401||err.status===403){latest.current=null;setState(null);return;}
   }finally{
    polling=false;
    if(!abort.signal.aborted)timer=setTimeout(poll,latest.current?.bridge==='ready'?(latest.current.transport==='idle'?450:180):1000);
   }
  };
  const wake=()=>{clearTimeout(timer);void poll();};
  void poll();
  document.addEventListener('visibilitychange',wake);
  return()=>{abort.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',wake);};
 },[token,visible]);
 const run=async(task:()=>Promise<void>)=>{
  if(inFlight.current)return;
  inFlight.current=true;epoch.current++;setWorking(true);setError('');setMessage('');
  try{await task();}
  catch(cause){setError((cause as Error).message);}
  finally{inFlight.current=false;setWorking(false);}
 };
 const command=(input:RehearsalCommand)=>void run(async()=>{
  const next=await deskCommand(input,token);latest.current=next;setState(next);setNetwork('');
 });
 const select=(project:string)=>{if(project!==state?.project?.id)command({project,action:'select'});};
 const active=state?.project,tab=state?.tabs.find(t=>t.id===active?.id);
 const transport=state?.transport??'idle',canPick=transport==='idle'&&!working&&!network;
 const disabled=working||!!network;
 const index=state?.tabs.findIndex(t=>t.id===active?.id)??-1;
 const step=(offset:number)=>{const next=state?.tabs[index+offset];if(next)select(next.id);};
 const navigation=<div className="bp-song-nav">
  <button type="button" aria-label={tx('Morceau précédent')} disabled={!canPick||index<1} onClick={()=>step(-1)}><ChevronLeft/></button>
  <span>{index+1} / {state?.tabs.length??0}</span>
  <button type="button" aria-label={tx('Morceau suivant')} disabled={!canPick||!state||index>=state.tabs.length-1} onClick={()=>step(1)}><ChevronRight/></button>
 </div>;
 const normalizeTitle=(title:string)=>title.normalize('NFC').trim().toLowerCase();
 const matchingTabs=requestedSong ? state?.tabs.filter(t=>normalizeTitle(t.title)===normalizeTitle(requestedSong))??[] : [];
 const notices=<>
  {requestedSong&&!requestDismissed&&<div className="regie-song-request" role="status">
   <div><small>{tx("Depuis le répertoire")}</small><strong>{requestedSong}</strong></div>
   {state?.bridge==='ready'&&(matchingTabs.length===1
     ? matchingTabs[0].id===active?.id ? <span>{tx("Projet actif")}</span> : <button type="button" className="xs2-btn primary" disabled={!canPick} onClick={()=>select(matchingTabs[0].id)}>{tx("Sélectionner dans REAPER")}</button>
     : <span>{tx(matchingTabs.length?"Plusieurs projets portent ce titre. Choisis le bon dans la liste.":"Ouvre ce projet dans REAPER ou choisis un morceau dans la liste.")}</span>)}
   <button type="button" aria-label={tx("Fermer")} onClick={()=>setRequestDismissed(true)}>×</button>
  </div>}
  {network&&<p className={phone?'ea-banner':'xs2-msg error'} role="alert">{tx(network)}</p>}
  {error&&<p className={phone?'ea-banner':'xs2-msg error'} role="alert">{tx(error)}</p>}
  {message&&<p role="status">{tx(message)}</p>}
  {!state&&!network&&<p role="status">{tx('Connexion à REAPER…')}</p>}
 </>;
 const bridge=state&&state.bridge!=='ready'?<div className={phone?'ea-profiles':'xs2-card sh-install'}>
  <h3>{tx(state.bridge==='update'?'Mettre à jour le pont Reaper':'Le pont BandPilot ne répond pas dans REAPER.')}</h3>
  <p>{tx(phone?'Vérifie la connexion à REAPER sur l’ordinateur du groupe.':'Le pont permet de voir tes morceaux et de piloter la lecture. Redémarre REAPER après son installation.')}</p>
  {!phone&&<button type="button" className="xs2-btn primary" disabled={working} onClick={()=>void run(async()=>{
   await call('/api/show/install',{confirm:true});setMessage('Pont installé. Redémarre REAPER pour activer les onglets.');
  })}>{tx('Installer le pont REAPER')}</button>}
 </div>:null;
 const search = query.trim().toLocaleLowerCase(getLocale());
 const matchingSongs = (state?.tabs ?? []).filter(t => songName(t).toLocaleLowerCase(getLocale()).includes(search));
 const empty = state?.bridge === 'ready' && !state.tabs.length ? 'Ouvre un projet par morceau dans REAPER.'
   : search && !matchingSongs.length ? 'Aucun morceau trouvé.' : '';
 const list=<aside className="xs2-card sh-songs" aria-label={tx('Morceaux')}>
  <h3>{tx('Morceaux')}</h3>
  {state&&state.tabs.length>1&&navigation}
  {state&&(state.tabs.length>4||query)&&<input type="search" className="bp-song-search" aria-label={tx('Rechercher un morceau')} placeholder={tx('Rechercher un morceau')} value={query} onChange={e=>setQuery(e.target.value)}/>}
  <div className="sh-song-list rehearsal-song-grid">{matchingSongs.map(t=><button type="button" key={t.id} className={`sh-song ${t.id===active?.id?'on':''}`} aria-pressed={t.id===active?.id} disabled={!canPick} onClick={()=>select(t.id)}>
   <span className="song-position">{t.number}</span><b>{songName(t)}</b>{t.duration!==undefined&&t.duration>0&&<small>{clock(t.duration)}</small>}
  </button>)}</div>
  {empty&&<p className="muted">{tx(empty)}</p>}
 </aside>;
 if(phone)return <section className="ea-rehearse" aria-label={tx('Répéter')}>
  {notices}{bridge}
  {state?.bridge==='ready'&&<>
   <div className="bp-phone-song">
    <button type="button" aria-label={tx('Morceau précédent')} disabled={!canPick||index<1} onClick={()=>step(-1)}><ChevronLeft/></button>
    <label className="bp-song-choice">
     <span aria-hidden="true">{tab?songName(tab):tx('Choisir un morceau')}</span><ChevronDown aria-hidden="true" size={16}/>
    <select aria-label={tx('Morceau')} value={active?.id??''} disabled={!canPick} onChange={e=>select(e.target.value)}>
    {!active&&<option value="">{tx('Choisir un morceau')}</option>}
    {state.tabs.map(t=><option key={t.id} value={t.id}>{t.number} · {songName(t)}</option>)}
    </select></label>
   <button type="button" aria-label={tx('Morceau suivant')} disabled={!canPick||index>=state.tabs.length-1} onClick={()=>step(1)}><ChevronRight/></button>
   </div>
   {empty&&<p>{tx(empty)}</p>}
  </>}
  {state?.bridge==='ready'&&active&&tab&&<SongControls key={active.id} project={active} title={songName(tab)} saved={tab.saved} state={state} configured={configured} inputError={inputError}
   phone disabled={disabled} command={command}/>}
 </section>;
 return <>
  {notices}{bridge}
  {state?.bridge==='ready'&&(active&&tab?<SongControls key={active.id} project={active} title={songName(tab)} saved={tab.saved} state={state} configured={configured} inputError={inputError}
   phone={false} disabled={disabled} command={command} songList={list}/>:<div className="sh-grid">{list}</div>)}
 </>;
}

function SongControls({project:p,title:song,saved,state,configured,inputError,phone,disabled,command,songList}:{
 project:RehearsalProject;title:string;saved:boolean;state:DeskStatus;configured:ConfiguredInput[];inputError:string;phone:boolean;disabled:boolean;
 command:(d:RehearsalCommand)=>void;songList?:React.ReactNode;
}){
 // Let waveform reads share one HTTP connection, keeping transport commands clear of the browser's request queue.
 const peakQueue=useRef(Promise.resolve());
 const peakAbort=useRef(new AbortController());
 useEffect(()=>{peakAbort.current=new AbortController();return ()=>peakAbort.current.abort();},[p.id]);
 const loadPeaks=useCallback((track:{id?:string},item:number,take:number)=>{
  const signal=peakAbort.current.signal;
  const result=peakQueue.current.then(()=>{
   signal.throwIfAborted();
   return deskApi<{peaks:number[]|null}>('peaks?'+new URLSearchParams({project:p.id,track:track.id??'',item:String(item),take:String(take)}),undefined,undefined,signal);
  });
  peakQueue.current=result.then(()=>{},()=>{});
  return result;
 },[p.id]);
 const [preferredSource,setSource]=useState<'backing'|'take'>('backing'),[take,setTake]=useState('');
 const [span,setSpan]=useState<'whole'|'passage'>('whole'),[a,setA]=useState(''),[b,setB]=useState(''),[repeat,setRepeat]=useState(false);
 const [marker,setMarker]=useState(''),[inputIndex,setInputIndex]=useState(''),[inputName,setInputName]=useState('');
 const [seek,setSeek]=useState<number|null>(null);
 const duration=p.ending??state.tabs.find(t=>t.id===p.id)?.duration??0;
 const playerRange=useMemo(()=>({start:p.start,stop:duration}),[p.start,duration]);
 const busy=state.transport!=='idle',recording=state.transport==='recording',paused=state.transport==='paused',starting=state.transport==='starting';
 const operated=state.owned&&state.active===p.id,locked=busy||disabled;
 const send=(data:Omit<RehearsalCommand,'project'>)=>command({...data,project:p.id});
 const first=p.marks.find(m=>m.id===a),last=p.marks.find(m=>m.id===b);
 const from=span==='whole'?p.start:first?.pos,to=span==='whole'?p.ending:last?.pos;
 const selected=p.takes.find(t=>t.id===take)??p.takes[0];
 const valid=from!==undefined&&to!==undefined&&to>from+.049;
 const takePassage=!!selected&&(span==='whole'||valid&&Math.min(to,selected.last)>Math.max(from,selected.first)+.049);
 const source=p.takes.length?preferredSource:'backing';
 const canPlay=source==='take'?takePassage:valid;
 const range=span==='passage'?{a,b}:{};
 const sections=useMemo(()=>songSections(p.marks),[p.marks]);
 const [leadIn,setLeadIn]=useState(false);
 const [bars,setBars]=useState(()=>{
  try{const saved=localStorage.getItem('bp-loop-count-bars');return saved&&/^[0-8]$/.test(saved)?saved:'';}catch{return '';}
 });
 const countOption=bars===''?{}:{countBars:Number(bars)};
 const counting=busy&&p.countInTo!==undefined&&p.pos<p.countInTo;
 const operation=recording?'Enregistrement':paused?'En pause':starting?'Démarrage…':busy?'Lecture':'Prêt';
 const notes=state.notice?.project===p.id&&state.notice;
 const running=!disabled&&(state.transport==='playing'||recording);
 const [advance,setAdvance]=useState(0);
 useEffect(()=>{
  setAdvance(0);
  if(!running)return;
  const anchor=performance.now();
  const timer=setInterval(()=>setAdvance(Math.min(0.65,(performance.now()-anchor)/1000)*(state.rate??1)),60);
  return ()=>clearInterval(timer);
 },[p,running,state.rate]);
 const pos=running?Math.max(p.pos,Math.min(p.stopAt??Infinity,p.pos+advance)):p.pos;
 // Use the reported audio position at loop boundaries, where extrapolation can briefly enter the next region.
 const current=sections.filter(s=>s.left.pos<=p.pos&&p.pos<s.right.pos).at(-1);
 const nextSection=sections.find(s=>s.left.pos>p.pos);
 const looping=p.loopStart!==undefined,leaving=p.leavingAt!==undefined&&p.pos<p.leavingAt;
 const transportLabel=counting?'Décompte':looping&&p.pos>=p.loopStart!?'En boucle':leaving?'Sortie en fin de section':operation;
 const statuses=<>
  {busy&&!operated&&<small>{tx('Ce transport est piloté depuis REAPER.')}</small>}
  {recording&&p.stopAt!==undefined&&<small role="status">{tx('REC jusqu’à')} {clock(p.stopAt)}</small>}
  {notes&&<small role="status">{notes.kind==='take'?`${tx('Prise')} ${notes.number} · ${tx(notes.partial?'prise partielle':'terminée')}`:tx(notes.kind==='marker'?'Repère ajouté.':notes.kind==='saved'?'Projet sauvegardé.':notes.kind==='startError'?'REAPER n’a pas démarré. Vérifie le périphérique audio.':'REAPER n’a renvoyé aucun audio enregistré.')}</small>}
 </>;
 const transport=<div className={`sh-transport bp-transport ${recording?'rec':''}`}>
  <div className="sh-transport-info"><small>{tx(operation)} · {tx(sources[busy&&p.source?p.source:source])}</small><b className="bp-current-section" aria-live="polite">{phone?(counting?tx('Décompte'):current?.label||tx(operation)):song}</b>
   {phone&&(looping||leaving)&&<small className="bp-loop-state">{tx(transportLabel)}</small>}
   {!phone&&current&&<small>{current.label} · {tx(transportLabel)}</small>}{!phone&&nextSection&&<small className="rehearsal-next">{tx("Ensuite")} · {nextSection.label} · {clock(nextSection.left.pos)}</small>}{statuses}</div>
  <strong className="sh-clock">{clock(pos)}</strong>
  <progress className="bp-song-progress" max={Math.max(.001,duration-p.start)} value={Math.max(0,pos-p.start)} aria-label={tx('Position dans le morceau')}/>
  <div className="sh-transport-actions" role="group" aria-label={tx('Transport de répétition')}>
   <button className="sh-big bp-play" type="button" disabled={disabled||recording||starting||busy&&!operated||!busy&&!canPlay} onClick={()=>{
    if(busy)send({action:'pause'});else send({action:'play',source,...(source==='take'&&selected?{take:selected.id}:{}),...range,...(span==='passage'&&repeat?countOption:{}),...(span==='passage'&&repeat&&leadIn?{leadIn:true}:{}),loop:span==='passage'&&repeat});
   }}>{busy&&!paused?<Pause size={16}/>:<Play size={16}/>} {tx(busy&&!paused&&!recording?'Pause':'Lecture')}</button>
   <button className="sh-big" type="button" disabled={disabled||!busy||!operated} onClick={()=>send({action:'stop'})}><Square size={15}/> {tx('Stop')}</button>
   <button className="sh-big rec" type="button" disabled={locked||!valid||!!p.recordProblem} onClick={()=>send({action:'record',...range})}><Circle size={16}/> {tx('REC')}</button>
   <button className="sh-big" type="button" disabled={disabled} onClick={()=>send({action:'marker',name:marker.trim()||'À revoir'})}><Flag size={15}/> {tx('À revoir')}</button>
  </div>
  {operated&&looping&&<button type="button" className="sh-big bp-leave-loop" disabled={disabled||starting} onClick={()=>{setRepeat(false);send({action:'leaveLoop'});}}>{tx('Sortir de la boucle')}</button>}
 </div>;
 const guides=!!p.guides?.length&&<details className={phone?'ea-profiles bp-guides':'xs2-card bp-guides'}>
  <summary>{tx('Volume des guides')}</summary>
  {p.guides.map(track=><GuideFader key={track.id} track={track} disabled={disabled}
   apply={volume=>send({action:'guideVolume',track:track.id,volume})}/>)}
 </details>;
 const listening=<section className={phone?'ea-profiles bp-listening':'bp-listening'}>
  {p.takes.length>0&&<div className="sh-seg bp-listen-sources" role="group" aria-label={tx('Source d’écoute')}>
   {(['backing','take'] as const).map(s=><button type="button" key={s} className={source===s?'on':''} aria-pressed={source===s} disabled={locked} onClick={()=>setSource(s)}>{tx(sources[s])}</button>)}
  </div>}
  {sections.length>0&&<section className="bp-section-picker"><h3>{tx('Boucler une section')}</h3>
   <div className="bp-section-strip">{sections.map(({left,right,label})=>{
    if(!right)return null;
    const listeningSource=busy?p.source:source;
    const sectionTake=busy?p.takes.find(t=>t.id===p.playTake):selected;
    const playable=listeningSource==='original'?!!p.original:listeningSource==='take'?!!sectionTake&&Math.min(sectionTake.last,right.pos)>Math.max(sectionTake.first,left.pos)+.049:true;
    return <button key={left.id} type="button" disabled={disabled||!playable||busy&&(recording||starting||!operated)}
     aria-pressed={p.loopStart!==undefined&&Math.abs(p.loopStart-Math.max(left.pos,sectionTake&&listeningSource==='take'?sectionTake.first:0))<.001&&Math.abs((p.stopAt??0)-Math.min(right.pos,sectionTake&&listeningSource==='take'?sectionTake.last:Infinity))<.001}
     onClick={()=>{
      setSpan('passage');setA(left.id);setB(right.id);setRepeat(true);
      if(busy)send({action:'section',a:left.id,b:right.id,leadIn});
      else send({action:'play',source,...(source==='take'&&selected?{take:selected.id}:{}),a:left.id,b:right.id,loop:true,leadIn,...countOption});
     }}><b>{label}</b><small>{clock(left.pos)}</small></button>;
   })}</div>
   <label className="bp-count-bars">{tx('Décompte au départ')}<select value={bars} onChange={e=>{
    setBars(e.target.value);try{localStorage.setItem('bp-loop-count-bars',e.target.value);}catch{/* current screen only */}
   }}><option value="">{tx('Réglage REAPER')}</option><option value="0">{tx('Sans décompte')}</option>
    {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} {tx(n===1?'mesure':'mesures')}</option>)}
   </select></label>
   <label className="bp-lead-in"><input type="checkbox" checked={leadIn} onChange={e=>setLeadIn(e.target.checked)}/>{tx('Reprendre une mesure avant')}</label>
  </section>}
  {source==='take'&&phone&&<label>{tx('Prise')}<select value={selected?.id??''} disabled={locked||!p.takes.length} onChange={e=>setTake(e.target.value)}>
   {!p.takes.length&&<option value="">{tx('Pas encore de prise.')}</option>}
   {p.takes.map(t=><option key={t.id} value={t.id}>{tx('Prise')} {t.number} · {clock(t.first)}–{clock(t.last)}{t.partial?' · '+tx('prise partielle'):''}</option>)}
  </select></label>}
  <div className="sh-seg bp-range-type" role="group" aria-label={tx('Plage de lecture')}>
   <button type="button" className={span==='whole'?'on':''} aria-pressed={span==='whole'} disabled={locked} onClick={()=>{setSpan('whole');setRepeat(false);}}>{tx('Morceau entier')}</button>
   <button type="button" className={span==='passage'?'on':''} aria-pressed={span==='passage'} disabled={locked} onClick={()=>setSpan('passage')}>{tx('Entre deux repères')}</button>
  </div>
  {span==='passage'&&<div className="bp-range">
   <label>{tx('Début')}<select value={a} disabled={locked} onChange={e=>setA(e.target.value)}>
    <option value="">{tx('Choisir')}</option>{p.marks.map(m=><option key={m.id} value={m.id}>{markerLabel(m)}</option>)}
   </select></label>
   <label>{tx('Fin')}<select value={b} disabled={locked} onChange={e=>setB(e.target.value)}>
    <option value="">{tx('Choisir')}</option>{p.marks.map(m=><option key={m.id} value={m.id} disabled={!!first&&m.pos<=first.pos}>{markerLabel(m)}</option>)}
   </select></label>
   <label className="bp-check"><input type="checkbox" checked={repeat} disabled={locked} onChange={e=>setRepeat(e.target.checked)}/>{tx('Boucle')}</label>
  </div>}
  {!valid&&source!=='take'&&<p className="muted">{tx(span==='whole'?'Choisis la fin dans Préparer ce morceau.':'Choisis un début et une fin pour le passage.')}</p>}
 </section>;
 const inputs=<>
  {inputError&&<p role="status">{tx(inputError)}</p>}
  {rehearsalInputs(configured,p).map(({input,track,name,channels,available})=><label className="sh-check" key={input?'usb'+input.usb:track!.id}>
   <input type="checkbox" checked={track?.armed??false} disabled={locked||!available&&!track?.armed} onChange={e=>{
    if(track)send({action:'arm',track:track.id,on:e.target.checked});
    else if(input&&e.target.checked)send({action:'configuredInput',index:input.usb,name:input.name,stereo:input.stereo});
   }}/>
   <span>{name||tx('Piste')}<small>{channels.length>0&&`${tx('Entrée')} ${channels.join('–')} · `}{tx(available?track?.armed?'Prêt à enregistrer':'Absent':'Entrée indisponible')}</small></span>
  </label>)}
  {p.recordProblem&&(!configured.length||p.recordProblem!=='Aucune piste d’entrée armée dans ce morceau.')&&<p className="muted">{tx(p.recordProblem)}</p>}
  <details className="bp-input-setup"><summary>{tx('Ajouter une piste d’entrée')}</summary>
   <div className="bp-range">
    <label>{tx('Entrée')}<select value={inputIndex} onChange={e=>setInputIndex(e.target.value)} disabled={locked}>
     <option value="">{tx('Choisir')}</option>
     {Array.from({length:p.inputs??0},(_,i)=><option key={i} value={i+1}>{tx('Entrée')} {i+1}</option>)}
    </select></label>
    <label>{tx('Nom de la piste')}<input value={inputName} maxLength={64} onChange={e=>setInputName(e.target.value)} disabled={locked}/></label>
    <button className="xs2-btn" type="button" disabled={locked||!inputIndex} onClick={()=>send({action:'input',index:Number(inputIndex),name:inputName})}>{tx('Ajouter')}</button>
   </div>
  </details>
 </>;
 const prep=<details className={phone?'ea-profiles':'xs2-card bp-settings'}><summary>{tx('Préparer ce morceau')}</summary>
  <div className="bp-prepare">
   <label>{tx('Piste Original')}<select value={p.original??''} disabled={locked} onChange={e=>send({action:'setup',original:e.target.value})}>
    <option value="">{tx('Détection automatique')}</option>
    {p.choices.map((t,i)=><option key={t.id} value={t.id}>{t.name||`${tx('Piste')} ${i+1}`}</option>)}
   </select></label>
   <label>{tx('Fin du morceau')}<select value={p.endMarker} disabled={locked} onChange={e=>send({action:'setup',endMarker:e.target.value})}>
    <option value="">{tx('Repère Fin ou fin de l’original')}</option>
    {p.marks.filter(m=>m.pos>p.start).map(m=><option key={m.id} value={m.id}>{markerLabel(m)}</option>)}
   </select></label>
   <label className="bp-check"><input type="checkbox" checked={p.autoSave} disabled={locked||!saved} onChange={e=>send({action:'setup',autoSave:e.target.checked})}/>{tx('Sauvegarder après chaque prise')}</label>
   {phone&&duration>0&&<div className="bp-range">
    <label>{tx('Position dans le morceau')} · {clock(seek??p.pos)}<input type="range" min={0} max={duration} step=".1" value={Math.min(duration,seek??p.pos)} disabled={locked} onChange={e=>setSeek(Number(e.target.value))}/></label>
    <button className="xs2-btn" type="button" disabled={locked||seek===null} onClick={()=>{if(seek!==null){send({action:'seek',position:seek});setSeek(null);}}}>{tx('Aller à la position')}</button>
   </div>}
   <label>{tx('Nom du prochain repère')}<input value={marker} maxLength={64} onChange={e=>setMarker(e.target.value)} placeholder={tx('À revoir')}/></label>
   <button className="xs2-btn" type="button" disabled={locked||!saved||!p.dirty} onClick={()=>send({action:'save'})}>{tx('Sauvegarder le projet')}</button>
  </div>
 </details>;
 if(phone)return <>{transport}{guides}{listening}
  {source==='backing'&&!!p.backing?.length&&<details className="ea-profiles bp-backing"><summary>{tx('Pistes d’accompagnement')}</summary>
   {p.backing.map(track=><label className="sh-check" key={track.id}><input type="checkbox" checked={!track.mute} disabled={locked} onChange={e=>send({action:'track',track:track.id,kind:'mute',on:!e.target.checked})}/><span>{track.name||tx('Piste')}</span></label>)}
  </details>}<details className="ea-profiles bp-inputs"><summary>{tx('Qui est là aujourd’hui ?')}{p.armed>0&&` · ${p.armed}`}</summary>{inputs}</details>{prep}</>;
 const picture=p.picture;
 const pictureEnd=duration;
 return <>
  {transport}
  <div className="sh-grid bp-tab-grid">
   {songList}
   <main className="xs2-card sh-main bp-track-card">
    {listening}
    {picture&&pictureEnd>p.start&&<Player show={{project:p.id,regions:picture.regions,tracks:picture.tracks}}
     cursor={pos} range={playerRange} disabled={locked}
     loadPeaks={loadPeaks}
     onSeek={position=>send({action:'seek',position})}
     onSection={(start,stop)=>{
      const left=p.marks.find(m=>m.pos===start),right=p.marks.find(m=>m.pos===stop);
      if(left&&right){setSpan('passage');setA(left.id);setB(right.id);}
      send({action:'seek',position:start});
     }}
     onTrack={(track,solo)=>{if(track.id)send({action:'track',track:track.id,kind:solo?'solo':'mute',on:solo?!track.solo:!track.mute});}}/>}
   </main>
   <aside className="sh-side">
    {guides}
    <section className="xs2-card bp-inputs"><h3>{tx('Qui est là aujourd’hui ?')}</h3>{inputs}</section>
    {p.takes.length>0&&<section className="xs2-card"><h3>{tx('Prises')}</h3>{p.takes.map(t=><button className={`sh-song ${source==='take'&&selected?.id===t.id?'on':''}`} type="button" key={t.id} disabled={locked} onClick={()=>{setSource('take');setTake(t.id);}}>
     <b>{tx('Prise')} {t.number}</b><small>{clock(t.last-t.first)}</small>
    </button>)}</section>}
    {prep}
   </aside>
  </div>
 </>;
}
