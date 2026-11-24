import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {batchPath} from '../../../shared/batch-edit';
import {quickDefinition,QUICK_SCOPES,type QuickSelection,type QuickScope,validateParameterLinks,type ParameterLink,type ParameterLinksDefinition} from '../../../shared/parameter-links';
import type {MixerProfile} from '../../../shared/mixer-models';
import {presetApi} from '../preset-controls';
import type {Value,SetFn} from '../xair/controls';
import {tx} from '../i18n';
import {CommandUndo} from './CommandActivation';
const base='/api/library/parameter-links';
type Session={token:string;sequence:number;links:ParameterLink[]};
type LinksContext={canWrite:boolean;links:ParameterLink[];active:boolean;busy:boolean;error:string;backup:string;legacy:ParameterLink[];save:(links:ParameterLink[])=>Promise<void>;reload:()=>Promise<void>;quick:QuickSelection|null;start:(quick?:QuickSelection)=>Promise<void>;stop:()=>void;dispatch:(address:string,value:Value,direct:SetFn)=>void};
const Context=createContext<LinksContext|null>(null);
export const useParameterLinks=()=>useContext(Context);
export function ParameterLinksProvider({model,canWrite,children}:{model:MixerProfile;canWrite:boolean;children:ReactNode}){
 const [admin,setAdmin]=useState(false);
 useEffect(()=>{let alive=true;void presetApi<{user:{role:string}|null}>('/api/auth').then(a=>{if(alive)setAdmin(a.user?.role==='admin');}).catch(()=>undefined);return()=>{alive=false;};},[]);
 const [definition,setDefinition]=useState<ParameterLinksDefinition>({model:model.id,revision:0,links:[]});
 const [active,setActive]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[backup,setBackup]=useState(''),[legacy,setLegacy]=useState<ParameterLink[]>([]);
 const [quick,setQuick]=useState<QuickSelection|null>(null);
 const definitionRef=useRef(definition),session=useRef<Session|null>(null),generation=useRef(0),running=useRef(false),queue=useRef(new Map<number,{channel:number;value:number}>());
 const permitted=canWrite&&admin&&model.family==='xair',enabled=useRef(permitted);enabled.current=permitted;
 const stop=useCallback(()=>{
  generation.current++;queue.current.clear();const s=session.current;session.current=null;setActive(false);setQuick(null);setBusy(false);
  if(s)void presetApi(base+'/stop',{token:s.token}).catch(()=>undefined);
 },[]);
 const accept=(d:ParameterLinksDefinition)=>{definitionRef.current=d;setDefinition(d);};
 const reload=useCallback(async()=>{
  if(!enabled.current)return;
  const ticket=generation.current;
  try{const d=await presetApi<ParameterLinksDefinition>(base);if(ticket!==generation.current||d.model!==model.id)return;
   if(d.revision!==definitionRef.current.revision)stop();accept(d);setError('');
  }catch(e){if(ticket===generation.current)setError((e as Error).message);}
 },[model.id,stop]);
 useEffect(()=>{
  stop();setError('');setBackup('');setBusy(false);accept({model:model.id,revision:0,links:[]});setLegacy([]);
  if(permitted){
   try{setLegacy(validateParameterLinks({model:model.id,revision:0,links:JSON.parse(localStorage.getItem('bandpilot-parameter-links:'+model.id)??'[]')}).links);}catch{/* Keep invalid older browser data untouched. */}
   void reload();
  }
  return stop;
 },[model.id,permitted,reload,stop]);
 useEffect(()=>{
  const hidden=()=>{if(document.hidden)stop();};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('bandpilot-console-reset',stop);
  const timer=setInterval(()=>{
   if(document.hidden||running.current)return;
   const s=session.current;
   if(s)void presetApi(base+'/pulse',{token:s.token}).catch(e=>{if(session.current===s){stop();setError((e as Error).message);}});
   else if(enabled.current)void reload();
  },5000);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('bandpilot-console-reset',stop);};
 },[reload,stop]);
 const save=async(links:ParameterLink[])=>{
  if(!permitted)return;stop();const ticket=generation.current;setBusy(true);setError('');
  try{const d=await presetApi<ParameterLinksDefinition>(base,{...definitionRef.current,links});if(ticket===generation.current){accept(d);setLegacy([]);}}
  catch(e){if(ticket===generation.current)setError((e as Error).message);}
  finally{if(ticket===generation.current)setBusy(false);}
 };
 const start=async(temporary?:QuickSelection)=>{
  if(!permitted||busy||running.current||active||!temporary&&!definition.links.length)return;
  if(!temporary&&!confirm(tx('Activer les liens pour les commandes directes de tous les écrans ? Les paramètres liés changeront ensemble.')))return;
  const ticket=++generation.current;setBusy(true);setError('');
  try{const activeLinks=temporary?quickDefinition(model.id,definition.revision,temporary).links:definition.links;
   const s=await presetApi<Pick<Session,'sequence'|'token'>>(base+'/start',{model:model.id,revision:definition.revision,quick:temporary,confirm:true});
   if(ticket!==generation.current){void presetApi(base+'/stop',{token:s.token}).catch(()=>undefined);return;}
   session.current={...s,links:activeLinks};setQuick(temporary??null);setActive(true);
  }catch(e){if(ticket===generation.current)setError((e as Error).message);}
  finally{if(ticket===generation.current)setBusy(false);}
 };
 const dispatch=useCallback((address:string,value:Value,direct:SetFn)=>{
  const match=/^\/ch\/(\d{2})\/(.+)$/.exec(address);
  const index=session.current&&enabled.current&&match?session.current.links.findIndex(link=>link.channels.includes(Number(match[1]))&&batchPath(link.setting,1,link.band)===match[2]):-1;
  if(index<0){direct(address,value);return;}
  if(typeof value!=='number')return;
  queue.current.set(index,{value,channel:Number(match![1])});if(running.current)return;running.current=true;const batchTicket=generation.current;setBusy(true);
  void(async()=>{
   try{while(session.current&&queue.current.size){
    const [index,movement]=queue.current.entries().next().value!;queue.current.delete(index);
    const s=session.current,ticket=generation.current;
    const result=await presetApi<{sequence:number;backupId?:string}>(base+'/move',{token:s.token,sequence:s.sequence+1,index,...movement});
    if(result.backupId)setBackup(result.backupId);
    if(ticket!==generation.current)break;s.sequence=result.sequence;
   }}catch(e){if(batchTicket!==generation.current)return;stop();const failure=e as Error&{backupId?:string};setError(failure.message);if(failure.backupId)setBackup(failure.backupId);}
   finally{running.current=false;if(batchTicket===generation.current)setBusy(false);}
  })();
 },[stop]);
 return <Context.Provider value={{canWrite:permitted,links:definition.links,active,quick,busy,error,backup,legacy,save,reload,start,stop,dispatch}}>{children}</Context.Provider>;
}
export function ParameterLinksBar({canWrite,mode,compact=false}:{compact?:boolean;canWrite:boolean;mode:'real'|'simulation'}){
 const links=useParameterLinks();if(!links||!links.active&&!links.links.length&&!links.legacy.length&&!links.error&&!links.backup)return null;
 if(compact&&!links.active&&!links.error)return null;
 return <div className="parameter-links-switch" role="region" aria-label={tx('Liens de pistes')}>
  {(links.active||!!links.links.length)&&<button type="button" className="xs2-btn" disabled={!canWrite||!links.canWrite||links.busy&&!links.active} aria-pressed={links.active} onClick={()=>links.active?links.stop():void links.start()}>{tx(links.quick?'Délier le groupe temporaire':links.active?'Désactiver les liens de pistes':'Activer les liens de pistes')}</button>}
  {links.active&&<span role="status">{links.quick?tx(QUICK_SCOPES[links.quick.scope])+' · '+links.quick.channels.join(', '):tx('Liens actifs sur les commandes directes de tous les écrans.')}</span>}
  {!!links.legacy.length&&<button disabled={!canWrite||!links.canWrite||links.busy} onClick={()=>{if(confirm(tx('Importer les anciens liens de ce navigateur en remplacement des liens enregistrés ? Aucun réglage audio ne sera envoyé.')))void links.save(links.legacy);}}>{tx('Importer les liens de ce navigateur')}</button>}
  {links.error&&<><p role="alert">{tx(links.error)}</p><button onClick={()=>void links.reload()}>{tx('Recharger')}</button></>}
  <CommandUndo backup={links.backup} canWrite={canWrite&&links.canWrite} mode={mode} beforeUndo={links.stop}/>
 </div>;
}

