import {useEffect,useRef,useState} from 'react';
import {batchPath,BATCH_SETTINGS} from '../../../shared/batch-edit';
import type {MixerProfile} from '../../../shared/mixer-models';
import {presetApi} from '../preset-controls';
import {type Value,type SetFn} from '../xair/controls';
import {type Link} from './BatchEdit';

function readLinks(model:MixerProfile):Link[]{
 try{
  const raw=JSON.parse(localStorage.getItem('bandpilot-parameter-links:'+model.id)??'[]');
  if(!Array.isArray(raw))return [];
  const used=new Set<string>();
  return raw.slice(0,32).filter((link:Link)=>{
   if(!link||!Object.hasOwn(BATCH_SETTINGS,link.setting)||String(link.setting)==='tap'||!Number.isInteger(link.band)||link.band<1||link.band>4||
    !Array.isArray(link.channels)||link.channels.length<2||new Set(link.channels).size!==link.channels.length||
    link.channels.some(c=>!Number.isInteger(c)||c<1||c>model.channels))return false;
   const keys=link.channels.map(c=>c+'/'+batchPath(link.setting,1,link.band));
   if(keys.some(key=>used.has(key)))return false;
   keys.forEach(key=>used.add(key));
   return true;
  });
 }catch{return [];}
}

export function useParameterLinks(model:MixerProfile,canWrite:boolean,setDirect:SetFn){
 const [links,setLinks]=useState(()=>readLinks(model));
 const [active,setActive]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),armed=useRef(false),running=useRef(false);
 const queue=useRef(new Map<Link,number>());
 const stop=()=>{generation.current++;armed.current=false;queue.current.clear();setActive(false);};
 useEffect(()=>{stop();setLinks(readLinks(model));},[model.id]);
 useEffect(()=>{if(!canWrite)stop();},[canWrite]);
 useEffect(()=>{
  const hidden=()=>{if(document.hidden)stop();};
  document.addEventListener('visibilitychange',hidden);
  window.addEventListener('bandpilot-console-reset',stop);
  return()=>{
   generation.current++;armed.current=false;queue.current.clear();
   document.removeEventListener('visibilitychange',hidden);
   window.removeEventListener('bandpilot-console-reset',stop);
  };
 },[]);
 const save=(next:Link[])=>{
  if(next.length>32)return;
  stop();
  try{localStorage.setItem('bandpilot-parameter-links:'+model.id,JSON.stringify(next));setLinks(next);setError('');}
  catch{setError('Impossible d’enregistrer les liens de pistes.');}
 };
 const set=(address:string,value:Value)=>{
  const match=/^\/ch\/(\d{2})\/(.+)$/.exec(address);
  const link=armed.current&&canWrite&&match?links.find(link=>link.channels.includes(Number(match[1]))&&batchPath(link.setting,1,link.band)===match[2]):undefined;
  if(!link){setDirect(address,value);return;}
  if(typeof value!=='number')return;
  queue.current.set(link,value);
  if(running.current)return;
  running.current=true;
  void (async()=>{
   try{
    while(armed.current&&queue.current.size){
     const [link,wire]=queue.current.entries().next().value!;
     queue.current.delete(link);
     const ticket=generation.current;
     const plan=await presetApi<{token:string|null}>('/api/library/batch-edit/preview',{model:model.id,...link,value:wire,wire:true});
     if(ticket!==generation.current)continue;
     if(plan.token)await presetApi('/api/library/group-adjust/apply',{token:plan.token,confirm:true});
    }
   }catch(cause){if(armed.current){stop();setError((cause as Error).message);}}
   finally{running.current=false;}
  })();
 };
 return {links,save,active,error,set,stop,start:()=>{if(canWrite&&links.length){setError('');armed.current=true;setActive(true);}}};
}
