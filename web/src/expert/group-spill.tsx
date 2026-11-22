import {useEffect,useState} from 'react';
import {tx} from '../i18n';
/** A temporary view only: no local storage and no mixer API. Scope changes hide it. */
export function useGroupSpill(scope:string){
 const [value,setValue]=useState<{scope:string;channels:number[]}|null>(null);
 useEffect(()=>setValue(null),[scope]);
 const channels=value?.scope===scope?value.channels:null;
 return {channels,show:(channels:number[])=>setValue({scope,channels:[...channels]}),clear:()=>setValue(null)};
}
export function GroupSpillNotice({clear}:{clear:()=>void}){
 return <div className="group-spill-notice" role="status"><span>{tx('Vue du groupe · mix actuellement sélectionné')}</span><button type="button" onClick={clear}>{tx('Quitter la vue du groupe')}</button></div>;
}
