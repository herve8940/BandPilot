import {FineFaders} from '../xair/meter-preferences';
import {DeskFinder,type DeskDestination} from './DeskFinder';
import {GainFader,useGainFaders} from './GainFaders';
import {SurfaceEditor} from './SurfaceEditor';
import {ExpertViewLink} from './ExpertViewLink';
import {GainCompensationPanel,RoomEqPanel} from './MixPreparation';
import {BatchEdit} from './BatchEdit';
import {QuickGang,useParameterLinks} from './parameter-links';
import {GroupStrip,useBankGroups} from './GroupStrips';
import {ConsoleCommands} from './ConsoleCommands';
import {MidiControls} from './MidiControls';
import {ChannelPresetActions} from "../ChannelPresetActions";
import {useGroupSpill,GroupSpillNotice} from './group-spill';
import {GroupedAdjustments} from '../GroupedAdjustments';
import {tx, getLocale} from "../i18n";
import {useAirStrips} from '../xair/model-strips';
import { Search, Drum, Guitar, Piano, MicVocal, Headphones, Sparkles, SlidersHorizontal, Music2, Speaker } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Fader, Meter, Knob, compCurve, transferPoints, num, pad, useLiveMixer, useMeters, meterStore, readEq, eqResponse, type Values, type SetFn, type Value } from "../xair/controls";
import { gainControl, faderAddress, onAddress, soloAddress, stripName, type Strip } from "../xair/strips";
import { CompView, EqView, FxView, GateView, InputView, MainView, MeterView, RoutingView, SendsView, type ViewProps } from "../xair/views";
import { faderToDb, formatDb, logMap, RATIOS, stripColor } from "../xairMath";
import { AnalysisView } from "./AnalysisView";
import { RecordingView } from "./RecordingView";
import { RecordingDock } from "./RecordingDock";
import {VisualCompressor} from "./DynamicsControls";
import {DeskLayoutTools, SignalPath, useDeskLayout} from "./Workspace";
import "../xair-mixer.css";
import "./expert.css";
import "./expert-v3.css";

