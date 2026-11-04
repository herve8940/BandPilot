# BandPilot 2.2.0 — état du projet

BandPilot succède à XR18 Studio. Cette version réunit les améliorations de console, coach et répétitions, les corrections des essais manuels et une première adaptation multi-modèle.

## Disponible dans les sources de la version

- Interface adaptable, menu compact, console Simple/Expert et traitements visuels.
- Coach en six étapes avec mesures matérielles disponibles, propositions et sauvegardes.
- Retours personnels X-Air/M-Air avec profils et autorisations actualisées.
- Sessions REAPER, lecteur de répétition, sections, présence, prises, boucles et Original ; pont 1.2.2.
- Notes et setlist active dans la base SQLite, indépendantes du port de l’application.
- Profils XR12/MR12/XR18/MR18/X18 et adaptateur X32 partiel ; contrôles et scènes bornés au modèle.
- Guides FR/EN, nouvelles captures en simulation et vidéo illustrée sous-titrée.

## Vérifications et limites

137 tests automatiques passent dans la préparation de cette version, avec compilation serveur et interface. Les installateurs sont publiés seulement après les contrôles du workflow Windows, Mac Intel, Mac Apple Silicon et Linux. Le statut réel de ces contrôles reste visible dans [GitHub Actions](https://github.com/herve8940/BandPilot/actions).

Les essais matériels ont été effectués sur XR18. Les autres modèles demandent une validation physique. La X32 reste **partielle et expérimentale**, sans préamplis, routage, FX, vumètres, scènes, coach, retours téléphone et USB complets. Le concert complet, certaines intégrations et les résultats acoustiques ne sont pas certifiés.

[Guide actuel](USER_GUIDE_FR.md) · [Matrice de compatibilité](multi-model.md) · [Essais manuels et corrections](corrections-tests-manuels.md) · [Notes de version](RELEASE_NOTES.md)
