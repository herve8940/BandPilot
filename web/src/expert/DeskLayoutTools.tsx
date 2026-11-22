import {LayoutTransfer} from './LayoutTransfer';
import {MeterDisplaySettings} from '../xair/meter-preferences';
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown, ArrowUp, Check, Columns3, Plus, Search, SlidersHorizontal, X} from 'lucide-react';
import {tx} from '../i18n';
import {num, type Values} from '../xair/controls';
import {stripColor} from '../xairMath';
import {stripName, type Strip} from '../xair/strips';
import {displayDefaults, type DeskLayout} from './desk-layout';
import {moveStrip, type FaderBank} from './fader-banks';
import './desk-customize.css';

type Props = {strips:Strip[]; allStrips?:Strip[]; monitorOutputs?:number; values:Values; desk:DeskLayout};
const groups = [
  {id:'inputs', label:'Entrées', kinds:['ch','aux']},
  {id:'fx', label:'Effets', kinds:['fxrtn','fxsend']},
  {id:'outputs', label:'Bus / Main', kinds:['bus','lr']},
  {id:'dca', label:'DCA', kinds:['dca']},
];
function stripDetail(strip:Strip) {
  if (strip.kind === 'fxrtn') return `${tx('Retour FX')} ${strip.short.replace('FX ', '')}`;
  if (strip.kind === 'fxsend') return `${tx('Départ FX')} ${strip.short.replace('Send ', '')}`;
  return strip.kind === 'ch' ? `${tx('Canal')} ${strip.short}` : strip.short;
}

export function DeskLayoutTools(props:Props) {
  const [open, setOpen] = useState(false);
  const {desk} = props;
  const selected = desk.layout.banks.find(bank => bank.id === desk.layout.activeBank);
  return <div className="desk-customize-bar">
    <div className="desk-customize-caption"><Columns3 aria-hidden="true"/><span><b>{tx('Mon mélangeur')}</b><small>{selected?.name || tx('Affichage standard')}</small></span></div>
    <button type="button" className="desk-customize-open" onClick={() => setOpen(true)}><SlidersHorizontal aria-hidden="true"/>{tx('Personnaliser')}</button>
    <MeterDisplaySettings/>
    {desk.storageError && <p role="status">{tx('Affichage conservé pour cette session uniquement. Réessaie l’enregistrement.')}</p>}
    {open && createPortal(<LayoutEditor {...props} onClose={() => setOpen(false)}/>, document.body)}
  </div>;
}

