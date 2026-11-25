import {useState} from 'react';
import {ChevronDown,Headphones} from 'lucide-react';
import {MonitorDesk} from './expert/Workspace';
import {useLiveMixer} from './xair/controls';
import {tx} from './i18n';
import type {Input} from './CoachSetup';

type Props={inputs:Input[];mode:'real'|'simulation';canWrite:boolean;fromMixer:boolean};
function LiveReturns({inputs,mode,canWrite,fromMixer}:Props){
  const live=useLiveMixer();
  return <div className="xs2 guided-live-returns"><MonitorDesk sources={inputs} consoleNames={fromMixer} mode={mode} values={live.values} set={live.set} confirmed={live.confirmed} writable={canWrite&&live.online}/>
    {live.message&&<p role="status">{live.message}</p>}</div>;
}
export function GuidedReturnMix(props:Props){
  const [open,setOpen]=useState(false);
  return <div className="guided-return-mix">
    <button type="button" className="guided-return-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>
      <Headphones size={20}/><span>{tx('Mixer les retours ici')}</span><ChevronDown size={18}/></button>
    {open&&<LiveReturns {...props}/>}
  </div>;
}
