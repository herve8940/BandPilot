import {useRef,useState,type PointerEvent} from 'react';
import {Drum,Guitar,Headphones,Mic2,Piano,Plug,Speaker} from 'lucide-react';
import {stageCoordinates,stagePosition,type StagePosition} from '../../shared/tech-rider';
import type {Profile,Role} from './CoachSetup';
import {getLocale,tx} from './i18n';
import './tech-rider-document.css';

export const connectionLabels={micro:'Micro',di:'DI',line:'Ligne'};
export const standLabels={none:'Sans pied',short:'Pied court',tall:'Pied perche',clip:'Pince'};
export const providerLabels={band:'Groupe',venue:'Salle'};
export const monitorLabels={'in-ear':'In-ear',headphones:'Casque',wedge:'Enceinte de retour'};
const icons:Record<Role,typeof Mic2>={chant:Mic2,guitare:Guitar,basse:Guitar,batterie:Drum,clavier:Piano};
export const phantomLabel=(value:boolean|undefined)=>value===true?'Requis':value===false?'Non requis':'À confirmer';
const dateLabel=(date?:string)=>date?new Date(date.length===10?date+'T12:00:00':date).toLocaleDateString(getLocale()):'';

export function StagePlot({profile,onMove}:{profile:Profile;onMove?:(bus:number,position:StagePosition)=>void}){
 const people=profile.musicians??[],tech=profile.tech??{};
 const stage=useRef<HTMLDivElement>(null);
 const drag=useRef<{bus:number;pointer:number;offsetX:number;offsetY:number;position:StagePosition}|null>(null);
 const [preview,setPreview]=useState<{bus:number;position:StagePosition}|null>(null);
 const begin=(e:PointerEvent<HTMLButtonElement>,bus:number,index:number)=>{
  if(!onMove||e.button!==0||!stage.current)return;
  const bounds=stage.current.getBoundingClientRect(),pos=stageCoordinates(tech.positions?.[bus],index);
  drag.current={bus,pointer:e.pointerId,offsetX:(e.clientX-bounds.left)/bounds.width*100-pos.x,offsetY:(e.clientY-bounds.top)/bounds.height*100-pos.y,position:stagePosition(pos.x,pos.y)};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=(e:PointerEvent<HTMLButtonElement>)=>{
  if(!drag.current||e.pointerId!==drag.current.pointer||!stage.current)return;
  const bounds=stage.current.getBoundingClientRect();
  const position=stagePosition((e.clientX-bounds.left)/bounds.width*100-drag.current.offsetX,(e.clientY-bounds.top)/bounds.height*100-drag.current.offsetY);
  drag.current.position=position;setPreview({bus:drag.current.bus,position});
 };
 const end=(e:PointerEvent<HTMLButtonElement>)=>{
  if(!drag.current||e.pointerId!==drag.current.pointer)return;
  onMove?.(drag.current.bus,drag.current.position);drag.current=null;setPreview(null);
 };
 return <div className="rider-stage-wrap">
  <div className="rider-stage-caption"><span>{tx('Fond de scène')}</span><span>{tx('Vue depuis la salle')}</span></div>
  <div className={'rider-stage'+(onMove?' is-editable':'')} ref={stage}>
   {people.map((person,index)=>{
    const pos=stageCoordinates(preview?.bus===person.bus?preview.position:tech.positions?.[person.bus],index),Icon=icons[person.role],monitor=tech.monitors?.[person.bus];
    const content=<><Icon className="rider-instrument" size={25}/><strong>{person.name}</strong><span className="rider-stage-channels">{tx('Entrées')} {person.channels.join(' · ')||'—'}</span><span className="rider-stage-monitor">{monitor?.kind==='wedge'?<Speaker size={12}/>:<Headphones size={12}/>} {tx('Retour')} {person.bus}{monitor?.power&&<Plug size={13} aria-label={tx('Prise électrique')}/>}</span></>;
    const style={left:pos.x+'%',top:pos.y+'%'};
    return onMove?<button type="button" className="rider-stage-person" key={person.bus} style={style} aria-label={tx('Déplacer ')+person.name} onPointerDown={e=>begin(e,person.bus,index)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null;setPreview(null);}} onLostPointerCapture={()=>{drag.current=null;setPreview(null);}} onKeyDown={e=>{
     const delta=({ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]} as Record<string,number[]>)[e.key];
     if(delta){e.preventDefault();onMove(person.bus,stagePosition(pos.x+delta[0],pos.y+delta[1]));}
    }}>{content}</button>:<div className="rider-stage-person" key={person.bus} style={style}>{content}</div>;
   })}
   {!people.length&&<p className="rider-stage-empty">{tx('Ajoute les musiciens dans Préparer les retours pour afficher leurs cartes.')}</p>}
  </div>
  <div className="rider-audience">{tx('Avant-scène')}<span>{tx('PUBLIC')}</span></div>
 </div>;
}

