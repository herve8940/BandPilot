# Contribuer / Contributing

Merci de ton intérêt pour XR18 Studio ! / Thanks for your interest in XR18 Studio!

## Signaler un problème ou proposer une idée / Report a bug or suggest an idea

Ouvre une [issue](https://github.com/herve8940/BandPilot/issues/new/choose). Le plus utile : la version, ton ordinateur, ta console (XR18, X18, MR18), une capture d’écran et le journal de diagnostic (Réglages › Télécharger le journal de diagnostic).

Open an [issue](https://github.com/herve8940/BandPilot/issues/new/choose) with the version, your computer, your mixer, a screenshot and the diagnostic log.

## Développer / Develop

```sh
npm run setup      # dépendances / dependencies
npm run studio     # serveur + interface / server + UI (http://127.0.0.1:5173)
npm test           # tests
npm run build:all
```

- Aucun matériel nécessaire : le mode simulation suffit pour l’interface. / No hardware needed: simulation mode is enough for the UI.
- Toute écriture vers la console passe par le moteur OSC unique (`src/xr18.ts`), avec relecture. Le 48 V, le routage et les types d’effets restent derrière une prévisualisation et une confirmation. / Every write goes through the single OSC engine with read-back; 48 V, routing and effect types stay behind preview + confirmation.
- Ajoute un test pour chaque correction (`tests/`). / Add a test for every fix.
- L’interface est en français, en langage simple pour des musiciens qui ne sont pas ingés son. / The UI is in French, in plain words for non-engineers.

En contribuant, tu acceptes que ton code soit publié sous la [licence MIT](LICENSE). / By contributing, you agree your code is published under the [MIT License](LICENSE).
