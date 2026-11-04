import {useEffect, useState} from 'react';
import {useAirStrips} from '../xair/model-strips';
import {Fader, Meter, num, pad, type Values, type SetFn} from '../xair/controls';
import {faderToDb, formatDb, stripColor} from '../xairMath';
import {stripName, type Strip} from '../xair/strips';
import {CompView, EqView, type ViewProps} from '../xair/views';
import './workspace.css';
import {VisualCompressor} from './DynamicsControls';

type Layout={hidden:string[];outputs:boolean;density:'compact'|'comfortable'};
const defaults:Layout={hidden:[],outputs:true,density:'compact'};
const storageKey='bandpilot-workspaces-v1';
export const screenClass=(width:number)=>width<760?'small':width<1400?'medium':'wide';
function readLayouts():Record<string,Layout>{
 try{const raw=JSON.parse(localStorage.getItem(storageKey)||'{}');return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};}catch{return {};}
}
export function useDeskLayout(model:string){
 const [screen,setScreen]=useState(()=>screenClass(window.innerWidth));
 const [layouts,setLayouts]=useState(readLayouts);
 useEffect(()=>{const resize=()=>setScreen(screenClass(window.innerWidth));window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 const key=`${model}:${screen}`,saved=layouts[key];
 const layout:Layout={hidden:Array.isArray(saved?.hidden)?saved.hidden.filter(x=>typeof x==='string'):[],outputs:saved?.outputs!==false,density:saved?.density==='comfortable'?'comfortable':'compact'};
 const update=(patch:Partial<Layout>)=>setLayouts(previous=>{const next={...previous,[key]:{...layout,...patch}};try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{/* usable without storage */}return next;});
 return {layout,update,screen,reset:()=>update(defaults)};
}
export function DeskLayoutTools({strips,values,desk}:{strips:Strip[];values:Values;desk:ReturnType<typeof useDeskLayout>}){
 const {layout,update}=desk;
 return <details className="desk-layout"><summary>Ma console · {strips.filter(s=>!layout.hidden.includes(s.id)).length}/{strips.length} entrées visibles</summary>
  <div className="desk-layout-body"><p>Affichage personnel enregistré pour {desk.screen==='small'?'petit écran':desk.screen==='medium'?'écran standard':'grand écran'}. Masquer une tranche ne coupe pas son son.</p>
   <div className="desk-layout-actions"><label>Largeur des tranches <select aria-label="Largeur des tranches" value={layout.density} onChange={e=>update({density:e.target.value as Layout['density']})}><option value="compact">Compacte</option><option value="comfortable">Confortable</option></select></label><label><input type="checkbox" checked={layout.outputs} onChange={e=>update({outputs:e.target.checked})}/> Afficher les sorties et le Master</label><button type="button" onClick={()=>update({hidden:[]})}>Tout afficher</button><button type="button" onClick={()=>update({hidden:strips.filter(s=>stripName(s,values)===s.fallback).map(s=>s.id)})}>Garder les entrées nommées</button><button type="button" onClick={desk.reset}>Réinitialiser ma vue</button></div>
   <div className="desk-channel-picker">{strips.map(s=><label key={s.id}><input type="checkbox" aria-label={`Afficher ${stripName(s,values)}`} checked={!layout.hidden.includes(s.id)} onChange={e=>update({hidden:e.target.checked?layout.hidden.filter(id=>id!==s.id):[...layout.hidden,s.id]})}/><i style={{background:stripColor(num(values,`${s.prefix}/config/color`))}}/>{stripName(s,values)}</label>)}</div>
  </div></details>;
}

const tapNames=['Entrée','Avant EQ','Après EQ','Avant fader','Après fader','Sous-groupe'];
export function SignalPath({source,bus,values}:{source:Strip;bus?:Strip;values:Values}){
 const isChannel=source.kind==='ch',usb=isChannel&&values[`${source.prefix}/preamp/rtnsw`]===1;
 const input=values[`${source.prefix}/config/insrc`];
 const origin=isChannel?(usb?'Source USB · REAPER / ordinateur':typeof input==='number'?input<16?`Entrée physique ${input+1}`:'Entrée désactivée':'Entrée physique · source non reçue'):stripName(source,values);
 const tap=bus?values[`${source.prefix}/mix/${pad(Number(bus.id.replace('bus','')))}/tap`]:undefined;
 return <div className="desk-signal" aria-label="Parcours du signal"><span>{origin}</span><b aria-hidden="true">→</b><span>{stripName(source,values)}</span><b aria-hidden="true">→</b>{bus?<><span>{typeof tap==='number'?tapNames[tap]??'Point de prélèvement inconnu':'Point de prélèvement non reçu'}</span><b aria-hidden="true">→</b><span>{stripName(bus,values)} · EQ + compression du retour</span></>:<span>Envois vers retours / façade selon routage</span>}</div>;
}

type Musician={name:string;bus:number;channels:number[]};
export function MonitorDesk({values,set,writable,confirmed}:{values:Values;set:SetFn;writable:boolean;confirmed:ViewProps['confirmed']}){
 const {BUSES,INPUTS,model}=useAirStrips();
 const buses=BUSES.slice(0,model.monitorOutputs);
 const [selected,setSelected]=useState(1),[musicians,setMusicians]=useState<Musician[]>([]),[page,setPage]=useState<'mix'|'eq'|'comp'>('mix');
 const [profileError,setProfileError]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/coach').then(async r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(active)setMusicians(Array.isArray(d.profile?.musicians)?d.profile.musicians:[]);}).catch(()=>{if(active)setProfileError(true);});return()=>{active=false;};},[model.id]);
 const bus=buses.find(b=>b.id===`bus${selected}`)??buses[0];
 if(!bus)return null;
 const number=Number(bus.id.replace('bus','')),musician=musicians.find(m=>m.bus===number);
 const title=(n:number)=>musicians.find(m=>m.bus===n)?.name||stripName(BUSES[n-1]!,values);
 const props:ViewProps={strip:bus,values,set,canWrite:writable,confirmed,open:()=>undefined};
 return <section className="monitor-desk" aria-label="Régie des retours">
  <header><div><small>RÉGIE DES RETOURS</small><h2>Les retours du groupe</h2><p>Choisis un musicien : ses envois et les traitements de son bus sont réunis ici.</p></div><span className="desk-readonly">{writable?'Contrôle actif':'Lecture seule'}</span></header>
  {profileError&&<p role="status">Les noms du coach sont indisponibles. Les noms et réglages des bus restent accessibles.</p>}
  <div className="monitor-people" role="group" aria-label="Choisir le retour">{buses.map((b,i)=><button type="button" key={b.id} aria-pressed={number===i+1} onClick={()=>setSelected(i+1)}><b>{title(i+1)}</b><small>Aux {i+1} · EQ {values[`${b.prefix}/eq/on`]===1?'ON':'OFF / ?'} · Comp {values[`${b.prefix}/dyn/on`]===1?'ON':'OFF / ?'}</small><Meter indexes={b.meters}/></button>)}</div>
  <div className="monitor-target"><div><h3>Retour de {title(number)}</h3><span>Bus {number} · sortie à vérifier dans Routage · {formatDb(faderToDb(num(values,`${bus.prefix}/mix/fader`)))} dB</span></div><label>Volume de ce retour<input type="range" min="0" max="1" step=".005" aria-label={`Volume du retour ${title(number)}`} disabled={!writable} value={num(values,`${bus.prefix}/mix/fader`)} onChange={e=>set(`${bus.prefix}/mix/fader`,Number(e.target.value))}/></label><button type="button" disabled={!writable} aria-pressed={num(values,`${bus.prefix}/mix/on`,1)===0} onClick={()=>set(`${bus.prefix}/mix/on`,num(values,`${bus.prefix}/mix/on`,1)?0:1)}>Couper ce retour</button></div>
  <nav className="monitor-tabs" aria-label="Réglages du retour">{([['mix','Mix personnel'],['eq','Égaliseur du retour'],['comp','Compression du retour']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={page===id} onClick={()=>setPage(id)}>{label}</button>)}</nav>
  {page==='mix'&&<><p>Les faders ci-dessous règlent uniquement les envois vers <strong>{title(number)}</strong>. Les traitements des pistes restent accessibles dans Canal.</p><div className="monitor-sends">{INPUTS.map(s=>{const address=`${s.prefix}/mix/${pad(number)}/level`,own=s.kind==='ch'&&musician?.channels.includes(Number(s.short));return <div className={`monitor-source${own?' own':''}`} key={s.id}><b>{stripName(s,values)}</b><small>{own?'Son instrument':s.kind==='fxrtn'?'Retour d’effet':s.kind==='aux'?'Entrée auxiliaire':'Instrument / micro'}</small><Fader label={`${stripName(s,values)} vers ${title(number)}`} value={num(values,address)} disabled={!writable} onChange={v=>set(address,v)}/><output>{formatDb(faderToDb(num(values,address)))} dB</output></div>;})}</div></>}
  {page==='eq'&&<><p>Cette égalisation agit sur tout le mix de {title(number)}. Elle ne modifie pas les EQ des instruments ni ceux des autres bus.</p><div className="xm monitor-processing"><EqView key={bus.id} {...props}/></div></>}
  {page==='comp'&&<><p>Cette compression agit sur tout ce retour. Une forte réduction peut faire reculer la voix à chaque coup de grosse caisse.</p><div className="xm monitor-processing"><VisualCompressor key={bus.id} {...props}/></div></>}
  <details className="monitor-route"><summary>Comprendre le trajet vers ce retour</summary>{INPUTS.filter(s=>s.kind==='ch').map(s=><SignalPath key={s.id} source={s} bus={bus} values={values}/>)}</details>
 </section>;
}
