import {useEffect,useRef,useState} from 'react';
import {tx} from '../i18n';
import {presetApi} from '../preset-controls';

type Pass={id:string;token:string;ready:boolean;submitted:boolean};
const root='/api/eq-rta/ring/';
export function MonitorRingPass({token,bus,linked,detected}:{token:string;bus:number;linked:boolean;detected:string|null}){
 const pass=useRef<Pass|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [armed,setArmed]=useState(false),[message,setMessage]=useState('');
 const stop=()=>{
   const p=pass.current;pass.current=null;clearTimeout(timer.current);setArmed(false);
   if(p)void fetch(root+'stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,token:p.token}),keepalive:true}).catch(()=>{});
 };
 useEffect(()=>{
   const hidden=()=>{if(document.hidden)stop();};
   document.addEventListener('visibilitychange',hidden);
   return ()=>{document.removeEventListener('visibilitychange',hidden);stop();};
 },[token,bus,linked]);
 const arm=async()=>{
   if(pass.current||document.hidden)return;
   const p={token,id:crypto.randomUUID(),ready:false,submitted:false};pass.current=p;
   setMessage('');setArmed(true);
   timer.current=setTimeout(()=>{if(pass.current===p){stop();setMessage('Correction arrêtée.');}},30000);
   try{
     await presetApi(root+'arm',{token,id:p.id,bus,linked,confirm:true});
     if(pass.current===p)p.ready=true;
   }catch(e){if(pass.current===p){stop();setMessage((e as Error).message);}}
 };
 useEffect(()=>{
   const p=pass.current;
   if(!armed||!p?.ready||detected!==p.id||p.submitted||document.hidden)return;
   p.submitted=true;
   void presetApi<{written:number}>(root+'apply',{token,id:p.id}).then(result=>{
     if(pass.current===p)setMessage(result.written?'Correction appliquée. La sauvegarde est dans l’historique des scènes.':'La bande a déjà atteint sa limite.');
   }).catch(e=>{if(pass.current===p)setMessage((e as Error).message);}).finally(()=>{if(pass.current===p)stop();});
 },[detected,armed,token]);
 const first=bus%2===1?bus:bus-1;
 return <details className="quick-gang" onToggle={e=>{if(!e.currentTarget.open)stop();}}>
  <summary>{tx("Correction automatique du retour")}</summary>
  <p>{tx("Pendant la balance, sans musique. Pendant 30 secondes, un pic persistant peut déclencher une seule atténuation de 2 dB maximum sur le GEQ.")}</p>
  <button type="button" aria-pressed={armed} onClick={()=>armed?stop():void arm()}>{tx(armed?'Arrêter la correction':'Armer la correction')} · {linked?`Bus ${first}–${first+1}`:`Bus ${bus}`}</button>
  {message&&<p role="status">{tx(message)}</p>}
 </details>;
}
