# BandPilot 2.2.1 — panneau de connexion au démarrage

## Défaut reproduit

Dans la version 2.2.0, deux panneaux frères de la page Réglages utilisaient tous deux le modèle comme clé React. À chaque mise à jour de l’état de la console, React pouvait conserver des panneaux orphelins et réutiliser leurs états de chargement. Le panneau de connexion se répétait ; certaines copies affichaient à tort « gérée par l’administrateur » et les champs pouvaient se réinitialiser.

Le défaut a été confirmé dans l’application macOS installée. Le backend indiquait une XR18 réellement connectée en lecture seule et une session locale administrateur, comptes désactivés. Il ne s’agissait pas d’un refus réel de droits par le serveur.

## Correction

- Clés distinctes et stables pour le panneau de connexion et le panneau Comptes/ReaCue.
- Chargement des droits, refus réel et erreur réseau affichés séparément ; nouvelle tentative possible après erreur.
- Annulation des réponses d’autorisation devenues obsolètes après démontage.
- Contrôles serveur et restrictions des véritables invités/musiciens inchangés.
- Contrôle de démarrage des installateurs étendu à l’ouverture de la page Réglages et à l’unicité des commandes de connexion.

## Vérifications

Le nouveau test monte le vrai composant App dans un DOM, simule les mises à jour WebSocket et vérifie les contrôles visibles. Avant correction : **17 panneaux après 15 mises à jour**. Après : **un panneau**, commandes administrateur disponibles et changement de modèle propre.

Trois autres scénarios vérifient l’attente d’autorisation, la nouvelle tentative après erreur et les restrictions d’un invité réel. **137 tests backend et 4 tests React réussis**, compilation réussie. Le test React est exécuté par `npm run test:web` et intégré à CI ainsi qu’aux constructions des installateurs.

L’interface corrigée a aussi été inspectée avec le backend de l’application du Mac et la vraie XR18 en lecture seule. Aucun contrôle audio matériel n’a été activé pour ces essais.

[Versions et téléchargements](https://github.com/herve8940/xr18-studio/releases/latest) · [Notes de version](RELEASE_NOTES.md)
