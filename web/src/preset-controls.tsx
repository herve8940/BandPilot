import {tx} from './i18n';
import {PRESET_SECTIONS, type PresetSection} from '../../shared/channel-preset';

export type LibraryEntry = {id:string;kind:string;name:string;data:unknown;createdAt:string};
export type PresetOptions = {model:string;family:string;channels:{channel:number;name:string|number}[]};
export const PRESET_LABELS:Record<PresetSection,string> = {eq:'EQ et coupe-bas',compressor:'Compresseur',gate:'Gate / expandeur'};

export function PresetSections({selected,available=PRESET_SECTIONS,onChange}:{selected:PresetSection[];available?:readonly PresetSection[];onChange:(sections:PresetSection[])=>void}) {
  return <div className="preset-sections" role="group" aria-label={tx('Traitements à inclure')}>
    {available.map(section=><label key={section} className={selected.includes(section)?'selected':''}>
      <input type="checkbox" checked={selected.includes(section)} onChange={event=>onChange(event.target.checked?[...selected,section]:selected.filter(value=>value!==section))}/>
      {tx(PRESET_LABELS[section])}
    </label>)}
  </div>;
}

export async function presetApi<T>(path:string,data?:unknown):Promise<T> {
  const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Erreur serveur');
  return result as T;
}
