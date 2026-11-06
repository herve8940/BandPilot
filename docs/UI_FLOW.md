# Interface harmonisée — version locale 2.2.3-dev.1

La référence visuelle est la console Canal : panneaux bleu nuit, onglet actif violet, sélection/focus cyan, boutons et cartes cohérents. Les couleurs rouge, ambre et verte restent réservées aux actions et états correspondants.

La palette commune est définie dans `web/src/design-system.css`, chargée par l’application et par la page téléphone. Les anciennes palettes globales de `theme.css`, `visual-console.css` et `ears.css` ont été retirées.

## Un seul parcours

- **Préparer** : répertoire/setlists, notes de répète, scènes.
- **Régler le son** : Mon ingé son, Console, Retours.
- **Répéter** : morceaux, enregistrement et réécoute REAPER.
- **Concert** : conduite du set.
- **Réglages** : connexion, comptes et système.

Le menu compact garde de petits libellés. La navigation des pages n’apparaît plus à la fois dans le menu gauche et dans la barre contextuelle. Une reconnexion ne ramène plus l’utilisateur aux réglages après l’écran initial de connexion.

## Retours sans doublon

La page **Retours** contient directement deux vues :

1. **Mix et traitements** : choix du musicien, envois, EQ, compression et matrice complète avancée.
2. **Téléphones** : partage, QR codes et profils existants.

L’onglet Ears a été retiré du mode Expert et l’ancien bouton intermédiaire « Ouvrir la régie » a été supprimé. Les réglages de bus restent accessibles dans la console complète, pour le travail technique. Le même composant de compression est partagé par les canaux, les retours et l’adaptateur X32.

Les fonctions audio, les autorisations et le pont REAPER 1.2.3 sont conservés. Changer de page ou d’onglet ne déclenche aucune commande audio ni le partage réseau.

## Vérifications

Compilation serveur/interface ; huit régressions React incluant le parcours complet vers les retours, les téléphones, l’absence du doublon Expert/Ears, la reconnexion sans changement de page et l’absence de commandes audio lors de la navigation. Revue visuelle des pages principales en simulation, avec palette et débordement horizontal contrôlés à 1440 px et à 390 px pour les réglages et les retours.

Cette itération locale est distincte de la version stable publique 2.2.2.