function LayoutEditor({strips, allStrips = strips, monitorOutputs=0, values, desk, onClose}:Props & {onClose:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const initial = desk.layout.banks.find(bank => bank.id === desk.layout.activeBank) || desk.layout.banks[0];
  const blank = ():FaderBank => ({id:`bank-${crypto.randomUUID()}`, name:tx('Ma vue'), strips:[]});
  const [draft, setDraft] = useState<FaderBank>(() => initial ? {...initial, strips:[...initial.strips]} : blank());
  const [display, setDisplay] = useState(() => ({hidden:[...desk.layout.hidden], outputs:desk.layout.outputs, density:desk.layout.density}));
  const [tab, setTab] = useState<'views'|'display'>('views');
  const [group, setGroup] = useState('inputs');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);
  const existing = desk.layout.banks.some(bank => bank.id === draft.id);
  const valid = !!draft.name.trim() && draft.strips.length > 0 && (existing || desk.layout.banks.length < 12);
  useEffect(() => {
    const el = dialog.current!; const previous = document.activeElement as HTMLElement|null;
    el.showModal();
    return () => { el.close(); previous?.focus(); };
  }, []);
  const choose = (bank:FaderBank) => { setDraft({...bank, strips:[...bank.strips]}); setError(false); };
  const toggle = (id:string) => setDraft(old => ({...old, strips:old.strips.includes(id) ? old.strips.filter(s => s !== id) : [...old.strips, id]}));
  const finish = (stored:boolean) => { if (stored) onClose(); else setError(true); };
  const save = () => {
    if (tab === 'display') finish(desk.update(display));
    else if (valid) {
      const bank = {...draft, name:draft.name.trim()};
      finish(desk.update({banks:existing ? desk.layout.banks.map(old => old.id === bank.id ? bank : old) : [...desk.layout.banks, bank], activeBank:bank.id}));
    }
  };
  const matches = allStrips.filter(strip => {
    const text = `${stripName(strip, values)} ${stripDetail(strip)}`.toLocaleLowerCase();
    return search.trim() ? text.includes(search.trim().toLocaleLowerCase()) : groups.find(g => g.id === group)!.kinds.includes(strip.kind);
  });
  return <dialog ref={dialog} className="desk-customize-dialog" aria-labelledby="desk-customize-title" onCancel={event => {event.preventDefault(); onClose();}}>
    <header className="desk-customize-header"><div><span className="desk-customize-eyebrow">{tx('À ta façon')}</span><h2 id="desk-customize-title">{tx('Personnaliser le mélangeur')}</h2><p>{tx('Choisis tes tranches et leur ordre. Le son reste inchangé.')}</p></div><button type="button" className="desk-icon-button" aria-label={tx('Fermer')} onClick={onClose}><X aria-hidden="true"/></button></header>
    <nav className="desk-customize-tabs" aria-label={tx('Personnalisation du mélangeur')}>
      <button type="button" aria-pressed={tab === 'views'} onClick={() => setTab('views')}><Columns3 aria-hidden="true"/>{tx('Mes vues')}</button>
      <button type="button" aria-pressed={tab === 'display'} onClick={() => setTab('display')}><SlidersHorizontal aria-hidden="true"/>{tx('Affichage')}</button>
    </nav>
    <div className="desk-customize-body">
      {tab === 'views' ? <>
        <div className="desk-view-toolbar">
          {desk.layout.banks.length > 0 && <label>{tx('Vue à personnaliser')}<select value={existing ? draft.id : ''} onChange={event => {const bank = desk.layout.banks.find(b => b.id === event.target.value); if (bank) choose(bank);}}>{!existing && <option value="">{tx('Nouvelle vue')}</option>}{desk.layout.banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label>}
          <label className="desk-view-name">{tx('Nom de la vue')}<input maxLength={40} value={draft.name} onChange={event => setDraft({...draft, name:event.target.value})}/></label>
          {desk.layout.banks.length > 0 && <button type="button" disabled={desk.layout.banks.length >= 12} onClick={() => {choose(blank()); setSearch('');}}><Plus aria-hidden="true"/>{tx('Nouvelle vue')}</button>}
        </div>
        {monitorOutputs>0&&<div className="desk-view-toolbar">
          <label>{tx('Mix de cette vue')}<select value={draft.mix??''} onChange={e=>setDraft(old=>({...old,mix:e.target.value===''?undefined:Number(e.target.value)}))}>
            <option value="">{tx('Mix sélectionné manuellement')}</option>
            <option value={0}>{tx('Façade')}</option>
            {Array.from({length:monitorOutputs},(_,i)=><option value={i+1} key={i}>{tx('Bus')} {i+1}</option>)}
          </select></label>
          <label><input type="checkbox" checked={draft.compactStrips===true} onChange={e=>setDraft({...draft,compactStrips:e.target.checked||undefined})}/>{tx('Tranches centrées sur les niveaux')}</label>
        </div>}
        <div className="desk-view-builder">
          <section className="desk-available" aria-label={tx('Tranches disponibles')}>
            <h3><span>1</span>{tx('Choisir les tranches')}</h3>
            <label className="desk-strip-search"><Search aria-hidden="true"/><input type="search" aria-label={tx('Rechercher une tranche')} placeholder={tx('Rechercher une tranche')} value={search} onChange={event => setSearch(event.target.value)}/></label>
            <div className="desk-strip-filters" role="group" aria-label={tx('Famille de canaux')}>{groups.filter(g => allStrips.some(s => g.kinds.includes(s.kind))).map(g => <button type="button" key={g.id} aria-pressed={!search && group === g.id} onClick={() => {setGroup(g.id); setSearch('');}}>{tx(g.label)}</button>)}</div>
            <div className="desk-strip-choices">{matches.map(strip => {
              const selected = draft.strips.includes(strip.id);
              return <button type="button" key={strip.id} data-strip-id={strip.id} className="desk-strip-choice" aria-pressed={selected} onClick={() => toggle(strip.id)}>
                <i style={{background:stripColor(num(values, `${strip.prefix}/config/color`))}} aria-hidden="true"/>
                <span><b>{stripName(strip, values)}</b><small>{stripDetail(strip)}</small></span>
                {selected ? <Check aria-hidden="true"/> : <Plus aria-hidden="true"/>}
              </button>;
            })}{!matches.length && <p className="desk-empty">{tx('Aucune tranche trouvée.')}</p>}</div>
          </section>
          <section className="desk-selected" aria-label={tx('Tranches de ma vue')}>
            <h3><span>2</span>{tx('Ranger ma vue')}<small>{draft.strips.length}</small></h3>
            <p>{tx('Les tranches apparaîtront dans cet ordre.')}</p>
            {draft.strips.length === 0 ? <div className="desk-empty-selection"><Columns3 aria-hidden="true"/><b>{tx('Ta vue commence ici')}</b><p>{tx('Ajoute les tranches dont tu as besoin avec le bouton +.')}</p><button type="button" onClick={() => setDraft({...draft, strips:strips.filter(s => !desk.layout.hidden.includes(s.id)).map(s => s.id)})}>{tx('Partir des entrées visibles')}</button></div> : <ol className="desk-selected-list">{draft.strips.map((id, index) => {
              const strip = allStrips.find(s => s.id === id), name = strip ? stripName(strip, values) : tx('Tranche indisponible');
              return <li key={id} data-strip-id={id}><span className="desk-strip-position">{index + 1}</span><span className="desk-selected-name"><b>{name}</b><small>{strip ? stripDetail(strip) : id}</small></span>
                <button type="button" className="desk-icon-button" disabled={index === 0} aria-label={`${tx('Monter la tranche')} ${name}`} title={tx('Monter la tranche')} onClick={() => setDraft(moveStrip(draft, id, -1))}><ArrowUp aria-hidden="true"/></button>
                <button type="button" className="desk-icon-button" disabled={index === draft.strips.length - 1} aria-label={`${tx('Descendre la tranche')} ${name}`} title={tx('Descendre la tranche')} onClick={() => setDraft(moveStrip(draft, id, 1))}><ArrowDown aria-hidden="true"/></button>
                <button type="button" className="desk-icon-button" aria-label={`${tx('Retirer')} ${name}`} title={tx('Retirer')} onClick={() => toggle(id)}><X aria-hidden="true"/></button>
              </li>;
            })}</ol>}
          </section>
        </div>
      </> : <section className="desk-display-options">
        <h3>{tx('Un mélangeur plus lisible')}</h3>
        <p>{tx('Ces options règlent l’affichage sur cet écran. Tes vues personnelles sont conservées.')}</p>
        <div className="desk-density" role="group" aria-label={tx('Largeur des tranches')}>{(['compact','comfortable'] as const).map(value => <button type="button" key={value} aria-pressed={display.density === value} onClick={() => setDisplay({...display, density:value})}><Columns3 aria-hidden="true"/><b>{tx(value === 'compact' ? 'Compacte' : 'Confortable')}</b><small>{tx(value === 'compact' ? 'Plus de tranches à l’écran' : 'Des commandes plus espacées')}</small></button>)}</div>
        <label className="desk-output-option"><input type="checkbox" checked={display.outputs} onChange={event => setDisplay({...display, outputs:event.target.checked})}/>{tx('Afficher les sorties et le Master')}</label>
        <details className="desk-standard-visibility"><summary>{tx('Masquer des tranches dans les vues standard')}</summary><div className="desk-visibility-actions"><button type="button" onClick={() => setDisplay({...display, hidden:[]})}>{tx('Tout afficher')}</button><button type="button" onClick={() => setDisplay({...display, hidden:strips.filter(s => stripName(s, values) === s.fallback).map(s => s.id)})}>{tx('Garder les entrées nommées')}</button></div><div className="desk-visibility-choices">{strips.map(strip => <label key={strip.id}><input type="checkbox" aria-label={`${tx('Afficher')} ${stripName(strip, values)}`} checked={!display.hidden.includes(strip.id)} onChange={event => setDisplay({...display, hidden:event.target.checked ? display.hidden.filter(id => id !== strip.id) : [...display.hidden, strip.id]})}/>{stripName(strip, values)}</label>)}</div></details>
        <button type="button" className="desk-reset" onClick={() => setDisplay({...displayDefaults})}>{tx('Réinitialiser l’affichage')}</button>
      </section>}
    <LayoutTransfer desk={desk} allowed={allStrips.map(s=>s.id)} onDone={onClose}/>
    </div>
    {error && <p className="desk-storage-error" role="alert">{tx('Affichage conservé pour cette session uniquement. Réessaie l’enregistrement.')}</p>}
    <footer className="desk-customize-footer">
      {tab === 'views' && existing && <button type="button" className="desk-delete" onClick={() => {if (confirm(tx('Supprimer cette vue personnalisée ?'))) finish(desk.update({banks:desk.layout.banks.filter(b => b.id !== draft.id), activeBank:desk.layout.activeBank === draft.id ? 'inputs' : desk.layout.activeBank}));}}>{tx('Supprimer cette vue')}</button>}
      <span className="desk-footer-spacer"/><button type="button" onClick={onClose}>{tx('Annuler')}</button><button type="button" className="desk-save" disabled={tab === 'views' && !valid} onClick={save}><Check aria-hidden="true"/>{tx(tab === 'views' ? 'Enregistrer la vue' : 'Enregistrer l’affichage')}</button>
    </footer>
  </dialog>;
}
