import {useState} from 'react';
import {Volume2} from 'lucide-react';
import {tx} from './i18n';
import {useLiveMixer} from './xair/controls';
import {faderToDb,formatDb} from './xairMath';
import {pad} from './xair/strips';

type Props={channel:number;name:string;canApply:boolean;busy:boolean;prepare:(values:Record<string,number>,name:string)=>void};
function FrontLevels({channel,name,canApply,busy,prepare}:Props){
  const live=useLiveMixer();
  const [draft,setDraft]=useState<Record<string,number>>({});
  const prefix=channel===0?'/rtn/aux':'/ch/'+pad(channel);
  const rows=[{prefix,label:name},{prefix:'/lr',label:tx('Master de façade')}];
  const changes:Record<string,number>={};
  rows.forEach(row=>{
    const address=row.prefix+'/mix/fader',value=draft[address];
    if(value!==undefined&&typeof live.values[address]==='number'&&value!==live.values[address])changes[address]=value===0?-90:faderToDb(value);
  });
  return <div className="guided-front-levels">
    {rows.map(row=>{
      const address=row.prefix+'/mix/fader',actual=live.values[address];
      const value=draft[address]??(typeof actual==='number'?actual:0);
      return <label key={address}><span><strong>{row.label}</strong>{live.values[row.prefix+'/mix/on']===0&&<small>{tx('Coupé')}</small>}</span>
        <input aria-label={row.label+' · '+tx('Fader de façade')} type="range" min="0" max="1" step=".005" value={value} disabled={!live.online||!canApply||busy||typeof actual!=='number'} onChange={e=>setDraft({...draft,[address]:Number(e.target.value)})}/>
        <output>{typeof actual==='number'?formatDb(faderToDb(value))+' dB':'—'}</output></label>;
    })}
    {live.values[prefix+'/mix/lr']===0&&<p className="coach-note">{tx('Cette tranche n’est pas envoyée en façade.')}</p>}
    <button type="button" disabled={!Object.keys(changes).length||busy||!live.online||!canApply} onClick={()=>prepare(changes,name)}>{tx('Vérifier les niveaux proposés')}</button>
  </div>;
}
export function GuidedFrontMix(props:Props&{revision:number}){
  const [open,setOpen]=useState(false);
  return <div className="guided-front"><button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}><Volume2 size={18}/>{tx('Volumes de façade')}</button>
    {open&&<FrontLevels key={props.channel+'-'+props.revision} {...props}/>}</div>;
}
