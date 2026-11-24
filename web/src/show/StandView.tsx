import {useEffect,useState} from 'react';
import {Maximize2,Minimize2} from 'lucide-react';
import {tx} from '../i18n';

export function useStandView() {
  const [active,setActive]=useState(false);
  useEffect(()=>{
    if(!active)return;
    const escape=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!e.defaultPrevented&&!document.querySelector('dialog[open]'))setActive(false);
    };
    window.addEventListener('keydown',escape);
    return ()=>window.removeEventListener('keydown',escape);
  },[active]);
  const Icon=active?Minimize2:Maximize2;
  const button=<button className="xs2-btn stand-switch" type="button" aria-pressed={active} onClick={()=>setActive(!active)}><Icon size={16}/>{tx(active?'Quitter la vue pupitre':'Vue pupitre')}</button>;
  return {active,button};
}
