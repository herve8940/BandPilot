import {tx} from './i18n';
export function RecallScopeMatrix<Key extends string>({rows,sections,labels,selections,onSelect}:{rows:{id:string;label:string}[];sections:Key[];labels:Record<Key,string>;selections:Record<string,Key[]>;onSelect:(id:string,selected:Key[])=>void}){
 if(!rows.length||!sections.length)return null;
 return <details className="scope-matrix">
  <summary>{tx('Personnaliser les réglages par tranche')}</summary>
  <div className="scope-matrix-scroll">
   <table><thead><tr><th scope="col">{tx('Canal')}</th>{sections.map(section=><th scope="col" key={section}>{tx(labels[section])}</th>)}</tr></thead>
    <tbody>{rows.map(({id,label})=>{
     const selected=selections[id]??sections;
     return <tr key={id}><th scope="row">{label}</th>{sections.map(section=><td key={section}><input type="checkbox"
      aria-label={label+' · '+tx(labels[section])} checked={selected.includes(section)} disabled={selected.length===1&&selected.includes(section)}
      onChange={e=>onSelect(id,e.target.checked?[...selected,section]:selected.filter(key=>key!==section))}/></td>)}</tr>;
    })}</tbody>
   </table>
  </div>
 </details>;
}
export function narrowScopes<Key extends string>(value:Record<string,Key[]>,selectedIds:string[],sections:Key[]){
 return Object.fromEntries(Object.entries(value).flatMap(([id,keys])=>{
  const selected=sections.filter(key=>keys.includes(key));
  return selectedIds.includes(id)&&selected.length>0&&selected.length<sections.length?[[id,selected]]:[];
 }));
}
