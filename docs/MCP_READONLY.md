> **BandPilot 2.2** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# Serveur MCP BandPilot — lecture seule

Le serveur MCP utilise le SDK officiel Model Context Protocol et le transport stdio. Il donne accès aux données locales de répétition, sans communication OSC.

## Outils
- `studio_list_songs`
- `studio_list_setlists`
- `studio_get_setlist` (UUID)
- `studio_list_rehearsals`
- `studio_list_ear_profiles`

## Démarrage
```sh
npm install
XR18_DB_PATH=./data/xr18-studio.db npm run mcp
```
Le chemin SQLite doit pointer vers **la même base** que celle de l'application. Pour l'application Electron, le fichier se trouve dans le répertoire utilisateur propre à BandPilot ; utiliser son chemin exact dans `XR18_DB_PATH`.

## Exemple de configuration MCP (client compatible stdio)
```json
{
  "mcpServers": {
    "xr18-studio": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/CHEMIN/ABSOLU/DU/PROJET",
      "env": {
        "XR18_DB_PATH": "/CHEMIN/ABSOLU/xr18-studio.db"
      }
    }
  }
}
```

## Sécurité et limites
- Aucun outil d'écriture, aucun contrôle de fader, aucun accès OSC.
- L'accès MCP donne accès aux données locales du groupe ; ne connecter qu'un assistant autorisé.
- Le SDK est un ajout de dépendance non validé par compilation.
- Les commandes et installateurs ne sont pas testés dans cette étape, conformément à la demande.


## Version 0.2.0

Le périmètre lecture seule de ce document décrit la version initiale. La version 0.2.0 ajoute des outils de prévisualisation et d’écriture confirmée via le backend authentifié, sans transport OSC supplémentaire. Voir `FONCTIONS_0_2.md`, section MCP, pour les outils et variables de connexion.
