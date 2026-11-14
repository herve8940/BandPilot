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


## Accès directs depuis l’application

`config/community.json` contient aussi l’identifiant du serveur et les salons
`help`, `bugs`, `guide` et `ideas`. Ils ont été vérifiés dans Discord le
14 novembre 2026 : `#entraide-help`, `#bugs-tests`, `#demarrer-start-here` et
`#idees-feedback`. Si un salon est recréé, vérifier son nouvel identifiant et
mettre à jour cette configuration. Un renommage seul ne change pas son identifiant.

Dans **Aide et incidents** (ou **Aide, logs et mises à jour** sur Android), accessible dans le menu et dans **Réglages**, y compris sur petit écran :

- L’aide, le guide de démarrage et les idées ouvrent directement le salon adapté.
- Pour un incident, saisir un résumé, les étapes et, si utile, le modèle de console,
  le mode simulation/matériel réel et le contexte d’écoute. Les champs restent locaux.
- Le message affiché contient ces textes et la version de BandPilot. Les motifs
  sensibles reconnus par le filtre de diagnostic sont masqués ; l’utilisateur doit
  toujours relire ses propres informations. Aucune collecte de diagnostic n’est
  nécessaire pour préparer ce message.
- **Copier le message Discord** copie exactement l’aperçu. **Ouvrir #bugs-tests**
  ouvre le salon ; l’utilisateur colle et envoie lui-même le message dans Discord.
  Aucun texte n’est transmis dans une URL. Si la copie échoue, l’aperçu est
  sélectionné pour une copie manuelle. Android utilise son presse-papiers natif.
- Les messages dépassant 2 000 caractères doivent être raccourcis avant copie,
  conformément à la [limite des messages Discord](https://github.com/discord/discord-api-docs/blob/main/developers/resources/message.mdx).
- L’invitation reste accessible pour les nouveaux membres ou en cas de salon
  inaccessible. Après avoir rejoint le serveur, rouvrir le salon depuis BandPilot.
- Le diagnostic détaillé et GitHub restent disponibles aux administrateurs dans
  une section repliable. L’aide Discord reste accessible même si le serveur local
  ne répond pas. Aucun message ni rapport n’est publié automatiquement.
