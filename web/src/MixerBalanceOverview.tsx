import {tx} from './i18n';
import {useMixerModel} from './MixerModel';
import {BUSES,INPUTS,gainControl,pad,type Strip} from './xair/strips';
import {faderToDb,formatDb,lin} from './xairMath';

type Values=Record<string,number|string>;
export type BalanceInput=number|'aux';
export function balanceInputs(channels:number,values:Values){
  const hasAux=Object.keys(values).some(a=>a.startsWith('/rtn/aux/'));
  return INPUTS.filter(s=>s.kind==='ch'?Number(s.short)<=channels:s.kind==='aux'&&hasAux);
}
export const inputId=(s:Strip):BalanceInput=>s.kind==='aux'?'aux':Number(s.short);
export function balanceInputName(values:Values,channel:BalanceInput){
  if(channel==='aux'){
    const name=values['/rtn/aux/config/name'];
    return typeof name==='string'&&name.trim()?name:tx('Aux stéréo');
  }
  const name=values['/ch/'+pad(channel)+'/config/name'];
  return typeof name==='string'&&name.trim()?name:tx('Entrée')+' '+channel;
}
export function balanceGain(values:Values,strip:Strip,preamps:number,hasUsb:boolean){
  const p=strip.prefix,usb=values[p+'/preamp/rtnsw'];
  if(hasUsb&&usb!==0&&usb!==1)return null;
  if(usb!==1&&(strip.kind!=='ch'||typeof values[p+'/config/insrc']!=='number'))return null;
  const control=gainControl(strip,values,preamps);
  const raw=control&&values[control.address];
  return control&&typeof raw==='number'?{db:lin(raw,control.lo,control.hi),control}:null;
}
const level=(v:unknown)=>typeof v==='number'?formatDb(faderToDb(v))+' dB':'—';
const toggle=(v:unknown,on:string,off:string)=>v===1?tx(on):v===0?tx(off):'—';
function stripName(strip:Strip,values:Values){
  if(strip.kind==='ch')return balanceInputName(values,Number(strip.short));
  const name=values[strip.prefix+'/config/name'];
  if(typeof name==='string'&&name.trim())return name;
  return strip.kind==='aux'?tx('Aux stéréo'):strip.kind==='fxrtn'?tx('Retour FX')+' '+strip.id.slice(3):strip.short;
}
function pairLabel(n:number,prefix:string,v:Values){
  const first=n%2?n:n-1;
  return v[prefix+first+'-'+(first+1)]===1?tx('Stéréo')+' '+first+'–'+(first+1):'';
}
export function MixerBalanceOverview({values:v,selection,onSelection,onInput,busy}:{
  values:Values;selection:BalanceInput[];onSelection:(next:BalanceInput[])=>void;onInput:(n:BalanceInput)=>void;busy:boolean
}){
  const model=useMixerModel();
  const inputs=balanceInputs(model.channels,v);
  const ids=inputs.map(inputId);
  const named=inputs.filter(s=>{
    const name=v[s.prefix+'/config/name'];
    return typeof name==='string'&&name.trim().length>0;
  }).map(inputId);
  const onlyNamed=selection.length===named.length&&named.every(id=>selection.includes(id));
  function toggleInput(id:BalanceInput){
    onSelection(ids.filter(n=>n===id?!selection.includes(n):selection.includes(n)));
  }
  function sourceLabel(s:Strip){
    const p=s.prefix,src=v[p+'/config/insrc'],usb=v[p+'/config/rtnsrc'];
    if(model.usbChannels>0){
      const switched=v[p+'/preamp/rtnsw'];
      if(switched===1){
        const input=typeof usb!=='number'?'—':s.kind==='aux'?(usb*2+1)+'–'+(usb*2+2):String(usb+1);
        return 'USB '+input;
      }
      if(switched!==0)return null;
    }
    if(s.kind==='aux')return tx('Aux stéréo');
    if(typeof src!=='number')return null;
    if(src>=model.channels)return tx('Désactivé');
    return tx('Prise')+' '+(src+1);
  }
  return <div className="balance-readback">
    <section aria-labelledby="balance-inputs-title">
      <h3 id="balance-inputs-title">{tx('Instruments et prises')}</h3>
      <p id="balance-selection-help">{tx('Coche les tranches à garder pour la suite de la balance.')}</p>
      <div className="coach-actions balance-selection-tools">
        <span role="status">{tx('Tranches sélectionnées')} · {selection.length} / {inputs.length}</span>
        <button type="button" disabled={busy||!named.length||onlyNamed} onClick={()=>onSelection(named)}>{tx('Cocher les entrées nommées')} ({named.length})</button>
        <button type="button" disabled={busy||selection.length===inputs.length} onClick={()=>onSelection(ids)}>{tx('Tout cocher')}</button>
        <button type="button" disabled={busy||!selection.length} onClick={()=>onSelection([])}>{tx('Tout décocher')}</button>
      </div>
      <div className="balance-table-scroll" role="region" aria-labelledby="balance-inputs-title" tabIndex={0}>
        <table className="balance-inputs"><thead><tr>{['Entrée','Source','Gain','Fader de façade','Main LR','État','Égaliseur','Compresseur','Gate','Tranche'].map(h=><th scope="col" key={h}>{tx(h)}</th>)}</tr></thead>
          <tbody>{inputs.map(s=>{
            const p=s.prefix,n=Number(s.short),source=sourceLabel(s);
            const reading=balanceGain(v,s,model.micPreamps,model.usbChannels>0);
            const gain=reading?formatDb(reading.db)+' dB':'—',control=reading?.control;
            const pair=s.kind==='ch'?pairLabel(n,'/config/chlink/',v):tx('Stéréo');
            const id=inputId(s),checked=selection.includes(id);
            return <tr key={p} data-strip={s.id} className={checked?'balance-picked':undefined} onClick={e=>{
              if(!busy&&!(e.target as HTMLElement).closest('label,button,input'))toggleInput(id);
            }}><th scope="row">
              <label className="balance-pick"><input type="checkbox" checked={checked} disabled={busy} onChange={()=>toggleInput(id)}/>
                {s.kind==='ch'&&<span>{s.short}</span>}{stripName(s,v)}</label>
              {pair&&<small>{pair}</small>}</th>
              <td>{source??'—'}</td><td>{gain}{control&&!control.headamp&&<small>{tx(control.label)}</small>}</td><td>{level(v[p+'/mix/fader'])}</td>
              <td>{toggle(v[p+'/mix/lr'],'Activé','Désactivé')}</td>
              <td>{toggle(v[p+'/mix/on'],'Actif','Coupé')}</td>
              {['eq','dyn','gate'].map(processor=>{
                const value=v[p+'/'+processor+'/on'];
                return <td key={processor} className={value===1?'balance-enabled':undefined}>{toggle(value,'Activé','Désactivé')}</td>;
              })}<td><button type="button" className="balance-inspect" disabled={busy} aria-label={tx('Ouvrir la tranche')+' · '+stripName(s,v)} onClick={()=>onInput(id)}>{tx('Ouvrir')}</button></td></tr>;
          })}</tbody>
        </table>
      </div>

    </section>

  </div>;
}

