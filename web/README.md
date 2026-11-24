# XR18 Studio — interface web

Interface React/TypeScript (Vite + Tailwind CSS) servie par le backend XR18 Studio.

## Démarrage

À la racine du dépôt :

```sh
npm run setup
npm run studio
```

Ouvrir **http://127.0.0.1:5173**. Le proxy Vite pointe sur le backend local (port 3000).

## Communication avec le backend

- `GET /api/status`, `/api/channels`, `/api/meters`, `/api/console/parameters?prefix=…` : lecture.
- WebSocket `/ws` : instantané initial (`snapshot`), puis `parameter`, `channel`, `main`, `meters` (40 valeurs dans `state.all`) et `status`.
- Contrôle direct (console graphique) : le client envoie sur `/ws` `{"type":"set","address":"/ch/01/mix/fader","value":0.75}` (valeur OSC 0..1 ou entier) ou `{"type":"sync"}`. En cas de refus, le serveur répond `{"type":"live-error"}`. Le 48 V, le routage et le type d’effet ne sont pas acceptés par ce canal.

## Fichiers principaux

- Les modes Simple et Expert de la console utilisent `src/SimpleMixer.tsx` et `src/expert/ExpertStudio.tsx` pour les tranches, les faders et les traitements.
- `xairMath.ts` : lois de conversion X-Air (fader en dB, fréquences log, Q, couleurs, réponse EQ).
- Les réglages avec aperçu et confirmation se trouvent dans `src/ConsolePanel.tsx` et `src/FxConsole.tsx`.

## Sécurité

- Mode simulation par défaut. Le contrôle réel exige l’activation explicite des écritures dans Configuration.
- Les droits sont vérifiés côté serveur, y compris sur le WebSocket : un musicien ne règle que les envois de ses bus.
- Ne pas exposer le serveur à Internet. L’accès réseau exige HTTPS et des comptes (voir `docs/FONCTIONS_0_2.md`).
