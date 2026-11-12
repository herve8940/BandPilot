---
title: Maintenir les liens de la communauté Discord
---

# Maintenir les liens de la communauté Discord

Le serveur **BandPilot — Communauté** dispose d’une invitation sans expiration,
créée le 12 novembre 2026. Elle accueille les nouveaux membres dans `#accueil-welcome`.
L’accueil et les annonces sont en lecture seule pour les membres.

L’adresse publique est définie dans `config/community.json`. L’application la lit
directement ; les présentations publiques sont générées à partir de ce fichier et
de `config/community-copy.json` pour les cinq langues du projet.

Si l’invitation est révoquée ou remplacée :

1. Créer et vérifier l’invitation dans Discord, avec le bon serveur et salon d’arrivée.
2. Mettre à jour `config/community.json`.
3. Lancer `node scripts/sync-community.mjs`, puis les vérifications de documentation.
4. Publier les changements. Les applications déjà installées reçoivent le nouveau lien
   avec leur prochaine mise à jour.

```sh
node scripts/sync-community.mjs --check
node scripts/sync-support.mjs --check
python3 scripts/check-docs.py
```

Ne pas modifier à la main les blocs `community` et `community-badge` des README,
les blocs `community` des pages d’accueil, ni les pages `COMMUNITY_*.md` générées.
Les guides utilisent la navigation commune `docs/_layouts/default.html`.

Les liens ouvrent Discord sur action de l’utilisateur. Aucun widget, bot, suivi
automatique ou envoi de diagnostic à Discord n’est ajouté. Les bugs reproductibles
restent suivis dans GitHub Issues et les vulnérabilités suivent [la procédure de sécurité](../SECURITY.md).
