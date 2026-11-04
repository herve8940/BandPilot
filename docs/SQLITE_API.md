> **BandPilot 2.2** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# API répétitions SQLite — étape backend

Les données sont stockées par défaut dans `data/xr18-studio.db` (ignoré par Git). Définir `XR18_DB_PATH` pour choisir le chemin. Une sauvegarde du fichier SQLite doit être faite lorsque le serveur est arrêté ou via un mécanisme de backup SQLite cohérent.

## Endpoints locaux

- `GET /api/songs` : répertoire.
- `POST /api/songs` : `{"title":"Plug In Baby","artist":"Muse","bpm":136}`.
- `DELETE /api/songs/:id` : suppression et retrait automatique des setlists.
- `GET /api/rehearsals` : répétitions.
- `POST /api/rehearsals` : `{"title":"Répétition","startsAt":"2026-11-03T19:00:00","notes":"Travail batterie"}`.
- `GET /api/setlists` : setlists avec les IDs des morceaux dans l'ordre.
- `POST /api/setlists` : `{"name":"Concert","songIds":["id-morceau-1","id-morceau-2"]}`.
- `DELETE /api/setlists/:id` : suppression.

## Limitations

- Cette PR développe le backend persistant. L'interface existante utilise encore localStorage : migration et synchronisation à réaliser.
- Les dates sont des chaînes ISO analysables ; une validation stricte des fuseaux horaires reste à ajouter.
- Le backend HTTP est lié à 127.0.0.1 et n'a pas encore de contrôle d'accès. **Ne pas l'exposer sur Internet**.
- Les traitements EQ/comp/gate restent des simulations. Aucun mapping OSC matériel n'est validé.
- La compilation, les tests et la console physique restent à vérifier.

## Vérification

```bash
npm install
npm test
npm run build
npm run dev
```

Exemple :

```bash
curl -X POST http://127.0.0.1:3000/api/songs -H 'Content-Type: application/json' -d '{"title":"Plug In Baby","artist":"Muse","bpm":136}'
curl http://127.0.0.1:3000/api/songs
```
