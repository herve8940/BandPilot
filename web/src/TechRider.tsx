import {useState} from 'react';
import {CONNECTION_TYPES,type StagePosition,type TechInput} from '../../shared/tech-rider';
import type {Profile} from './CoachSetup';
import {tx} from './i18n';
import './tech-rider.css';

const labels={micro:'Micro',di:'DI',line:'Ligne'};
const rows=['Fond de scène','Milieu de scène','Avant-scène'];
const columns=['Gauche','Centre','Droite'];

export function TechRider({profile,editable,onChange,onSave}:{profile:Profile;editable:boolean;onChange:(profile:Profile)=>void;onSave:()=>void}){
 const [dragBus,setDragBus]=useState<number|null>(null);
 const inputs=[...profile.inputs].sort((a,b)=>a.channel-b.channel), people=profile.musicians??[];
 const tech=profile.tech??{}, details=tech.inputs??{};
 const position=(bus:number,index:number)=>tech.positions?.[bus]??{row:Math.floor(index/3),column:index%3};
 const setInput=(channel:number,patch:Partial<TechInput>)=>onChange({...profile,tech:{...tech,inputs:{...details,[channel]:{...details[channel],...patch}}}});
 const move=(bus:number,pos:StagePosition)=>{if(editable&&people.some(p=>p.bus===bus))onChange({...profile,tech:{...tech,positions:{...tech.positions,[bus]:pos}}});};
 const partnerOf=new Map(inputs.flatMap(i=>details[i.channel]?.stereoWith===i.channel+1&&inputs.some(j=>j.channel===i.channel+1)?[[i.channel+1,i.channel] as const]:[]));
 const describe=(channel:number)=>{
  const input=inputs.find(i=>i.channel===channel), info=details[channel];
  return <>{channel} · {input?.name??tx("Entrée à attribuer")}{info?.connection?` · ${tx(labels[info.connection])}`:''}{info?.phantom?' · 48 V':''}</>;
 };
 return <details className="tech-rider">
  <summary>{tx("Fiche technique du groupe")}</summary>
  <div className="tech-print">
   <h3>{tx("Fiche technique du groupe")}</h3>
   <p>{tx("Branchements prévus. Le 48 V est une indication de câblage.")}</p>
   <div className="tech-people">{people.map(p=><article key={p.bus}>
    <h4>{p.name} · {tx("Retour")} {p.bus}</h4>
    <ul>{[...new Set(p.channels)].sort((a,b)=>a-b).map(channel=><li key={channel}>{describe(channel)}</li>)}</ul>
   </article>)}</div>
   {!people.length&&<p>{tx("Ajoute les musiciens dans Préparer les retours pour afficher leurs cartes.")}</p>}
   <h4>{tx("Liste de câblage")}</h4>
   <div className="tech-patch">{inputs.filter(i=>!partnerOf.has(i.channel)).map(i=>{
    const right=partnerOf.has(i.channel+1)&&partnerOf.get(i.channel+1)===i.channel;
    return <article key={i.channel}>
     <b>{describe(i.channel)}{right&&<> / {describe(i.channel+1)}</>}</b>
     <small>{people.filter(p=>p.channels.includes(i.channel)||(right&&p.channels.includes(i.channel+1))).map(p=>p.name).join(', ')}</small>
    </article>;
   })}</div>
   <h4>{tx("Plan de scène")}</h4>
   <p>{tx("Vue de dessus, depuis la salle")}</p>
   <div className="tech-stage">{rows.flatMap((row,r)=>columns.map((column,c)=><div key={r*3+c} onDragOver={e=>{if(editable)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(dragBus!==null)move(dragBus,{row:r,column:c});setDragBus(null);}}>
    <small>{tx(row)} · {tx(column)}</small>
    {people.map((p,index)=>({p,pos:position(p.bus,index)})).filter(({pos})=>pos.row===r&&pos.column===c).map(({p})=><article key={p.bus} draggable={editable} onDragStart={e=>{e.dataTransfer.setData('text/plain',String(p.bus));setDragBus(p.bus);}} onDragEnd={()=>setDragBus(null)}>
     <b>{p.name}</b><small>{p.channels.map(channel=>inputs.find(i=>i.channel===channel)?.name??String(channel)).join(' · ')}</small>
    </article>)}
   </div>))}</div>
   <p className="tech-audience">{tx("Public")}</p>
  </div>
  {editable&&<details className="tech-edit"><summary>{tx("Modifier les branchements et les positions")}</summary>
   {inputs.map(i=><fieldset key={i.channel}><legend>{i.channel} · {i.name}</legend>
    <label>{tx("Branchement")} <select value={details[i.channel]?.connection??''} onChange={e=>setInput(i.channel,{connection:(e.target.value||undefined) as TechInput['connection']})}>
     <option value="">{tx("À préciser")}</option>{CONNECTION_TYPES.map(id=><option key={id} value={id}>{tx(labels[id])}</option>)}
    </select></label>
    <label><input type="checkbox" checked={details[i.channel]?.phantom??false} onChange={e=>setInput(i.channel,{phantom:e.target.checked})}/> {tx("48 V à vérifier")}</label>
    {inputs.some(j=>j.channel===i.channel+1)&&<label><input type="checkbox" disabled={partnerOf.has(i.channel)||!!details[i.channel+1]?.stereoWith} checked={details[i.channel]?.stereoWith===i.channel+1} onChange={e=>setInput(i.channel,{stereoWith:e.target.checked?i.channel+1:undefined})}/> {tx("Paire stéréo avec l’entrée suivante")}</label>}
   </fieldset>)}
   {people.map((p,index)=><label key={p.bus}>{p.name} <select value={position(p.bus,index).row*3+position(p.bus,index).column} onChange={e=>{const cell=Number(e.target.value);move(p.bus,{row:Math.floor(cell/3),column:cell%3});}}>{rows.flatMap((r,ri)=>columns.map((c,ci)=><option key={ri*3+ci} value={ri*3+ci}>{tx(r)} · {tx(c)}</option>))}</select></label>)}
  </details>}
  <div className="coach-actions">
   {editable&&<button type="button" onClick={onSave}>{tx("Enregistrer la fiche technique")}</button>}
   <button type="button" onClick={()=>window.print()}>{tx("Imprimer la fiche technique")}</button>
  </div>
 </details>;
}
