import "./language.css";
import {setLanguage,useLanguage,type Language} from './i18n';

export function LanguageSelect(){
 const language=useLanguage();
 return <label className="bandpilot-language">{language==='en'?'Language':'Langue'} <select aria-label={language==='en'?'Application language':'Langue de l’application'} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="fr">Français</option><option value="en">English</option></select></label>;
}
export function LanguageSettings(){
 const language=useLanguage();
 return <section className="studio-panel pad studio-control" aria-label={language==='en'?'Language options':'Options de langue'} style={{marginBottom:20}}><h2>{language==='en'?'Options · Language':'Options · Langue'}</h2><LanguageSelect/><p>{language==='en'?'Your choice is saved on this device. More languages can be added on request.':'Ton choix est mémorisé sur cet appareil. D’autres langues peuvent être ajoutées sur demande.'}</p></section>;
}
