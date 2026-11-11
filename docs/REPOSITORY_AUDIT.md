# Revue du dépôt et de la documentation — 11 novembre 2026

Périmètre : `herve8940/BandPilot`, branche publique `main`, README, GitHub Pages,
guides, fichiers communautaires, configuration CI et dépendances déclarées. Les autres
dépôts du compte, les réglages privés GitHub et un audit complet du code ne sont pas
couverts. Cette revue n'est ni une certification juridique ni une certification de sécurité.

## Corrections

- Distinction stable bureau 2.3.3 / préversion Android 2.4.0-android.1 / intégration
  BandStudio 2.3.4-dev.1, sans annoncer des fonctions DEV comme stables.
- Mise à jour des références au pont REAPER livré 1.5.0 ; les captures 2.2.4 et la vidéo
  2.2 restent datées. Les anciens rapports et notes de version gardent leur contexte.
- Contribution, assistance, règles d'échange, signalement de sécurité et traitement des
  données explicités. Les diagnostics publics demandent une relecture.
- Soutien traduit en cinq langues, lié depuis README, pages et guides. Après création
  du compte par son propriétaire, les liens pointent vers [BandPilot sur Ko-fi](https://ko-fi.com/bandpilot).
  Aucun paiement n'est intégré à BandPilot.
- Installation CI avec le lockfile et permissions de lecture explicites. Vérification
  automatique des liens locaux et de la synchronisation des pages de soutien.
- Texte MIT ajouté aux futurs paquets de bureau, en complément des notices tierces.
  Les installateurs déjà publiés ne sont pas remplacés par cette revue.

## Dépendances : résultat npm audit

Contrôle du 11 novembre 2026, sans modification des versions de dépendances :

| Commande | Résultat |
|---|---|
| `npm audit --omit=dev` | 0 vulnérabilité connue dans les dépendances serveur de production |
| `npm --prefix web audit` | 0 vulnérabilité connue dans les dépendances de l'interface |
| `npm audit` | 18 dépendances signalées : 1 critique, 13 élevées, 4 modérées |

Les nombres désignent des entrées de dépendances signalées, pas 18 failles indépendantes.
Electron est déclaré comme dépendance de développement mais son moteur est **embarqué**
dans les applications de bureau : les résultats production seuls ne suffisent donc pas.
Les autres alertes concernent notamment electron-builder et sa chaîne d'extraction (`tar`,
`extract-zip`). Les propositions de correction npm impliquent des changements majeurs.

Le traitement restant est une migration contrôlée d'Electron/electron-builder, avec
vérification du module SQLite natif, de NSIS et des paquets Windows/macOS/Linux. Un
`npm audit fix --force` sans ces validations ne constitue pas une correction vérifiée.
Cette revue documentaire ne modifie pas ces moteurs ni les installateurs publiés.

## Réglages et limites à vérifier

- `main` a été observée sans protection de branche. Une règle de revue/contrôles requis
  peut être choisie par le mainteneur selon son mode de travail ; elle n'est pas imposée ici.
- La disponibilité du signalement privé GitHub et des analyses de sécurité privées
  n'a pas pu être confirmée par le connecteur. La procédure prévoit ce cas.
- Les tests matériels restent nécessaires pour les modèles et usages non validés.
- Ko-fi indique la configuration du profil et la connexion aux paiements terminées ;
  la page du projet affiche son formulaire de soutien. Aucun paiement de test n'a été effectué.
- Les captures existantes n'ont pas été remplacées par de fausses captures de la dernière version.

[État du projet](ETAT_DU_PROJET.md) · [Activation Ko-fi](KOFI_SETUP.md)
