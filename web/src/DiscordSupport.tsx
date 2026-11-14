import {useRef,useState} from 'react';
import {redactDiagnosticText} from '../../shared/diagnostic-report';
import {CommunityLink} from './CommunityLink';
import {tx,useLanguage} from './i18n';
import {isAndroid} from './platform';

export function DiscordHelp(){
 useLanguage();
 return <section className="support-community" aria-label={tx('Aide sur Discord')}>
  <h3>{tx('Aide sur Discord')}</h3>
  <p>{tx('Installation, connexion, balance ou retours : pose ta question dans #entraide-help.')}</p>
  <div className="support-actions"><CommunityLink destination="help"/><CommunityLink destination="guide"/><CommunityLink destination="ideas"/></div>
  <p className="support-hint">{tx('Première visite ou salon inaccessible ? Rejoins le serveur, puis rouvre le salon depuis BandPilot. Un compte Discord est nécessaire.')}</p>
  <CommunityLink/>
 </section>;
}

// Only explicit user text and the app version enter this message. No logs,
// profiles, audio, addresses or credentials are fetched for Discord.
const clean=(text:string)=>redactDiagnosticText(text.trim()).replace(/@/g,'@\u200b');
export function DiscordIncident({summary,description,version,disabled=false}:{summary:string;description:string;version:{version:string;build:string};disabled?:boolean}){
 useLanguage();
 const [context,setContext]=useState('');
 const [copyState,setCopyState]=useState<{message:string;status:'copied'|'manual'}|null>(null);
 const [copying,setCopying]=useState(false);
 const preview=useRef<HTMLTextAreaElement>(null);
 const message=[
  `${tx('Incident BandPilot')} — ${clean(summary)}`,
  `BandPilot ${clean(version.version)||tx('Version inconnue')}${version.build?` (${clean(version.build).slice(0,80)})`:''}${isAndroid?' · Android':''}`,
  context.trim()?`${tx('Console et contexte')} : ${clean(context)}`:'',
  description.trim()?`${tx('Étapes pour retrouver le problème')} :\n${clean(description)}`:'',
 ].filter(Boolean).join('\n\n');
 const tooLong=message.length>2000;
 const status=copyState?.message===message?copyState.status:null;
 const copy=async()=>{
  if(copying||disabled||!summary.trim()||tooLong)return;
  setCopying(true);setCopyState(null);
  try{
   if(window.bandpilotSupport?.copyText){const result=await window.bandpilotSupport.copyText(message);if(result.error)throw Error(result.error);}
   else await navigator.clipboard.writeText(message);
   setCopyState({message,status:'copied'});
  }catch{
   preview.current?.focus();preview.current?.select();
   setCopyState({message,status:'manual'});
  }finally{setCopying(false);}
 };
 return <section className="discord-incident" aria-label={tx('Signaler un incident sur Discord')}>
  <label>{tx('Console et contexte (facultatif)')}<input maxLength={200} value={context} disabled={disabled||copying} placeholder={tx('Modèle, simulation ou console réelle, type d’écoute…')} onChange={e=>setContext(e.target.value)}/></label>
  <p>{tx('Relis le message, copie-le, puis colle-le dans #bugs-tests. Tu choisis quand le publier dans Discord. Aucun journal ni fichier audio n’est joint.')}</p>
  {summary.trim()&&<>
   <label>{tx('Message à copier dans Discord')}<textarea ref={preview} className="discord-preview" rows={8} readOnly value={message}/></label>
   <p className="support-hint">{message.length} / 2000 · {tx('Vérifie aussi les informations personnelles que tu as saisies.')}</p>
   {tooLong&&<p role="alert">{tx('Le message dépasse 2 000 caractères. Raccourcis la description ou le contexte avant de le copier.')}</p>}
  </>}
  <div className="support-actions"><button type="button" className="primary" disabled={disabled||copying||!summary.trim()||tooLong} onClick={()=>void copy()}>{tx('Copier le message Discord')}</button><CommunityLink destination="bugs"/></div>
  {status&&<p role="status">{tx(status==='copied'?'Message copié. Ouvre #bugs-tests, colle le message et envoie-le dans Discord.':'Copie automatique indisponible. Le texte est sélectionné : copie-le manuellement, puis ouvre #bugs-tests.')}</p>}
 </section>;
}
