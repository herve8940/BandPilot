# Interface languages

BandPilot 2.2.4 supports **French, English, Italian, Spanish and German**. Additional languages can be requested through [GitHub Issues](https://github.com/herve8940/BandPilot/issues).

French interface text is the source key. `web/src/i18n/{en,it,es,de}.json` contains the other four catalogues, with identical keys. Translations ship with the application and need no translation service or internet at runtime. The new catalogues were prepared with machine assistance and checked for placeholders, terminology and core workflows; native-speaker corrections are welcome.

`tx()` is used only at display boundaries: React text, labels, tooltips and dialogs. API values, OSC addresses, IDs, option values, saved names and editable input values must never be translated. Dynamic messages use numbered `{{0}}` placeholders; their complete multiset must match the French source, except for six explicitly tested legacy templates that omit French-only plural suffixes. No name, number or other content placeholder may be dropped. Captured names are preserved verbatim. Prefer complete messages to separately translated grammatical suffixes. Each language has its own bounded translation cache.

`shared/languages.ts` defines codes, locale mappings, selector text and the connected-adviser language instruction. `LanguageSelect` exposes the preference in Settings, sign-in and phone monitors. Desktop persistence uses the existing data profile through a narrow IPC API; browser and phone clients use local storage. `desktop/languages.cjs` covers the native menu and confirmation buttons. `useLanguage()` subscribes the interface without remounting forms. A language change must never reconnect the mixer or send audio commands.

The local adviser recognises common problem descriptions in all five languages. Optional connected advice is requested in the selected language. These language changes do not extend mixer compatibility, change processing settings or add DEV-only features.

To add a language, extend the shared metadata, catalogue selection and native labels. Update the local adviser vocabulary, website, guides, release descriptions and video captions. Check exact keys, dynamic placeholders, technical terms, long labels and small screens. Unknown preferences fall back to French; unknown display strings are preserved.

Run `npm test`, `npm run test:web`, `npm run build:all` and the packaged `--smoke-test`. Regression checks cover catalogue completeness, placeholders, independent caches, all five selectors, native/browser persistence, custom names, unchanged form drafts and absence of audio writes. Native smoke tests use the real selector, clear browser storage, reload and verify the native preference and menu on each packaged platform.
