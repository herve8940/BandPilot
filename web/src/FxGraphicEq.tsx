import {useId,useState} from 'react';
import {FX_SCHEMAS,GEQ_FREQUENCIES,canEditFx,fxFromWire,fxToWire,type FxVector} from '../../shared/fx-parameters';
import {tx} from './i18n';
import './fx-geq.css';

const sideLabel={M:'Mid',S:'Side',A:'Côté A (gauche)',B:'Côté B (droite)',stereo:'Stéréo (gauche + droite)'};
export function fxParameterLabel(algorithm:number,index:number){
 const p=FX_SCHEMAS[algorithm]?.parameters[index];
 if(!p)return `${tx('Paramètre ')}${index+1}`;
 const label=p.frequency?`${p.frequency>=1000?p.frequency/1000:p.frequency} ${p.frequency>=1000?'kHz':'Hz'}`:tx(p.label);
 const detail=p.band?`${label} ${p.band}`:label;
 return p.side?`${tx(sideLabel[p.side])} · ${detail}`:detail;
}
type Props={fx:FxVector;disabled:boolean;drafts:Record<number,string>;errors:Record<number,string>;
 onParameter:(index:number,value:number)=>void;onEdit:(index:number,raw:string)=>void;onChange:(fx:FxVector)=>void;onClearDrafts:(indices:number[])=>void};
export function FxGraphicEq({fx,disabled,drafts,errors,onParameter,onEdit,onChange,onClearDrafts}:Props){
 const [side,setSide]=useState(0),[band,setBand]=useState(17),id=useId();
 const schema=FX_SCHEMAS[fx.algorithm];
 if(!schema?.geq||!canEditFx(fx))return null;
 const dual=schema.geq==='dual',offset=dual?side*32:0,index=offset+band,gainIndex=offset+31;
 const value=(i:number)=>Number(fxFromWire(schema.parameters[i]!,fx.parameters[i]!.value).toFixed(4));
 const points=GEQ_FREQUENCIES.map((_,i)=>`${36+i*24},${100-value(offset+i)*5}`).join(' ');
 const resetBands=()=>{const indices=GEQ_FREQUENCIES.map((_,i)=>offset+i);onChange({...fx,parameters:fx.parameters.map((p,i)=>indices.includes(i)?fxToWire(schema.parameters[i]!,0):p)});onClearDrafts(indices);};
 const numberField=(i:number,label:string)=><label>{label}<input type="number" min={-15} max={15} step="any" disabled={disabled} value={drafts[i]??value(i)} aria-invalid={!!errors[i]} aria-describedby={errors[i]?`${id}-${i}`:undefined} onChange={e=>onEdit(i,e.target.value)}/></label>;
 return <section className="fx-geq" aria-label={tx('Égaliseur graphique FX')}>
  <header><div><h3>{tx('Égaliseur graphique FX')}</h3><p>{tx('31 bandes · ±15 dB')}</p></div><span className="fx-geq-badge">{tx(schema.name)}</span></header>
  {dual?<div className="fx-geq-sides" role="group" aria-label={tx('Côté à régler')}>{(['A','B'] as const).map((s,n)=><button key={s} type="button" aria-pressed={side===n} onClick={()=>setSide(n)}>{tx(sideLabel[s])}{Object.keys(errors).some(i=>Math.floor(Number(i)/32)===n)?' ⚠':''}</button>)}</div>:<p>{tx('Une seule courbe règle les deux côtés de cet effet stéréo.')}</p>}
  <p className="fx-geq-hint">{tx('Prépare les bandes ici, puis prévisualise et confirme pour les appliquer.')}</p>
  <svg className="fx-geq-overview" viewBox="0 0 792 205" role="img" aria-label={tx('Vue des gains de bande')}>
   {[-15,0,15].map(db=><g key={db}><line x1="36" x2="756" y1={100-db*5} y2={100-db*5} className={db===0?'zero':''}/><text x="28" y={104-db*5} textAnchor="end">{db>0?'+':''}{db}</text></g>)}
   {[0,7,17,27,30].map(i=><text key={i} x={36+i*24} y="198" textAnchor="middle">{GEQ_FREQUENCIES[i]!>=1000?GEQ_FREQUENCIES[i]!/1000+'k':GEQ_FREQUENCIES[i]}</text>)}
   <polyline points={points}/>{GEQ_FREQUENCIES.map((_,i)=><circle key={i} cx={36+i*24} cy={100-value(offset+i)*5} r={band===i?5:2.5} className={band===i?'selected':''}/>)}
  </svg>
  <small>{tx('Gains des bandes, pas une mesure acoustique ni la réponse exacte du filtre.')}</small>
  <div className="fx-geq-scroll" tabIndex={0} role="region" aria-label={tx('Curseurs des 31 bandes')}>
   <div className="fx-geq-faders">{GEQ_FREQUENCIES.map((freq,i)=><label key={i} className={band===i?'selected':''}>
    <output>{value(offset+i).toFixed(1)}</output><input type="range" min={-15} max={15} step={.5} value={value(offset+i)} disabled={disabled}
     aria-label={fxParameterLabel(fx.algorithm,offset+i)} aria-valuetext={`${value(offset+i)} dB`} onFocus={()=>setBand(i)} onPointerDown={()=>setBand(i)} onChange={e=>{setBand(i);onParameter(offset+i,Number(e.target.value));}}/>
    <span>{freq>=1000?freq/1000+'k':freq}</span>
   </label>)}</div>
  </div>
  <fieldset disabled={disabled} className="fx-geq-detail"><legend>{tx(dual?sideLabel[side===0?'A':'B']:sideLabel.stereo)}</legend>
   <label>{tx('Bande à régler')}<select value={band} onChange={e=>setBand(Number(e.target.value))}>{GEQ_FREQUENCIES.map((f,i)=><option key={i} value={i}>{f>=1000?f/1000+' kHz':f+' Hz'}</option>)}</select></label>
   {numberField(index,tx('Gain de bande')+' (dB)')}
   <button type="button" onClick={()=>onParameter(index,0)}>{tx('Bande à 0 dB')}</button>
   {numberField(gainIndex,tx('Niveau de sortie')+' (dB)')}
  </fieldset>
  {Object.entries(errors).map(([i,error])=><p className="fx-field-error" role="alert" id={`${id}-${i}`} key={i}>{fxParameterLabel(fx.algorithm,Number(i))} : {tx(error)}</p>)}
  <div className="fx-geq-reset"><button type="button" disabled={disabled} onClick={resetBands}>{tx('Préparer les 31 bandes à 0 dB')}</button><small>{tx('Uniquement le côté affiché. Le niveau de sortie est conservé.')}</small></div>
 </section>;
}