type View = "meters" | "midi" | "console" | "channel" | "fx" | "routing" | "analysis" | "recording" | "surface";
const VIEWS: { id: View; label: string }[] = [
  { id:"console",label:"Mélangeur" }, { id:"channel",label:"Canal" }, { id:"surface",label:"Surfaces" },
  { id:"meters",label:"Vumètres" }, { id:"fx",label:"Effets" }, { id:"routing",label:"Routage" }, { id:"analysis",label:"Analyse" },
  { id:"recording",label:"Enregistrement" }, { id:"midi",label:"MIDI" },
];
async function api<T = any>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(path, { method: data === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const v = await r.json().catch(() => ({})); if (!r.ok) throw Error(v.error ?? "Erreur"); return v as T;
}
const dbText = (wire: number) => formatDb(faderToDb(wire)).replace("-", "−");
const busName = (values: Values, b: number) => { const n = values[`/bus/${b}/config/name`]; return typeof n === "string" && n.trim() ? n.trim() : `Bus ${b}`; };
const earsLabel = (values: Values, b: number) => { const n = values[`/bus/${b}/config/name`]; return typeof n === "string" && n.trim() ? n.trim() : `Retour ${b}`; };

/** Small EQ curve of a strip (high-pass included), drawn on 60×26. */
function eqPath(values: Values, prefix: string) {
  if([1,2].includes(Number(values[`${prefix}/eq/mode`])))return "";
  if (!values[`${prefix}/eq/1/f`] && values[`${prefix}/eq/1/f`] !== 0) return "M0 13 H60";
  const bands = readEq(values, prefix, 4), on = num(values, `${prefix}/eq/on`, 1) === 1;
  const hp = num(values, `${prefix}/preamp/hpon`) === 1 ? logMap(num(values, `${prefix}/preamp/hpf`), 20, 400) : undefined;
  let d = "";
  for (let x = 0; x <= 60; x += 2) { const f = 20 * Math.pow(1000, x / 60); const y = Math.max(1, Math.min(25, 13 - eqResponse(bands, f, on, hp) * 0.7)); d += `${x ? "L" : "M"}${x} ${y.toFixed(1)} `; }
  return d;
}

export function ExpertStudio({ canWrite, initialStrip, selectedChannel, onSelectChannel, simulation = false }: { initialStrip?:string; simulation?: boolean; canWrite: boolean; selectedChannel?: number; onSelectChannel?: (n: number) => void }) {
  const {ALL,MAIN,OUTPUTS,INPUTS,BUSES,FXSENDS,model}=useAirStrips();
  const live = useLiveMixer();
  const { values, set:setDirect, confirmed, online, message, messageKind, clearMessage } = live;
  const [view, setView] = useState<View>(() => { try { return VIEWS.find(v=>v.id===localStorage.getItem("xr18-expert-view"))?.id || "channel"; } catch { return "channel"; } });
  const [selectedId, setSelectedId] = useState(initialStrip ?? (selectedChannel ? `ch${selectedChannel}` : "ch1"));
  const [rehearsal, setRehearsal] = useState(false), [recoCount, setRecoCount] = useState(0), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const spill=useGroupSpill(`${model.id}:${simulation}:${view}`);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabsRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const nav=tabsRef.current;
    const tab=nav?.querySelector<HTMLElement>('[aria-current=page]');
    if(!nav||!tab)return;
    const reveal=()=>{
      const bounds=nav.getBoundingClientRect(),selected=tab.getBoundingClientRect();
      if(selected.left<bounds.left)nav.scrollLeft+=selected.left-bounds.left;
      else if(selected.right>bounds.right)nav.scrollLeft+=selected.right-bounds.right;
    };
    reveal();
    if(typeof ResizeObserver==="undefined")return;
    const observer=new ResizeObserver(reveal);observer.observe(nav);
    return ()=>observer.disconnect();
  },[view]);
  const writable = canWrite && online;
  const links=useParameterLinks();
  const set=setDirect;
  const strip = ALL.find(s => s.id === selectedId) ?? INPUTS[0]!;
  const go = (v: View) => { setView(v); bodyRef.current?.scrollTo({ top: 0, left: 0 }); try { localStorage.setItem("xr18-expert-view", v); } catch { /* convenience only */ } };
  useEffect(()=>{const open=()=>go("midi");window.addEventListener("bandpilot-open-midi",open);return()=>window.removeEventListener("bandpilot-open-midi",open);},[]);
  const select = (s: Strip) => { setSelectedId(s.id); if (s.kind === "ch") onSelectChannel?.(Number(s.short)); };
  const previousInput=useRef(selectedChannel);
  useEffect(() => {if(selectedChannel&&previousInput.current!==selectedChannel)setSelectedId(`ch${selectedChannel}`);previousInput.current=selectedChannel;}, [selectedChannel]);
  useEffect(() => { void api<{ on: boolean }>("/api/rehearsal").then(r => setRehearsal(r.on)).catch(() => undefined); }, []);
  useEffect(() => { const t = setInterval(() => { void api<{ recommendations: unknown[] }>("/api/analysis").then(a => setRecoCount(a.recommendations.length)).catch(() => undefined); }, 5000); return () => clearInterval(t); }, []);
  const toggleRehearsal = async () => {
    const next = !rehearsal;
    if (!confirm(tx(next ? "Passer en Ears seulement ? Le Main (façade) est coupé et reste coupé : on ne travaille que les ears des musiciens." : "Quitter Ears seulement ? Le Main reste coupé tant que tu ne le rallumes pas toi-même."))) return;
    try { const r = await api<{ on: boolean }>("/api/rehearsal", { on: next }); setRehearsal(r.on); setNotice(r.on ? "Ears seulement : Main coupé, analyse sur les ears." : "Ears seulement quitté."); } catch (e) { setError((e as Error).message); }
  };
  const props: ViewProps = { strip, values, set, canWrite: writable, confirmed, open: (s) => { select(s); go("channel"); } };

  const [manualLayer,setLayer]=useState(0),[groupsOnly,setGroupsOnly]=useState(false);
  const [processor,setProcessor]=useState<Step>("comp");
  const [finding,setFinding]=useState(false);
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"&&!event.altKey&&!event.shiftKey&&!event.repeat&&!document.querySelector("dialog[open]")){
        event.preventDefault();setFinding(true);
      }
    };
    window.addEventListener("keydown",shortcut);
    return ()=>window.removeEventListener("keydown",shortcut);
  },[]);
  const inspect=(s:Strip,step?:Step)=>{
    select(s);
    if(step)setProcessor(step);
    go("channel");
  };
  const destinations=():DeskDestination[]=>{
    const views=VIEWS.map(v=>({id:v.id,label:tx(v.label),context:tx("Mode Expert"),terms:"",open:()=>go(v.id)}));
    const ordered=[strip,...ALL.filter(s=>s.id!==strip.id)];
    return [...views,...ordered.flatMap(s=>{
      const name=stripName(s,values), channel=tx(s.short);
      return [{id:s.id,label:name,context:channel,terms:s.id,open:()=>inspect(s)},...PROCESSORS.filter(p=>available(p.id,s)).map(p=>({
        id:s.id+"-"+p.id,label:tx(p.name),context:channel+" · "+name,terms:s.id+" "+p.id,open:()=>inspect(s,p.id)
      }))];
    })];
  };
  const channelProps = { ...props, canWrite: writable && !(rehearsal && strip.kind === "lr") };

  return <section className="xs2 xs3 xs-expert-desk" aria-label={tx("Mode Expert")}>
    <header className="xs2-head">
      <nav ref={tabsRef} className="xs2-tabs" aria-label={tx("Vues du mode Expert")}>
        {VIEWS.map(v => <button key={v.id} type="button" className={view === v.id ? "on" : ""} aria-current={view === v.id ? "page" : undefined} onClick={() => go(v.id)}>
          {tx(v.label)}{v.id === "analysis" && recoCount > 0 && <span className="xs2-badge">{tx(recoCount)}</span>}
        </button>)}
      </nav>
      <button className="desk-find-button" type="button" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" onClick={()=>setFinding(true)}><Search size={15}/>{tx("Accès direct")}<kbd>{/Mac/i.test(navigator.platform)?"⌘":"Ctrl"} K</kbd></button>
      <div className="xs2-spacer" />
      <button type="button" className={`xs2-pill ${rehearsal ? "rehearsal" : "foh"}`} onClick={() => void toggleRehearsal()} disabled={!canWrite} title={tx("En Ears seulement, le Main est coupé et verrouillé : on ne règle que les ears")}>
        {rehearsal ? <><Lock />{tx(" Ears seulement · Main coupé")}</> : tx("Façade active")}
      </button>
      <span className={`xs2-pill ${online ? "live" : "off"}`}><span className="xs2-dot" />{tx(online ? (simulation ? "Simulation modifiable" : writable ? "Contrôle actif" : "Lecture seule") : "Hors ligne")}</span>
    </header>
    {finding&&<DeskFinder destinations={destinations()} onClose={()=>setFinding(false)}/>}
    {(message || notice || error) && <div className={`xs2-msg ${error ? 'error' : message ? messageKind : ''}`} role={error || (message && messageKind === 'error') ? 'alert' : 'status'}>{tx(error || message || notice)}<button type="button" aria-label={tx("Fermer")} onClick={() => { clearMessage(); setNotice(""); setError(""); }}>{tx("×")}</button></div>}
    {view === "channel" && <ChannelRail strip={strip} values={values} select={select} />}
    <div className="xs2-body" ref={bodyRef}>
      {view === "console" && <ConsoleView manualLayer={manualLayer} setLayer={setLayer} groupsOnly={groupsOnly} setGroupsOnly={setGroupsOnly} mode={simulation?'simulation':'real'} spill={spill} values={values} set={set} writable={writable} rehearsal={rehearsal} strip={strip} select={select} inspect={inspect} />}
      {view==="channel"&&strip.kind==="ch"&&<QuickGang key={strip.id} channel={Number(strip.short)} strips={INPUTS.filter(s=>s.kind==="ch").map(s=>({id:s.id,number:Number(s.short),name:stripName(s,values)}))}/>}
      {view === "channel" && <FocusedChannel {...channelProps} select={select} step={processor} setStep={setProcessor} />}

      {view==='midi'&&<MidiControls values={values} set={set} canWrite={writable} openInitially mode={simulation?'simulation':'real'}/>}
      {view==='console'&&<ConsoleCommands key={`commands:${model.id}:${simulation}`} canWrite={writable} mode={simulation?'simulation':'real'}/>}
      {view==='console'&&<GroupedAdjustments key={`${model.id}:${simulation}`} model={model.id} canWrite={writable} mode={simulation?'simulation':'real'} onSpill={spill.show}/>}
      {view==='console'&&links&&<BatchEdit key={model.id} model={model} values={values} writable={writable&&links.canWrite&&!links.busy} mode={simulation?'simulation':'real'} links={links.links} onLinks={links.save}/>}

      {(view === "channel" || view === "console") && strip.kind === "ch" && <ChannelPresetActions key={`presets:${model.id}:${strip.id}:${simulation}`} channel={Number(strip.short)} name={stripName(strip,values)} model={model.id} online={online} canWrite={writable} mode={simulation?'simulation':'real'}/>}
      {(view==='channel'||view==='console')&&strip.kind==='ch'&&<GainCompensationPanel key={`gain:${model.id}:${strip.id}:${simulation}`} model={model.id} channel={Number(strip.short)} canWrite={writable} mode={simulation?'simulation':'real'}/>}
      {view==='analysis'&&<RoomEqPanel key={`${model.id}:${simulation}`} model={model.id} outputs={model.monitorOutputs} canWrite={writable} mode={simulation?'simulation':'real'}/>}
      {view === "surface" && <SurfaceEditor mode={simulation?'simulation':'real'} key={model.id} values={values} set={setDirect} canWrite={writable} rehearsal={rehearsal} openChannel={s=>props.open(s,'channel')}/> }
      {view === "console" && <ChannelPage {...channelProps} select={select} />}

      {view === "meters" && <div className="xm meter-bridge"><MeterView values={values} onInspect={s=>inspect(s)}/></div>}
      {view === "fx" && <div className="xm xs2-legacy"><FxView {...props} /></div>}
      {view === "routing" && <RoutingPage {...props} />}
      {view === "analysis" && <AnalysisView values={values} rehearsal={rehearsal} canWrite={writable} onCount={setRecoCount} />}
      {view === "recording" && <RecordingView />}
      <ExpertViewLink view={view} channel={strip.kind==='ch'?Number(strip.short):selectedChannel??1} scope={`${model.id}:${simulation}`}
        onReceive={({view,channel},channelOnly)=>{
          if(channel>=1&&channel<=model.channels){setSelectedId(`ch${channel}`);onSelectChannel?.(channel);}
          if(!channelOnly)setView(view);
        }}/>
    </div>
    {view !== "recording" && <RecordingDock open={() => go("recording")} />}
  </section>;
}

