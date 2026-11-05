import {tx, getLocale} from "./i18n";
import { useEffect, useRef, useState } from "react";
import { faderToDb, formatDb, stripColor, stripInverted } from "./xairMath";
import { HELP, STRIP_HELP } from "./xairHelp";
import { Fader, HelpPanel, Meter, num, pad, ScaledMeter, Toggle, useLiveMixer, usePersistentFlag, type SetFn, type Values } from "./xair/controls";
import { ALL, BUSES, DCAS, faderAddress, FXSENDS, INPUTS, isInput, layerMaster, MAIN, onAddress, OUTPUTS, soloAddress, stripName, type Strip } from "./xair/strips";
import { ChannelView, CompView, EqView, FxView, GateView, InputView, MainView, MeterView, MixerView, RoutingView, SendsView, type Tab, type ViewProps } from "./xair/views";
import "./xair-mixer.css";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "mixer", label: "Mixer", icon: "▥" }, { id: "channel", label: "Canal", icon: "⫼" }, { id: "input", label: "Entrée", icon: "⇥" },
  { id: "gate", label: "Gate", icon: "⌐" }, { id: "eq", label: "EQ", icon: "∿" }, { id: "comp", label: "Comp", icon: "⌒" },
  { id: "sends", label: "Envois", icon: "⇉" }, { id: "main", label: "Main", icon: "LR" }, { id: "fx", label: "Effets", icon: "✺" },
  { id: "routing", label: "Routage", icon: "⇄" }, { id: "meter", label: "Vumètres", icon: "▮" },
];

function BankStrip({ strip, values, set, layer, selected, onSelect, canWrite, master }: { strip: Strip; values: Values; set: SetFn; layer: number; selected: boolean; onSelect: () => void; canWrite: boolean; master?: boolean }) {
  const fAddr = faderAddress(strip, master ? 0 : layer), oAddr = onAddress(strip), solo = soloAddress(strip);
  const fader = num(values, fAddr), on = num(values, oAddr, 1) === 1, color = num(values, `${strip.prefix}/config/color`);
  const name = stripName(strip, values), sendLayer = !master && isInput(strip) && layer > 0;
  return <div className={`xm-strip${selected ? " selected" : ""}${master ? " master" : ""}`} style={{ "--strip": stripColor(color) } as React.CSSProperties}>
    <button type="button" className={`xm-scribble${stripInverted(color) ? " inverted" : ""}`} onClick={onSelect} title={tx(`${name} — cliquer pour sélectionner`)}>{name}</button>
    {solo ? <Toggle tone="yellow" disabled={!canWrite} on={values[solo] === 1} onClick={() => set(solo, values[solo] === 1 ? 0 : 1)} title={tx("Écouter seul au casque")}>{tx("Solo")}</Toggle> : <span className="xm-toggle ghost">{tx("Solo")}</span>}
    <div className={`xm-strip-db${sendLayer ? " send" : ""}`}>{tx(formatDb(faderToDb(fader)))}</div>
    <div className="xm-strip-fader">
      <Fader label={tx(`${sendLayer ? "Envoi" : "Fader"} ${name}`)} value={fader} disabled={!canWrite} reset={sendLayer ? 0 : .75} accent={stripColor(color)} onChange={v => set(fAddr, v)} />
      <Meter indexes={strip.meters} />
    </div>
    <Toggle tone="red" disabled={!canWrite} on={!on} onClick={() => set(oAddr, on ? 0 : 1)} title={tx("Couper le canal")}>{tx("Mute")}</Toggle>
    <span className="xm-strip-num">{tx(strip.short)}</span>
  </div>;
}

