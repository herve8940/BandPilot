import type {ReturnTarget} from '../EarsSharePanel';
import {useGroupSpill,GroupSpillNotice} from './group-spill';
import {GroupedAdjustments} from '../GroupedAdjustments';
import {MixCopyPanel} from './MixCopyPanel';
import {busLinkAddress,busPairStart,pairedMonitorAddress} from '../../../shared/monitor-pairs';
import {tx, getLocale} from "../i18n";
import {useEffect, useState, type ReactNode} from 'react';
import {useAirStrips} from '../xair/model-strips';
import {Fader, Meter, num, pad, type Values, type SetFn} from '../xair/controls';
import {faderToDb, formatDb, stripColor} from '../xairMath';
import {stripName, type Strip} from '../xair/strips';
import {EqView, type ViewProps} from '../xair/views';
import './workspace.css';
import {VisualCompressor} from './DynamicsControls';

export {useDeskLayout, screenClass} from './desk-layout';
export {DeskLayoutTools} from './DeskLayoutTools';

const tapNames=['Entrée','Avant EQ','Après EQ','Avant fader','Après fader','Sous-groupe'];
export function SignalPath({source,bus,values}:{source:Strip;bus?:Strip;values:Values}){
 const isChannel=source.kind==='ch',usb=isChannel&&values[`${source.prefix}/preamp/rtnsw`]===1;
 const input=values[`${source.prefix}/config/insrc`];
 const origin=isChannel?(usb?'Source USB · REAPER / ordinateur':typeof input==='number'?input<16?`Entrée physique ${input+1}`:'Entrée désactivée':'Entrée physique · source non reçue'):stripName(source,values);
 const tap=bus?values[`${source.prefix}/mix/${pad(Number(bus.id.replace('bus','')))}/tap`]:undefined;
 return <div className="desk-signal" aria-label={tx("Parcours du signal")}><span>{tx(origin)}</span><b aria-hidden="true">→</b><span>{stripName(source,values)}</span><b aria-hidden="true">→</b>{bus?<><span>{tx(typeof tap==='number'?tapNames[tap]??'Point de prélèvement inconnu':'Point de prélèvement non reçu')}</span><b aria-hidden="true">→</b><span>{stripName(bus,values)}{tx(" · EQ + compression du retour")}</span></>:<span>{tx("Envois vers retours / façade selon routage")}</span>}</div>;
}

