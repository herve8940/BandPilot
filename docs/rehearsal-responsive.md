# Répéter : adaptation des fenêtres Mac et PC

Base : branche DEV, commit 182bdf6b190e3d018f1d2edc71ed802b31abb6c1 (2.2.0-dev.10).

## Changements

- Disposition selon la largeur réelle du panneau, grâce aux container queries : trois colonnes sur grand écran ; morceaux au-dessus du lecteur sur portable ; une colonne et panneaux secondaires sous le lecteur quand la place manque.
- Sections avec libellés complets, défilement horizontal et indication accessible de la section active. Les boutons ne représentent plus proportionnellement la durée ; la forme d’onde conserve l’échelle temporelle.
- Transport maintenu en haut pendant le défilement, avec commandes groupées. L’en-tête général défile sur cette page pour éviter deux barres fixes superposées. Le message de fin d’enregistrement dispose de sa propre ligne.
- Petites fenêtres : commandes de piste au-dessus de la forme d’onde, textes longs autorisés à revenir à la ligne, cibles tactiles adaptées.
- Canvas redessiné au redimensionnement, même à l’arrêt, en tenant compte du devicePixelRatio ; nettoyage du ResizeObserver et de l’écouteur resize au démontage.
- Navigation principale nommée explicitement pour rester accessible lorsque les textes du menu sont masqués.
- Couche CSS dédiée chargée après les thèmes existants, limitée à la répétition. La présentation Concert est conservée.

## Vérifications effectuées le 4 novembre 2026

Compilation TypeScript et build Vite : réussis. Vérification des espaces du diff : réussie.

Essais dans Chrome sur le Mac, avec le frontend modifié relié au backend local existant, projet Nouveau concert / la sentinelle. Aucun transport audio ni réglage de console actionné pendant ces vérifications de design.

| Fenêtre en pixels CSS | Vérification |
| --- | --- |
| 1920 × 1080 | Trois colonnes ; sept pistes visibles ; aucun libellé de section tronqué. |
| 1366 × 768 | Morceaux au-dessus ; lecteur + panneaux latéraux ; forme d’onde environ 620 px, contre 336 px avant changement. |
| 1280 × 720 | Aucun débordement horizontal ; canvas à la taille de son affichage, contrôlé après stabilisation. |
| 1024 × 600 | Menu compact ; mise en page fluide et transport disponible. |
| 768 × 1024 | Lecteur sur toute la largeur utile ; panneaux secondaires réorganisés. |
| 390 × 844 | Noms et boutons au-dessus des formes d’onde ; quatre commandes de transport sur une rangée. |
| 320 × 568 | Aucun débordement horizontal ; libellés et commandes accessibles. |

À 390 px : après défilement, haut du transport mesuré à 0 px. Vérification du menu réduit et agrandi à 1280 px ; les boutons de navigation conservent leur nom accessible. Redimensionnements effectués avec le transport arrêté : le canvas retrouve sa largeur de rendu sans avoir besoin de lancer la lecture.

## Limites

Les dimensions sont celles du viewport en pixels CSS, indépendantes du nombre de pixels physiques d’un écran Retina ou d’un moniteur Windows mis à l’échelle. Cela ne remplace pas une validation sur du matériel Windows, avec ses polices, sa mise à l’échelle et son éventuel écran tactile. L’auto-stop en enregistrement n’a pas été déclenché pendant cette revue visuelle.

Les problèmes fonctionnels de sélection des prises et du pont REAPER relèvent du rapport de tests séparé ; ce changement de présentation ne les corrige pas.

Les sources modifiées et l’aperçu sont séparés de l’application dans /Applications. Aucun paquet macOS ou Windows n’a été installé ou publié.
