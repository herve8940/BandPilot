# BandPilot — état du projet

État vérifié le **11 novembre 2026** dans les releases GitHub. Les captures conservées
dans les guides montrent la 2.2.4 en simulation ; la vidéo illustre la 2.2.

| Distribution | Version publiée | Statut |
|---|---|---|
| Windows, macOS Intel/Apple Silicon, Linux | [2.3.3](https://github.com/herve8940/BandPilot/releases/tag/v2.3.3) | Stable ; paquets de bureau et sommes SHA-256 |
| Android autonome | [2.4.0-android.1](https://github.com/herve8940/BandPilot/releases/tag/android-v2.4.0-android.1) | Préversion ; APK signé séparé, [limites Android](ANDROID.md) |
| Intégration BandStudio | [2.3.4-dev.1](https://github.com/herve8940/BandPilot/releases/tag/bandstudio-integration-dev) | Préversion Windows ; nécessite la version compatible de BandStudio, capture matérielle/latence à valider |

Le numéro Android n'annonce pas une version stable 2.4 pour ordinateur. Une fonction
présente dans une branche DEV n'est pas nécessairement livrée dans la version stable.

## Fonctions de la version stable

Console Simple/Expert, balance guidée, profils de groupe, retours personnels, ambiances
de sources, fiche technique et plan de scène imprimable, scènes JSON avec aperçu et
sauvegarde, répétitions et Atelier du son avec REAPER sur ordinateur. Interface et guides
principaux en français, anglais, italien, espagnol et allemand. Pont REAPER livré : **1.5.0**.

La 2.3.3 renforce la validation des instruments, le traitement des interruptions, la
validité des mesures et les vérifications de l'installateur Windows. Voir les
[notes de version](RELEASE_NOTES.md) pour le détail.

## Validation et limites

Les essais matériels documentés concernent principalement la XR18. X18, MR18, XR12 et
MR12 demandent leurs propres essais. La X32 reste **partielle et expérimentale** :
[matrice de capacités](multi-model.md). Une détection ou un test de simulation ne certifie
pas un concert ni un résultat acoustique. Les presets sont des points de départ.

Façade, retours de scène, in-ears, casque et groupes mixtes ont des besoins différents.
Enregistrer une préférence ne doit pas envoyer de réglage audio à la console. Les profils
existants et les valeurs par défaut doivent être préservés.

Les tests automatiques et les constructions sont visibles dans
[GitHub Actions](https://github.com/herve8940/BandPilot/actions). Les paquets de bureau
peuvent être non signés/non notariés. Le [rapport de revue](REPOSITORY_AUDIT.md) précise les
alertes de dépendances restantes ; cette page n'est pas une certification de sécurité.

[Guide actuel](USER_GUIDE_FR.md) · [Téléchargements](https://herve8940.github.io/BandPilot/#download)
· [Données et confidentialité](PRIVACY.md) · [Soutenir le projet](SUPPORT_FR.md)
