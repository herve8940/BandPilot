import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Minus,Plus} from 'lucide-react';
import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy,type RenderTask} from 'pdfjs-dist/legacy/build/pdf.mjs';
import worker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import {tx} from './i18n';

GlobalWorkerOptions.workerSrc=worker;
export async function validateSongPdf(file:File){
 const job=getDocument({data:new Uint8Array(await file.arrayBuffer()),useWasm:false});
 try{const pdf=await job.promise;await pdf.getPage(1);}
 finally{await job.destroy();}
}

export function SongPdfReader({url}:{url:string}){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null);
 const [page,setPage]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(0);
 const [text,setText]=useState(''),[error,setError]=useState(false);
 const frame=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let active=true;
  const job=getDocument({url,useWasm:false});
  job.promise.then(value=>{if(active)setPdf(value);}).catch(()=>{if(active)setError(true);});
  return ()=>{active=false;void job.destroy();};
 },[url]);
 useEffect(()=>{
  const node=frame.current;
  if(!node)return;
  const resize=()=>setWidth(Math.max(1,node.clientWidth));
  resize();const observer=new ResizeObserver(resize);observer.observe(node);
  return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const target=canvas.current;
  if(!pdf||!target||!width)return;
  let active=true,render:RenderTask|undefined;
  setText('');setError(false);
  void (async()=>{
   const sheet=await pdf.getPage(page);
   if(!active)return;
   const natural=sheet.getViewport({scale:1});
   const view=sheet.getViewport({scale:Math.min(width,1100)*zoom/natural.width});
   const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(8_000_000/(view.width*view.height)));
   target.width=Math.max(1,Math.floor(view.width*ratio));target.height=Math.max(1,Math.floor(view.height*ratio));
   target.style.width=view.width+'px';target.style.height=view.height+'px';
   render=sheet.render({canvas:target,viewport:view,transform:[ratio,0,0,ratio,0,0]});
   await render.promise;
   const content=await sheet.getTextContent();
   if(active)setText(content.items.map(item=>'str' in item?item.str:'').join(' '));
  })().catch(()=>{if(active)setError(true);});
  return ()=>{active=false;render?.cancel();};
 },[pdf,page,zoom,width]);
 return <>
  {pdf&&<nav className="pdf-navigation" aria-label={tx('Pages du PDF')}>
   <button type="button" aria-label={tx('Page précédente')} disabled={page<=1} onClick={()=>setPage(page-1)}><ChevronLeft/></button>
   <span aria-live="polite">{page} / {pdf.numPages}</span>
   <button type="button" aria-label={tx('Page suivante')} disabled={page>=pdf.numPages} onClick={()=>setPage(page+1)}><ChevronRight/></button>
   <button type="button" aria-label={tx('Réduire le zoom')} disabled={zoom<=1} onClick={()=>setZoom(zoom-.25)}><Minus/></button>
   <span>{Math.round(zoom*100)} %</span>
   <button type="button" aria-label={tx('Agrandir le zoom')} disabled={zoom>=2} onClick={()=>setZoom(zoom+.25)}><Plus/></button>
  </nav>}
  {error?<p role="alert">{tx('Impossible de lire cette fiche PDF.')}</p>:!pdf&&<p role="status">{tx('Chargement du PDF…')}</p>}
  <div ref={frame} className="song-pdf-page"><canvas ref={canvas} aria-hidden="true"/><span className="sr-only">{text}</span></div>
 </>;
}
