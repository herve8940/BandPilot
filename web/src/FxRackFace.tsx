import {useId} from 'react';
import {FX_NAMES} from '../../shared/fx-parameters';
import {FX_INFO} from './xairHelp';
import {rackModel} from './fx-rack-models';
import './fx-rack.css';

// Original faceplates. Miniatures identify a processor; the enlarged editor displays its settings.
export function FxRackFace({algorithm}:{algorithm:number}){
 const id='rack'+useId().replace(/[^\w-]/g,'');
 const model=rackModel(algorithm), info=FX_INFO[algorithm];
 if(!model||!info)return null;
 const {layout,metal,ink,accent}=model,code=FX_NAMES[algorithm];
 const fill=(name:string)=>`url(#${id}-${name})`;
 const knobs=(xs:number[],y:number,r=10)=>xs.map(x=><g key={x} transform={`translate(${x} ${y})`}>
  <path d={`M${-r-2} 2 A${r+2} ${r+2} 0 1 1 ${r+2} 2`} fill="none" stroke={ink} strokeWidth="1" opacity=".57"/>
  <circle r={r} fill={fill('dial')} stroke="#141719" strokeWidth="1.5"/><circle r={r-3} fill="#34373a"/>
  <path d={`M-1 -2 l-3 ${3-r}`} stroke="#f7efdf" strokeWidth="1.8" strokeLinecap="round"/></g>);
 const faders=(xs:number[],y:number,h:number,w:number)=>xs.map(x=><g key={x}>
  <path d={`M${x} ${y}v${h}`} stroke="#191c1c" strokeWidth="3"/>
  {Array.from({length:5},(_,i)=><path key={i} d={`M${x-w} ${y+i*h/4}h${w-2}`} stroke={ink} opacity=".5"/>)}
  <rect x={x-w/2} y={y+h/2-3} width={w} height="6" rx="1" fill="#e3decb" stroke="#51504a"/><path d={`M${x-w/2+1} ${y+h/2}h${w-2}`} stroke="#777569"/></g>);
 const lcd=(x:number,w:number,title:string)=><g><rect x={x} y="12" width={w} height="22" rx="2" fill="#131b19" stroke="#131516" strokeWidth="3"/>
  <text x={x+w/2} y="27" fill={accent} fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="1">{title}</text></g>;
 return <svg className="fx-rack-face" viewBox="0 0 320 78" width="320" height="78" aria-hidden="true" focusable="false" data-rack={code}>
  <defs><linearGradient id={id+'-metal'} x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="white" stopOpacity=".16"/><stop offset=".18" stopColor="white" stopOpacity=".04"/><stop offset=".68" stopColor="black" stopOpacity="0"/><stop offset="1" stopColor="black" stopOpacity=".24"/></linearGradient>
   <radialGradient id={id+'-dial'} cx=".35" cy=".22" r=".84"><stop stopColor="#a09e93"/><stop offset=".48" stopColor="#5f6060"/><stop offset=".76" stopColor="#1a1c20"/><stop offset="1" stopColor="#777975"/></radialGradient>
   <pattern id={id+'-grain'} width="4" height="3" patternUnits="userSpaceOnUse"><path d="M0 .5h4" stroke="white" opacity=".046"/></pattern></defs>
  <rect x="1" y="1" width="318" height="76" rx="4" fill={metal} stroke="#111518" strokeWidth="2"/>
  <rect x="2" y="2" width="316" height="74" rx="3" fill={fill('metal')}/><rect x="2" y="2" width="316" height="74" rx="3" fill={fill('grain')}/>
  {[8,312].flatMap(x=>[10,68].map(y=><g key={x+'-'+y}><circle cx={x} cy={y} r="3.2" fill="#242729" stroke="#92928a" strokeWidth=".65"/><path d={`M${x-1.6} ${y+1}l3.2 -2`} stroke="#93918a"/></g>))}
  <g fontFamily="Arial, sans-serif" fill={ink}>
   {layout==='sliders'?<>{lcd(24,272,info.code)}{faders([51,96,140,184,228,272],40,25,16)}</>:
    layout==='equalizer'?<>{lcd(24,85,info.code)}{faders(Array.from({length:31},(_,i)=>120+i*5.7),18,45,4)}<text x="26" y="54" fontSize="11">31 BAND</text></>:
    layout==='keys'?<><path d="M26 13v51" stroke="#17191a" strokeWidth="8"/>{[1,2,3,4].map((n)=><g key={n}><rect x={37+n*20} y="28" width="17" height="13" rx="1.5" fill={['','#b79d7c','#c8bda0','#e5d9aa','#e2cf95'][n]} stroke="#171918"/><text x={45+n*20} y="53" fontSize="8" textAnchor="middle">{n}</text></g>)}<text x="285" y="48" textAnchor="end" fill={accent} fontStyle="italic" fontSize="12">Dimensional Chorus</text></>:
    layout==='compressor'?<>{knobs([54,101],42,16)}{knobs([144,174],43,10)}<text x="26" y="15" fontSize="8" letterSpacing="2">{info.code}</text><rect x="205" y="16" width="76" height="43" rx="5" fill="#171817"/><rect x="209" y="20" width="68" height="34" rx="3" fill="#e8d4a4"/><path d="M214 41Q242 14 271 41" fill="none" stroke="#72614c" strokeDasharray="1.6 1.6" strokeWidth="3"/><path d="M244 55l-25 -17" stroke="#302d29"/></>:
    layout==='amp'?<><rect x="17" y="9" width="286" height="24" rx="2" fill="#242321"/>{Array.from({length:44},(_,i)=><path key={i} d={`M${20+i*6.4} 11l6 20`} stroke="#59564a" strokeWidth="1.3"/>)}<rect x="112" y="12" width="96" height="17" rx="3" fill="#242321"/><text x="160" y="24" textAnchor="middle" fontSize="10" fill="#f6dda9" fontStyle="italic">{info.code}</text>{knobs([48,85,122,159,196,233,270],54,9)}</>:
    layout==='display'&&code==='DLY'?<>{lcd(111,98,'STEREO DELAY')}{knobs([43,82,237,276],30,9)}{knobs([43,82,237,276],56,8)}<path d="M119 51h13l3 -5 3 10 3 -5h18m0 0h10l3 -4 3 7 3 -3h20" fill="none" stroke={accent} opacity=".8"/></>:
    layout==='display'||layout==='split'?<>{lcd(113,96,info.code)}{knobs([51,266],25,10)}{knobs([44,77,111,145,179,213,247,281],56,8)}{layout==='split'&&<path d="M128 41v26m72 -26v26" stroke={ink} opacity=".4"/>}</>:
    <><text x="28" y="21" fontSize="10" fontWeight="700" letterSpacing="1.6">{info.name.toUpperCase()}</text><path d="M28 28h262" stroke={accent} opacity=".65"/>{knobs(Array.from({length:Math.min(model.controls.length,8)},(_,i)=>42+i*(239/Math.max(1,Math.min(model.controls.length,8)-1))),52)}</>}
  </g></svg>;
}
