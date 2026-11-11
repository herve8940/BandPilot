<div align="center">

# BandPilot

**Ton groupe. Ta console. Ton son.**

[![Version](https://img.shields.io/github/v/release/herve8940/BandPilot)](https://github.com/herve8940/BandPilot/releases/latest) [![CI](https://github.com/herve8940/BandPilot/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/herve8940/BandPilot/actions/workflows/ci.yml) [![MIT](https://img.shields.io/badge/licence-MIT-green)](LICENSE)

Application gratuite pour préparer la balance, piloter la console, donner les retours aux musiciens et répéter avec REAPER. **BandPilot est le nouveau nom de XR18 Studio.**

[⬇ Télécharger](https://herve8940.github.io/BandPilot/#download) · [🌐 Site](https://herve8940.github.io/BandPilot/) · [📘 Guide FR](docs/USER_GUIDE_FR.md) · [English](README.en.md) · [🎬 Visite vidéo](https://herve8940.github.io/BandPilot/VIDEO_TOUR.html)

**Application multilingue : français, anglais, italien, espagnol et allemand.** Choisis la langue dans **Réglages → Options · Langue** ; le choix est mémorisé sur cet appareil. Les musiciens peuvent choisir leur langue sur leur téléphone. D’autres langues peuvent être ajoutées suivant la demande.

[Français](README.md) · [English](README.en.md) · [Italiano](README.it.md) · [Español](README.es.md) · [Deutsch](README.de.md)

![Console BandPilot 2.2.4 en simulation](docs/images/bandpilot-2.2.4/expert-canal.jpg)

Windows · Mac Intel et Apple Silicon · Linux · **Android autonome**

</div>

## Versions et disponibilité

Bureau : **2.3.3 stable** (Windows, macOS, Linux). Android : **2.4.0-android.1 en préversion**, APK séparé. BandStudio : **2.3.4-dev.1 en préversion Windows**, à tester avec la version compatible de BandStudio ; ne fait pas partie de la version stable.

[Téléchargements et limites](https://herve8940.github.io/BandPilot/#download) · [BandStudio DEV](https://github.com/herve8940/BandPilot/releases/tag/bandstudio-integration-dev)

## Nouveautés : fiche technique, ambiances et Android

Première version Android disponible en APK signé. Installation durable, sans signature à renouveler tous les sept jours. REAPER reste sur ordinateur.

- **Fiche technique et plan de scène** — Prépare les entrées, les musiciens, les retours et les branchements. Place chacun sur le plan de scène, puis imprime la fiche ou exporte un PDF. Le raccourci est visible dès l’accueil de Mon ingé son.
- **Ambiances des sources** — Choisis une ambiance adaptée au chant ou à l’instrument, prévisualise l’essai et règle la quantité pour chaque musicien. Garde le résultat ou reviens aux réglages précédents.
- **Android autonome** — Installe l’APK sur une tablette compatible et connecte-la directement à la console par Wi-Fi. L’interface, le moteur et les données sont sur la tablette : aucun PC ni Docker nécessaire.

[Android APK](https://github.com/herve8940/BandPilot/releases/download/android-v2.4.0-android.1/BandPilot-Android-2.4.0-android.1-universal.apk) · [Guide Android](docs/ANDROID.md)

Première version : 2.4.0-android.1. Android 8 minimum, Android System WebView 111 minimum. APK ARM 32/64 bits et x86_64 ; affichage portrait et paysage. Installation et démarrage vérifiés sur une Xiaomi Redmi Pad sous Android 14 ; fonctionnement confirmé par son utilisateur. La compatibilité de chaque tablette et de chaque console reste à valider. Appareils à pages mémoire de 16 Ko non certifiés. REAPER et l’Atelier lié aux prises restent disponibles sur ordinateur.

## Les fonctions

| Espace | Ce que tu peux préparer ou contrôler |
|---|---|
| Mon ingé son | Six étapes de balance, configuration du groupe, mesure des gains, conseils à vérifier, retours et sauvegarde. Le coach ne reçoit pas le flux audio. |
| Console | Simple ou Expert, banques de canaux, EQ, gate, compresseur, envois, bus, DCA, FX et routage selon le modèle. Menu compact et interface adaptable. |
| Retours | Lien QR par musicien, uniquement son bus, faders/mute, profils, plafonds et montée progressive. |
| Répéter | Avec morceaux ou groupe seul : sections, prises, formes d’onde, présence, Original, boucle, REC/Stop et marqueurs via REAPER. |
| Concert | Déroulement du set dans le projet préparé avec REAPER/ReaCue configurés. |
| Préparer | Répertoire, setlists, répétitions, brouillon persistant, capture/export/import JSON de scènes et sauvegardes avant rappel. |
| Réglages | Détection par modèle, lecture seule initiale, synchronisation, comptes facultatifs, diagnostic, IA connectée facultative et intégrations. |

Le contrôle local ne demande ni compte ni Internet. Ordinateur ou tablette Android, console et téléphones partagent le même réseau local. REAPER est un logiciel séparé avec sa propre licence ; l’IA connectée facultative nécessite Internet et une clé personnelle.

## Consoles et limites

| Modèle | État actuel |
|---|---|
| Behringer XR18 | Famille principale ; essais physiques réalisés sur XR18. |
| Behringer X18 / Midas MR18 | Profils et protocole commun ; validation physique de ces appareils restante. |
| Behringer XR12 / Midas MR12 | Interface adaptée à 12 entrées, 4 préamplis micro et 2 Aux physiques. USB stéréo sur clé, **pas d’USB multipiste PC**. Validation physique restante. |
| Behringer X32 et variantes | **Partiel et expérimental** : mixage, EQ, dynamique principale et envois. Préamplis, routage, FX, vumètres, scènes, coach, retours téléphone et USB complets restent à adapter. |

La détection ne constitue pas une certification de toutes les fonctions. [Matrice détaillée](docs/multi-model.md). Aucun fichier X-Air n’est présenté comme une scène X32 compatible.

## Bien démarrer

1. Télécharge l’installateur de ton système et sauvegarde tes scènes avant une mise à jour.
2. Explore la simulation, puis détecte ta console en lecture seule.
3. Récupère **Table → PC** et conserve une sauvegarde avant d’activer le contrôle.
4. Suis [Mon ingé son](docs/TUTO_MON_INGE_SON.md), puis vérifie le résultat à l’oreille.
5. Pour répéter, installe le pont **REAPER 1.5.0**, sauvegarde tes projets et redémarre REAPER.

La simulation de console ne simule pas REAPER : REC capture ses véritables entrées audio. Les installateurs peuvent ne pas être signés/notariés.

## Documentation et médias

- [Guide complet FR](docs/USER_GUIDE_FR.md) · [Full English guide](docs/USER_GUIDE_EN.md)
- [Mon ingé son FR](docs/TUTO_MON_INGE_SON.md) · [English coach tutorial](docs/TUTO_MON_INGE_SON_EN.md)
- [Visite vidéo et transcription](docs/VIDEO_TOUR.md) — montage de six captures en simulation, 42 secondes, sous-titres FR/EN/IT/ES/DE.
- [Nouveautés 2.3.3](docs/RELEASE_NOTES.md) · [Essais manuels et corrections](docs/corrections-tests-manuels.md)
- [Contrôles X-Air détaillés](docs/GUIDE_CONSOLE.md) · [Architecture et API](docs/SQLITE_API.md)

## Développement

La version Android autonome est disponible : [installation, compatibilité et compilation de l’APK](android/README.md). Elle embarque le moteur de console et les données sur la tablette, sans PC ni Docker. Les installateurs de bureau ci-dessus restent distincts de cet APK.

**BandPilot 2.3.3** corrige la validation des instruments, conserve une possibilité d’annulation après interruption et renforce les vérifications de l’application Windows installée. Les rapports debug et les mises à jour au lancement restent disponibles. [Détails](docs/RELEASE_NOTES.md).

**BandPilot 2.3.1** ajoute les [fiches de balance par groupe](docs/WORKSPACES.md#reprendre-une-balance-de-groupe), la [fiche technique et le plan de scène](docs/WORKSPACES.md#fiche-technique-du-groupe), la vérification du retour sur téléphone, la [comparaison kick et basse](docs/ATELIER_DU_SON.md#comparer-le-kick-et-la-basse) et le [diagnostic de connexion](docs/CONNEXION_XR18.md#diagnostiquer-la-connexion).

Dans **BandPilot 2.3.0**, l’[Atelier du son et les conseils mesurés](docs/ATELIER_DU_SON.md) ajoutent le travail sur un extrait REAPER, la comparaison A/B et la restauration des sources. Spectre par instrument, compatibilité mono, conseils EQ et essais de polarité sont intégrés. Le gate guidé utilise deux repères écoutés (repos et note faible), et la compression tient compte de l’enveloppe du jeu. Dans **Mon ingé son**, les [ambiances guidées](docs/INGE_SON.md#ambiances-guidées) proposent des effets pour le chant, les chœurs, la guitare acoustique ou solo, la caisse claire, les toms et le clavier, avec un dosage individuel par retour. Pont REAPER **1.5.0** requis pour les nouvelles mesures.

Node.js 20+ (CI et installateurs : Node 22). `npm ci`, `npm --prefix web ci`, puis `npm run studio`. Vérifications : `npm test`, `npm run test:web` et `npm run build:all`. Installateurs : `npm run desktop:package`.

Les tests backend et les tests de régression React couvrent notamment OSC, scènes, FX, comptes, retours, REAPER, Lua et profils de console. Ils ne remplacent pas une validation acoustique et un concert complet sur chaque matériel. La publication attend les contrôles des quatre plateformes de construction et conserve les sommes SHA-256.

Les anciens identifiants `xr18-studio`, le dépôt, les clés de données et les chemins REAPER restent pour préserver la compatibilité. Projet indépendant, non affilié à Behringer, Midas ou Music Tribe ; marques de leurs propriétaires. Licence [MIT](LICENSE).

Correctif de démarrage : [panneau de connexion 2.2.1](docs/hotfix-2.2.1.md).

## BandPilot 2.2.2

[Console personnelle et régie des retours](docs/WORKSPACES.md) : disposition par modèle et taille d’écran, mix/EQ/compression par musicien, parcours du signal. Inclut le [correctif REAPER 1.2.3](docs/hotfix-2.2.2.md).

<!-- support:start -->
## Soutenir BandPilot

Plus de temps pour jouer, moins de temps à chercher un réglage. BandPilot aide les groupes à préparer leur balance et à retrouver leurs repères, avec un outil gratuit et ouvert.

Un soutien volontaire aide à consacrer du temps aux corrections, aux essais sur les consoles et aux guides en cinq langues. Un retour de terrain, une traduction ou un partage du projet sont aussi utiles.

[Soutenir sur Ko-fi](https://ko-fi.com/bandpilot) · [Comment aider le projet](docs/SUPPORT_FR.md) · [Contribuer](CONTRIBUTING.md)
<!-- support:end -->

[Sécurité](SECURITY.md) · [Données et confidentialité](docs/PRIVACY.md) · [Assistance](SUPPORT.md) · [MIT](LICENSE)