type Musician={name:string;bus:number;channels:number[]};
export function MonitorDesk({initialBus=1,onShare,sources,consoleNames=false,values,set:send,writable,confirmed,mode="real"}:{sources?:{channel:number;name:string}[];consoleNames?:boolean;initialBus?:number;onShare?:(target:ReturnTarget)=>void;mode?:"real"|"simulation";values:Values;set:SetFn;writable:boolean;confirmed:ViewProps['confirmed']}){
 const {BUSES,INPUTS,model}=useAirStrips();
 const buses=BUSES.slice(0,model.monitorOutputs).filter(b=>{const n=Number(b.id.replace('bus',''));return n%2===1||values[busLinkAddress(n)]!==1;});
 const [selected,setSelected]=useState(initialBus),[musicians,setMusicians]=useState<Musician[]>([]),[page,setPage]=useState<'mix'|'eq'|'comp'>('mix');
 const [profileError,setProfileError]=useState(false);
 const spill=useGroupSpill(`${model.id}:${mode}:${selected}`);
 useEffect(()=>{let active=true;fetch('/api/coach').then(async r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(active)setMusicians(Array.isArray(d.profile?.musicians)?d.profile.musicians:[]);}).catch(()=>{if(active)setProfileError(true);});return()=>{active=false;};},[model.id]);
 const tracks=sources?INPUTS.filter(s=>sources.some(i=>s.kind==='ch'?i.channel===Number(s.short):s.kind==='aux'&&i.channel===0)):INPUTS;
 const sourceName=(s:typeof INPUTS[number])=>sources?.find(i=>s.kind==='aux'?i.channel===0:s.kind==='ch'&&i.channel===Number(s.short))?.name??stripName(s,values);
 const selectedBus=values[busLinkAddress(selected)]===1?busPairStart(selected):selected;
 const bus=buses.find(b=>b.id===`bus${selectedBus}`)??buses[0];
 if(!bus)return null;
 const number=Number(bus.id.replace('bus','')),musician=!consoleNames?musicians.find(m=>m.bus===number):undefined;
 const stereo=values[busLinkAddress(number)]===1;
 const set:SetFn=(a,v)=>{send(a,v);const paired=stereo?pairedMonitorAddress(number,a):null;if(paired)send(paired,v);};
 const title=(n:number)=>(!consoleNames&&musicians.find(m=>m.bus===n)?.name)||stripName(BUSES[n-1]!,values);
 const props:ViewProps={strip:bus,values,set,canWrite:writable,confirmed,open:()=>undefined};
 return <section className="monitor-desk" aria-label={tx("Régie des retours")}>
  <header><div><small>{tx("RÉGIE DES RETOURS")}</small><h2>{tx("Les retours du groupe")}</h2><p>{tx("Choisis un musicien : ses envois et les traitements de son bus sont réunis ici.")}</p></div><span className="desk-readonly">{tx(writable?'Contrôle actif':'Lecture seule')}</span></header>
  {profileError&&<p role="status">{tx("Les noms du coach sont indisponibles. Les noms et réglages des bus restent accessibles.")}</p>}
  <div className="monitor-people" role="group" aria-label={tx("Choisir le retour")}>{buses.map(b=>{const i=Number(b.id.replace('bus',''))-1;return <button type="button" key={b.id} aria-pressed={number===i+1} onClick={()=>setSelected(i+1)}><b>{title(i+1)}</b><small>{tx("Aux ")}{tx(i+1)}{tx(" · EQ ")}{tx(values[`${b.prefix}/eq/on`]===1?'ON':'OFF / ?')}{tx(" · Comp ")}{tx(values[`${b.prefix}/dyn/on`]===1?'ON':'OFF / ?')}</small>{values[busLinkAddress(i+1)]===1&&<small>{tx('Stéréo')} {i+1}–{i+2}</small>}<Meter indexes={b.meters}/></button>;})}</div>
  <div className="monitor-target"><div><h3>{tx("Retour de ")}{title(number)}</h3><span>{tx("Bus ")}{tx(number)}{tx(" · sortie à vérifier dans Routage · ")}{tx(formatDb(faderToDb(num(values,`${bus.prefix}/mix/fader`))))}{tx(" dB")}</span></div><label>{tx("Volume de ce retour")}<input type="range" min="0" max="1" step=".005" aria-label={tx(`Volume du retour ${title(number)}`)} disabled={!writable} value={num(values,`${bus.prefix}/mix/fader`)} onChange={e=>set(`${bus.prefix}/mix/fader`,Number(e.target.value))}/></label><button type="button" disabled={!writable} aria-pressed={num(values,`${bus.prefix}/mix/on`,1)===0} onClick={()=>set(`${bus.prefix}/mix/on`,num(values,`${bus.prefix}/mix/on`,1)?0:1)}>{tx("Couper ce retour")}</button></div>
  {onShare&&<button type="button" className="xs2-btn monitor-share" onClick={()=>onShare({bus:number,name:musician?.name??'',stereo})}>{tx('Partager ce retour')}</button>}
  {!sources&&spill.channels&&<GroupSpillNotice clear={spill.clear}/>}
  <nav className="monitor-tabs" aria-label={tx("Réglages du retour")}>{([['mix','Mix personnel'],['eq','Égaliseur du retour'],['comp','Compression du retour']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={page===id} onClick={()=>setPage(id)}>{tx(label)}</button>)}</nav>
  {page==='mix'&&<><p>{tx("Les faders ci-dessous règlent uniquement les envois vers ")}<strong>{title(number)}</strong>{tx(". Les traitements des pistes restent accessibles dans Canal.")}</p><div className="monitor-sends">{tracks.filter(s=>sources||!spill.channels||s.kind==='ch'&&spill.channels.includes(Number(s.short))).map(s=>{const address=`${s.prefix}/mix/${pad(number)}/level`,own=s.kind==='ch'&&musician?.channels.includes(Number(s.short));return <div className={`monitor-source${own?' own':''}`} key={s.id}><b>{sourceName(s)}</b><small>{tx(own?'Son instrument':s.kind==='fxrtn'?'Retour d’effet':s.kind==='aux'?'Entrée auxiliaire':'Instrument / micro')}</small><Fader label={tx(`${sourceName(s)} vers ${title(number)}`)} value={num(values,address)} disabled={!writable||(!!sources&&typeof values[address]!=='number')} onChange={v=>set(address,v)}/><output>{!sources||typeof values[address]==='number'?formatDb(faderToDb(num(values,address)))+' dB':'—'}</output>{stereo&&<label>{tx('Panorama')}<input type="range" min="0" max="1" step=".01" value={num(values,`${s.prefix}/mix/${pad(number)}/pan`,.5)} disabled={!writable} onChange={e=>set(`${s.prefix}/mix/${pad(number)}/pan`,Number(e.target.value))}/></label>}</div>;})}</div></>}
  {page==='eq'&&<><p>{tx("Cette égalisation agit sur tout le mix de ")}{title(number)}{tx(". Elle ne modifie pas les EQ des instruments ni ceux des autres bus.")}</p><div className="xm monitor-processing"><EqView key={bus.id} {...props}/></div></>}
  {page==='comp'&&<><p>{tx("Cette compression agit sur tout ce retour. Une forte réduction peut faire reculer la voix à chaque coup de grosse caisse.")}</p><div className="xm monitor-processing"><VisualCompressor key={bus.id} {...props}/></div></>}
  <details className="monitor-route"><summary>{tx("Comprendre le trajet vers ce retour")}</summary>{tracks.filter(s=>s.kind==='ch').map(s=><SignalPath key={s.id} source={s} bus={bus} values={values}/>)}</details>
   {!sources&&<MixCopyPanel key={`${model.id}:${number}`} values={values} outputs={model.monitorOutputs} target={number} writable={writable}/>}
  {!sources&&<GroupedAdjustments model={model.id} canWrite={writable} mode={mode} fixedBus={number} onSpill={channels=>{spill.show(channels);setPage('mix');}}/>}
</section>;
}
