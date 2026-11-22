# BandPilot — état du projet

Publication du **22 novembre 2026**. Les installateurs ne sont rendus disponibles qu’après la réussite des constructions et tests de chaque plateforme.

| Distribution | Version | Portée |
|---|---|---|
| Windows, macOS Intel/Apple Silicon, Linux | [2.3.15](https://github.com/herve8940/BandPilot/releases/tag/v2.3.15) | Installateurs et sommes SHA-256 ; mises à jour automatiques sur les installations compatibles |
| Android autonome | [2.4.0-android.5](https://github.com/herve8940/BandPilot/releases/tag/android-v2.4.0-android.5) | APK séparé ; les nouveautés 2.3.15 ne sont pas toutes livrées dans cet APK |
| BandStudio | [Projet indépendant](https://herve8940.github.io/BandStudio/) | Préparation des morceaux et export REAPER ; ne fait pas partie de l’installateur BandPilot |

## Nouveautés de bureau

Commandes et surfaces de console, groupes logiciels, stéréo, MIDI, rappels sélectifs avec protections, effets X-Air détaillés, GEQ et mesure acoustique. Répétition par onglets REAPER, gestionnaire sur téléphone, prises séparées, accords et paroles de fiches compatibles. [Tutoriel 2.3.15](NEW_2_3_15_FR.md) · [English](NEW_2_3_15_EN.md).

Les profils existants et leurs valeurs par défaut sont conservés. Les nouvelles options sont explicites. Une préférence enregistrée ne déclenche pas un réglage audio. Les musiciens peuvent avoir des écoutes différentes, y compris inconnues.

Réinstaller le pont livré avec cette version et redémarrer REAPER, même si le numéro affiché est déjà 1.5.0. La simulation de console ne simule pas REAPER : REC utilise ses entrées audio réelles.

## Validation et limites

Les tests et paquets sont suivis dans [GitHub Actions](https://github.com/herve8940/BandPilot/actions). Les tests logiciels et la simulation ne certifient pas chaque console physique. Les essais matériels documentés concernent principalement la XR18 ; X18, MR18, XR12 et MR12 nécessitent leurs propres essais. X32 reste partielle et expérimentale. Voir la [matrice de capacités](multi-model.md).

Les presets sont des points de départ. Mesures, estimations et préférences restent distinctes ; aucun résultat sonore universel ni récupération d’un enregistrement écrêté n’est promis. Les installateurs peuvent être non notariés.

Les anciennes captures 2.2.4 et la vidéo 2.2 sont conservées comme illustrations historiques. [Guide](USER_GUIDE_FR.md) · [Notes de version](RELEASE_NOTES.md) · [Données et confidentialité](PRIVACY.md).
