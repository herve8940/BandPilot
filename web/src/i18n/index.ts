import {useSyncExternalStore} from 'react';
import english from './en.json';
import italian from './it.json';
import spanish from './es.json';
import german from './de.json';
import {LANGUAGES,isLanguage,languageOrFrench,type Language} from '../../../shared/languages';
export {LANGUAGES,type Language} from '../../../shared/languages';

export const LANGUAGE_KEY = 'bandpilot-language';
const listeners = new Set<() => void>();
type DesktopLanguage = {get: () => string; set: (language: Language) => boolean};
const desktop = () => typeof window === 'undefined' ? undefined :
  (window as unknown as {bandpilotLanguage?: DesktopLanguage}).bandpilotLanguage;
export function readLanguage(): Language {
  // The native preference survives the desktop server's changing localhost port.
  try {
    const saved = desktop()?.get() ?? localStorage.getItem(LANGUAGE_KEY);
    return languageOrFrench(saved);
  } catch { return 'fr'; }
}
let language = readLanguage();
const dictionaries = {en:english,it:italian,es:spanish,de:german};
const normalize = (text: string) => text.trim().replace(/\s+/g, ' ');
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
function makeCatalog(entries:Record<string,string>){
 const catalog = new Map(Object.entries(entries));
 const cache = new Map<string,string>();
 const patterns = [...catalog].filter(([key]) => /\{\{\d+\}\}/.test(key) && key.replace(/\{\{\d+\}\}/g, '').length >= 4)
  .sort((a, b) => b[0].length - a[0].length).map(([source, target]) => {
    const slots: number[] = [];
    let last = 0, pattern = '';
    for (const match of source.matchAll(/\{\{(\d+)\}\}/g)) {
      pattern += escape(source.slice(last, match.index)) + '([\\s\\S]*?)';
      slots.push(Number(match[1]));
      last = match.index! + match[0].length;
    }
    return {re: new RegExp('^' + pattern + escape(source.slice(last)) + '$'), slots, target};
  });

 return {catalog,cache,patterns};
}
const catalogs = Object.fromEntries(Object.entries(dictionaries).map(([lang,entries])=>[lang,makeCatalog(entries)])) as Record<Exclude<Language,'fr'>,ReturnType<typeof makeCatalog>>;

/** Display only. Never translate OSC addresses, IDs, form values or user names. */
export function translate(text: string, lang: Language): string {
  if (!isLanguage(lang) || lang === 'fr' || !text || !/[a-zÀ-ÿ]/i.test(text)) return text;
  const {catalog,cache,patterns}=catalogs[lang];
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  let result = catalog.get(normalize(text));
  if (result === undefined) {
    for (const p of patterns) {
      // Match the original text: do not collapse spaces or translate names in placeholders.
      const match = p.re.exec(text.trim());
      if (!match) continue;
      const args = new Map(p.slots.map((slot, i) => [slot, match[i + 1]!]));
      result = p.target.replace(/\{\{(\d+)\}\}/g, (_, slot) => args.get(Number(slot)) ?? '');
      break;
    }
  }
  const translated = result === undefined ? text :
    (text.match(/^\s*/)?.[0] ?? '') + result + (text.match(/\s*$/)?.[0] ?? '');
  if (cache.size >= 2000) cache.clear(); // Live meter strings must not grow memory forever.
  cache.set(text, translated);
  return translated;
}
/** JSX presentation boundary; numbers, objects and React elements stay unchanged. */
export function tx<T>(value: T): T {
  return (typeof value === 'string' ? translate(value, language) : value) as T;
}
export const getLanguage = () => language;
export const getLocale = () => LANGUAGES[language].locale;
function applyDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.title = LANGUAGES[language].title;
}
export function setLanguage(next: Language) {
  if (!isLanguage(next)) return;
  language = next;
  try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Session-only in restricted browsers. */ }
  try { desktop()?.set(next); } catch { /* The current UI remains usable if storage is unavailable. */ }
  applyDocument();
  for (const notify of listeners) notify();
}
export function useLanguage() {
  return useSyncExternalStore(callback => {listeners.add(callback); return () => listeners.delete(callback);}, getLanguage, () => 'fr' as Language);
}
if (typeof window !== 'undefined') {
  applyDocument();
  window.addEventListener('storage', event => {
    if (event.key !== LANGUAGE_KEY) return;
    language = languageOrFrench(event.newValue);
    applyDocument();
    for (const notify of listeners) notify();
  });
}
