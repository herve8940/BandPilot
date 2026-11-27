import {useId,useState,type CSSProperties} from 'react';
import {FX_SCHEMAS,canEditFx,fxFromWire,type FxVector} from '../../shared/fx-parameters';
import {FX_INFO} from './xairHelp';
import {Knob} from './xair/controls';
import {tx,getLocale} from './i18n';
import {rackModel} from './fx-rack-models';
import './fx-rack.css';

type Props={fx:FxVector;disabled:boolean;onParameter:(index:number,value:number)=>void};
const sideNames={A:'Côté A (gauche)',B:'Côté B (droite)',M:'Mid',S:'Side'};
export function FxRackControls({fx,disabled,onParameter}:Props){
 const [bank,setBank]=useState(0),id=useId();
 const model=rackModel(fx.algorithm),schema=FX_SCHEMAS[fx.algorithm],info=FX_INFO[fx.algorithm];
 if(!model||!schema||!info||schema.geq||!canEditFx(fx))return null;
 const parameters=schema.parameters;
 const sideOf=(i:number)=>fx.algorithm===31?([0,1,4].includes(i)?'A':'B'):parameters[i]?.side;
 const sides=[...new Set(parameters.map((_,i)=>sideOf(i)))].filter((s):s is keyof typeof sideNames=>!!s&&s!=='stereo');
 const selected=sides[bank]??sides[0];
 const indices=parameters.map((_,i)=>i).filter(i=>!selected||sideOf(i)===selected);
 const primary=fx.algorithm===31?indices:model.controls.map(i=>indices[i]).filter((i):i is number=>i!==undefined);
 const groups=fx.algorithm===26?[{title:'Délai',p:primary.slice(0,2)},{title:'Modulation',p:primary.slice(2,4)},{title:'Réverbe',p:primary.slice(4)}]:[{title:'',p:primary}];
 const format=new Intl.NumberFormat(getLocale(),{maximumFractionDigits:2});
 const control=(i:number)=>{
  const p=parameters[i]!,wire=fx.parameters[i]!.value,label=tx(p.label);
  if(p.scale==='enum'){
   if(p.options.length===2&&p.options[0]==='OFF'&&p.options[1]==='ON')return <button type="button" key={i} className="fx-hw-switch" aria-pressed={wire===1} disabled={disabled} onClick={()=>onParameter(i,wire===1?0:1)}><i aria-hidden="true"/>{label}</button>;
   if(p.label==='Ratio'&&model.layout==='compressor')return <div className="fx-hw-ratios" key={i} role="group" aria-label={label}><small>{label}</small>{p.options.map((o,n)=><button type="button" key={o} disabled={disabled} aria-pressed={wire===n} onClick={()=>onParameter(i,n)}>{o}</button>)}</div>;
   return <label className="fx-hw-choice" key={i}>{label}<select value={wire} disabled={disabled} onChange={e=>onParameter(i,Number(e.target.value))}>{p.options.map((o,n)=><option value={n} key={o}>{tx(o)}</option>)}</select></label>;
  }
  const value=fxFromWire(p,wire),display=format.format(value)+(p.unit?' '+p.unit:'');
  const move=(next:number)=>onParameter(i,Math.min(p.hi,Math.max(p.lo,fxFromWire(p,next))));
  if(model.layout==='sliders')return <label key={i} className="fx-hw-slider"><span>{label}</span><input type="range" min="0" max="1" step=".001" value={wire} disabled={disabled} aria-label={label} aria-valuetext={display} onChange={e=>move(Number(e.target.value))}/><output>{display}</output></label>;
  return <Knob key={i} label={label} size={54} disabled={disabled} value={wire} display={display} onChange={move}/>;
 };
 return <section className={'fx-hardware fx-hardware-'+model.layout} style={{'--fx-metal':model.metal,'--fx-ink':model.ink,'--fx-accent':model.accent,'--fx-dial-fill':`url(#${id}-knob)`} as CSSProperties} aria-labelledby={id} data-algorithm={fx.algorithm}>
  <svg aria-hidden="true" width="0" height="0" style={{position:'absolute'}}><defs><radialGradient id={id+'-knob'} cx=".34" cy=".23" r=".83"><stop stopColor="#82847f"/><stop offset=".33" stopColor="#565954"/><stop offset=".68" stopColor="#343737"/><stop offset=".84" stopColor="#202323"/><stop offset="1" stopColor="#727570"/></radialGradient></defs></svg>
  <header className="fx-hw-name"><div><small>{tx(info.family)}</small><strong id={id}>{tx(info.name)}</strong></div><span>{info.code}</span></header>
  {sides.length>1&&<div className="fx-hw-banks" role="group" aria-label={tx('Côté à régler')}>{sides.map((side,n)=><button type="button" key={side} aria-pressed={side===selected} onClick={()=>setBank(n)}>{tx(sideNames[side])}</button>)}</div>}
  <div className={'fx-hw-deck'+(groups.length>1?' grouped':'')}>{groups.map(g=><div className="fx-hw-group" key={g.title}>{g.title&&<b>{tx(g.title)}</b>}<div className="fx-hw-controls">{g.p.map(control)}</div></div>)}</div>
 </section>;
}