function Lock() { return <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>; }

// ---------------- Console ----------------
function ConsoleView({ manualLayer,setLayer,groupsOnly,setGroupsOnly,mode, spill, values, set, writable, rehearsal, strip, select, inspect }: {manualLayer:number;setLayer:(n:number)=>void;groupsOnly:boolean;setGroupsOnly:(on:boolean)=>void;inspect:(strip:Strip,step:Step)=>void;mode:'real'|'simulation';spill:ReturnType<typeof useGroupSpill>;values: Values; set: SetFn; writable: boolean; rehearsal: boolean; strip: Strip; select: (s: Strip) => void }) {
  const {ALL,MAIN,OUTPUTS,INPUTS,BUSES,FXSENDS,model}=useAirStrips();
  const levels=useMeters();
  const groups=useBankGroups(model.id);
  const groupStrips:Strip[]=groups.map(group=>({id:'grp-'+group.id,kind:'dca',prefix:'',short:tx('Groupe'),fallback:group.name,meters:[]}));
  const strips=[...ALL,...groupStrips];
  const used = (s: Strip) => s.kind !== "ch" || stripName(s, values) !== s.fallback || (levels[s.meters[0]!] ?? -128) > -60;
  const desk=useDeskLayout(model.id);
  const customBank=!groupsOnly?desk.layout.banks.find(b=>b.id===desk.layout.activeBank):undefined;
  const bank=customBank?customBank.id:desk.layout.activeBank==='returns'?'returns':'inputs';
  const pinnedLayer=customBank?.mix!==undefined&&customBank.mix<=model.monitorOutputs?customBank.mix:undefined;
  const requestedLayer=pinnedLayer??manualLayer;
  const layer=rehearsal&&requestedLayer===0?1:requestedLayer;
  const gainFaders=useGainFaders(model,values,writable&&!rehearsal,`${mode}:${bank}:${layer}:${groupsOnly}`);
  const setBank=(activeBank:string)=>{setGroupsOnly(false);spill.clear();desk.update({activeBank});};
  const visibleStrips=spill.channels?INPUTS.filter(s=>s.kind==='ch'&&spill.channels!.includes(Number(s.short))):groupsOnly?groupStrips:customBank?customBank.strips.flatMap(id=>strips.find(s=>s.id===id)??[]):INPUTS.filter(s=>(bank==='inputs'?s.kind==='ch':s.kind!=='ch')&&!desk.layout.hidden.includes(s.id));
  const showLayer=(n:number)=>n===layer||!desk.layout.hiddenMixes?.includes(n);
  const showModule=(k:'input'|'eq'|'comp')=>!desk.layout.hiddenModules?.includes(k);
  const color = (s: Strip) => stripColor(num(values, `${s.prefix}/config/color`));
  return <div className={`expert-console density-${desk.layout.density}${gainFaders.active?" gain-faders-active":""}`}>
    <div className="main">
      {spill.channels&&<GroupSpillNotice clear={spill.clear}/>}
      <div className="expert-bankbar"><div role="group" aria-label={tx("Banque de tranches")}><button type="button" aria-pressed={!groupsOnly&&bank === "inputs"} onClick={() => setBank("inputs")}>{tx("Entrées 1–")}{tx(model.channels)}</button><button type="button" aria-pressed={!groupsOnly&&bank === "returns"} onClick={() => setBank("returns")}>{tx("Aux + retours FX")}</button>{groups.length>0&&<button type="button" aria-pressed={groupsOnly} onClick={()=>{spill.clear();setGroupsOnly(true);}}>{tx('Groupes logiciels')}</button>}{desk.layout.banks.map(b=><button type="button" key={b.id} aria-pressed={bank===b.id} onClick={()=>setBank(b.id)}>{b.name}</button>)}</div><button type="button" className="xs2-btn" onClick={() => document.getElementById("expert-channel-parameters")?.scrollIntoView({ block: "start" })}>{tx("Paramètres de ")}{stripName(strip, values)} ↓</button></div>
      <div className="xs2-bar">
        <FineFaders/><span className="label">{tx("Les faders règlent")}</span>
        <button type="button" className={`xs2-chip${gainFaders.active?" on":""}`} aria-pressed={gainFaders.active} disabled={!writable||rehearsal||groupsOnly} onClick={gainFaders.toggle}>{tx("Gains / trims")}</button>
        <button type="button" className={`xs2-chip${layer === 0 ? " on" : ""}${rehearsal ? " locked" : ""}`} disabled={rehearsal||pinnedLayer!==undefined} onClick={() => setLayer(0)} title={tx(rehearsal ? "Main coupé en répétition" : "Le mix de la façade")}>{rehearsal && <Lock />}{tx(" Façade")}</button>
        {BUSES.map((b, i) => showLayer(i+1)&&<button key={b.id} type="button" className={`xs2-chip${layer === i + 1 ? " on" : ""}`} disabled={pinnedLayer!==undefined} onClick={() => setLayer(i + 1)}>{i < model.monitorOutputs ? earsLabel(values, i + 1) : tx(`Bus ${i + 1} interne`)}</button>)}
        {FXSENDS.map((f, i) => showLayer(i+7)&&<button key={f.id} type="button" className={`xs2-chip${layer === i + 7 ? " on" : ""}`} disabled={pinnedLayer!==undefined} onClick={() => setLayer(i + 7)}>{tx("FX ")}{tx(i + 1)}</button>)}
      </div>
      {gainFaders.active&&<p className="gain-fader-notice">{tx("Gains / trims actifs : le niveau à la source change aussi dans les retours et l’enregistrement. Les sorties et les groupes gardent leurs faders de volume.")}</p>}
      <div className={`xs2-strips${customBank ? " expert-custom-strips" : ""}`} role="list" aria-label={tx("Tranches")}>
        {visibleStrips.map(s => {
          const group=groups.find(group=>'grp-'+group.id===s.id);
          if(group)return <GroupStrip key={`${group.id}:${group.revision}:${layer}:${mode}`} group={group} layer={layer} canWrite={writable&&layer<=model.monitorOutputs} mode={mode} onSpill={()=>spill.show(group.channels)}/>;
          const inputStrip=["ch","aux","fxrtn"].includes(s.kind),stripLayer=inputStrip?layer:0,locked=!writable||(rehearsal&&s.kind==="lr");
          const fa = faderAddress(s, stripLayer), oa = onAddress(s), so = soloAddress(s), on = num(values, oa, 1) === 1;
          const gain = gainControl(s, values,model.micPreamps);
          const comp = s.kind === "ch" && num(values, `${s.prefix}/dyn/on`) === 1;
          return <div key={s.id} role="listitem" className={`xs2-strip${s.id === strip.id ? " sel" : ""}${used(s) ? "" : " idle"}`} onClick={() => select(s)}>
            <i className="tag" style={{ background: color(s) }} />
            <button type="button" className="name" onClick={() => { select(s); document.getElementById("expert-channel-parameters")?.scrollIntoView({ block: "start" }); }} title={tx(`Paramètres de ${stripName(s, values)}`)}>{stripName(s, values)}</button>
            <span className="ch">{tx(s.short)}</span>
            {!customBank?.compactStrips&&<>{showModule("input")&&<div className="expert-strip-overview"><span>{tx(gain ? `${gain.label.split(" ")[0]} ${(gain.lo + num(values, gain.address) * (gain.hi - gain.lo)).toFixed(0)} dB` : "—")}</span>{s.kind === "ch" && <span>{tx("Gate ")}{tx(num(values, `${s.prefix}/gate/on`) === 1 ? "ON" : "OFF")}</span>}</div>}
            {showModule("eq")&&available("eq",s)&&<button type="button" className="strip-inspect" aria-label={tx("Égaliseur")+" · "+stripName(s,values)} title={tx("Égaliseur")} onClick={e=>{e.stopPropagation();inspect(s,"eq");}}><svg className="eq" viewBox="0 0 60 26" aria-hidden="true"><path d="M0 13 H60" stroke="#485269"/><path d={eqPath(values,s.prefix)} fill="none" stroke={color(s)} strokeWidth="1.6"/></svg></button>}
            {showModule("comp")&&available("comp",s)&&<button type="button" className="strip-inspect dyn" aria-label={tx("Compresseur")+" · "+stripName(s,values)} title={tx("Compresseur")} onClick={e=>{e.stopPropagation();inspect(s,"comp");}}>Comp · {comp?Number(RATIOS[num(values,`${s.prefix}/dyn/ratio`)])+":1":"—"}</button>}
            </>}<div className={"fz"+(gainFaders.active&&inputStrip?" gain-fader-zone":"")}>{gainFaders.active&&inputStrip?<GainFader strip={s} values={values} model={model} set={set} disabled={locked}/>:<Fader label={tx(`${stripLayer ? "Envoi" : "Fader"} ${stripName(s, values)}`)} value={num(values, fa)} disabled={locked} reset={stripLayer ? 0 : .75} accent={color(s)} onChange={v => set(fa, v)} />}<Meter indexes={s.meters} /></div>
            {!(gainFaders.active&&inputStrip)&&<span className="db">{tx(dbText(num(values, fa)))}</span>}
            <span className="ms">
              <button type="button" className={on ? "" : "mute"} disabled={locked} aria-label={tx(`Mute ${stripName(s, values)}`)} aria-pressed={!on} onClick={e => { e.stopPropagation(); set(oa, on ? 0 : 1); }}>{tx("M")}</button>
              {so && <button type="button" className={values[so] === 1 ? "solo" : ""} disabled={locked} aria-label={tx(`Solo ${stripName(s, values)}`)} aria-pressed={values[so] === 1} onClick={e => { e.stopPropagation(); set(so, values[so] === 1 ? 0 : 1); }}>{tx("S")}</button>}
            </span>
          </div>;
        })}
      </div>
    </div>
    {desk.layout.outputs&&!spill.channels&&<section className="expert-output-bank" aria-label={tx("Faders des sorties et groupes")}>
      <h3>{tx("Sorties et groupes ")}<small>{tx("Bus 1–")}{tx(model.buses)}{tx(" · Départs FX · DCA · Main LR")}</small></h3>
      <div className="xs2-strips expert-output-strips" role="list" aria-label={tx("Sorties et groupes")}>
        {[...OUTPUTS, MAIN].map(output => {
          const address = faderAddress(output, 0), mute = onAddress(output);
          const locked = !writable || (rehearsal && output.kind === "lr");
          return <div role="listitem" key={output.id} className={`xs2-strip${output.id === strip.id ? " sel" : ""}`}>
            <button type="button" className="name" onClick={() => { select(output); document.getElementById("expert-channel-parameters")?.scrollIntoView({ block: "start" }); }} title={tx(`Paramètres de ${stripName(output, values)}`)}>{stripName(output, values)}</button>
            <span className="ch">{tx(output.short)}</span>
            <div className="fz"><Fader label={tx(`Volume sortie ${stripName(output, values)}`)} value={num(values, address)} disabled={locked} reset={.75} onChange={v => set(address, v)} /><Meter indexes={output.meters} /></div>
            <span className="db">{tx(dbText(num(values, address)))}</span>
            <span className="ms"><button type="button" aria-label={tx(`Mute sortie ${stripName(output, values)}`)} disabled={locked} aria-pressed={num(values, mute, 1) === 0} className={num(values, mute, 1) === 0 ? "mute" : ""} onClick={() => set(mute, num(values, mute, 1) === 1 ? 0 : 1)}>{tx("M")}</button></span>
          </div>;
        })}
      </div>
    </section>}
    <DeskLayoutTools strips={INPUTS} allStrips={strips} monitorOutputs={model.monitorOutputs} values={values} desk={desk}/>
    <MidiControls values={values} set={set} canWrite={writable}/>
    {!visibleStrips.length&&<p role="status">{tx("Aucune tranche visible. Utilise « Personnaliser » pour les réafficher.")}</p>}
  </div>;
}

