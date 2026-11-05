import "./language.css";
import {setLanguage,useLanguage,LANGUAGES,type Language} from './i18n';

export function LanguageSelect(){
 const language=useLanguage(),text=LANGUAGES[language];
 return <label className="bandpilot-language">{text.label} <select aria-label={text.ariaLabel} value={language} onChange={e=>setLanguage(e.target.value as Language)}>{Object.entries(LANGUAGES).map(([id,l])=><option value={id} lang={id} key={id}>{l.name}</option>)}</select></label>;
}
export function LanguageSettings(){
 const text=LANGUAGES[useLanguage()];
 return <section className="studio-panel pad studio-control" aria-label={text.optionsAria} style={{marginBottom:20}}><h2>{text.options}</h2><LanguageSelect/><p>{text.saved}</p></section>;
}
