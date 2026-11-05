import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {LANGUAGES,isLanguage,languageOrFrench} from '../shared/languages.js';
const native=createRequire(import.meta.url)('../desktop/languages.cjs');

test('native and renderer support the same languages and validate preferences',()=>{
 assert.deepEqual(native.languageCodes,Object.keys(LANGUAGES));
 for(const language of native.languageCodes){assert.equal(isLanguage(language),true);assert.equal(native.normalizeLanguage(language),language);assert.equal(languageOrFrench(language),language);}
 for(const invalid of ['toString','__proto__','constructor','xx',null,{},['en'],1]){assert.equal(isLanguage(invalid),false);assert.equal(languageOrFrench(invalid),'fr');assert.equal(native.normalizeLanguage(invalid),'fr');}
 const required=['Connection','Detect and connect my mixer','About BandPilot','Quit','View','Reload','Toggle full screen','Cancel','Confirm','BandPilot — unable to start','The local BandPilot server did not start.'];
 for(const lang of ['it','es','de'])for(const key of required){assert.ok(native.labels[lang][key]);assert.notEqual(native.label(lang,'Texte français',key),key,`${lang}: ${key}`);}
});
