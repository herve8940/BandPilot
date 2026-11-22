import {useCallback,useEffect,useRef,useState} from 'react';
import NoSleep from 'nosleep.js';

/** The usual Wi-Fi QR uses HTTP. Start its local video fallback in the musician's tap. */
export function useScoreScreen(){
 const [awake,setAwake]=useState(false);
 const requested=useRef(false),generation=useRef(0);
 const lock=useRef<WakeLockSentinel|null>(null),fallback=useRef<NoSleep|null>(null);
 const release=useCallback(()=>{
  generation.current++;
  const previous=lock.current;
  lock.current=null;
  if(previous)void previous.release().catch(()=>{});
  fallback.current?.disable();
  setAwake(false);
 },[]);
 const acquire=useCallback(async()=>{
  requested.current=true;
  if(document.hidden||lock.current&&!lock.current.released)return;
  const attempt=++generation.current;
  try{
   if(navigator.wakeLock){
    const next=await navigator.wakeLock.request('screen');
    if(attempt!==generation.current){await next.release();return;}
    lock.current=next;
    next.addEventListener('release',()=>{if(lock.current===next){lock.current=null;setAwake(false);}});
   }else{
    const video=fallback.current??=new NoSleep();
    await video.enable();
    if(attempt!==generation.current){if(!requested.current||document.hidden)video.disable();return;}
   }
   setAwake(true);
  }catch{if(attempt===generation.current)setAwake(false);}
 },[]);
 const leave=useCallback(()=>{requested.current=false;release();},[release]);
 useEffect(()=>{
  const visibility=()=>{if(document.hidden)release();else if(requested.current)void acquire();};
  document.addEventListener('visibilitychange',visibility);
  return ()=>{document.removeEventListener('visibilitychange',visibility);leave();};
 },[acquire,release,leave]);
 return {awake,acquire,leave};
}
