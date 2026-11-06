import {useState} from 'react';
import {Cable,Check,FileDown,FileText,MapPin,Printer,Save} from 'lucide-react';
import {CONNECTION_TYPES,EQUIPMENT_PROVIDERS,STAND_TYPES,TECH_TEXT_LIMITS,type StagePosition,type TechInput,type TechMonitor,type TechRider as Rider} from '../../shared/tech-rider';
import type {Profile} from './CoachSetup';
import {tx} from './i18n';
import {connectionLabels,monitorLabels,providerLabels,StagePlot,standLabels,TechRiderDocument} from './TechRiderDocument';
import {exportTechRider,printTechRider} from './tech-rider-export';
import './tech-rider.css';

const rows=['Fond de scène','Milieu de scène','Avant-scène'],columns=['Gauche','Centre','Droite'];
type Pane='info'|'patch'|'stage'|'preview';
const panes:{id:Pane;label:string;icon:typeof FileText}[]=[{id:'info',label:'Informations',icon:FileText},{id:'patch',label:'Câblage',icon:Cable},{id:'stage',label:'Scène & retours',icon:MapPin},{id:'preview',label:'Aperçu PDF',icon:FileDown}];

export function TechRider({profile,editable,onChange,onSave}:{profile:Profile;editable:boolean;onChange:(profile:Profile)=>void;onSave:(profile:Profile)=>Promise<void>}){
 const [pane,setPane]=useState<Pane>('info'),[exporting,setExporting]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[dirty,setDirty]=useState(false);
 const inputs=[...profile.inputs].sort((a,b)=>a.channel-b.channel),people=profile.musicians??[],tech=profile.tech??{},details=tech.inputs??{};
 const update=(patch:Partial<Rider>)=>{if(!editable)return;onChange({...profile,tech:{...tech,...patch,updatedAt:new Date().toISOString()}});setDirty(true);setNotice('');};
 const setInput=(channel:number,patch:Partial<TechInput>)=>update({inputs:{...details,[channel]:{...details[channel],...patch}}});
 const setMonitor=(bus:number,patch:Partial<TechMonitor>)=>update({monitors:{...tech.monitors,[bus]:{...tech.monitors?.[bus],...patch}}});
 const move=(bus:number,pos:StagePosition)=>update({positions:{...tech.positions,[bus]:pos}});
 const partnerOf=new Map(inputs.flatMap(i=>details[i.channel]?.stereoWith===i.channel+1&&inputs.some(j=>j.channel===i.channel+1)?[[i.channel+1,i.channel] as const]:[]));
 const run=async(action:()=>Promise<void>)=>{setError('');setNotice('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Action indisponible');}};
 const field=(key:keyof typeof TECH_TEXT_LIMITS,label:string,multiline=false)=> <label className={multiline?'rider-field rider-field-wide':'rider-field'} key={key}><span>{tx(label)}</span>{multiline?<textarea rows={4} value={tech[key]??''} maxLength={TECH_TEXT_LIMITS[key]} disabled={!editable} onChange={e=>update({[key]:e.target.value})}/>:<input type={key==='contactEmail'?'email':key==='contactPhone'?'tel':'text'} value={tech[key]??''} maxLength={TECH_TEXT_LIMITS[key]} disabled={!editable} onChange={e=>update({[key]:e.target.value})}/>}</label>;
 return <details className="tech-rider">
  <summary><FileText size={22}/><span><strong>{tx('Fiche technique du groupe')}</strong><small>{tx('Plan de scène, câblage et PDF pour la salle')}</small></span><span className="rider-summary-count">{inputs.length} {tx('entrées')}</span></summary>
  <div className="rider-workspace">
   <div className="rider-toolbar"><div><span className="rider-eyebrow">{tx('PRÉPARER LE CONCERT')}</span><h3>{tech.bandName||tx('La fiche de ton groupe')}</h3></div><div className="rider-actions">
    {editable&&<button type="button" onClick={()=>void run(async()=>{await onSave(profile);setDirty(false);setNotice('Fiche technique enregistrée.');})}><Save size={15}/>{tx('Enregistrer')}</button>}
    <button type="button" disabled={exporting} onClick={()=>void run(()=>printTechRider(profile))}><Printer size={15}/>{tx('Imprimer')}</button>
    <button type="button" className="primary" disabled={exporting} onClick={()=>void run(async()=>{setExporting(true);try{const result=await exportTechRider(profile);if(result==='saved')setNotice('PDF enregistré.');else if(result==='print')setNotice('Choisis Enregistrer au format PDF dans la fenêtre d’impression.');}finally{setExporting(false);}})}><FileDown size={15}/>{tx(exporting?'Export en cours…':'Exporter PDF')}</button>
   </div></div>
   <div className="rider-status-line"><span>{tx('Préremplie avec les instruments et les musiciens du groupe.')}</span>{dirty&&<span className="rider-dirty">{tx('Modifications à enregistrer')}</span>}</div>
   {notice&&<p className="rider-notice" role="status"><Check size={16}/>{tx(notice)}</p>}{error&&<p className="rider-error" role="alert">{tx(error)}</p>}
   <nav className="rider-tabs" aria-label={tx('Sections de la fiche technique')}>{panes.map(({id,label,icon:Icon})=><button type="button" key={id} aria-pressed={pane===id} onClick={()=>setPane(id)}><Icon size={16}/>{tx(label)}</button>)}</nav>
   {pane==='info'&&<div className="rider-info">
    <section className="rider-editor-section"><h4>{tx('Groupe & concert')}</h4><div className="rider-fields">{field('bandName','Nom du groupe')}{field('eventName','Concert / lieu')}<label className="rider-field"><span>{tx('Date du concert')}</span><input type="date" value={tech.eventDate??''} disabled={!editable} onChange={e=>update({eventDate:e.target.value})}/></label>{field('stageSize','Dimensions / espace nécessaire')}</div></section>
    <section className="rider-editor-section"><h4>{tx('Contact technique')}</h4><div className="rider-fields">{field('contactName','Nom du contact')}{field('contactPhone','Téléphone')}{field('contactEmail','Adresse e-mail')}</div></section>
    <section className="rider-editor-section"><h4>{tx('Matériel & accueil')}</h4><div className="rider-fields rider-equipment-fields">{field('providedEquipment','Apporté par le groupe',true)}{field('requestedEquipment','Demandé à la salle',true)}{field('notes','Informations complémentaires',true)}</div></section>
   </div>}
   {pane==='patch'&&<div className="rider-editor-section"><h4>{tx('Liste de câblage')}</h4><p className="rider-hint">{tx('Une ligne par entrée console. Les indications de 48 V ne modifient pas la console.')}</p>
    <div className="rider-input-list">{inputs.map(input=>{
     const d=details[input.channel]??{},owners=people.filter(p=>p.channels.includes(input.channel)).map(p=>p.name).join(', ');
     return <details className="rider-input-editor" key={input.channel}><summary><b className="rider-input-number">{String(input.channel).padStart(2,'0')}</b><span><strong>{input.name}</strong><small>{owners||tx('Musicien à préciser')}</small></span><span className="rider-input-summary">{d.microphone||(d.connection?tx(connectionLabels[d.connection]):tx('Branchement à préciser'))}{d.phantom===true?' · 48 V':''}{d.stereoWith?` · L ${input.channel}/${d.stereoWith}`:partnerOf.has(input.channel)?` · R ${partnerOf.get(input.channel)}/${input.channel}`:''}</span></summary>
      <div className="rider-fields">
       <label className="rider-field"><span>{tx('Branchement')}</span><select value={d.connection??''} disabled={!editable} onChange={e=>setInput(input.channel,{connection:(e.target.value||undefined) as TechInput['connection']})}><option value="">{tx('À préciser')}</option>{CONNECTION_TYPES.map(k=><option key={k} value={k}>{tx(connectionLabels[k])}</option>)}</select></label>
       <label className="rider-field"><span>{tx('Micro / DI souhaité')}</span><input value={d.microphone??''} disabled={!editable} maxLength={120} onChange={e=>setInput(input.channel,{microphone:e.target.value})}/></label>
       <label className="rider-field"><span>{tx('Pied de micro')}</span><select value={d.stand??''} disabled={!editable} onChange={e=>setInput(input.channel,{stand:(e.target.value||undefined) as TechInput['stand']})}><option value="">{tx('À préciser')}</option>{STAND_TYPES.map(k=><option key={k} value={k}>{tx(standLabels[k])}</option>)}</select></label>
       <label className="rider-field"><span>{tx('Alimentation 48 V')}</span><select value={d.phantom===undefined?'':String(d.phantom)} disabled={!editable} onChange={e=>setInput(input.channel,{phantom:e.target.value===''?undefined:e.target.value==='true'})}><option value="">{tx('À confirmer')}</option><option value="true">{tx('Requis')}</option><option value="false">{tx('Non requis')}</option></select></label>
       <label className="rider-field"><span>{tx('Fourni par')}</span><select value={d.provider??''} disabled={!editable} onChange={e=>setInput(input.channel,{provider:(e.target.value||undefined) as TechInput['provider']})}><option value="">{tx('À confirmer')}</option>{EQUIPMENT_PROVIDERS.map(k=><option key={k} value={k}>{tx(providerLabels[k])}</option>)}</select></label>
       {inputs.some(i=>i.channel===input.channel+1)&&<label className="rider-check"><input type="checkbox" disabled={!editable||partnerOf.has(input.channel)||!!details[input.channel+1]?.stereoWith} checked={d.stereoWith===input.channel+1} onChange={e=>setInput(input.channel,{stereoWith:e.target.checked?input.channel+1:undefined})}/><span>{tx('Paire stéréo avec l’entrée suivante')}</span></label>}
       <label className="rider-field rider-field-wide"><span>{tx('Remarques de câblage')}</span><textarea rows={2} value={d.notes??''} disabled={!editable} maxLength={300} onChange={e=>setInput(input.channel,{notes:e.target.value})}/></label>
      </div>
     </details>;
    })}</div>{!inputs.length&&<p>{tx('Ajoute les instruments du groupe pour préparer le câblage.')}</p>}
   </div>}
   {pane==='stage'&&<div className="rider-editor-section"><h4>{tx('Plan de scène')}</h4><p className="rider-hint">{tx('Déplace les musiciens à la souris ou au doigt. Au clavier, utilise les flèches sur une carte.')}</p><StagePlot profile={profile} onMove={editable?move:undefined}/>
    <h4>{tx('Retours & alimentation')}</h4><p className="rider-hint">{tx('Les besoins indiqués ici sont à convenir avec la salle ; ils ne changent pas le routage audio.')}</p>
    <div className="rider-monitor-editors">{people.map((person,index)=>{
     const m=tech.monitors?.[person.bus]??{},pos=tech.positions?.[person.bus]??{row:Math.floor(index/3),column:index%3};
     return <fieldset key={person.bus}><legend>{person.name} · {tx('Retour')} {person.bus}</legend><div className="rider-fields">
      <label className="rider-field"><span>{tx('Position sur scène')}</span><select value={pos.row*3+pos.column} disabled={!editable} onChange={e=>move(person.bus,{row:Math.floor(Number(e.target.value)/3),column:Number(e.target.value)%3})}>{rows.flatMap((r,ri)=>columns.map((c,ci)=><option key={ri*3+ci} value={ri*3+ci}>{tx(r)} · {tx(c)}</option>))}</select></label>
      <label className="rider-field"><span>{tx('Type de retour')}</span><select value={m.kind??''} disabled={!editable} onChange={e=>setMonitor(person.bus,{kind:(e.target.value||undefined) as TechMonitor['kind']})}><option value="">{tx('À préciser')}</option>{Object.entries(monitorLabels).map(([key,label])=><option value={key} key={key}>{tx(label)}</option>)}</select></label>
      <label className="rider-field"><span>{tx('Besoin mono / stéréo')}</span><select value={m.mode??''} disabled={!editable} onChange={e=>setMonitor(person.bus,{mode:(e.target.value||undefined) as TechMonitor['mode']})}><option value="">{tx('À confirmer')}</option><option value="mono">{tx('Mono')}</option><option value="stereo">{tx('Stéréo')}</option></select></label>
      <label className="rider-field"><span>{tx('Matériel de retour')}</span><input value={m.equipment??''} maxLength={120} disabled={!editable} onChange={e=>setMonitor(person.bus,{equipment:e.target.value})}/></label>
      <label className="rider-check"><input type="checkbox" checked={m.power??false} disabled={!editable} onChange={e=>setMonitor(person.bus,{power:e.target.checked})}/><span>{tx('Prise électrique à proximité')}</span></label>
      <label className="rider-field rider-field-wide"><span>{tx('Remarques pour le retour')}</span><textarea rows={2} value={m.notes??''} maxLength={300} disabled={!editable} onChange={e=>setMonitor(person.bus,{notes:e.target.value})}/></label>
     </div></fieldset>;
    })}</div>
   </div>}
   {pane==='preview'&&<><p className="rider-hint">{tx('Document A4 : plan de scène et accueil, puis câblage et retours. Les longues notes peuvent ajouter des pages.')}</p><div className="rider-preview-scroll"><TechRiderDocument profile={profile}/></div></>}
  </div>
 </details>;
}