export function MixerBalanceReturns({values:v,selection}:{
  values:Values;selection?:BalanceInput[]
}){
  const model=useMixerModel();
  const inputs=balanceInputs(model.channels,v).filter(s=>!selection||selection.includes(inputId(s)));
  const sends=[...inputs,...INPUTS.filter(s=>!selection&&s.kind==='fxrtn'&&Number(s.id.slice(3))<=model.fxSlots)];
  const buses=BUSES.slice(0,model.buses);
  return (<section aria-labelledby="balance-returns-title">
      <div className="balance-table-head"><h3 id="balance-returns-title">{tx('Retours')}</h3>
      </div>
      <div className="balance-table-scroll" role="region" aria-labelledby="balance-returns-title" tabIndex={0}>
        <table className="balance-sends"><thead><tr><th scope="col">{tx('Entrée')}</th>{buses.map((b,i)=><th scope="col" key={b.id}>{stripName(b,v)}
          <small>{[stripName(b,v)!==b.short?b.short:'',i>=model.monitorOutputs?tx('Bus interne'):'',pairLabel(i+1,'/config/buslink/',v)].filter(Boolean).join(' · ')}</small></th>)}</tr></thead>
          <tbody><tr className="balance-masters"><th scope="row">{tx('Niveau du bus')}</th>{buses.map(b=><td key={b.id}>{level(v[b.prefix+'/mix/fader'])}<small>{toggle(v[b.prefix+'/mix/on'],'Actif','Coupé')}</small></td>)}</tr>
          {sends.map(s=><tr key={s.id} data-strip={s.id}><th scope="row">{s.kind==='ch'&&<span>{s.short} · </span>}{stripName(s,v)}</th>{buses.map((b,i)=><td key={b.id}>{level(v[s.prefix+'/mix/'+pad(i+1)+'/level'])}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>);
}


export function BalanceStripReadings({values,channel}:{values:Values;channel:BalanceInput}){
  const prefix=channel==='aux'?'/rtn/aux':'/ch/'+pad(channel);
  const rows=[
    ['Fader de façade',level(values[prefix+'/mix/fader'])],
    ['État',toggle(values[prefix+'/mix/on'],'Actif','Coupé')],
    ['Égaliseur',toggle(values[prefix+'/eq/on'],'Activé','Désactivé')],
    ['Compresseur',toggle(values[prefix+'/dyn/on'],'Activé','Désactivé')],
  ];
  if(channel!=='aux')rows.push(['Gate',toggle(values[prefix+'/gate/on'],'Activé','Désactivé')]);
  return <section className="balance-strip-readings" aria-label={tx('Réglages au départ de la balance')}>
    <h3>{tx('Réglages au départ de la balance')}</h3><dl>{rows.map(([label,value])=><div key={label}><dt>{tx(label!)}</dt><dd>{value}</dd></div>)}</dl>
  </section>;
}
