import {useState} from 'react';
import {ArrowDown,ArrowUp,ListMusic,Music2,Trash2} from 'lucide-react';
import {tx} from './i18n';

type Song = {id:string;title:string;artist:string;bpm:number|null};
type Entry = {song:Song;index:number};
type Props = {
  entries:Entry[];
  move:(from:number,to:number)=>void;
  remove:(index:number)=>void;
  rehearse?:(title:string)=>void;
};

export function ActiveSetlist({entries,move,remove,rehearse}:Props) {
  const [picked,setPicked]=useState<{id:string;index:number}|null>(null);
  const current=entries.find(e=>e.index===picked?.index&&e.song.id===picked.id)
    ?? entries.find(e=>e.song.id===picked?.id) ?? entries[0];
  const position=current ? entries.indexOf(current) : -1;
  const shift=(direction:-1|1)=>{
    const destination=entries[position+direction];
    if(!current||!destination)return;
    move(current.index,destination.index);
    setPicked({id:current.song.id,index:destination.index});
  };
  return <>
    <div className="panel-title"><div><b>{tx("Setlist active")}</b><small>{entries.length}{tx(" morceaux")}</small></div><ListMusic size={18}/></div>
    <div className="song-list setlist-tracks">{entries.map((entry,i)=>
      <div className="setlist-row" key={entry.index}>
        <button type="button" className="setlist-pick" aria-pressed={entry===current} onClick={()=>setPicked({id:entry.song.id,index:entry.index})}>
          <span className="regie-track-number">{String(i+1).padStart(2,"0")}</span>
          <b>{entry.song.title}</b>{entry.song.bpm!=null&&<small>{entry.song.bpm} BPM</small>}
        </button>
      </div>)}
      {!current&&<p>{tx("Ajoute des morceaux depuis le répertoire.")}</p>}
    </div>
    {current&&<div className="setlist-inspector">
      <div><strong>{current.song.title}</strong>{current.song.artist&&<small>{current.song.artist}</small>}</div>
      <div className="setlist-order">
        <button type="button" disabled={position===0} aria-label={tx("Monter")+" · "+current.song.title} title={tx("Monter")} onClick={()=>shift(-1)}><ArrowUp size={16}/></button>
        <button type="button" disabled={position===entries.length-1} aria-label={tx("Descendre")+" · "+current.song.title} title={tx("Descendre")} onClick={()=>shift(1)}><ArrowDown size={16}/></button>
        <button type="button" aria-label={tx("Retirer de la setlist")+" · "+current.song.title} title={tx("Retirer de la setlist")} onClick={()=>remove(current.index)}><Trash2 size={15}/></button>
      </div>
      {rehearse&&<button type="button" className="primary setlist-rehearse" onClick={()=>rehearse(current.song.title)}><Music2 size={16}/>{tx("Ouvrir en répétition")}</button>}
    </div>}
  </>;
}