export function TechRiderDocument({profile}:{profile:Profile}){
 const tech=profile.tech??{},people=profile.musicians??[],inputs=[...profile.inputs].sort((a,b)=>a.channel-b.channel);
 const missing=tx('À préciser');
 const stereo=new Map<number,string>();
 for(const input of inputs){const other=tech.inputs?.[input.channel]?.stereoWith;if(other&&inputs.some(i=>i.channel===other)){stereo.set(input.channel,`L · ${input.channel}/${other}`);stereo.set(other,`R · ${input.channel}/${other}`);}}
 const heading=(number:string,title:string)=><h2><span>{number}</span>{tx(title)}</h2>;
 return <article className="tech-document">
  <section className="rider-sheet">
   <header className="rider-doc-header"><div><p className="rider-kicker">{tx('FICHE TECHNIQUE')}</p><h1>{tech.bandName||tx('Mon groupe')}</h1><p>{[tech.eventName,dateLabel(tech.eventDate)].filter(Boolean).join(' · ')||tx('Concert à préciser')}</p></div><div className="rider-brand">BandPilot<small>{tx('Plan de scène & accueil technique')}</small></div></header>
   <div className="rider-facts"><div><b>{tx('Contact technique')}</b><span>{tech.contactName||missing}</span><span>{[tech.contactEmail,tech.contactPhone].filter(Boolean).join(' · ')}</span></div><div><b>{tx('Espace scénique')}</b><span>{tech.stageSize||missing}</span></div><div><b>{tx('Configuration')}</b><span>{inputs.length} {tx('entrées')} · {people.length} {tx('retours')}</span>{tech.updatedAt&&<span>{tx('Mise à jour')} {dateLabel(tech.updatedAt)}</span>}</div></div>
   {heading('01','Plan de scène')}<StagePlot profile={profile}/>
   {heading('02','Matériel & accueil')}
   <div className="rider-equipment"><section><h3>{tx('Apporté par le groupe')}</h3><p>{tech.providedEquipment||missing}</p></section><section><h3>{tx('Demandé à la salle')}</h3><p>{tech.requestedEquipment||missing}</p></section></div>
   {tech.notes&&<section className="rider-notes"><h3>{tx('Informations complémentaires')}</h3><p>{tech.notes}</p></section>}
   <footer className="rider-doc-footer"><span>{tech.bandName||tx('Mon groupe')}</span><span>BandPilot · {tx('Fiche technique')}</span></footer>
  </section>
  <section className="rider-sheet">
   <header className="rider-page-header"><strong>{tech.bandName||tx('Mon groupe')}</strong><span>{tx('Câblage & retours')}</span></header>
   {heading('03','Liste de câblage')}
   <table className="rider-patch-table"><thead><tr>{['Entrée','Instrument / musicien','Micro / DI','Pied','48 V','Fourni par'].map(label=><th scope="col" key={label}>{tx(label)}</th>)}</tr></thead><tbody>{inputs.map(input=>{
    const detail=tech.inputs?.[input.channel]??{},names=people.filter(p=>p.channels.includes(input.channel)).map(p=>p.name).join(', ');
    return <tr key={input.channel}><td><b className="rider-channel">{String(input.channel).padStart(2,'0')}</b>{stereo.has(input.channel)&&<small>{stereo.get(input.channel)}</small>}</td><td><strong>{input.name}</strong>{names&&<small>{names}</small>}{detail.notes&&<small className="rider-input-note">{detail.notes}</small>}</td><td>{detail.microphone||missing}<small>{detail.connection?tx(connectionLabels[detail.connection]):missing}</small></td><td>{detail.stand?tx(standLabels[detail.stand]):missing}</td><td className={detail.phantom===undefined?'rider-unconfirmed':''}>{tx(phantomLabel(detail.phantom))}</td><td>{detail.provider?tx(providerLabels[detail.provider]):missing}</td></tr>;
   })}</tbody></table>
   {!inputs.length&&<p>{tx('Ajoute les instruments du groupe pour préparer le câblage.')}</p>}
   <p className="rider-footnote">{tx('Les indications de 48 V sont à vérifier au branchement.')}</p>
   {heading('04','Retours des musiciens')}
   <table className="rider-monitor-table"><thead><tr>{['Bus','Musicien','Retour souhaité','Matériel / remarques'].map(label=><th scope="col" key={label}>{tx(label)}</th>)}</tr></thead><tbody>{people.map(person=>{
    const m=tech.monitors?.[person.bus]??{};
    return <tr key={person.bus}><td><b className="rider-channel">{person.bus}</b></td><td><strong>{person.name}</strong></td><td>{m.kind?tx(monitorLabels[m.kind]):missing}<small>{m.mode?tx(m.mode==='stereo'?'Stéréo':'Mono'):missing}</small></td><td>{m.equipment||'—'}{m.power&&<small>{tx('Prise électrique à proximité')}</small>}{m.notes&&<small>{m.notes}</small>}</td></tr>;
   })}</tbody></table>
   {!people.length&&<p>{tx('Retours à préciser avec le groupe.')}</p>}
   <p className="rider-footnote">{tx('Besoins de retours à confirmer avec la salle. Les paires de sorties stéréo sont à convenir.')}</p>
   <footer className="rider-doc-footer"><span>{tech.bandName||tx('Mon groupe')}</span><span>BandPilot · {tx('Fiche technique')}</span></footer>
  </section>
 </article>;
}
