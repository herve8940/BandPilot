import {useState} from 'react';
import {tx} from '../i18n';
import type {ViewProps} from './views';
import {num} from './controls';
import {GEQ_FREQUENCIES} from '../../../shared/fx-parameters';
import '../fx-geq.css';

import {GEQ_KEYS} from '../../../shared/room-eq';
export {GEQ_KEYS};
export function OutputEqMode({strip,values,canWrite,confirmed}:Pick<ViewProps,'strip'|'values'|'canWrite'|'confirmed'>){
 const [busy,setBusy]=useState(false),mode=values[`${strip.prefix}/eq/mode`];
 return <div className="output-eq-mode"><label>{tx('Type d’égaliseur de sortie')}<select aria-label={tx('Type d’égaliseur de sortie')} disabled={!canWrite||busy||typeof mode!=='number'} value={typeof mode==='number'?mode:''} onChange={async e=>{const next=Number(e.target.value);setBusy(true);try{await confirmed({[`${strip.prefix}/eq/mode`]:next},'Changer le type d’égaliseur de cette sortie ? Le son peut changer immédiatement.');}finally{setBusy(false);}}}>
 {typeof mode!=='number'&&<option value="">{tx('Non reçu')}</option>}{['PEQ','GEQ','True EQ'].map((label,i)=><option key={i} value={i}>{label}</option>)}</select></label><small>{tx('Le changement de type conserve les valeurs des autres égaliseurs de cette sortie.')}</small></div>;
}
export function OutputGraphicEq({strip,values,set,canWrite,confirmed}:ViewProps){
 const [band,setBand]=useState(17),[busy,setBusy]=useState(false),p=strip.prefix;
 const ready=GEQ_KEYS.every(k=>typeof values[`${p}/geq/${k}`]==='number');
 const gain=(i:number)=>num(values,`${p}/geq/${GEQ_KEYS[i]}`,.5)*30-15;
 const write=(i:number,db:number)=>{if(canWrite&&ready&&Number.isFinite(db)&&db>=-15&&db<=15)set(`${p}/geq/${GEQ_KEYS[i]}`,(db+15)/30);};
 return <section className="fx-geq output-geq" aria-label={tx('Égaliseur graphique de sortie')}>
 <header><h3>{tx('Égaliseur graphique de sortie')}</h3><span>{tx('31 bandes · ±15 dB')}</span></header>
 <p>{tx('Les curseurs règlent directement cette sortie. Ils ne changent aucun slot FX.')}</p>
 {!ready&&<p role="status">{tx('En attente des valeurs des 31 bandes.')}</p>}
 {ready&&<><svg className="fx-geq-overview" viewBox="0 0 792 205" role="img" aria-label={tx('Vue des gains de bande')}>
 {[-15,0,15].map(db=><g key={db}><line x1="36" x2="756" y1={100-db*5} y2={100-db*5}/><text x="28" y={104-db*5} textAnchor="end">{db}</text></g>)}
 <polyline points={GEQ_KEYS.map((_,i)=>`${36+i*24},${100-gain(i)*5}`).join(' ')}/>
 {[0,7,17,27,30].map(i=><text key={i} x={36+i*24} y="198" textAnchor="middle">{GEQ_KEYS[i]}</text>)}
 </svg><small>{tx('Gains des bandes, pas une mesure acoustique ni la réponse exacte du filtre.')}</small></>}
 <div className="fx-geq-scroll" tabIndex={0} role="region" aria-label={tx('Curseurs des 31 bandes')}><div className="fx-geq-faders">{GEQ_FREQUENCIES.map((hz,i)=><label key={i} className={band===i?'selected':''}><output>{ready?gain(i).toFixed(1):'—'}</output><input type="range" min={-15} max={15} step={.5} disabled={!canWrite||!ready||busy} value={gain(i)} aria-label={`${strip.short} · ${hz} Hz`} aria-valuetext={`${gain(i).toFixed(1)} dB`} onFocus={()=>setBand(i)} onChange={e=>{setBand(i);write(i,Number(e.target.value));}}/><span>{GEQ_KEYS[i]}</span></label>)}</div></div>
 <button type="button" disabled={!canWrite||!ready||busy} onClick={async()=>{setBusy(true);try{await confirmed(Object.fromEntries(GEQ_KEYS.map(k=>[`${p}/geq/${k}`,0])),'Remettre les 31 bandes de cette sortie à 0 dB ?');}finally{setBusy(false);}}}>{tx('Remettre les 31 bandes à 0 dB')}</button>
 </section>;
}
