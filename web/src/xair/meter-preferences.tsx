import {useSyncExternalStore} from 'react';
import {tx} from '../i18n';
type Settings={holdMs:number;reset:number;stored:boolean};
type Bridge={get:()=>{holdMs:number}|null;set:(value:{holdMs:number})=>boolean};
const holds=[0,500,1500,3000,10000,-1],key='bandpilot-meter-display-v1';
const bridge=()=> (window as Window & {bandpilotMetering?:Bridge}).bandpilotMetering;
let settings:Settings={holdMs:1500,reset:0,stored:true},loaded=false;
const listeners=new Set<()=>void>();
function get(){
 if(!loaded){loaded=true;try{const v=bridge()?.get()??JSON.parse(localStorage.getItem(key)||'null');if(v&&holds.includes(v.holdMs))settings={...settings,holdMs:v.holdMs};}catch{/* Preserve the previous default. */}}
 return settings;
}
function publish(patch:Partial<Settings>){settings={...get(),...patch};listeners.forEach(fn=>fn());}
export const meterPreferences={get,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
 set(holdMs:number){if(!holds.includes(holdMs))return;let stored=false;try{localStorage.setItem(key,JSON.stringify({holdMs}));stored=true;}catch{/* Native persistence may still work. */}try{const native=bridge();if(native)stored=native.set({holdMs});}catch{stored=false;}publish({holdMs,reset:get().reset+1,stored});},
 reset(){publish({reset:get().reset+1});}
};
export const useMeterPreferences=()=>useSyncExternalStore(meterPreferences.subscribe,get);
export type Peak={value:number;at:number};
export function nextPeak(previous:Peak|undefined,db:number,now:number,holdMs:number):Peak{
 if(!previous||db>=previous.value||holdMs===0||(holdMs>0&&now-previous.at>holdMs))return {value:db,at:now};
 return previous;
}
export function MeterDisplaySettings(){
 const s=useMeterPreferences();
 return <details className="meter-display-settings"><summary>{tx('Affichage des crêtes')}</summary><label>{tx('Maintien des crêtes')}<select value={s.holdMs} onChange={e=>meterPreferences.set(Number(e.target.value))}>{holds.map(ms=><option key={ms} value={ms}>{tx(ms===0?'Désactivé':ms===-1?'Jusqu’à effacement':`${ms/1000} s`)}</option>)}</select></label><button type="button" onClick={()=>meterPreferences.reset()}>{tx('Effacer les crêtes')}</button><p>{tx('Affichage des niveaux reçus, sans changement audio. Les crêtes entre deux mesures peuvent ne pas être capturées.')}</p>{!s.stored&&<p role="status">{tx('Affichage conservé pour cette session uniquement. Réessaie l’enregistrement.')}</p>}</details>;
}
