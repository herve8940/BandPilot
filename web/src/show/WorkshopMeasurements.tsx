import {SPECTRUM_HZ,type SpectralEvidence} from '../../../shared/workshop-spectrum';
import type {TemporalEvidence} from '../../../shared/workshop-envelope';
export type WorkshopMeasure={channel:number;name:string;peakDb:number;rmsDb:number;crestDb:number;clipped:number;spectral?:SpectralEvidence;temporal?:TemporalEvidence};
export function WorkshopMeasurements({rows}:{rows:WorkshopMeasure[]}){
 return <div className="workshop-measures">{rows.map(e=><article key={e.channel}><b>{e.name}</b><span>Crête <strong>{e.peakDb} dBFS</strong></span><span>Moyenne RMS <strong>{e.rmsDb} dBFS</strong></span><span>Écart crête / moyenne <strong>{e.crestDb} dB</strong></span>{e.spectral&&<>
  <svg className="workshop-spectrum" viewBox="0 0 300 110" role="img" aria-label={`Spectre relatif de ${e.name}, avant EQ`}><line x1="0" x2="300" y1="80" y2="80" stroke="currentColor" opacity=".3"/>{e.spectral.bands.map((db,i)=><rect key={i} x={i*300/28+1} y={80-(60+db)*1.2} width={300/28-3} height={Math.max(1,(60+db)*1.2)} rx="2" fill={SPECTRUM_HZ[i]!<100?'var(--bp-cyan)':SPECTRUM_HZ[i]!<=400?'var(--bp-purple)':'#48d5aa'}><title>{SPECTRUM_HZ[i]} Hz : {db} dB relatifs</title></rect>)}<text x="4" y="100">Grave</text><text x="115" y="100">Médiums</text><text x="263" y="100">Aigu</text></svg>
  <small>Spectre relatif · avant traitements</small><span>Énergie à 160–400 Hz <strong>{e.spectral.lowMidPercent} %</strong></span>
  {e.spectral.phase?<div className={`workshop-phase ${e.spectral.phase.negativePercent>0?'warning':''}`}><b>{e.spectral.phase.negativePercent>0?(e.spectral.phase.variable?'Opposition par moments':'Opposition gauche / droite'):'Compatibilité mono'}</b><span>Corrélation <strong>{e.spectral.phase.correlation}</strong></span><meter aria-label={`Corrélation gauche droite de ${e.name}`} min="-1" max="1" low={0} high={0.5} optimum={1} value={e.spectral.phase.correlation}/><span>Perte mono maximale <strong>{e.spectral.phase.worstLossDb>=90?'≥ 90':e.spectral.phase.worstLossDb} dB</strong></span><small>−1 : opposition · 0 : décorrélé · +1 : identique</small></div>:<small>Phase stéréo : {e.spectral.activeSeconds?'piste mono ou signal insuffisant':'signal insuffisant'}</small>}
 </>}</article>)}</div>;
}
export function settingLabel(address:string,value:number|string){
 const channel=Number(address.split('/')[2]),last=address.split('/').at(-1),band=/\/eq\/(\d)\//.exec(address)?.[1];
 const common:Record<string,string>={thr:'Seuil',attack:'Attaque',release:'Relâchement',mgain:'Compensation',hpf:'Coupe-bas',hpon:'Coupe-bas',invert:'Polarité',ratio:'Ratio',mode:'Mode',hold:'Maintien',range:'Atténuation',det:'Détection',mix:'Dosage',auto:'Temps automatiques'};
 let label=band?`EQ ${band} · ${({f:'Fréquence',g:'Gain',q:'Largeur Q',type:'Forme'} as Record<string,string>)[last!]??last}`:common[last!]??(address.includes('/eq/')?'Égaliseur':address.includes('/dyn/')?'Compresseur':address.includes('/gate/')?'Gate':last);
 let shown=String(value);
 if(['on','hpon','auto'].includes(last!))shown=Number(value)===1?'Activé':'Désactivé';
 else if(last==='invert')shown=Number(value)===1?'Inversée':'Normale';
 else if(last==='ratio')shown=['1.1','1.3','1.5','2','2.5','3','4','5','7','10','20','100'][Number(value)]+':1';
 else if(last==='mode')shown=address.includes('/gate/')?['Gate','Expansion 2:1','Expansion 3:1','Expansion 4:1','Ducking'][Number(value)]:Number(value)===0?'Compression':'Expansion';
 else if(last==='det')shown=Number(value)===0?'Crête':'RMS';
 else if(last==='mix')shown+='%';
 else if(last==='type')shown=['Coupe-bas','Plateau grave','Cloche','Cloche vintage','Plateau aigu','Coupe-haut'][Number(value)]??shown;
 else if(['f','hpf'].includes(last!))shown+=' Hz';else if(['thr','mgain','g','range'].includes(last!))shown+=' dB';else if(['attack','release','hold'].includes(last!))shown+=' ms';
 return `Canal ${channel} · ${label} : ${shown}`;
}
