# Pages d’accueil BandPilot

Les fichiers de langue de ce dossier alimentent les cinq pages d’accueil du site et les cinq README du dépôt. Les versions et les noms des installateurs sont définis dans `render.mjs`. Les articles et les guides sont en Markdown dans le dossier parent. GitHub Pages les rend avec `_layouts/default.html`.

Depuis la racine du dépôt, après avoir modifié une traduction ou une version, lance :

```sh
node docs/_source/render.mjs
node docs/_source/render.mjs --check
python3 scripts/check-docs.py
```

Les blocs Discord et Ko-fi des accueils sont conservés par ce générateur. Leurs sources sont les fichiers de configuration correspondants, appliqués par `scripts/sync-community.mjs` et `scripts/sync-support.mjs`.
