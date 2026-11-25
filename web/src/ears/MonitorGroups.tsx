import {useRef,useState,type PointerEvent,type ReactNode} from 'react';
import {EAR_GROUP_RANGE,type EarGroup} from '../../../shared/ear-group';
import {tx} from '../i18n';

type Choice = {prefix:string; name:string};
type Draft = Pick<EarGroup,'name'|'members'> & Partial<Pick<EarGroup,'id'|'revision'>>;
interface Props {
  token:string; groups:EarGroup[]; sources:Choice[]; online:boolean; canMove:boolean;
  renderSource:(prefix:string)=>ReactNode;
  move:(group:EarGroup,offset:number)=>void;
  notify:(message:string)=>void;
}

function GroupEditor({initial,sources,save,cancel,online}:{
  initial:Draft; sources:Choice[]; online:boolean; cancel:()=>void;
  save:(draft:Draft,remove?:boolean)=>Promise<void>;
}) {
  const [draft,setDraft]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [dragging,setDragging]=useState<string|null>(null);
  const list=useRef<HTMLUListElement>(null);
  const drag=useRef<{member:string; pointer:number; y:number; frame:number}|null>(null);
  const sourcesById=new Map(sources.map(s=>[s.prefix,s]));
  const rows=[...draft.members,...sources.map(s=>s.prefix).filter(p=>!draft.members.includes(p))];
  function reorder(member:string,target:string) {
    if(member===target)return;
    setDraft(prev=>{
      const from=prev.members.indexOf(member),to=prev.members.indexOf(target);
      if(from<0||to<0)return prev;
      const members=[...prev.members];members.splice(from,1);members.splice(to,0,member);
      return {...prev,members};
    });
  }
  function stopDrag(){
    if(drag.current)cancelAnimationFrame(drag.current.frame);
    drag.current=null;setDragging(null);
  }
  function startDrag(e:PointerEvent<HTMLButtonElement>,member:string){
    if(!e.isPrimary||e.button!==0)return;
    list.current?.setPointerCapture(e.pointerId);
    const active={member,pointer:e.pointerId,y:e.clientY,frame:0};
    drag.current=active;setDragging(member);
    const tick=()=>{
      if(drag.current!==active||!list.current?.isConnected)return;
      const bounds=list.current.getBoundingClientRect();
      const dock=document.querySelector('.ea-master')?.getBoundingClientRect();
      const top=Math.max(0,bounds.top),bottom=Math.min(dock?.top??window.innerHeight,bounds.bottom);
      if(active.y<top+38)window.scrollBy(0,-10);
      else if(active.y>bottom-38)window.scrollBy(0,10);
      const target=document.elementFromPoint(bounds.left+bounds.width/2,active.y)?.closest<HTMLElement>('[data-member]');
      if(target&&list.current.contains(target))reorder(active.member,target.dataset.member!);
      active.frame=requestAnimationFrame(tick);
    };
    active.frame=requestAnimationFrame(tick);
  }
  async function submit(remove=false){
    if(busy)return;
    setBusy(true);
    try{await save(draft,remove);}finally{setBusy(false);}
  }
  return <section className="ea-group-editor">
    <h3>{tx(initial.id?'Modifier le groupe':'Nouveau groupe')}</h3>
    <label>{tx('Nom du groupe')}<input autoFocus maxLength={40} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <p>{tx('Coche les entrées puis fais glisser leur poignée pour les ordonner.')}</p>
    <div className="ea-group-actions">
      <button disabled={busy} onClick={cancel}>{tx('Annuler')}</button>
      <button disabled={busy||!online||!draft.name.trim()||!draft.members.length} onClick={()=>void submit()}>{tx('Enregistrer')}</button>
      {initial.id&&<button disabled={busy||!online} onClick={()=>{if(confirm(tx('Supprimer ce groupe personnel ?')))void submit(true);}}>{tx('Supprimer')}</button>}
    </div>
    <ul ref={list}
      onPointerMove={e=>{if(drag.current?.pointer===e.pointerId)drag.current.y=e.clientY;}}
      onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}>{rows.map(prefix=>{
      const name=sourcesById.get(prefix)?.name??prefix,index=draft.members.indexOf(prefix);
      return <li key={prefix} data-member={prefix} className={dragging===prefix?'dragging':''}>
        <label><input type="checkbox" checked={index>=0} onChange={()=>setDraft({...draft,members:index>=0?draft.members.filter(p=>p!==prefix):[...draft.members,prefix]})}/><span>{name}</span></label>
        {index>=0&&<div className="ea-order">
          <button type="button" disabled={index===0} aria-label={tx('Monter')+' · '+name} onClick={()=>reorder(prefix,draft.members[index-1])}>↑</button>
          <button type="button" disabled={index===draft.members.length-1} aria-label={tx('Descendre')+' · '+name} onClick={()=>reorder(prefix,draft.members[index+1])}>↓</button>
          <button type="button" className="ea-grip" aria-label={tx('Déplacer')+' · '+name} onPointerDown={e=>startDrag(e,prefix)}
            onKeyDown={e=>{const target=e.key==='ArrowUp'?index-1:e.key==='ArrowDown'?index+1:-1;if(draft.members[target]){e.preventDefault();reorder(prefix,draft.members[target]);}}}>⠿</button>
        </div>}
      </li>;
    })}</ul>
  </section>;
}

export function MonitorGroups({token,groups,sources,online,canMove,renderSource,move,notify}:Props){
  const [edit,setEdit]=useState<Draft|null>(null);
  const [open,setOpen]=useState<string|null>(null);
  async function save(draft:Draft,remove=false){
    try{
      const r=await fetch('/ears-api/'+token+'/groups'+(draft.id?'/'+draft.id:''),{
        method:remove?'DELETE':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:draft.name,members:draft.members,revision:draft.revision})
      });
      if(!r.ok)throw Error((await r.json()).error||tx('Enregistrement impossible'));
      setEdit(null);
    }catch(error){notify((error as Error).message);}
  }
  return <section className="ea-groups">
    <div className="ea-group-heading"><h2>{tx('Mes groupes')}</h2>
      {!edit&&<button disabled={!online} onClick={()=>setEdit({name:'',members:[]})}>{tx('Nouveau groupe')}</button>}
    </div>
    {edit?<GroupEditor initial={edit} sources={sources} online={online} save={save} cancel={()=>setEdit(null)}/>:
      groups.map(group=><article className="ea-group" key={group.id}>
        <div className="ea-group-heading">
          <button className="ea-group-toggle" aria-expanded={open===group.id} onClick={()=>setOpen(open===group.id?null:group.id)}>
            <span aria-hidden="true">{open===group.id?'▾':'▸'}</span> {group.name}
          </button>
          <output>{group.offset>0?'+':''}{Number(group.offset.toFixed(1))} dB</output>
          <button disabled={!online} aria-label={tx('Modifier le groupe')+' · '+group.name} onClick={()=>setEdit({...group,members:[...group.members]})}>{tx('Modifier')}</button>
        </div>
        <input type="range" className="ea-group-fader" min={-EAR_GROUP_RANGE} max={EAR_GROUP_RANGE} step=".5" value={group.offset}
          aria-label={tx('Volume du groupe')+' · '+group.name} aria-valuetext={group.offset.toFixed(1)+' dB'} disabled={!canMove} onChange={e=>move(group,Number(e.target.value))}/>
        {open===group.id&&<div className="ea-group-members">{group.members.map(renderSource)}</div>}
      </article>)}
  </section>;
}