// ---------------- Channel ----------------
type Step = "input" | "gate" | "eq" | "comp" | "sends" | "main";
function ChannelPage(props: ViewProps & { select: (s: Strip) => void }) {
  const {ALL,MAIN,OUTPUTS,INPUTS,BUSES,FXSENDS,model}=useAirStrips();
  const { strip, values, select, set, canWrite } = props;
  const i = ALL.findIndex(s => s.id === strip.id);
  const blocks: { id: Step; title: string; content: ReactNode }[] = [
    { id: "input", title: "Entrée · source, gain et coupe-bas", content: <InputView {...props} /> },
    { id: "gate", title: "Gate · porte de bruit", content: <GateView {...props} /> },
    { id: "eq", title: "Égaliseur", content: <EqView {...props} /> },
    { id: "comp", title: "Compresseur", content: <CompView {...props} /> },
    { id: "sends", title: "Envois · retours et effets", content: <SendsView {...props} /> },
    { id: "main", title: "Sortie · panorama, LR et groupes", content: <MainView {...props} /> },
  ];
  const applicable = blocks.filter(b => available(b.id,strip));
  return <section id="expert-channel-parameters" className="expert-parameters" aria-label={tx(`Tous les paramètres de ${stripName(strip, values)}`)}>
    <div className="expert-parameter-head">
      <div><small>{tx("CANAL SÉLECTIONNÉ · ")}{tx(strip.short)}</small><h2>{stripName(strip, values)}</h2><p>{tx("Tous les traitements ci-dessous. Choisis une tranche pour changer de canal.")}</p></div>
      <div className="expert-selected-level"><label>{tx("Volume de ")}{stripName(strip, values)} · {tx(dbText(num(values, faderAddress(strip, 0))))}{tx(" dB")}<input type="range" min="0" max="1" step=".005" aria-label={tx(`Volume du canal sélectionné ${stripName(strip, values)}`)} value={num(values, faderAddress(strip, 0))} disabled={!canWrite} onChange={e => set(faderAddress(strip, 0), Number(e.target.value))}/></label><button type="button" className="xs2-btn" aria-label={tx("Canal précédent")} disabled={i <= 0} onClick={() => select(ALL[i - 1]!)}>‹</button><button type="button" className="xs2-btn" aria-label={tx("Canal suivant")} disabled={i >= ALL.length - 1} onClick={() => select(ALL[i + 1]!)}>›</button></div>
    </div>
    {strip.kind === "dca" && <p className="muted">{tx("Ce DCA commande le niveau des canaux qui lui sont affectés. Leurs traitements se règlent sur chaque canal.")}</p>}
    <>{["ch","aux","fxrtn"].includes(strip.kind)&&<SignalPath source={strip} values={values}/>}</><nav className="expert-parameter-jumps" aria-label={tx("Accès direct aux traitements")}>{applicable.map(b => <button key={b.id} type="button" onClick={() => document.getElementById(`expert-block-${b.id}`)?.scrollIntoView({ block: "start" })}>{tx(b.title.split(" · ")[0])} ↓</button>)}</nav>
    <div className="expert-parameter-grid">{applicable.map(b => <section key={b.id} id={`expert-block-${b.id}`} className={`expert-parameter-block block-${b.id}`} aria-label={tx(b.title)}><h3>{tx(b.title)}</h3><div className="xm xs2-legacy">{b.content}</div></section>)}</div>
  </section>;
}

