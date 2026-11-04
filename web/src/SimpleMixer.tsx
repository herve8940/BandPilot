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
export function SimpleMixer({ canWrite, onExpert }: { canWrite: boolean; onExpert: (channel?: number) => void }) {
  const {INPUTS,BUSES,model}=useAirStrips();
  const { values, set, online, message, clearMessage } = useLiveMixer();
  const [layer, setLayer] = useState(0);
  const [showAll, setShowAll] = usePersistentFlag("xr18-simple-show-all", false);
  const writable = canWrite && online;
  const master = layerMaster(layer);
  // Hide unnamed, colourless spare channels unless asked: fewer things to scan on stage.
  const used = (s: Strip) => {
    if (showAll || s.kind !== "ch" || !Object.keys(values).length) return true;
    const name = values[`${s.prefix}/config/name`];
    return (typeof name === "string" && name.trim() !== "") || num(values, `${s.prefix}/config/color`) > 0;
  };
  // A console with no named input (new or just reset to a blank scene) shows all 16 inputs.
  const noneNamed = !INPUTS.some(s => s.kind === "ch" && !showAll && used(s));
  const strips = noneNamed ? INPUTS : INPUTS.filter(used);

  const card = (strip: Strip, isMaster = false) => {
    const fAddr = faderAddress(strip, isMaster ? 0 : layer), oAddr = onAddress(strip), solo = soloAddress(strip);
    const fader = num(values, fAddr), on = num(values, oAddr, 1) === 1, color = stripColor(num(values, `${strip.prefix}/config/color`));
    const name = stripName(strip, values);
    return <article key={strip.id} className={`sm-strip${isMaster ? " master" : ""}${on ? "" : " muted"}`} style={{ "--c": color } as React.CSSProperties}>
      <button type="button" className="sm-name" onClick={() => onExpert(strip.kind === "ch" ? Number(strip.short) : undefined)} title="Ouvrir les réglages détaillés (mode Expert)">
        <span className="sm-dot" /><b>{name}</b><small>{isMaster ? (layer === 0 ? "Volume général" : "Volume du retour") : strip.kind === "ch" ? `Entrée ${Number(strip.short)}` : strip.short}</small>
      </button>
      <div className={`sm-db${!isMaster && layer > 0 ? " send" : ""}`}>{formatDb(faderToDb(fader))}<small> dB</small></div>
      <div className="sm-fader">
        <Fader label={`${isMaster ? "Volume" : layer > 0 ? "Envoi" : "Volume"} ${name}`} value={fader} disabled={!writable} reset={!isMaster && layer > 0 ? 0 : .75} accent={color} onChange={v => set(fAddr, v)} />
        <Meter indexes={strip.meters} />
      </div>
      <div className="sm-buttons">
        <button type="button" className={on ? "sm-btn mute" : "sm-btn mute on"} disabled={!writable} aria-pressed={!on} onClick={() => set(oAddr, on ? 0 : 1)}>{on ? "Mute" : "Coupé"}</button>
        {solo && <button type="button" className={values[solo] === 1 ? "sm-btn solo on" : "sm-btn solo"} disabled={!writable} aria-pressed={values[solo] === 1} onClick={() => set(solo, values[solo] === 1 ? 0 : 1)}>Solo</button>}
      </div>
    </article>;
  };

  return <section className="sm">
    <div className="sm-head">
      <div>
        <h2>{layer === 0 ? "Je règle la façade" : <>Je règle le retour de <span>{stripName(master, values)}</span></>}</h2>
        <p>{layer === 0 ? "Ce que le public entend. Monte ou baisse chaque source, coupe-la avec Mute." : "Ce que ce musicien entend dans son retour. Le public n’est pas concerné."}</p>
      </div>
      <span className={online ? (writable ? "sm-status ok" : "sm-status ro") : "sm-status"}>{online ? (writable ? "Contrôle actif" : "Lecture seule") : "Hors ligne"}</span>
    </div>
    <div className="sm-mixes" role="tablist" aria-label="Mix à régler">
      <button type="button" role="tab" aria-selected={layer === 0} className={layer === 0 ? "active" : ""} onClick={() => setLayer(0)}>Façade</button>
      {BUSES.slice(0,model.monitorOutputs).map((b, i) => <button key={b.id} type="button" role="tab" aria-selected={layer === i + 1} className={layer === i + 1 ? "active" : ""} style={{ "--c": stripColor(num(values, `${b.prefix}/config/color`)) } as React.CSSProperties} onClick={() => setLayer(i + 1)}>
        <span className="sm-dot" />{stripName(b, values)}</button>)}
    </div>
    {message && <div className="sm-message" role="status">{message}<button type="button" onClick={clearMessage} aria-label="Fermer">×</button></div>}
    <div className="sm-board">
      <div className="sm-strips">{strips.filter(s => layer === 0 || isInput(s)).map(s => card(s))}</div>
      <div className="sm-master">{card(layer === 0 ? MAIN : master, true)}</div>
    </div>
    <div className="sm-foot">
      {noneNamed ? <span>Aucune entrée n’a encore de nom : toutes sont affichées. Donne-leur un nom (Mon ingé son, étape 2) pour n’afficher que celles qui servent.</span> : <label className="sm-check"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Afficher aussi les entrées sans nom</label>}
      <span>Astuce : touche le nom d’une source pour ouvrir son égaliseur, sa dynamique et ses envois.</span>
    </div>
  </section>;
}
