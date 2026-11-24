import {FineFaders} from './xair/meter-preferences';
import {Headphones, Speaker} from 'lucide-react';
import {tx, getLocale} from "./i18n";
import {useAirStrips} from './xair/model-strips';
import { useState } from "react";
import { faderToDb, formatDb, stripColor } from "./xairMath";
import { Fader, Meter, num, useLiveMixer, usePersistentFlag } from "./xair/controls";
import { faderAddress, isInput, layerMaster, MAIN, onAddress, soloAddress, stripName, type Strip } from "./xair/strips";
import "./simple-mixer.css";

/**
 * Mode Simple : volume, mute, solo et vumètre de chaque source, pour la façade
 * ou pour le retour d’un musicien. Tout le reste est dans le mode Expert.
 */
export function SimpleMixer({ canWrite, onExpert, simulation=false }: { simulation?:boolean; canWrite: boolean; onExpert: (channel?: number, stripId?:string) => void }) {
  const {INPUTS,BUSES,model}=useAirStrips();
  const { values, set, online, message, clearMessage } = useLiveMixer();
  const [layer, setLayer] = useState(0);
  const [showAll, setShowAll] = usePersistentFlag("xr18-simple-show-all", false);
  const writable = canWrite && online;
  const master = layerMaster(layer);
  // Hide unnamed, colourless spare channels unless asked: fewer things to scan on stage.
  const used = (s: Strip) => {
    if (s.kind !== "ch") return true;
    const name = values[`${s.prefix}/config/name`];
    return (typeof name === "string" && name.trim() !== "") || num(values, `${s.prefix}/config/color`) > 0;
  };
  // A console with no named input (new or just reset to a blank scene) shows all 16 inputs.
  const noneNamed = !INPUTS.some(s => s.kind === "ch" && used(s));
  const strips = showAll || noneNamed ? INPUTS : INPUTS.filter(used);

  const card = (strip: Strip, isMaster = false) => {
    const fAddr = faderAddress(strip, isMaster ? 0 : layer), oAddr = onAddress(strip), solo = soloAddress(strip);
    const allowMute = layer === 0 || isMaster;
    const fader = num(values, fAddr), on = num(values, oAddr, 1) === 1, color = stripColor(num(values, `${strip.prefix}/config/color`));
    const name = stripName(strip, values);
    return <article key={strip.id} className={`sm-strip${isMaster ? " master" : ""}${on ? "" : " muted"}`} style={{ "--c": color } as React.CSSProperties}>
      <button type="button" className="sm-name" onClick={() => onExpert(strip.kind === "ch" ? Number(strip.short) : undefined,strip.id)} title={tx("Ouvrir les réglages détaillés (mode Expert)")}>
        <span className="sm-dot" /><b>{name}</b><small>{tx(isMaster ? (layer === 0 ? "Volume général" : "Volume du retour") : strip.kind === "ch" ? `Entrée ${Number(strip.short)}` : strip.short)}</small>
      </button>
      <div className={`sm-db${!isMaster && layer > 0 ? " send" : ""}`}>{tx(formatDb(faderToDb(fader)))}<small>{tx(" dB")}</small></div>
      <div className="sm-fader">
        <Fader label={tx(`${isMaster ? "Volume" : layer > 0 ? "Envoi" : "Volume"} ${name}`)} value={fader} disabled={!writable} reset={!isMaster && layer > 0 ? 0 : .75} accent={color} onChange={v => set(fAddr, v)} />
        <Meter indexes={strip.meters} />
      </div>
      <div className="sm-buttons">
        {!allowMute && !on && <small>{tx("coupé en façade")}</small>}
        {allowMute && <button type="button" className={on ? "sm-btn mute" : "sm-btn mute on"} disabled={!writable} aria-pressed={!on} onClick={() => set(oAddr, on ? 0 : 1)}>{tx(layer > 0 ? (on ? "Couper ce retour" : "Rétablir ce retour") : (on ? "Mute" : "Coupé"))}</button>}
        {layer === 0 && solo && <button type="button" className={values[solo] === 1 ? "sm-btn solo on" : "sm-btn solo"} disabled={!writable} aria-pressed={values[solo] === 1} onClick={() => set(solo, values[solo] === 1 ? 0 : 1)}>{tx("Solo")}</button>}
      </div>
    </article>;
  };

  const MixIcon = layer === 0 ? Speaker : Headphones;
  return <section className="sm" data-mix={layer===0?"main":"monitor"}>
    <div className="sm-head">
      <span className="sm-destination-icon" aria-hidden="true"><MixIcon size={23}/></span>
      <div>
        <h2>{layer === 0 ? tx("Je règle la façade") : <>{tx("Je règle le retour de ")}<span>{stripName(master, values)}</span></>}</h2>
        <p>{tx(layer === 0 ? "Ce que le public entend. Monte ou baisse chaque source, coupe-la avec Mute." : "Ce que ce musicien entend dans son retour. Le public n’est pas concerné.")}</p>
      </div>
      <span className={online ? (simulation ? "sm-status demo" : writable ? "sm-status ok" : "sm-status ro") : "sm-status"}>{tx(online ? (simulation ? "Simulation modifiable" : writable ? "Contrôle actif" : "Lecture seule") : "Hors ligne")}</span>
    </div>
    <div className="sm-mixes" role="tablist" aria-label={tx("Mix à régler")} onKeyDown={e=>{
      const tabs=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'));
      const index=tabs.indexOf(e.target as HTMLButtonElement);
      if(index<0)return;
      const to:Record<string,number>={Home:0,End:tabs.length-1,ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length};
      if(!Object.hasOwn(to,e.key))return;
      e.preventDefault();const next=to[e.key]!;setLayer(next);tabs[next]!.focus();
    }}>
      <button type="button" role="tab" id="sm-mix-0" aria-controls="sm-mix-panel" tabIndex={layer===0?0:-1} aria-selected={layer === 0} className={layer === 0 ? "active" : ""} onClick={() => setLayer(0)}>{tx("Façade")}</button>
      {BUSES.slice(0,model.monitorOutputs).map((b, i) => <button key={b.id} type="button" role="tab" id={"sm-mix-"+(i+1)} aria-controls="sm-mix-panel" tabIndex={layer===i+1?0:-1} aria-selected={layer === i + 1} className={layer === i + 1 ? "active" : ""} style={{ "--c": stripColor(num(values, `${b.prefix}/config/color`)) } as React.CSSProperties} onClick={() => setLayer(i + 1)}>
        <span className="sm-dot" />{stripName(b, values)}</button>)}
    </div>
    {message && <div className="sm-message" role="status">{tx(message)}<button type="button" onClick={clearMessage} aria-label={tx("Fermer")}>{tx("×")}</button></div>}
    <div className="sm-board" role="tabpanel" id="sm-mix-panel" aria-labelledby={"sm-mix-"+layer}>
      <div className="sm-strips">{tx(strips.filter(s => layer === 0 || isInput(s)).map(s => card(s)))}</div>
      <div className="sm-master">{tx(card(layer === 0 ? MAIN : master, true))}</div>
    </div>
    <div className="sm-foot"><FineFaders/>
      {noneNamed ? <span>{tx("Aucune entrée n’a encore de nom : toutes sont affichées. Nomme les instruments dans Balance guidée pour les retrouver ici.")}</span> : <label className="sm-check"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />{tx(" Afficher aussi les entrées sans nom")}</label>}
      <span>{tx("Astuce : touche le nom d’une source pour ouvrir son égaliseur, sa dynamique et ses envois.")}</span>
    </div>
  </section>;
}