// Focused workspace: channel navigation, live strip and processing on one desk.
const PROCESSORS = [
  { id: "input", name: "Préampli", icon: "◉", color: "#41d9ec" },
  { id: "gate", name: "Gate", icon: "⌁", color: "#51e0a6" },
  { id: "comp", name: "Compresseur", icon: "⌁", color: "#b584ff" },
  { id: "eq", name: "Égaliseur", icon: "≋", color: "#5cbcff" },
  { id: "sends", name: "Envois", icon: "↗", color: "#f9c35e" },
  { id: "main", name: "Sortie / groupes", icon: "⑂", color: "#f581b7" },
] as const;
const available = (id: Step, s: Strip) => s.kind === "dca" ? false : id === "input" || id === "sends" ? ["ch", "aux", "fxrtn"].includes(s.kind) : id === "gate" ? s.kind === "ch" : id === "comp" ? ["ch", "bus", "lr"].includes(s.kind) : id === "eq" ? s.kind !== "fxsend" : true;
function sourceIcon(s: Strip, values: Values) {
  const n = stripName(s, values).toLowerCase();
  const Icon = /drum|kick|snare|tom|batt/.test(n) ? Drum : /bass|basse|gtr|guit/.test(n) ? Guitar : /key|piano|clav/.test(n) ? Piano : /vo|chant|mic/.test(n) ? MicVocal : s.kind === "bus" ? Headphones : s.kind === "fxrtn" || s.kind === "fxsend" ? Sparkles : s.kind === "dca" ? SlidersHorizontal : s.kind === "lr" ? Speaker : Music2;
  return <Icon strokeWidth={1.5}/>;
}
function ChannelRail({ strip, values, select }: { strip: Strip; values: Values; select: (s: Strip) => void }) {
  const {ALL,MAIN,OUTPUTS,INPUTS,BUSES,FXSENDS,model}=useAirStrips();
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = railRef.current, selected = rail?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (rail && selected) rail.scrollTo({ left: selected.offsetLeft - rail.offsetLeft - (rail.clientWidth - selected.offsetWidth) / 2 });
  }, [strip.id]);
  const group = strip.kind === "bus" || strip.kind === "lr" ? "bus" : strip.kind === "dca" ? "dca" : strip.kind === "fxsend" || strip.kind === "fxrtn" ? "fx" : "input";
  const groups = [{ id: "input", name: "Canaux", strips: INPUTS.filter(s => s.kind !== "fxrtn") }, { id: "bus", name: "Bus / Main", strips: [...BUSES, MAIN] }, { id: "fx", name: "FX", strips: ALL.filter(s => s.kind === "fxrtn" || s.kind === "fxsend") }, { id: "dca", name: "DCA", strips: ALL.filter(s => s.kind === "dca") }];
  const bank = groups.find(g => g.id === group)!;
  return <div className="visual-channel-nav"><div className="visual-bank-select" role="group" aria-label={tx("Famille de canaux")}>{groups.map(g => <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => select(g.strips[0]!)}>{tx(g.name)}</button>)}</div><div ref={railRef} className="visual-channel-rail" role="tablist" aria-label={tx("Sélection des canaux")}>{bank.strips.map(s => <button key={s.id} type="button" role="tab" aria-selected={s.id === strip.id} title={stripName(s, values)} onClick={() => select(s)}><small>{tx(s.short)}</small><span aria-hidden="true">{tx(sourceIcon(s, values))}</span><b>{stripName(s, values)}</b></button>)}</div></div>;
}
function FocusedChannel(props: ViewProps & { select: (s: Strip) => void; step:Step; setStep:(step:Step)=>void }) {
  const {ALL,MAIN,OUTPUTS,INPUTS,BUSES,FXSENDS,model}=useAirStrips();
  const { strip, values, set, canWrite, select } = props;
  const {step,setStep}=props;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const current = available(step, strip) ? step : PROCESSORS.find(p => available(p.id, strip))?.id;
  useEffect(() => { workspaceRef.current?.closest(".xs2-body")?.scrollTo({ top: 0 }); }, [current, strip.id]);
  const i = ALL.findIndex(s => s.id === strip.id), fader = faderAddress(strip, 0), mute = onAddress(strip), solo = soloAddress(strip);
  const on = num(values, mute, 1) === 1;
  const content = current === "input" ? <InputView {...props}/> : current === "gate" ? <GateView {...props}/> : current === "comp" ? <VisualCompressor {...props}/> : current === "eq" ? <EqView {...props}/> : current === "sends" ? <SendsView {...props}/> : current === "main" ? <MainView {...props}/> : <p>{tx("Ce DCA règle le niveau des canaux qui lui sont affectés. Sélectionne un canal pour éditer ses traitements.")}</p>;
  return <div className="visual-workspace" ref={workspaceRef}>
    <aside className="visual-selected" aria-label={tx(`Tranche sélectionnée ${stripName(strip, values)}`)}>
      <div className="visual-source-art" aria-hidden="true">{tx(sourceIcon(strip, values))}</div>
      <div className="visual-channel-title"><button type="button" aria-label={tx("Canal précédent")} disabled={i <= 0} onClick={() => select(ALL[i - 1]!)}>‹</button><strong>{tx(strip.short)} · {stripName(strip, values)}</strong><button type="button" aria-label={tx("Canal suivant")} disabled={i >= ALL.length - 1} onClick={() => select(ALL[i + 1]!)}>›</button></div>
      <div className="visual-ms"><button type="button" disabled={!canWrite} className={!on ? "muted" : ""} aria-pressed={!on} onClick={() => set(mute, on ? 0 : 1)}>{tx("◀ Mute")}</button>{solo && <button type="button" disabled={!canWrite} className={values[solo] === 1 ? "solo" : ""} aria-pressed={values[solo] === 1} onClick={() => set(solo, values[solo] === 1 ? 0 : 1)}>{tx("♫ Solo")}</button>}</div>
      <output className="visual-db">{tx(dbText(num(values, fader)))}{tx(" dB")}</output>
      <div className="visual-fader"><Meter indexes={strip.meters}/><Fader label={tx(`Volume ${stripName(strip, values)}`)} value={num(values, fader)} disabled={!canWrite} reset={.75} accent="#a87fff" onChange={v => set(fader, v)}/><div className="visual-fader-scale" aria-hidden="true">{["+10", "+5", "0", "−5", "−10", "−20", "−30", "−∞"].map(t => <span key={t}>{tx(t)}</span>)}</div></div>
      <label className="visual-mobile-level">{tx("Volume")}<input type="range" aria-label={tx(`Volume compact ${stripName(strip, values)}`)} min="0" max="1" step=".005" value={num(values, fader)} disabled={!canWrite} onChange={e => set(fader, Number(e.target.value))}/></label>
      {!["dca", "fxsend"].includes(strip.kind) && <div className="xm visual-pan"><Knob label={tx("Panorama")} value={num(values, `${strip.prefix}/mix/pan`, .5)} reset={.5} bipolar display={`${Math.round((num(values, `${strip.prefix}/mix/pan`, .5) - .5) * 200)}`} disabled={!canWrite} onChange={v => set(`${strip.prefix}/mix/pan`, v)}/></div>}
    </aside>
    <div className="visual-processing">
      <nav className="visual-process-tabs" aria-label={tx("Traitements du canal")}>{PROCESSORS.filter(p => available(p.id, strip)).map(p => <button key={p.id} type="button" aria-pressed={current === p.id} style={{ "--process-color": p.color } as React.CSSProperties} onClick={() => setStep(p.id)}><span aria-hidden="true">{tx(p.icon)}</span>{tx(p.name)}<i className={num(values, `${strip.prefix}/${p.id === "comp" ? "dyn" : p.id}/on`) === 1 ? "lit" : ""}/></button>)}</nav>
      <section className={`visual-processor processor-${current}`} aria-label={tx(PROCESSORS.find(p => p.id === current)?.name ?? "DCA")}><div className="xm xs2-legacy">{content}</div></section>
      {available("eq", strip) && current !== "eq" && <EqOverview strip={strip} values={values} open={() => setStep("eq")}/>}
    </div>
  </div>;
}
function EqOverview({ strip, values, open }: { strip: Strip; values: Values; open: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 110 });
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver(entries => { const r = entries[0]?.contentRect; if (r && r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height }); });
    observer.observe(svgRef.current); return () => observer.disconnect();
  }, []);
  if([1,2].includes(Number(values[`${strip.prefix}/eq/mode`])))return <section className="visual-eq-overview"><header><b>{tx('Égaliseur graphique de sortie')}</b><button type="button" onClick={open}>{tx('Ouvrir EQ ↗')}</button></header></section>;
  const { w, h } = size, plotH = Math.max(20, h - 20), zero = plotH / 2;
  const xOf = (f: number) => Math.log(f / 20) / Math.log(1000) * w;
  const yOf = (db: number) => zero - Math.max(-18, Math.min(18, db)) / 18 * zero;
  const bands = readEq(values, strip.prefix, strip.kind === "bus" || strip.kind === "lr" ? 6 : 4);
  const on = num(values, `${strip.prefix}/eq/on`, 1) === 1;
  const hp = strip.kind === "ch" && num(values, `${strip.prefix}/preamp/hpon`) === 1 ? logMap(num(values, `${strip.prefix}/preamp/hpf`), 20, 400) : undefined;
  const colors = ["#b277ff", "#26d8f2", "#43ee8b", "#ffc54e", "#fa5887", "#5ba7ff"];
  const points = Array.from({ length: 201 }, (_, i) => `${i / 200 * w},${yOf(eqResponse(bands, 20 * Math.pow(1000, i / 200), on, hp))}`).join(" ");
  return <section className="visual-eq-overview" aria-label={tx("Aperçu de l’égaliseur")}><header><b>{tx("Égaliseur ")}<small>· {tx(on ? "actif" : "désactivé")}</small></b><button type="button" onClick={open}>{tx("Ouvrir EQ ↗")}</button></header><svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={tx("Courbe de réponse de l’égaliseur")}><defs><linearGradient id="visual-eq-spectrum">{colors.map((c, i) => <stop key={c} offset={`${i * 20}%`} stopColor={c}/>)}</linearGradient></defs>{[-12,-6,0,6,12].map(db => <line key={db} x1="0" x2={w} y1={yOf(db)} y2={yOf(db)} stroke="#33415c"/>)}{(w < 500 ? [20,100,1000,10000,20000] : [20,50,100,200,500,1000,2000,5000,10000,20000]).map(f => { const x = xOf(f); return <g key={f}><line x1={x} x2={x} y1="0" y2={plotH} stroke="#33415c"/><text x={Math.min(w - 18, Math.max(18, x))} y={h - 3} textAnchor="middle">{tx(f >= 1000 ? `${f / 1000}k` : f)}</text></g>; })}<polygon points={`0,${zero} ${points} ${w},${zero}`} fill="url(#visual-eq-spectrum)" opacity=".22"/><polyline points={points} fill="none" stroke="url(#visual-eq-spectrum)" strokeWidth="2"/>{bands.map((b, i) => <g key={i}><circle cx={xOf(b.f)} cy={yOf(b.type === 0 || b.type === 5 ? 0 : b.g)} r="8" fill={colors[i]}/><text x={xOf(b.f)} y={yOf(b.type === 0 || b.type === 5 ? 0 : b.g) + 4} textAnchor="middle" className="eq-number">{tx(i + 1)}</text></g>)}</svg></section>;
}
// ---------------- Routing ----------------
function RoutingPage(props: ViewProps) {
  const { values, canWrite, confirmed } = props;
  const usb = useMemo(() => Array.from({ length: 16 }, (_, i) => num(values, `/ch/${pad(i + 1)}/preamp/rtnsw`) === 1).filter(Boolean).length, [values]);
  const virtual = (on: boolean) => {
    const v: Record<string, Value> = {}; for (let c = 1; c <= 16; c++) v[`/ch/${pad(c)}/preamp/rtnsw`] = on ? 1 : 0;
    void confirmed(v, on ? "Passer les 16 canaux sur les pistes USB ? Chaque canal écoute l’enregistrement au lieu du micro (balance virtuelle)." : "Revenir aux micros sur les 16 canaux ?");
  };
  return <div className="xs2-split">
    <div className="main"><div className="xm xs2-legacy"><RoutingView {...props} /></div></div>
    <div className="side">
      <div className="xs2-card" style={{ background: "#0F1E1E", borderColor: "#1D4A4A" }}>
        <h3>{tx("Balance virtuelle ")}{usb ? <span className="xs2-badge" style={{ background: "#3EE0E0" }}>{tx(usb)}{tx(" USB")}</span> : null}</h3>
        <div style={{ color: "#B9E6E6", marginBottom: 10 }}>{tx("Chaque canal écoute la piste USB enregistrée (REAPER) au lieu du micro : on rejoue la répète et on peaufine le son sans les musiciens.")}</div>
        {usb ? <button type="button" className="xs2-btn" disabled={!canWrite} onClick={() => virtual(false)}>{tx("Revenir aux micros…")}</button> : <button type="button" className="xs2-btn primary" disabled={!canWrite} onClick={() => virtual(true)}>{tx("Passer les 16 canaux sur USB…")}</button>}
      </div>
    </div>
  </div>;
}
