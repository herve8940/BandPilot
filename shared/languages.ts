/** Supported interface languages. Persist identifiers; translate display text only. */
export const LANGUAGES = {
 fr: {name:'Français',locale:'fr-BE',title:'BandPilot — Console & répétitions',label:'Langue',ariaLabel:'Langue de l’application',options:'Options · Langue',optionsAria:'Options de langue',saved:'Ton choix est mémorisé sur cet appareil. D’autres langues peuvent être ajoutées sur demande.',adviser:'Réponds exclusivement en français. '},
 en: {name:'English',locale:'en-GB',title:'BandPilot — Mixer & rehearsals',label:'Language',ariaLabel:'Application language',options:'Options · Language',optionsAria:'Language options',saved:'Your choice is saved on this device. More languages can be added on request.',adviser:'Respond exclusively in English. '},
 it: {name:'Italiano',locale:'it-IT',title:'BandPilot — Mixer e prove',label:'Lingua',ariaLabel:'Lingua dell’applicazione',options:'Opzioni · Lingua',optionsAria:'Opzioni della lingua',saved:'La scelta viene salvata su questo dispositivo. Altre lingue possono essere aggiunte su richiesta.',adviser:'Rispondi esclusivamente in italiano. '},
 es: {name:'Español',locale:'es-ES',title:'BandPilot — Mezcla y ensayos',label:'Idioma',ariaLabel:'Idioma de la aplicación',options:'Opciones · Idioma',optionsAria:'Opciones de idioma',saved:'Tu elección se guarda en este dispositivo. Se pueden añadir otros idiomas bajo petición.',adviser:'Responde exclusivamente en español. '},
 de: {name:'Deutsch',locale:'de-DE',title:'BandPilot — Mischpult und Proben',label:'Sprache',ariaLabel:'Sprache der Anwendung',options:'Optionen · Sprache',optionsAria:'Sprachoptionen',saved:'Deine Auswahl wird auf diesem Gerät gespeichert. Weitere Sprachen können auf Wunsch ergänzt werden.',adviser:'Antworte ausschließlich auf Deutsch. '}
} as const;
export type Language = keyof typeof LANGUAGES;
export function isLanguage(value:unknown):value is Language {return typeof value==='string'&&Object.hasOwn(LANGUAGES,value);}
export function languageOrFrench(value:unknown):Language {return isLanguage(value)?value:'fr';}
