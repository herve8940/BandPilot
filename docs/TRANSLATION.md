# Interface languages

BandPilot 2.2.3 supports French and English. Additional languages can be added on request through GitHub Issues.

The French interface text is the source key. `web/src/i18n/en.json` contains reviewed English equivalents. `tx()` is used only at display boundaries (React text, labels, tooltips and dialogs). API values, OSC addresses, IDs, option values, saved names and editable input values must never be translated. Dynamic messages use numbered `{{0}}` placeholders; captured names are preserved verbatim. Prefer complete messages rather than separately translated grammatical suffixes.

`LanguageSelect` exposes the preference in Settings, sign-in and phone monitors. The desktop stores it in its existing data profile via a narrow IPC API; browser/phone clients use local storage. `useLanguage()` subscribes the top-level interface without remounting forms. Do not reconnect the console or send audio commands on language changes.

To add a language, extend the language type and preference validation, locale mapping, dictionary selection, selector labels, native menu/dialog labels, and the connected-adviser language instruction. Check all interpolated values, technical terms, long labels and small screens. Run `npm run test:web`, `npm test`, `npm run build:all` and the native desktop smoke test. Keep French as the fallback for invalid preferences; unknown display strings are preserved rather than removed.

The language tests cover saved preferences across local origins, live switching without audio writes, form preservation, exact custom names, dynamic placeholders and English phone monitors. Native smoke tests also switch the real selector and verify persistence and the menu.
