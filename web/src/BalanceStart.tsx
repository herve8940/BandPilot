import {ArrowRight,Layers,SlidersHorizontal} from 'lucide-react';
import {tx} from './i18n';

type Props={model:string;canRead:boolean;canBlank:boolean;busy:boolean;onMixer:()=>void;onBlank:()=>void;onConnect:()=>void};
export function BalanceStart({model,canRead,canBlank,busy,onMixer,onBlank,onConnect}:Props){
  return <div className="balance-start">
    <div className="balance-lead"><h2>{tx('Comment démarres-tu ta balance ?')}</h2>
      <p>{tx('Choisis ton point de départ. Tu retrouveras les mêmes étapes jusqu’à la sauvegarde.')}</p>
    </div>
    <div className="balance-mic" aria-hidden="true"/>
    <div className="balance-start-options">
      <button type="button" className="balance-start-card balance-resume" disabled={busy||!canRead} onClick={onMixer} aria-labelledby="balance-resume-label" aria-describedby="balance-resume-hint">
        <SlidersHorizontal aria-hidden="true"/><span><strong id="balance-resume-label">{tx('Reprendre le mélangeur actuel')}</strong>
        <small id="balance-resume-hint">{tx('Lis les réglages et les retours de la console, puis coche les tranches à travailler.')}</small></span><ArrowRight aria-hidden="true"/>
      </button>
      <button type="button" className="balance-start-card balance-blank" disabled={busy||!canBlank} onClick={onBlank} aria-labelledby="balance-blank-label" aria-describedby="balance-blank-hint">
        <Layers aria-hidden="true"/><span><strong id="balance-blank-label">{tx('Partir d’une scène vierge')}</strong>
        <small id="balance-blank-hint">{tx('Vérifie la remise à zéro, puis construis les instruments et les retours du groupe.')}</small></span><ArrowRight aria-hidden="true"/>
      </button>
    </div>
    {(!canRead||!canBlank)&&<button type="button" className="balance-connect" disabled={busy} onClick={onConnect}>{tx(canRead?'Activer le contrôle pour la scène vierge':'Connecter ma console')} · {model}</button>}
  </div>;
}