export function XAirMixer({ canWrite, selectedChannel, onSelectChannel, initialTab = "mixer" }: { canWrite: boolean; selectedChannel?: number; onSelectChannel?: (n: number) => void; initialTab?: Tab }) {
  const { values, set, confirmed, online, message, clearMessage } = useLiveMixer();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [layer, setLayer] = useState(0);
  const [bank, setBank] = useState<"inputs" | "outputs">("inputs");
  const [spill, setSpill] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState(selectedChannel ? `ch${selectedChannel}` : "ch1");
  const [helpOpen, setHelpOpen] = usePersistentFlag("xr18-help-open", typeof window === "undefined" || window.innerHeight >= 950);
  const bankRef = useRef<HTMLDivElement>(null), overviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selectedChannel) setSelectedId(`ch${selectedChannel}`); }, [selectedChannel]);

  const writable = canWrite && online;
  const strip = ALL.find(s => s.id === selectedId) ?? INPUTS[0]!;
  const select = (s: Strip) => { setSelectedId(s.id); if (s.kind === "ch") onSelectChannel?.(Number(s.short)); };
  const open = (s: Strip, t: Tab) => { select(s); setTab(t); };
  const bankStrips = (bank === "inputs" ? INPUTS : OUTPUTS).filter(s => spill === null || s.kind === "dca" || (num(values, `${s.prefix}/grp/dca`) >> spill & 1) === 1);
  const masterStrip = bank === "inputs" ? layerMaster(layer) : MAIN;
  const anySolo = Array.from({ length: 16 }, (_, i) => values[`/-stat/solosw/${pad(i + 1)}`] === 1).some(Boolean);
  const viewProps: ViewProps = { strip, values, set, canWrite: writable, confirmed, open };
  const fullWidth = tab === "mixer" || tab === "meter" || tab === "routing" || tab === "fx";
  const view = tab === "mixer" ? <MixerView {...viewProps} strips={bankStrips} /> : tab === "channel" ? <ChannelView {...viewProps} /> : tab === "input" ? <InputView {...viewProps} />
    : tab === "gate" ? <GateView {...viewProps} /> : tab === "eq" ? <EqView key={strip.id} {...viewProps} /> : tab === "comp" ? <CompView {...viewProps} /> : tab === "sends" ? <SendsView {...viewProps} />
    : tab === "main" ? <MainView {...viewProps} /> : tab === "fx" ? <FxView {...viewProps} /> : tab === "routing" ? <RoutingView {...viewProps} /> : <MeterView />;

  // Keep the overview columns aligned with the fader bank while scrolling horizontally.
  const syncScroll = (from: HTMLDivElement | null, to: HTMLDivElement | null) => { if (from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft; };

  return <section className="xm">
    <nav className="xm-tabs" aria-label={tx("Vues de la console")}>
      {TABS.map(t => <button key={t.id} type="button" className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}><span aria-hidden="true">{tx(t.icon)}</span>{tx(t.label)}</button>)}
      <span className={online ? (writable ? "xm-status ok" : "xm-status ro") : "xm-status"}>{tx(online ? (writable ? "● Contrôle direct" : "● Lecture seule") : "● Hors ligne")}</span>
    </nav>
    {message && <div className="xm-error" role="status">{tx(message)}<button type="button" onClick={clearMessage} aria-label={tx("Fermer")}>{tx("×")}</button></div>}

    <div className={`xm-body tab-${tab}${helpOpen ? " help-open" : ""}`}>
    <div className="xm-top">
      {!fullWidth && <div className="xm-top-side">
        <button type="button" className={`xm-sel-name${stripInverted(num(values, `${strip.prefix}/config/color`)) ? "" : " inverted"}`} style={{ "--strip": stripColor(num(values, `${strip.prefix}/config/color`)) } as React.CSSProperties}>{stripName(strip, values)}</button>
        <ScaledMeter indexes={strip.meters} label={tx(strip.short)} />
      </div>}
      <div className={tab === "mixer" ? "xm-view flush" : "xm-view"} ref={tab === "mixer" ? overviewRef : undefined} onScroll={tab === "mixer" ? () => syncScroll(overviewRef.current, bankRef.current) : undefined}>{tx(view)}</div>
      {!fullWidth && <div className="xm-top-side"><ScaledMeter indexes={masterStrip.meters} label={tx(masterStrip.short)} /></div>}
    </div>
    <HelpPanel page={HELP[tab]!} open={helpOpen} onToggle={() => setHelpOpen(!helpOpen)} />

      <div className="xm-bank" ref={bankRef} onScroll={() => syncScroll(bankRef.current, overviewRef.current)}>
        {bankStrips.map(s => <BankStrip key={s.id} strip={s} values={values} set={set} layer={bank === "inputs" ? layer : 0} selected={s.id === strip.id} onSelect={() => select(s)} canWrite={writable} />)}
      </div>
      <div className="xm-controls">
      <aside className="xm-side">
        <div className="xm-side-group">
          <h6>{tx("Faders du bas")}</h6>
          <div className="xm-seg"><button type="button" className={bank === "inputs" ? "active" : ""} onClick={() => setBank("inputs")}>{tx("Entrées")}</button><button type="button" className={bank === "outputs" ? "active" : ""} onClick={() => { setBank("outputs"); setSpill(null); }}>{tx("Sorties")}</button></div>
        </div>
        {bank === "inputs" && <div className="xm-side-group">
          <h6 title={tx("Choisir quel mix les faders règlent (façade ou retour d’un musicien)")}>{tx("Mix sur les faders")}</h6>
          <button type="button" className={layer === 0 ? "xm-layer main active" : "xm-layer main"} onClick={() => setLayer(0)}>{tx("Main LR")}</button>
          <div className="xm-layer-grid">
            {BUSES.map((b, i) => <button key={b.id} type="button" className={layer === i + 1 ? "xm-layer active" : "xm-layer"} style={{ "--strip": stripColor(num(values, `${b.prefix}/config/color`)) } as React.CSSProperties} onClick={() => setLayer(i + 1)} title={tx(`Les faders règlent le retour ${stripName(b, values)}`)}>{stripName(b, values)}</button>)}
            {FXSENDS.map((f, i) => <button key={f.id} type="button" className={layer === i + 7 ? "xm-layer fx active" : "xm-layer fx"} onClick={() => setLayer(i + 7)} title={tx(`Les faders règlent l’envoi vers l’effet ${i + 1}`)}>{tx("FX ")}{tx(i + 1)}</button>)}
          </div>
        </div>}
        <div className="xm-side-group">
          <h6 title={tx("Afficher seulement les canaux d’un DCA")}>{tx("DCA Groups")}</h6>
          <div className="xm-num-row">{DCAS.map((d, i) => <button key={d.id} type="button" className={spill === i ? "active" : ""} onClick={() => { setBank("inputs"); setSpill(spill === i ? null : i); }} title={tx(`Afficher les canaux du ${stripName(d, values)}`)}>{tx(i + 1)}</button>)}</div>
          <button type="button" className="xm-side-btn" disabled={!writable || !anySolo} onClick={() => { for (let i = 1; i <= 16; i++) if (values[`/-stat/solosw/${pad(i)}`] === 1) set(`/-stat/solosw/${pad(i)}`, 0); }} title={tx("Arrêter tous les solos")}>{tx("Clr Solo")}</button>
        </div>
        <div className="xm-side-group">
          <h6 title={tx("Couper d’un coup un groupe de canaux")}>{tx("Mute Groups")}</h6>
          <div className="xm-num-row">{[1, 2, 3, 4].map(n => <button key={n} type="button" disabled={!writable} className={num(values, `/config/mute/${n}`) === 1 ? "mute" : ""} onClick={() => set(`/config/mute/${n}`, num(values, `/config/mute/${n}`) === 1 ? 0 : 1)}>{tx(n)}</button>)}</div>
          <h6 title={tx("Mixage automatique de micros parlés")}>{tx("Auto Mix")}</h6>
          <div className="xm-num-row">{["X", "Y"].map(g => <button key={g} type="button" disabled={!writable} className={num(values, `/config/amixenable/${g}`) === 1 ? "active" : ""} onClick={() => set(`/config/amixenable/${g}`, num(values, `/config/amixenable/${g}`) === 1 ? 0 : 1)}>{tx(g)}</button>)}</div>
        </div>
        <details className="xm-side-help"><summary>{tx("? Les faders")}</summary><dl>{STRIP_HELP.map(([l, t]) => <div key={l}><dt>{tx(l)}</dt><dd>{tx(t)}</dd></div>)}</dl></details>
      </aside>
      <div className="xm-master"><BankStrip master strip={masterStrip} values={values} set={set} layer={0} selected={masterStrip.id === strip.id} onSelect={() => select(masterStrip)} canWrite={writable} /></div>
      </div>
    </div>
    {layer > 0 && bank === "inputs" && <p className="xm-layer-note">{tx("Les faders du bas règlent le mix de ")}<b>{stripName(layerMaster(layer), values)}</b>{tx(" (« sends on fader »). Le fader de droite est le volume général de ce retour.")}</p>}
  </section>;
}
