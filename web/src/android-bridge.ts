import {sanitizeDiagnostic} from '../../shared/diagnostic-report';
type Result={error?:string;[key:string]:any};
type Host={invoke(action:string,id:string,json:string):void;getLanguage():string;setLanguage(language:string):boolean};
declare global{interface Window{BandPilotAndroid?:Host;__bandpilotAndroidResult?:(id:string,result:Result)=>void}}
const native=window.BandPilotAndroid;
if(native){
 const pending=new Map<string,(result:Result)=>void>();
 window.__bandpilotAndroidResult=(id,result)=>{pending.get(id)?.(result);pending.delete(id);};
 const call=(action:string,input:unknown)=>new Promise<Result>(resolve=>{const id=crypto.randomUUID();pending.set(id,resolve);native.invoke(action,id,JSON.stringify(input));});
 (window as any).bandpilotLanguage={get:()=>native.getLanguage(),set:(language:string)=>native.setLanguage(language)};
 window.bandpilotDocuments={saveTechRiderPDF:input=>call('print',{html:input.html,name:input.filename})};
 const save=async(name:string,blob:Blob)=>{
  if(blob.size>10_000_000)throw Error('Fichier trop volumineux pour cet export.');
  const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
  return call('save',{name,mime:blob.type||'application/octet-stream',base64});
 };
 const click=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){if(this.download){void fetch(this.href).then(r=>r.blob()).then(b=>save(this.download,b)).catch(e=>window.alert(e.message));}else click.call(this);};
 window.open=(url?:string|URL)=>{if(url&&String(url).startsWith('https://'))void call('open',{url:String(url)});return null;};
 document.addEventListener('click',event=>{const link=(event.target as Element)?.closest?.('a[target="_blank"]') as HTMLAnchorElement|null;if(link&&link.href.startsWith('https://')){event.preventDefault();void call('open',{url:link.href});}});
 const reports=new Map<string,any>();
 const report=(id:string)=>{const r=reports.get(id);if(!r)throw Error('Prépare le rapport avant de le partager.');return r;};
 const repository='https://github.com/herve8940/BandPilot';
 let update:Result|null=null;
 window.bandpilotSupport={
  directIssue:false,
  status:async()=>({configured:false,repository}),connect:async()=>({error:'Utilise Créer dans le navigateur sur Android.'}),
  prepare:async input=>{const response=await fetch('/api/diagnostics/report');if(!response.ok)throw Error('Diagnostic indisponible');const data=await response.json();data.id=crypto.randomUUID();data.summary=sanitizeDiagnostic(input.summary);data.description=sanitizeDiagnostic(input.description);reports.set(data.id,data);if(reports.size>10)reports.delete(reports.keys().next().value!);return {id:data.id,content:JSON.stringify(data,null,2)};},
  export:async id=>save(`BandPilot-debug-${id}.json`,new Blob([JSON.stringify(report(id),null,2)],{type:'application/json'})),
  send:async()=>({error:'Utilise Créer dans le navigateur sur Android.'}),
  browser:async id=>{const r=report(id);await call('clipboard',{text:`Rapport BandPilot Android\n\n${JSON.stringify(r,null,2).split('\n').map(line=>'    '+line).join('\n')}`});await call('open',{url:`${repository}/issues/new?title=${encodeURIComponent('[BandPilot Android] '+r.summary)}`});return {copied:true};},
  checkUpdate:async()=>{const response=await fetch('/api/android/update');const data=await response.json();if(!response.ok)throw Error(data.error||'Recherche de mise à jour indisponible.');update=data;return data;},
  openUpdate:async()=>{if(!update?.available)throw Error('Vérifie les mises à jour avant de télécharger.');return call('open',{url:update.downloadURL});}
 };
 document.documentElement.dataset.platform='android';
}
