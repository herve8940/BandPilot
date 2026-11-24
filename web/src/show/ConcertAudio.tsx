import {useEffect,useRef,useState} from 'react';
import {Play,Square} from 'lucide-react';
import type {RehearsalStatus} from '../../../shared/rehearsal-desk';
import {tx} from '../i18n';
import {clock} from './api';
import {deskApi,deskCommand} from './rehearsal-api';
import type {ConcertSong} from './Concert';

export function ConcertAudio({song,onLock}:{song:ConcertSong;onLock:(locked:boolean)=>void}){
 const [state,setState]=useState<RehearsalStatus|null>(null),[override,setOverride]=useState(''),[source,setSource]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef(false),epoch=useRef(0);
 const tabs=state?.tabs??[];
 const sameFile=song.fileKey?tabs.filter(t=>t.fileKey===song.fileKey):[];
 const linked=tabs.find(t=>t.id===song.projectId)??(sameFile.length===1?sameFile[0]:undefined);
 const target=tabs.find(t=>t.id===override)??linked;
 const project=target&&state?.project?.id===target.id?state.project:null;
 const playing=!!project&&state?.owned&&state.active===project.id&&project.during==='play'&&state.transport!=='idle';
 useEffect(()=>{onLock(busy||!!playing);return ()=>onLock(false);},[busy,playing,onLock]);
 useEffect(()=>{
  const abort=new AbortController();let timer:ReturnType<typeof setTimeout>,previous:RehearsalStatus|undefined;
  async function poll(){
   const generation=epoch.current;
   try{
    if(!document.hidden&&!pending.current){
     const query=new URLSearchParams({files:'1'});if(target)query.set('project',target.id);
     if(previous?.revision)query.set('known',previous.revision);
     const update=await deskApi<RehearsalStatus>('state?'+query,undefined,undefined,abort.signal);
     if(!abort.signal.aborted&&!pending.current&&generation===epoch.current){
      if(update.position!==undefined&&previous?.project&&update.revision===previous.revision)update.project={...previous.project,pos:update.position};
      previous=update;setState(update);
     }
    }
   }catch{if(!abort.signal.aborted&&generation===epoch.current)setState(null);}
   finally{if(!abort.signal.aborted)timer=setTimeout(poll,playing?650:1800);}
  }
  void poll();return ()=>{abort.abort();clearTimeout(timer);};
 },[target?.id,playing]);
 const options=[
  ...(project?.backing?.length?[{value:'backing',label:tx('Pistes d’accompagnement')}]:[]),
  ...(project?.original?[{value:'original',label:tx('Original')}]:[]),
  ...(project?.takes??[]).map(t=>({value:t.id,label:tx('Prise')+' '+t.number}))
 ];
 const end=project?.stopAt??project?.ending;
 const section=playing&&project?.marks.filter(m=>m.id.startsWith('r')&&m.pos<=project.pos
  &&project.marks.some(other=>other.id==='e'+m.id.slice(1)&&other.pos>project.pos)).at(-1);
 const selected=options.find(o=>o.value===source)??options[0];
 async function transport(){
  if(!project||pending.current||!playing&&!selected)return;
  pending.current=true;epoch.current++;setBusy(true);setError('');
  try{
   const choice=selected?.value;
   const res=await deskCommand(playing?{project:project.id,action:'stop'}:{
    project:project.id,action:'play',source:choice==='original'||choice==='backing'?choice:'take',
    ...(choice!=='original'&&choice!=='backing'?{take:choice}:{}),loop:false
   });
   setState(last=>({...res,tabs:res.tabs.map(tab=>({...tab,fileKey:tab.fileKey??last?.tabs.find(t=>t.id===tab.id)?.fileKey}))}));
  }catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}
 }
 return <section className="xs2-card concert-audio" aria-label={tx('Audio de Répéter')}><h2>{tx('Audio de Répéter')}</h2>
  {state?.bridge!=='ready'?<p>{tx('Ouvre les projets dans REAPER pour jouer un accompagnement.')}</p>:<>
   {linked&&!override?<p>{tx('Projet')} · <b>{linked.title}</b></p>:<label>{tx('Projet ouvert dans Répéter')}<select aria-label={tx('Projet ouvert dans Répéter')} disabled={busy||!!playing} value={target?.id??''} onChange={e=>{setOverride(e.target.value);setSource('');setError('');}}>
    <option value="">{tx('Choisir un projet')}</option>{tabs.map(t=><option key={t.id} value={t.id}>{t.number} · {t.title||tx('Sans titre')}</option>)}</select></label>}
   {project&&<div className="concert-transport"><label>{tx('Source audio')}<select disabled={busy||state.transport!=='idle'||!selected} value={selected?.value??''} onChange={e=>setSource(e.target.value)}>
    {!selected&&<option value="">{tx('Aucune piste disponible')}</option>}{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
    <button type="button" className="xs2-btn" disabled={busy||(!playing&&(state.transport!=='idle'||!selected))} onClick={()=>void transport()}>{playing?<Square size={16}/>:<Play size={16}/>}
     {tx(playing?'Arrêter la lecture':'Lancer la lecture')}</button>
   </div>}
   {playing&&project&&<div className="concert-playhead"><p><b>{section&&section.name||tx('Lecture')}</b> · {clock(project.pos)}{end!==undefined&&' / '+clock(end)}</p>
    {end!==undefined&&end>project.start&&<progress aria-label={tx('Position dans le morceau')} max={end-project.start} value={Math.max(0,project.pos-project.start)}/>}</div>}
   {state.transport!=='idle'&&!playing&&<p role="status">{tx('Un transport est déjà actif dans REAPER.')}</p>}
  </>}{error&&<p role="alert">{tx(error)}</p>}
 </section>;
}
