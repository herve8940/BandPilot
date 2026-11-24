import {useEffect,useSyncExternalStore} from 'react';
import {tx} from '../i18n';
type Preferences={holdMs:number;decay:number;contrast:boolean;fine:boolean};
type Settings=Preferences&{reset:number;stored:boolean};
type Bridge={get:()=>Partial<Preferences>|null;set:(value:Preferences)=>boolean};
const holds=[0,500,1500,3000,10000,-1],decays=[0,6,12,24],key='bandpilot-meter-display-v1';
const bridge=()=> (window as Window & {bandpilotMetering?:Bridge}).bandpilotMetering;
let settings:Settings={holdMs:1500,decay:0,contrast:false,fine:false,reset:0,stored:true},loaded=false;
const listeners=new Set<()=>void>();
function get(){
 if(!loaded){
  loaded=true;
  try{
   const v=bridge()?.get()??JSON.parse(localStorage.getItem(key)||'null');
   if(v)settings={...settings,holdMs:holds.includes(v.holdMs)?v.holdMs:1500,decay:decays.includes(v.decay)?v.decay:0,contrast:v.contrast===true,fine:v.fine===true};
  }catch{/* Keep session defaults. */}
 }
 return settings;
}
function publish(patch:Partial<Settings>){settings={...get(),...patch};listeners.forEach(fn=>fn());}
function change(patch:Partial<Preferences>){
 const {holdMs,decay,contrast,fine}={...get(),...patch},next={holdMs,decay,contrast,fine};
 if(!holds.includes(holdMs)||!decays.includes(decay))return;
 let stored=false;
 try{localStorage.setItem(key,JSON.stringify(next));stored=true;}catch{}
 try{const native=bridge();if(native)stored=native.set(next);}catch{stored=false;}
 publish({...next,reset:get().reset+(patch.holdMs!==undefined||patch.decay!==undefined?1:0),stored});
}
export const meterPreferences={get,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
 set:(holdMs:number)=>change({holdMs}),change,reset(){publish({reset:get().reset+1});}
};
export const useMeterPreferences=()=>useSyncExternalStore(meterPreferences.subscribe,get);
export function useScreenContrast(){
 const {contrast}=useMeterPreferences();
 useEffect(()=>{document.documentElement.classList.toggle('stage-contrast',contrast);return ()=>document.documentElement.classList.remove('stage-contrast');},[contrast]);
}
export function ContrastSwitch(){
 const {contrast}=useMeterPreferences();
 return <button className="display-switch" type="button" aria-pressed={contrast} onClick={()=>change({contrast:!contrast})}>{tx('Contraste renforcé')}</button>;
}
export function FineFaders(){
 const {fine}=useMeterPreferences();
 return <button className="display-switch" type="button" aria-pressed={fine} title={tx('Déplacement relatif et précis des faders')} onClick={()=>change({fine:!fine})}>{tx('Faders fins')}</button>;
}
export type Peak={value:number;at:number;updated?:number};
export function nextPeak(previous:Peak|undefined,db:number,now:number,holdMs:number,decay=0):Peak{
 if(!previous||db>=previous.value||holdMs===0)return {value:db,at:now};
 if(holdMs<0||now<=previous.at+holdMs)return previous;
 if(!decay)return {value:db,at:now};
 const elapsed=now-Math.max(previous.at+holdMs,previous.updated??0);
 const value=previous.value-decay*Math.max(0,elapsed)/1000;
 return db>=value?{value:db,at:now}:{value,at:previous.at,updated:now};
}
export function MeterDisplaySettings(){
 const s=useMeterPreferences();
 return <details className="meter-display-settings"><summary>{tx('Affichage des crêtes')}</summary><label>{tx('Maintien des crêtes')}<select value={s.holdMs} onChange={e=>meterPreferences.set(Number(e.target.value))}>{holds.map(ms=><option key={ms} value={ms}>{tx(ms===0?'Désactivé':ms===-1?'Jusqu’à effacement':`${ms/1000} s`)}</option>)}</select></label><label>{tx("Descente des crêtes")}<select disabled={s.holdMs<=0} value={s.decay} onChange={e=>change({decay:Number(e.target.value)})}>{decays.map(n=><option value={n} key={n}>{n?n+" dB/s":tx("Instantanée")}</option>)}</select></label><button type="button" onClick={()=>meterPreferences.reset()}>{tx('Effacer les crêtes')}</button><p>{tx('Affichage des niveaux reçus, sans changement audio. Les crêtes entre deux mesures peuvent ne pas être capturées.')}</p>{!s.stored&&<p role="status">{tx('Affichage conservé pour cette session uniquement. Réessaie l’enregistrement.')}</p>}</details>;
}
