import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {FileText,Upload,X} from 'lucide-react';
import {MAX_SONG_PDF_BYTES} from '../../shared/song-pdf';
import {tx} from './i18n';

const Reader=lazy(()=>import('./SongPdfReader').then(m=>({default:m.SongPdfReader})));
type Props={song:{id:string;title:string;hasPdf?:boolean};editable:boolean;onClose:()=>void;onChange:(attached:boolean)=>void};

export function SongPdfDialog({song,editable,onClose,onChange}:Props){
 const dialog=useRef<HTMLDialogElement>(null),picker=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const url='/api/songs/'+encodeURIComponent(song.id)+'/pdf';
 useEffect(()=>{const node=dialog.current;node?.showModal();return ()=>node?.close();},[]);
 async function attach(file:File){
  setError('');
  if(file.size>MAX_SONG_PDF_BYTES){setError('La fiche dépasse la limite de 12 Mo.');return;}
  if(song.hasPdf&&!window.confirm(tx('Remplacer la fiche PDF de ce morceau ?')))return;
  setBusy(true);
  try{
   const {validateSongPdf}=await import('./SongPdfReader');
   await validateSongPdf(file);
  }catch{setError('Choisis un PDF lisible, sans mot de passe.');setBusy(false);return;}
  try{
   const response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:file});
   if(!response.ok)throw Error();
   setRevision(n=>n+1);onChange(true);
  }catch{setError('Impossible d’enregistrer la fiche PDF.');}
  finally{setBusy(false);}
 }
 async function detach(){
  if(!window.confirm(tx('Retirer la fiche PDF de ce morceau ?')))return;
  setBusy(true);setError('');
  try{const response=await fetch(url,{method:'DELETE'});if(!response.ok&&response.status!==404)throw Error();onChange(false);}
  catch{setError('Impossible de retirer la fiche PDF.');}
  finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="song-pdf-dialog" aria-labelledby="song-pdf-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <header><FileText size={23}/><div><small>{tx('Fiche PDF')}</small><h2 id="song-pdf-title">{song.title}</h2></div><button type="button" disabled={busy} aria-label={tx('Fermer')} onClick={onClose}><X size={19}/></button></header>
  {!song.hasPdf&&<p>{tx('Joins la fiche PDF exportée par BandStudio pour la consulter ici.')}</p>}
  {editable&&<div className="song-pdf-actions">
   <input hidden type="file" ref={picker} accept="application/pdf,.pdf" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void attach(file);}}/>
   <button type="button" disabled={busy} onClick={()=>picker.current?.click()}><Upload size={16}/>{tx(song.hasPdf?'Remplacer le PDF':'Joindre un PDF')}</button>
   {song.hasPdf&&<button type="button" disabled={busy} onClick={()=>void detach()}>{tx('Retirer le PDF')}</button>}
   {busy&&<span role="status">{tx('Enregistrement…')}</span>}
  </div>}
  {error&&<p role="alert">{tx(error)}</p>}
  {song.hasPdf&&<Suspense fallback={<p role="status">{tx('Chargement du PDF…')}</p>}><Reader key={revision} url={url}/></Suspense>}
 </dialog>;
}
