import {useEffect,useState} from 'react';
import type {MixerProfile} from '../../../shared/mixer-models';
import {gainControl,type Strip} from '../xair/strips';
import {Fader,type SetFn,type Values} from '../xair/controls';
import {tx} from '../i18n';
import './gain-faders.css';

export function knownGain(strip:Strip,values:Values,model:MixerProfile){
 if(model.family!=='xair')return null;
 if(strip.kind==='ch'){
  if(!model.usbChannels&&values[strip.prefix+'/preamp/rtnsw']===1)return null;
  if(model.usbChannels>0&&![0,1].includes(Number(values[strip.prefix+'/preamp/rtnsw'])))return null;
  if(values[strip.prefix+'/preamp/rtnsw']!==1&&!Number.isInteger(values[strip.prefix+'/config/insrc']))return null;
 }
 const gain=gainControl(strip,values,model.micPreamps);
 const wire=gain?values[gain.address]:undefined;
 return gain&&typeof wire==='number'&&Number.isFinite(wire)&&wire>=0&&wire<=1?gain:null;
}
export function useGainFaders(model:MixerProfile,values:Values,writable:boolean,scope:string){
 const signature=JSON.stringify([model.id,scope,...Object.entries(values).filter(([a])=>/^\/ch\/\d+\/(config\/(insrc|rtnsrc)|preamp\/rtnsw)$|^\/config\/(chlink|linkcfg)\//.test(a)).sort(([a],[b])=>a.localeCompare(b))]);
 const [armed,setArmed]=useState<string|null>(null);
 const active=writable&&armed===signature;
 useEffect(()=>{setArmed(null);},[signature,writable]);
 useEffect(()=>{const stop=()=>setArmed(null),hidden=()=>{if(document.hidden)stop();};window.addEventListener('bandpilot-console-reset',stop);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('bandpilot-console-reset',stop);document.removeEventListener('visibilitychange',hidden);};},[]);
 return {active,toggle:()=>{if(active)setArmed(null);else if(writable&&confirm(tx('Les faders vont régler les gains et trims d’entrée. Cela affecte aussi les retours et l’enregistrement. Activer ce mode ?')))setArmed(signature);}};
}
export function GainFader({strip,values,model,set,disabled}:{strip:Strip;values:Values;model:MixerProfile;set:SetFn;disabled:boolean}){
 const gain=knownGain(strip,values,model),value=gain?gain.lo+Number(values[gain.address])*(gain.hi-gain.lo):0;
 const label=tx('Gain / trim')+' · '+(values[strip.prefix+'/config/name']||strip.fallback);
 const step=gain?.headamp ? .5 : .25;
 const send=(next:number)=>{if(!disabled&&gain)set(gain.address,Math.max(0,Math.min(1,(Math.round(next/step)*step-gain.lo)/(gain.hi-gain.lo))));};
 const lo=gain?.lo??-18,hi=gain?.hi??18,marks=(gain?.headamp?[-12,0,12,24,36,48,60]:[-18,-12,-6,0,6,12,18]).map(db=>({value:(db-lo)/(hi-lo),label:db>0?'+'+db:String(db).replace('-','−'),reference:db===0}));
 return <div className="gain-fader">
  <small>{gain?tx(gain.headamp?'Préampli':'Trim'):tx('Gain non disponible')}</small>
  <div className="gain-fader-control"><Fader label={label} value={gain?Number(values[gain.address]):.5} valueText={gain?value.toFixed(1)+" dB":tx("Gain non disponible")} marks={marks} accent="#e4b879" reset={null} step={step/(hi-lo)} fineStep={step/(hi-lo)} disabled={disabled||!gain} onChange={wire=>send(lo+wire*(hi-lo))}/></div>
  <output><strong>{gain?value.toFixed(1):'—'}</strong><span>dB</span></output>
  <div className="gain-fader-steps"><button type="button" disabled={disabled||!gain||value<=gain.lo} aria-label={label+' −'} onClick={e=>{e.stopPropagation();send(value-step);}}>−</button><button type="button" disabled={disabled||!gain||value>=gain.hi} aria-label={label+' +'} onClick={e=>{e.stopPropagation();send(value+step);}}>+</button></div>
 </div>;
}
