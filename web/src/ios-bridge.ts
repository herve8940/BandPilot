import {sanitizeDiagnostic} from '../../shared/diagnostic-report';
type Result={error?:string;[key:string]:any};
type Host={invoke(action:string,id:string,json:string):void;getLanguage():string;setLanguage(language:string):boolean};
declare global{interface Window{BandPilotIOS?:Host;__bandpilotIOSResult?:(id:string,result:Result)=>void}}
const native=window.BandPilotIOS;
if(native){
 const pending=new Map<string,{resolve:(r:Result)=>void;timer:ReturnType<typeof setTimeout>}>();
 window.__bandpilotIOSResult=(id,result)=>{const p=pending.get(id);if(p){clearTimeout(p.timer);pending.delete(id);p.resolve(result);}};
 const call=(action:string,input:unknown)=>new Promise<Result>((resolve,reject)=>{
  const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('La demande iPad a expiré. Réessaie.'));},180000);
  pending.set(id,{resolve,timer});native.invoke(action,id,JSON.stringify(input));
 });
 const checked=async(p:Promise<Result>)=>{const r=await p;if(r.error)throw Error(r.error);return r;};
 (window as any).bandpilotLanguage={get:()=>native.getLanguage(),set:(language:string)=>native.setLanguage(language)};
 window.bandpilotDocuments={saveTechRiderPDF:input=>checked(call('print',{html:input.html,name:input.filename}))};
 const save=async(name:string,blob:Blob)=>{
  if(blob.size>10_000_000)throw Error('Fichier trop volumineux pour cet export.');
  const base64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
  return checked(call('save',{name,base64}));
 };
 const click=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){if(this.download){const url=new URL(this.href);if(url.origin!==location.origin&&url.protocol!=='blob:')return;void fetch(url).then(r=>r.blob()).then(b=>save(this.download,b)).catch(e=>window.alert(e.message));}else click.call(this);};
 window.open=(url?:string|URL)=>{if(url&&String(url).startsWith('https://'))void checked(call('open',{url:String(url)})).catch(e=>window.alert(e.message));return null;};
 document.addEventListener('click',event=>{const a=(event.target as Element)?.closest?.('a[target="_blank"]') as HTMLAnchorElement|null;if(a?.href.startsWith('https://')){event.preventDefault();window.open(a.href);}});
 const reports=new Map<string,any>();
 const report=(id:string)=>{const r=reports.get(id);if(!r)throw Error('Prépare le rapport avant de le partager.');return r;};
 const repository='https://github.com/herve8940/BandPilot';
 window.bandpilotSupport={
  directIssue:false,status:async()=>({configured:false,repository}),
  connect:async()=>({error:'Utilise Créer dans le navigateur sur iPad.'}),send:async()=>({error:'Utilise Créer dans le navigateur sur iPad.'}),
  prepare:async input=>{const response=await fetch('/api/diagnostics/report');if(!response.ok)throw Error('Diagnostic indisponible');const r=await response.json();r.id=crypto.randomUUID();r.summary=sanitizeDiagnostic(input.summary);r.description=sanitizeDiagnostic(input.description);reports.set(r.id,r);if(reports.size>10)reports.delete(reports.keys().next().value!);return {id:r.id,content:JSON.stringify(r,null,2)};},
  export:async id=>save(`BandPilot-debug-${id}.json`,new Blob([JSON.stringify(report(id),null,2)],{type:'application/json'})),
  browser:async id=>{const r=report(id);await checked(call('clipboard',{text:`Rapport BandPilot iPad\n\n${JSON.stringify(r,null,2).split('\n').map(line=>'    '+line).join('\n')}`}));await checked(call('open',{url:`${repository}/issues/new?title=${encodeURIComponent('[BandPilot iPad] '+r.summary)}`}));return {copied:true};},
  checkUpdate:async()=>checked(call('checkUpdate',{})),openUpdate:async()=>checked(call('openUpdate',{}))
 };
 document.documentElement.dataset.platform='ios';
}
