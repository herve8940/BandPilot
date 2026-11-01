import {useEffect,useState} from 'react';
import {Eraser,Check,Drum,Headphones,Plus,QrCode,Trash2,Users,Wand2} from 'lucide-react';

export type Input={channel:number;source:string;name:string};
export type Role='chant'|'guitare'|'basse'|'batterie'|'clavier';
export type Musician={name:string;bus:number;role:Role;channels:number[]};
export type Profile={version:1;inputs:Input[];completed:string[];musicians?:Musician[]};
export type Source={id:string;label:string;group:string;family:string;color:number;name:string;pan:number};
export type PresetCard={title:string;description:string;advice:string;lines:string[]};
export type CoachData={sources:Source[];presets:Record<string,PresetCard>;roles:{id:Role;label:string;hint:string}[];recipes:Record<Role,Record<string,number>>;ownLevel:number;templates:{id:string;label:string;description:string;inputs:Input[]}[];drumKit:string[]};

const COLORS=['#555','#e5534b','#57ab5a','#d4b106','#539bf5','#c96198','#39c5cf','#cdd9e5'];
const swatch=(c:number)=>COLORS[c%8];
const freeChannel=(inputs:Input[],after=0)=>Array.from({length:16},(_,i)=>i+1).find(n=>n>after&&!inputs.some(i=>i.channel===n));
/** Group the instrument list like a stage plot: voices, guitars, bass, drum kit, electronic drums, keys. */
function InstrumentSelect({data,value,disabled,onChange}:{data:CoachData;value:string;disabled:boolean;onChange:(id:string)=>void}){
 const groups=[...new Set(data.sources.map(s=>s.group))];
 return <select disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}>{groups.map(g=><optgroup key={g} label={g}>{data.sources.filter(s=>s.group===g).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>)}</select>;
}

