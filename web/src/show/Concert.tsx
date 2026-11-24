import {useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,FileText,ListMusic,Mic2} from 'lucide-react';
import {tx} from '../i18n';
import {isAndroid} from '../platform';
import {useStandView} from './StandView';
import {ConcertAudio} from './ConcertAudio';
import '../expert/expert.css';
import './show.css';
import './concert.css';

export type ConcertSong={id:string;title:string;artist:string;bpm:number|null;hasPdf?:boolean;projectId?:string;fileKey?:string};
type Entry={song:ConcertSong;index:number};
type Cursor={order:string;id:string;occurrence:number;phase:'ready'|'live'|'done'};
const storageKey='bandpilot-concert-cursor';
function savedCursor():Cursor|null{
 try{return JSON.parse(sessionStorage.getItem(storageKey)??'null');}catch{return null;}
}
export function Concert({entries,onSetlist,onSheet}:{entries:Entry[];onSetlist:()=>void;onSheet:(id:string)=>void}){
 const stand=useStandView();
 const [cursor,setCursor]=useState<Cursor|null>(savedCursor),[locked,setLocked]=useState(false);
 const order=JSON.stringify(entries.map(entry=>entry.song.id));
 const matches=cursor?.order===order?entries.flatMap((e,i)=>e.song.id===cursor.id?[i]:[]):[];
 const found=matches[cursor?.occurrence??0],index=found??0;
 const phase=found===undefined?'ready':cursor?.phase??'ready';
 const song=entries[index]?.song,next=entries[index+1]?.song;
 const list=useRef<HTMLOListElement>(null);
 useLayoutEffect(()=>{
  const container=list.current;
  const selected=container?.children[index];
  if(!container||!selected)return;
  const bounds=container.getBoundingClientRect(),row=selected.getBoundingClientRect();
  if(row.top<bounds.top)container.scrollTop+=row.top-bounds.top;
  else if(row.bottom>bounds.bottom)container.scrollTop+=row.bottom-bounds.bottom;
 },[index,order,stand.active]);
 function select(i:number,phase:Cursor['phase']){
  const selected=entries[i]?.song;if(!selected)return;
  const value={order,id:selected.id,occurrence:entries.slice(0,i).filter(e=>e.song.id===selected.id).length,phase};
  setCursor(value);try{sessionStorage.setItem(storageKey,JSON.stringify(value));}catch{/* View remains usable in memory. */}
 }
 return <section className={'xs2 sh sh-concert'+(stand.active?' stand-view':'')} aria-label={tx('Concert')}>
  <div className="sh-head"><ListMusic size={18}/><b>{tx('Setlist active')}</b><div className="xs2-spacer"/>
   {song&&<button type="button" className="xs2-btn" disabled={locked} onClick={onSetlist}>{tx('Ouvrir la setlist')}</button>}{stand.button}</div>
  {!song?<div className="xs2-card concert-empty"><ListMusic size={30}/><h2>{tx('Prépare ta setlist')}</h2><p>{tx('Dans Setlist, ajoute les morceaux ouverts dans Répéter et choisis leur ordre de passage.')}</p>
   <button type="button" className="xs2-btn primary" onClick={onSetlist}>{tx('Ouvrir la setlist')}</button></div>:
   <div className="sh-show concert-desk"><main>
    <div className="xs2-card sh-now"><div className="concert-cue" aria-live="polite" aria-atomic="true"><div>
     <small>{tx(phase==='done'?'Concert terminé':phase==='live'?'En scène':'Morceau sélectionné')} · {index+1} / {entries.length}</small>
     <h1>{song.title}</h1>{song.artist&&<p>{song.artist}</p>}
    </div><Mic2 size={28} aria-hidden="true"/></div>
    {song.hasPdf&&<button type="button" className="xs2-btn concert-sheet" onClick={()=>onSheet(song.id)}><FileText size={17}/>{tx('Ouvrir la fiche PDF')}</button>}
    <div className="concert-next"><small>{tx('Ensuite')}</small><b>{next?.title??tx('Fin du set')}</b></div></div>
    <div className="sh-cmds concert-manual">
     <button type="button" className="sh-cmd" disabled={locked||index===0} onClick={()=>select(index-1,phase==='ready'?'ready':'live')}><ArrowLeft size={18}/>{tx('Morceau précédent')}</button>
     <button type="button" className="sh-cmd next" disabled={locked} onClick={()=>phase==='ready'?select(index,'live'):phase==='done'?select(0,'ready'):next?select(index+1,'live'):select(index,'done')}>
      {tx(phase==='ready'?'Commencer le concert':phase==='done'?'Revenir au début':next?'Morceau suivant':'Terminer le concert')}<ArrowRight size={18}/></button>
    </div>
    {!isAndroid&&phase!=='done'&&<ConcertAudio key={song.id} song={song} onLock={setLocked}/>}
   </main><aside className="xs2-card concert-order"><h2>{tx('Ordre de passage')}</h2><ol ref={list}>
    {entries.map(({song:s},i)=><li key={i}><button type="button" className={'sh-song'+(index===i?' on':'')} aria-current={index===i?'step':undefined}
     disabled={locked} onClick={()=>select(i,phase==='live'?'live':'ready')}><span className="regie-track-number">{String(i+1).padStart(2,'0')}</span><b>{s.title}</b></button></li>)}</ol></aside>
   </div>}
 </section>;
}