export function QuickGang({strips,channel}:{strips:{id:string;number:number;name:string}[];channel:number}){
 const links=useParameterLinks();
 const [channels,setChannels]=useState<number[]>([channel]);
 const [scope,setScope]=useState<QuickScope>('eq');
 if(!links)return null;
 return <details className="quick-gang"><summary>{tx("Groupe temporaire")}</summary>
   <p>{tx("Les commandes choisies déplaceront ces tranches ensemble en conservant leurs écarts.")}</p>
   <fieldset disabled={links.active||links.busy||!links.canWrite}><legend>{tx("Canaux")}</legend>
     {strips.map(s=><label key={s.id}><input type="checkbox" checked={channels.includes(s.number)} onChange={e=>setChannels(old=>e.target.checked?[...old,s.number]:old.filter(n=>n!==s.number))}/>{s.number} · {s.name}</label>)}
   </fieldset>
   <label>{tx("Traitement")} <select disabled={links.active||links.busy} value={scope} onChange={e=>setScope(e.target.value as QuickScope)}>{(Object.entries(QUICK_SCOPES) as [QuickScope,string][]).map(([id,name])=><option key={id} value={id}>{tx(name)}</option>)}</select></label>
   <button type="button" disabled={!links.canWrite||links.busy||links.active||channels.length<2} onClick={()=>void links.start({scope,channels})}>{tx("Lier temporairement")}</button>
 </details>;
}
