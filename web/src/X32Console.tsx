import {tx, getLocale} from "./i18n";
import {useEffect,useState} from 'react';
import {Fader,Knob,num,useLiveMixer,type Values,type SetFn} from './xair/controls';
import {EqView,type ViewProps} from './xair/views';
import {VisualCompressor} from './expert/DynamicsControls';
import {faderToDb,formatDb,logMap} from './xairMath';
import {stripName,type Strip} from './xair/strips';
import {useMixerModel} from './MixerModel';
import './x32-console.css';
const channels=Array.from({length:32},(_,i):Strip=>({id:`ch${i+1}`,kind:'ch',prefix:`/ch/${String(i+1).padStart(2,'0')}`,short:String(i+1),fallback:`Canal ${i+1}`,meters:[]}));
const buses=Array.from({length:16},(_,i):Strip=>({id:`bus${i+1}`,kind:'bus',prefix:`/bus/${i+1}`,short:`Bus ${i+1}`,fallback:`Bus ${i+1}`,meters:[]}));
const dcas=Array.from({length:8},(_,i):Strip=>({id:`dca${i+1}`,kind:'dca',prefix:`/dca/${i+1}`,short:`DCA ${i+1}`,fallback:`DCA ${i+1}`,meters:[]}));
const matrices=Array.from({length:6},(_,i):Strip=>({id:`matrix${i+1}`,kind:'bus',prefix:`/mtx/${String(i+1).padStart(2,'0')}`,short:`Mtx ${i+1}`,fallback:`Matrice ${i+1}`,meters:[]}));
const mains:Strip[]=[{id:'lr',kind:'lr',prefix:'/lr',short:'LR',fallback:'Main stéréo',meters:[]},{id:'mono',kind:'lr',prefix:'/main/m',short:'M/C',fallback:'Main mono',meters:[]}];
const banks=[{name:'Canaux 1–16',strips:channels.slice(0,16)},{name:'Canaux 17–32',strips:channels.slice(16)},{name:'Bus 1–16',strips:buses},{name:'DCA 1–8',strips:dcas},{name:'Matrices / Main',strips:[...matrices,...mains]}];
const levelAddress=(s:Strip)=>`${s.prefix}/${s.kind==='dca'?'fader':'mix/fader'}`;
const muteAddress=(s:Strip)=>`${s.prefix}/${s.kind==='dca'?'on':'mix/on'}`;
export function X32Console({canWrite}:{canWrite:boolean}){
 const model=useMixerModel(),live=useLiveMixer(),{values,set,confirmed,online}=live;
 const [bank,setBank]=useState(0),[selected,setSelected]=useState<Strip>(channels[0]!),[step,setStep]=useState<'eq'|'comp'|'gate'|'sends'>('comp');
 const writable=canWrite&&online;
 const available=!selected.prefix.startsWith('/mtx/')&&selected.id!=='mono'&&selected.kind!=='dca';
 useEffect(()=>{if(selected.kind!=='ch'&&(step==='gate'||step==='sends'))setStep('comp');},[selected.id]);
 const props:ViewProps={strip:selected,values,set,confirmed,canWrite:writable,open:s=>setSelected(s)};
 return <section className="xs2 xs3 xs-expert-desk x32-core" aria-label={tx(`Console ${model.label}`)}>
  <header className="x32-heading"><strong>{tx(model.brand)} {tx(model.label)}</strong><span>{tx(writable?'Contrôle actif':'Lecture seule')}{tx(" · 32 canaux · 16 bus · 8 DCA · 6 matrices")}</span></header>
  <p className="x32-note">{tx("Adaptateur X32 en validation : niveaux, mutes, panoramas, EQ, dynamique et envois de canaux aux bus. Routage matériel, préamplis, FX, scènes complètes, vumètres et carte USB nécessitent encore leur adaptation et une validation sur console.")}</p>
  {live.message&&<p role="alert">{tx(live.message)}</p>}
  <nav className="visual-bank-select" aria-label={tx("Banques X32")}>{banks.map((b,i)=><button key={tx(b.name)} type="button" aria-pressed={i===bank} onClick={()=>setBank(i)}>{tx(b.name)}</button>)}</nav>
  <div className="xs2-body">
   <div className="x32-strips">{banks[bank]!.strips.map(s=>{const a=levelAddress(s),o=muteAddress(s),on=num(values,o,1)===1;return <article key={s.id} className={selected.id===s.id?'selected':''}><button type="button" className="x32-name" onClick={()=>setSelected(s)}>{stripName(s,values)}</button><small>{tx(s.short)}</small><div className="x32-fader"><Fader label={tx(`Volume ${stripName(s,values)}`)} value={num(values,a)} disabled={!writable} onChange={v=>set(a,v)}/></div><output>{tx(formatDb(faderToDb(num(values,a))))}{tx(" dB")}</output><button type="button" disabled={!writable} aria-pressed={!on} onClick={()=>set(o,on?0:1)}>{tx("Mute")}</button></article>;})}</div>
   <section className="x32-selected"><header><h2>{stripName(selected,values)}</h2>{available&&<div className="xm"><Knob label={tx("Panorama")} disabled={!writable} value={num(values,`${selected.prefix}/mix/pan`,.5)} display={String(Math.round((num(values,`${selected.prefix}/mix/pan`,.5)-.5)*200))} bipolar reset={.5} onChange={v=>set(`${selected.prefix}/mix/pan`,v)}/></div>}</header>
    {available&&<><nav className="visual-process-tabs" aria-label={tx("Traitements X32")}>{(['comp','eq',...(selected.kind==='ch'?['gate','sends']:[])] as const).map(id=><button key={id} type="button" aria-pressed={step===id} onClick={()=>setStep(id as typeof step)}>{tx({comp:'Compresseur',eq:'Égaliseur',gate:'Gate',sends:'Envois'}[id])}</button>)}</nav><div className="xm visual-processor">{step==='eq'?<EqView {...props}/>:step==='gate'&&selected.kind==='ch'?<X32Gate strip={selected} values={values} set={set} writable={writable}/>:step==='sends'&&selected.kind==='ch'?<div className="x32-sends">{buses.map((b,i)=>{const a=`${selected.prefix}/mix/${String(i+1).padStart(2,'0')}/level`;return <label key={b.id}>{stripName(b,values)}<input type="range" aria-label={tx(`Envoi ${stripName(selected,values)} vers ${stripName(b,values)}`)} min="0" max="1" step=".005" value={num(values,a)} disabled={!writable} onChange={e=>set(a,Number(e.target.value))}/><output>{tx(formatDb(faderToDb(num(values,a))))}{tx(" dB")}</output></label>;})}</div>:<VisualCompressor {...props} advanced={false}/>}</div></>}
   </section>
  </div>
 </section>;
}
function X32Gate({strip,values,set,writable}:{strip:Strip;values:Values;set:SetFn;writable:boolean}){
 const p=`${strip.prefix}/gate`,on=num(values,`${p}/on`)===1;
 return <div><button type="button" disabled={!writable} aria-pressed={on} onClick={()=>set(`${p}/on`,on?0:1)}>{tx("Gate ")}{tx(on?'activé':'désactivé')}</button><div className="visual-comp-knobs"><Knob size={56} label={tx("Seuil")} disabled={!writable} value={num(values,`${p}/thr`)} display={`${(-80+num(values,`${p}/thr`)*80).toFixed(1)} dB`} onChange={v=>set(`${p}/thr`,v)}/><Knob size={56} label={tx("Atténuation")} disabled={!writable} value={num(values,`${p}/range`)} display={`${(3+num(values,`${p}/range`)*57).toFixed(0)} dB`} onChange={v=>set(`${p}/range`,v)}/><Knob size={56} label={tx("Attaque")} disabled={!writable} value={num(values,`${p}/attack`)} display={`${(num(values,`${p}/attack`)*120).toFixed(0)} ms`} onChange={v=>set(`${p}/attack`,v)}/><Knob size={56} label={tx("Maintien")} disabled={!writable} value={num(values,`${p}/hold`)} display={`${logMap(num(values,`${p}/hold`),.02,2000).toFixed(0)} ms`} onChange={v=>set(`${p}/hold`,v)}/><Knob size={56} label={tx("Relâchement")} disabled={!writable} value={num(values,`${p}/release`)} display={`${logMap(num(values,`${p}/release`),5,4000).toFixed(0)} ms`} onChange={v=>set(`${p}/release`,v)}/></div></div>;
}
