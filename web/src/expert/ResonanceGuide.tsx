import {useEffect,useRef,useState,type ReactNode} from 'react';
import {tx} from '../i18n';
import {trackResonance,sustainedResonance,type Resonance} from './resonance-tracker';
export function ResonanceGuide({frame,scope,correction}:{frame:{bands:number[];at:number}|null;scope:string;correction?:(hz:number)=>ReactNode}){
 const [active,setActive]=useState(false),[candidate,setCandidate]=useState<Resonance|null>(null),previous=useRef<Resonance|null>(null);
 useEffect(()=>{setActive(false);setCandidate(null);previous.current=null;},[scope]);
 useEffect(()=>{if(!active){previous.current=null;setCandidate(null);return;}const r=trackResonance(previous.current,frame,Date.now());previous.current=r;setCandidate(r);},[frame,active]);
 return <details className="resonance-guide" onToggle={e=>{if(!e.currentTarget.open)setActive(false);}}><summary>{tx('Préparer un retour : repérer les résonances')}</summary>
 <ol><li>{tx('Choisis le micro ou le bus du retour à vérifier, avec le micro dans sa position de scène. Les écoutes peuvent être différentes pour chaque musicien.')}</li><li>{tx('Fais ce contrôle pendant la préparation, sans musique. Commence à faible niveau et arrête dès qu’un sifflement apparaît.')}</li><li>{tx('Un pic stable est une piste à écouter, pas une preuve de larsen. Vérifie d’abord la position du micro et de l’enceinte, puis ajuste manuellement l’EQ si nécessaire.')}</li></ol>
 <button type="button" disabled={!active&&!frame} aria-pressed={active} onClick={()=>setActive(v=>!v)}>{tx(active?'Arrêter le repérage':'Repérer les pics persistants')}</button>
 {active&&<p role="status">{!frame?tx('En attente de mesure'):sustainedResonance(candidate)?<>{tx('Pic persistant à examiner')} : <b>≈ {Math.round(candidate!.hz)} Hz</b> · {candidate!.db.toFixed(1)} dBFS · {tx('Écart local')} {candidate!.prominence.toFixed(1)} dB</>:tx('Aucun pic persistant repéré.')}</p>}
 {active&&sustainedResonance(candidate)&&correction?.(candidate!.hz)}
 <p>{tx('Repère indicatif : pic au-dessus de −55 dBFS, au moins 8 dB au-dessus des bandes voisines pendant 2 secondes. Une note tenue peut aussi être signalée. Aucun filtre ni gain n’est appliqué automatiquement.')}</p>
 </details>;
}