export function InputsStep({data,profile,setProfile,admin,busy,canApply,onApplyChannel,onApplyAll,onSave,notify,onNext,onBlank}:{
 data:CoachData;profile:Profile;setProfile:(p:Profile)=>void;admin:boolean;busy:boolean;canApply:boolean;
 onApplyChannel:(p:Profile,channel:number)=>void;onApplyAll:(p:Profile)=>void;onSave:(p:Profile)=>void;notify:(m:string)=>void;onNext:()=>void;onBlank:()=>void}){
 const [open,setOpen]=useState<number|null>(null);
 const src=(id:string)=>data.sources.find(s=>s.id===id)!;
 const update=(next:Profile)=>setProfile({...next,musicians:next.musicians?.map(m=>({...m,channels:m.channels.filter(c=>next.inputs.some(i=>i.channel===c))}))});
 const choose=(index:number,id:string)=>{
  const current=profile.inputs[index]!,before=src(current.source);
  const keepName=current.name.trim()&&current.name!==before.name&&!/^Micro \d+$/.test(current.name);
  const next={...profile,inputs:profile.inputs.map((v,i)=>i===index?{...v,source:id,name:keepName?v.name:src(id).name}:v)};
  setProfile(next);setOpen(current.channel);
  // Choosing an instrument proposes its complete best-practice setting right away.
  if(canApply)onApplyChannel(next,current.channel);else notify('Instrument choisi. Connecte la XR18 (ou passe en simulation) pour appliquer sa configuration complète.');
 };
 const addDrums=()=>{
  let inputs=[...profile.inputs],last=0;
  for(const id of data.drumKit){if(inputs.some(i=>i.source===id))continue;const ch=freeChannel(inputs,last)??freeChannel(inputs);if(!ch){notify('Plus assez d’entrées libres pour toute la batterie (16 maximum).');break;}inputs.push({channel:ch,source:id,name:src(id).name});last=ch;}
  inputs=inputs.filter(i=>!i.source.startsWith('drum-module'));
  update({...profile,inputs:inputs.sort((a,b)=>a.channel-b.channel)});notify('Batterie détaillée ajoutée : kick, snare, tom 1, tom 2, tom 3, OH 1 et OH 2. Vérifie les numéros d’entrée puis applique.');
 };
 return <div className="coach-section">
  <div className="coach-blank"><Eraser size={18}/><p><b>La console garde les réglages d’un autre groupe ou d’un ancien concert ?</b> Repars d’une scène vierge : tout revient à neutre, volumes en bas. Le 48 V, les gains et le routage ne bougent pas.</p><button disabled={!admin||busy||!canApply} onClick={onBlank}>{busy?"Lecture de la console…":"Partir d’une scène vierge"}</button></div>
  <h3>1. Pars d’un modèle</h3>
  <div className="coach-templates">{data.templates.map(t=><button key={t.id} disabled={!admin||busy} onClick={()=>{update({...profile,inputs:structuredClone(t.inputs)});notify(`Modèle « ${t.label} » chargé. Rien n’est encore envoyé à la console.`);}}><b>{t.label}</b><small>{t.description}</small></button>)}
   <button className="drums" disabled={!admin||busy} onClick={addDrums}><b><Drum size={16}/> Ajouter la batterie détaillée</b><small>Kick, snare, tom 1, tom 2, tom 3, OH 1, OH 2 sur les entrées libres.</small></button></div>
  <h3>2. Choisis l’instrument de chaque prise</h3>
  <p className="coach-hint">Dès que tu choisis un instrument, je te propose sa <b>configuration complète</b> : coupe-bas, égaliseur, compresseur, gate, position stéréo, nom et couleur.</p>
  <div className="coach-inputs">{profile.inputs.map((input,index)=>{const s=src(input.source),card=data.presets[input.source];return <div className="coach-input2" key={input.channel+':'+index} style={{['--chip' as string]:swatch(s.color)}}>
   <div className="row">
    <label>Prise<select disabled={!admin||busy} value={input.channel} onChange={e=>update({...profile,inputs:profile.inputs.map((v,i)=>i===index?{...v,channel:Number(e.target.value)}:v)})}>{Array.from({length:16},(_,i)=><option key={i+1} value={i+1} disabled={i+1!==input.channel&&profile.inputs.some(v=>v.channel===i+1)}>Entrée {i+1}</option>)}</select></label>
    <label>Instrument<InstrumentSelect data={data} value={input.source} disabled={!admin||busy} onChange={id=>choose(index,id)}/></label>
    <label>Nom sur la console<input disabled={!admin||busy} value={input.name} maxLength={12} onChange={e=>update({...profile,inputs:profile.inputs.map((v,i)=>i===index?{...v,name:e.target.value}:v)})}/></label>
    <div className="row-actions"><button className="apply" disabled={!admin||busy||!canApply} title="Appliquer la configuration complète de cet instrument" onClick={()=>onApplyChannel(profile,input.channel)}><Wand2 size={15}/> Appliquer</button><button disabled={!admin||busy} aria-label={'Retirer '+input.name} title="Retirer" onClick={()=>update({...profile,inputs:profile.inputs.filter((_,i)=>i!==index)})}><Trash2 size={15}/></button></div>
   </div>
   {card&&<details open={open===input.channel} onToggle={e=>{if((e.target as HTMLDetailsElement).open)setOpen(input.channel);}}><summary>Ce que je règle : {card.title}</summary><ul>{card.lines.map((l,n)=><li key={n}>{l}</li>)}</ul><p>{card.advice}</p></details>}
  </div>;})}</div>
  <div className="coach-actions">
   <button disabled={!admin||busy||profile.inputs.length>=16} onClick={()=>{const ch=freeChannel(profile.inputs);if(ch)update({...profile,inputs:[...profile.inputs,{channel:ch,source:'lead-rock',name:'Micro '+ch}].sort((a,b)=>a.channel-b.channel)});}}><Plus size={15}/> Ajouter un instrument</button>
   <button disabled={!admin||busy} onClick={()=>onSave(profile)}>Enregistrer mon groupe</button>
   <button className="primary" disabled={!admin||busy||!canApply||!profile.inputs.length} onClick={()=>onApplyAll(profile)}><Wand2 size={16}/> Appliquer à tout le groupe ({profile.inputs.length} instruments)</button>
   <button disabled={!profile.inputs.length} onClick={()=>{onSave(profile);onNext();}}>Étape suivante : régler les gains →</button>
  </div>
  <p className="coach-note">Avant chaque application, tu vois la liste « avant / après » et une sauvegarde est faite : « Annuler le dernier réglage guidé » remet tout comme avant. Je ne touche ni au gain d’entrée, ni au 48 V, ni aux volumes, ni aux mutes. Règle d’abord le gain (étape 3) : les seuils du compresseur et du gate supposent des crêtes vers −6 dB.</p>
 </div>;
}

