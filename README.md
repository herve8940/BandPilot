# BandPilot

**Français** · [English](README.en.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Italiano](README.it.md)

**De la balance au concert.** Prépare les entrées de ton groupe, règle les retours de chaque musicien et garde ta setlist sous la main. BandPilot pilote ta console sur le réseau local.

[Télécharger BandPilot](https://herve8940.github.io/BandPilot/#download) · [Guide de démarrage](docs/USER_GUIDE_FR.md) · [Notes de version](docs/RELEASE_NOTES.md#release-fr)

[![Console · Captures en français, en simulation](docs/images/bandpilot-3.0/hero.jpg)](https://herve8940.github.io/BandPilot/#view-mixer)

## Installe BandPilot

| Version ordinateur 3.0.3 | Téléchargements |
| --- | --- |
| Windows | [Windows (.exe)](https://github.com/herve8940/BandPilot/releases/download/v3.0.3/BandPilot-Windows-3.0.3.exe) |
| macOS | [Apple Silicon](https://github.com/herve8940/BandPilot/releases/download/v3.0.3/BandPilot-macOS-3.0.3-arm64.dmg) · [Intel](https://github.com/herve8940/BandPilot/releases/download/v3.0.3/BandPilot-macOS-3.0.3-x64.dmg) |
| Linux | [AppImage](https://github.com/herve8940/BandPilot/releases/download/v3.0.3/BandPilot-Linux-3.0.3-x86_64.AppImage) · [Debian / Ubuntu](https://github.com/herve8940/BandPilot/releases/download/v3.0.3/BandPilot-Linux-3.0.3-amd64.deb) |

[Tous les fichiers et sommes SHA-256](https://github.com/herve8940/BandPilot/releases/tag/v3.0.3)

**Application Android autonome.** Sur tablette Android, l’APK pilote la console sans ordinateur. Pour un retour personnel sur téléphone, scanne simplement le QR fourni par le groupe. [Télécharger l’APK · 3.0.3-android.1](https://github.com/herve8940/BandPilot/releases/download/android-v3.0.3-android.1/BandPilot-Android-3.0.3-android.1-universal.apk)

## Ta première balance

1. Installe BandPilot et ouvre la simulation pour découvrir les commandes.
2. Connecte l’ordinateur et la console au même réseau local, puis sélectionne la console détectée.
3. Choisis les instruments, vérifie les entrées et les sorties des musiciens, puis confirme la balance.

Pars d’une scène vierge ou de ta scène habituelle. Quand tu confirmes une nouvelle balance avec le groupe, les entrées inutilisées et leurs envois passent au silence. Les gains de préampli et le 48 V sont conservés. Associe chaque musicien à sa sortie. Dans Retours → Téléphones, partage le QR de son mix sur le réseau local. Enregistrer les musiciens actualise leurs liens sans toucher au son.

Prépare l’ordre des morceaux en répétition. En concert, retrouve la setlist et ouvre la fiche PDF du morceau en cours. Sur ordinateur, le pont REAPER relie les projets de répétition au répertoire. REAPER se télécharge séparément.

[Tutoriel de balance guidée](docs/TUTO_MON_INGE_SON.md) · [Site officiel](https://herve8940.github.io/BandPilot/)

## Consoles

- **Behringer XR18 / X18 · Midas MR18** — Six sorties Aux pour les retours. La XR18 a été détectée sur matériel réel. Le profil MR18 a été vérifié en simulation.
- **Behringer XR12 · Midas MR12** — Deux sorties Aux physiques pour les retours. L’enregistreur USB est stéréo. L’enregistrement multipiste sur ordinateur demande un autre modèle.
- **Behringer X32 · Rack · Compact · Producer · Core** — Prise en charge partielle et expérimentale. Le mixage de base et les envois aux bus sont disponibles. Les scènes complètes et les retours téléphone restent à adapter.

[Voir la matrice de compatibilité (FR)](docs/multi-model.md)

## Lancer le projet en local

Avec Node.js 22.13 ou ultérieur, exécute ces commandes à la racine du dépôt, puis ouvre l’adresse affichée par Vite.

```sh
npm run ci:deps
npm --prefix web ci
npm run studio
```

[Contribuer](CONTRIBUTING.md) · [Signaler un problème](https://github.com/herve8940/BandPilot/issues/new/choose) · [Licence MIT](LICENSE)

<!-- community:start -->
## La communauté BandPilot sur Discord

Pose tes questions, partage ton expérience et propose des améliorations pour BandPilot. Échanges en français ou en anglais.

[Rejoindre le Discord](https://discord.gg/FtWwEPmwE7) · [Découvrir les salons](docs/COMMUNITY_FR.md)
<!-- community:end -->

<!-- community-badge:start -->
[![Discord](https://img.shields.io/badge/Discord-BandPilot-5865F2?logo=discord&logoColor=white)](https://discord.gg/FtWwEPmwE7)
<!-- community-badge:end -->

<!-- support:start -->
## Soutenir BandPilot

Un soutien volontaire aide à consacrer du temps aux corrections, aux essais sur les consoles et aux guides en cinq langues. Un retour de terrain, une traduction ou un partage du projet sont aussi utiles.

[Soutenir sur Ko-fi](https://ko-fi.com/bandpilot) · [Comment aider le projet](docs/SUPPORT_FR.md) · [Contribuer](CONTRIBUTING.md)
<!-- support:end -->
