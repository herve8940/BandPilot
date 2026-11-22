import {useEffect,useRef,useState} from 'react';
import {presetApi} from '../preset-controls';
import {tx} from '../i18n';

const views=['console','channel','analysis'] as const;
type View=typeof views[number];
type Selection={view:View;channel:number};
const path='/api/expert-view-link';
export function ExpertViewLink({view,channel,scope,onReceive}:{view:string;channel:number;scope:string;onReceive:(selection:Selection)=>void}){
 const [role,setRole]=useState<'off'|'share'|'follow'>('off'),[status,setStatus]=useState('');
 const publisher=useRef('');
 const current=useRef({view,channel,onReceive});
 current.current={view,channel,onReceive};
 useEffect(()=>{setRole('off');setStatus('');},[scope]);
 useEffect(()=>{
  if(role==='off')return;
  let alive=true,timer:ReturnType<typeof setTimeout>|undefined;
  const tick=async()=>{
   if(!alive)return;
   try{
    if(role==='share'){
     const {view,channel}=current.current;
     if(views.includes(view as View)){
      publisher.current||=crypto.randomUUID();
      await presetApi(path,{publisher:publisher.current,view,channel});
      if(alive)setStatus('Vue partagée');
     }
    }else{
     const selection=await presetApi<Selection|null>(path);
     if(alive){
      if(selection&&views.includes(selection.view)&&Number.isInteger(selection.channel))current.current.onReceive(selection);
      setStatus(selection?'Vue suivie':'En attente d’une vue partagée');
     }
    }
   }catch(cause){if(alive){setStatus((cause as Error).message);setRole('off');}}
   if(alive)timer=setTimeout(()=>void tick(),1000);
  };
  void tick();
  return()=>{alive=false;clearTimeout(timer);};
 },[role,scope]);
 return <details className="expert-view-link">
  <summary>{tx('Synchroniser les vues')}</summary>
  <label>{tx('Cet écran')} <select value={role} onChange={e=>{setRole(e.target.value as typeof role);setStatus('');}}>
   <option value="off">{tx('Indépendant')}</option>
   <option value="share">{tx('Partager la vue')}</option>
   <option value="follow">{tx('Suivre la vue partagée')}</option>
  </select></label>
  <p>{tx('Relie des écrans connectés au même serveur BandPilot. La navigation partagée n’envoie aucun réglage audio.')}</p>
  {status&&<p role="status">{tx(status)}</p>}
 </details>;
}