export function EarsStep({data,profile,setProfile,admin,busy,canApply,onSuggest,onApply,onShare}:{
 data:CoachData;profile:Profile;setProfile:(p:Profile)=>void;admin:boolean;busy:boolean;canApply:boolean;
 onSuggest:()=>void;onApply:(p:Profile,bus?:number)=>void;onShare:(p:Profile)=>void}){
 const musicians=profile.musicians??[];
 const src=(id:string)=>data.sources.find(s=>s.id===id)!;
 const set=(list:Musician[])=>setProfile({...profile,musicians:list});
 const edit=(i:number,patch:Partial<Musician>)=>set(musicians.map((m,n)=>n===i?{...m,...patch}:m));
 const level=(m:Musician,input:Input)=>{const family=src(input.source).family;return m.channels.includes(input.channel)&&!(m.role==='batterie'&&family!=='edrums')?data.ownLevel:data.recipes[m.role][family]!;};
 const freeBus=Array.from({length:6},(_,i)=>i+1).find(b=>!musicians.some(m=>m.bus===b));
 return <div className="coach-section">
  <div className="coach-checklist"><p><Headphones size={18}/> Chaque musicien a son propre bus (sortie Aux 1 à 6 de la XR18) : branche-y son boîtier in-ear ou son retour.</p><p><Check size={17}/> Je prépare un mix de départ <b>pré-fader</b> : ce que tu changes en façade ne bouge pas ses oreilles.</p><p><QrCode size={17}/> Ensuite, chacun scanne son QR code et ajuste son mix sur son téléphone.</p></div>
  <div className="coach-actions"><button disabled={!admin||busy} onClick={onSuggest}><Users size={15}/> Proposer les musiciens d’après mon groupe</button><button disabled={!admin||busy||!freeBus} onClick={()=>freeBus&&set([...musicians,{name:'Musicien '+freeBus,bus:freeBus,role:'chant',channels:[]}])}><Plus size={15}/> Ajouter un musicien</button></div>
  {!musicians.length&&<p className="coach-note">Aucun musicien pour l’instant : clique sur « Proposer les musiciens d’après mon groupe ».</p>}
  <div className="coach-musicians">{musicians.map((m,i)=>{const role=data.roles.find(r=>r.id===m.role)!;const rows=[...profile.inputs].map(input=>({input,db:level(m,input)})).sort((a,b)=>b.db-a.db);return <article className="coach-musician" key={i}>
   <div className="row">
    <label>Musicien<input disabled={!admin||busy} value={m.name} maxLength={12} onChange={e=>edit(i,{name:e.target.value})}/></label>
    <label>Sortie / bus<select disabled={!admin||busy} value={m.bus} onChange={e=>edit(i,{bus:Number(e.target.value)})}>{Array.from({length:6},(_,b)=><option key={b+1} value={b+1} disabled={b+1!==m.bus&&musicians.some(x=>x.bus===b+1)}>Bus {b+1} (Aux {b+1})</option>)}</select></label>
    <label>Rôle<select disabled={!admin||busy} value={m.role} onChange={e=>edit(i,{role:e.target.value as Role})}>{data.roles.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    <div className="row-actions"><button className="apply" disabled={!admin||busy||!canApply} onClick={()=>onApply(profile,m.bus)}><Wand2 size={15}/> Appliquer</button><button disabled={!admin||busy} aria-label={'Retirer '+m.name} onClick={()=>set(musicians.filter((_,n)=>n!==i))}><Trash2 size={15}/></button></div>
   </div>
   <small className="role-hint">{role.hint}</small>
   <div className="own"><span>Ses instruments (mis devant) :</span>{profile.inputs.map(input=><button key={input.channel} disabled={!admin||busy} className={m.channels.includes(input.channel)?'on':''} onClick={()=>edit(i,{channels:m.channels.includes(input.channel)?m.channels.filter(c=>c!==input.channel):[...m.channels,input.channel]})}>{input.name}</button>)}</div>
   <div className="mixbars" aria-label={'Mix de départ de '+m.name}>{rows.map(({input,db})=><div key={input.channel} className={db<=-90?'off':''}><span>{input.name}</span><i><b style={{width:db<=-90?'0%':Math.max(4,Math.round((db+40)/40*100))+'%',background:swatch(src(input.source).color)}}/></i><em>{db<=-90?'coupé':db+' dB'}</em></div>)}</div>
  </article>;})}</div>
  <div className="coach-actions">
   <button className="primary" disabled={!admin||busy||!canApply||!musicians.length||!profile.inputs.length} onClick={()=>onApply(profile)}><Wand2 size={16}/> Appliquer les retours de tous ({musicians.length})</button>
   <button disabled={!admin||busy||!musicians.length} onClick={()=>onShare(profile)}><QrCode size={16}/> Créer les QR codes des musiciens</button>
  </div>
  <p className="coach-note">Le bus est nommé, retiré de la façade et démarré à −10 dB par sécurité. Les retours d’effets (réverbe) ne sont pas modifiés. Les cymbales sont coupées dans le retour du batteur car il les entend déjà fort. Garde le volume du boîtier bas au premier essai.</p>
 </div>;
}

type Thresholds={compThrDb:number|null;gateThrDb:number|null;note:string};
type Cal={channel:number;name:string;source:string;gainDb:number|null;peakDb:number|null;bleedDb:number|null;valid:boolean;needsBleed:boolean;state:'todo'|'ok'|'stale';thresholds:Thresholds|null};
type Report={available:boolean;title:string;message:string;maximumDb?:number};
type Decision={state:string;title:string;message:string;deltaDb:number};
type GainResult={report:Report;decision:Decision|null;proposal:unknown|null;gainDb?:number|null;thresholds?:Thresholds};
type BleedResult={report:Report;thresholds:Thresholds|null;message?:string};
const db=(v:number|null|undefined)=>v===null||v===undefined?'—':(v>0?'+':'')+(Math.round(v*2)/2).toLocaleString('fr-BE')+' dB';
const STATE_LABEL={todo:'À mesurer',ok:'Calé',stale:'Gain changé : à refaire'};
/** Peak position on a -60..0 dBFS scale, with the -9..-3 target zone. */
function PeakBar({peak}:{peak:number}){
 const pos=(v:number)=>Math.max(0,Math.min(100,(v+60)/60*100));
 return <div className="peakbar" aria-label={'Crête '+db(peak)}><span className="zone" style={{left:pos(-9)+'%',width:(pos(-3)-pos(-9))+'%'}}/><i style={{width:pos(peak)+'%'}} className={peak>=-1?'clip':peak>=-9&&peak<=-3?'good':'off'}/><small style={{left:pos(-6)+'%'}}>−6</small></div>;
}
export function GainStep({profile,channel,setChannel,admin,busy,canApply,real,refresh,api,run,onPlan,onApplyChannel,onApplyAll}:{
 profile:Profile;channel:number;setChannel:(c:number)=>void;admin:boolean;busy:boolean;canApply:boolean;real:boolean;refresh:number;
 api:(path:string,data?:unknown)=>Promise<any>;run:(fn:()=>Promise<void>)=>void;onPlan:(plan:any)=>void;onApplyChannel:(p:Profile,ch:number)=>void;onApplyAll:(p:Profile)=>void}){
 const [status,setStatus]=useState<Cal[]>([]),[gain,setGain]=useState<GainResult|null>(null),[bleed,setBleed]=useState<BleedResult|null>(null),[measuring,setMeasuring]=useState<''|'gain'|'bleed'>('');
 useEffect(()=>{let live=true;api('/api/coach/calibration',{}).then(s=>{if(live)setStatus(s);}).catch(()=>{});return()=>{live=false;};},[refresh,channel,profile.inputs.length,gain,bleed]);
 useEffect(()=>{setGain(null);setBleed(null);},[channel]);
 const current=status.find(s=>s.channel===channel),input=profile.inputs.find(i=>i.channel===channel);
 const done=status.filter(s=>s.state==='ok').length,index=profile.inputs.findIndex(i=>i.channel===channel),next=profile.inputs[index+1];
 const measure=(kind:'gain'|'bleed')=>run(async()=>{setMeasuring(kind);try{if(kind==='gain'){const r=await api('/api/coach/gain',{channel}) as GainResult;setGain(r);setBleed(null);if(r.proposal)onPlan(r.proposal);}else setBleed(await api('/api/coach/bleed',{channel}));}finally{setMeasuring('');}});
 const th=bleed?.thresholds??current?.thresholds??null;
 // The proposal belongs to the measure: once the gain has changed (applied here or on the console), it is out of date.
 const gainMoved=!!gain&&gain.gainDb!=null&&current?.gainDb!=null&&current.gainDb!==gain.gainDb;
 return <div className="coach-section gain-step">
  {!real&&<p className="coach-message warn">La mesure a besoin de la vraie XR18 et des musiciens qui jouent. En simulation, aucun niveau n’est inventé : connecte la console pour régler les gains.</p>}
  <h3>Où en est chaque instrument <small>{done} / {profile.inputs.length} calés</small></h3>
  <div className="gain-table" role="table">
   <div role="row" className="head"><span>Instrument</span><span>Gain</span><span>Niveau max</span><span>Repisse</span><span>Compresseur</span><span>Gate</span><span>État</span></div>
   {profile.inputs.map(i=>{const s=status.find(s=>s.channel===i.channel);return <button role="row" key={i.channel} className={(i.channel===channel?'active ':'')+(s?.state??'todo')} onClick={()=>setChannel(i.channel)}>
    <span><b>{i.name}</b> <small>entrée {i.channel}</small></span><span>{db(s?.gainDb)}</span><span>{s?.valid?db(s.peakDb):'—'}</span><span>{s?.valid&&s.needsBleed?db(s.bleedDb):s?.needsBleed?'—':'inutile'}</span>
    <span>{s?.thresholds?.compThrDb!=null?db(s.thresholds.compThrDb):'—'}</span><span>{s?.thresholds?.gateThrDb!=null?db(s.thresholds.gateThrDb):s?.needsBleed?'—':'off'}</span><span className="pill">{STATE_LABEL[s?.state??'todo']}</span></button>;})}
  </div>
  {input&&<div className="gain-card">
   <h3>{input.name} <small>entrée {channel}{current?.gainDb!=null?` · gain actuel ${db(current.gainDb)}`:''}</small></h3>
   {current?.state==='stale'&&<p className="coach-message warn">Le gain a changé depuis la dernière mesure : les seuils ne correspondent plus au signal. Remesure.</p>}
   <ol className="gain-steps">
    <li className={current?.state==='ok'?'done':''}><div><b>Régler le gain</b><p>Fais jouer <b>{input.name}</b> seul, au volume du passage le plus fort du concert, pendant 5 secondes. Je vise des crêtes vers −6 dB.</p></div>
     <button className="primary" disabled={!admin||busy||!real} onClick={()=>measure('gain')}>{measuring==='gain'?'Mesure… joue maintenant !':gain?.proposal?'Remesurer':'Mesurer (5 s)'}</button>
     {gain&&<div className={'gain-result '+(gain.decision?.state??'none')}>{gain.report.available&&gain.report.maximumDb!==undefined&&<PeakBar peak={gain.report.maximumDb}/>}<b>{gain.decision?.title??gain.report.title}</b><p>{gain.decision?.message??gain.report.message}</p>{gain.proposal!=null&&!gainMoved&&<button disabled={!admin||busy||!canApply} onClick={()=>onPlan(gain.proposal)}>Revoir et appliquer ce gain</button>}{gain.proposal!=null&&!gainMoved&&<small>Après l’avoir appliqué, remesure pour vérifier.</small>}{gainMoved&&<p className="gain-moved"><b>Gain passé à {db(current?.gainDb)}.</b> Cette mesure date d’avant : clique sur « Remesurer » et fais rejouer {input.name} pour vérifier.</p>}</div>}
    </li>
    {current?.needsBleed&&<li className={current.bleedDb!=null&&current.valid?'done':''}><div><b>Placer le gate</b><p><b>{input.name}</b> se tait, les autres jouent fort pendant 5 secondes : je mesure la repisse (le son des autres captés par ce micro) et je place le gate juste au-dessus.</p></div>
     <button disabled={!admin||busy||!real||current.state!=='ok'} onClick={()=>measure('bleed')}>{measuring==='bleed'?'Mesure… les autres jouent !':'Mesurer la repisse (5 s)'}</button>
     {bleed&&<div className="gain-result"><b>{bleed.thresholds?'Repisse mesurée : '+db(bleed.report.maximumDb):bleed.report.title}</b><p>{bleed.message??(bleed.thresholds?bleed.thresholds.note:bleed.report.message)}</p></div>}
    </li>}
    <li className={current?.state==='ok'?'':'locked'}><div><b>Appliquer la configuration calée</b><p>{th?<>Compresseur à partir de <b>{db(th.compThrDb)}</b>{th.gateThrDb!==null&&<>, gate à <b>{db(th.gateThrDb)}</b></>}. {th.note}</>:'Les seuils seront calculés sur ta mesure dès que le gain sera bien réglé.'}</p></div>
     <button className="primary" disabled={!admin||busy||!canApply||current?.state!=='ok'} onClick={()=>onApplyChannel(profile,channel)}><Wand2 size={15}/> Appliquer à {input.name}</button>
    </li>
   </ol>
   <div className="coach-actions">{next&&<button onClick={()=>setChannel(next.channel)}>Instrument suivant : {next.name} →</button>}<button disabled={!admin||busy||!canApply||!profile.inputs.length} onClick={()=>onApplyAll(profile)}><Wand2 size={15}/> Appliquer tout le groupe ({done} calé{done>1?'s':''})</button></div>
  </div>}
  <p className="coach-note">Pourquoi cet ordre : le compresseur et le gate travaillent sur le signal qui sort du préampli, avec des seuils fixes. Si le gain monte de 6 dB après coup, le compresseur écrase 6 dB de plus et le gate laisse passer la repisse. Si tu changes un gain plus tard, je te le signale ici (« à refaire »). Je ne touche jamais au 48 V et je ne monte pas de plus de 6 dB à la fois.</p>
 </div>;
}
