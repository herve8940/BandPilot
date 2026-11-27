import {useState} from 'react';
import {FX_INFO} from './xairHelp';
import {FxRackFace} from './FxRackFace';
import {tx} from './i18n';

const families=[...new Set(FX_INFO.map(effect=>effect.family))];
export function FxRackCatalog(){
 const [open,setOpen]=useState(false),[family,setFamily]=useState('Réverbe'),[enlarged,setEnlarged]=useState<number|null>(null);
 return <details className="fx-rack-catalog" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>{tx('Catalogue des effets')} <small>({FX_INFO.length})</small></summary>
  {open&&<><div className="fx-catalog-families" role="group" aria-label={tx('Catalogue des effets')}>{families.map(f=><button type="button" key={f} aria-pressed={f===family} onClick={()=>{setFamily(f);setEnlarged(null);}}>{tx(f)}</button>)}</div>
   <div className="fx-catalog-cards">{FX_INFO.map((fx,i)=>fx.family===family&&<button type="button" key={fx.code} aria-pressed={enlarged===i} onClick={()=>setEnlarged(enlarged===i?null:i)}><FxRackFace algorithm={i}/><span>{tx(fx.name)}</span></button>)}</div>
   {enlarged!==null&&<figure aria-live="polite"><FxRackFace algorithm={enlarged}/><figcaption><strong>{tx(FX_INFO[enlarged]!.name)}</strong> · {tx(FX_INFO[enlarged]!.text)}</figcaption></figure>}
  </>}
 </details>;
}
