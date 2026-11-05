<div align="center">

# BandPilot

**Ton groupe. Ta console. Ton son.**

[![Version](https://img.shields.io/github/v/release/herve8940/BandPilot)](https://github.com/herve8940/BandPilot/releases/latest) [![CI](https://github.com/herve8940/BandPilot/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/herve8940/BandPilot/actions/workflows/ci.yml) [![MIT](https://img.shields.io/badge/licence-MIT-green)](LICENSE)

Application gratuite pour préparer la balance, piloter la console, donner les retours aux musiciens et répéter avec REAPER. **BandPilot est le nouveau nom de XR18 Studio.**

[⬇ Télécharger](https://github.com/herve8940/BandPilot/releases/latest) · [🌐 Site](https://herve8940.github.io/BandPilot/) · [📘 Guide FR](docs/USER_GUIDE_FR.md) · [English](README.en.md) · [🎬 Visite vidéo](https://herve8940.github.io/BandPilot/VIDEO_TOUR.html)

**Application multilingue : français, anglais, italien, espagnol et allemand.** Choisis la langue dans **Réglages → Options · Langue** ; le choix est mémorisé sur cet appareil. Les musiciens peuvent choisir leur langue sur leur téléphone. D’autres langues peuvent être ajoutées suivant la demande.

[Français](README.md) · [English](README.en.md) · [Italiano](README.it.md) · [Español](README.es.md) · [Deutsch](README.de.md)

![Console BandPilot 2.2.4 en simulation](docs/images/bandpilot-2.2.4/expert-canal.jpg)

Windows · Mac Intel et Apple Silicon · Linux

</div>

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

Le contrôle local ne demande ni compte ni Internet. Ordinateur, console et téléphones partagent le même réseau local. REAPER est un logiciel séparé avec sa propre licence ; l’IA connectée facultative nécessite Internet et une clé personnelle.

## Consoles et limites

| Modèle | État dans 2.2 |
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
5. Pour répéter, installe le pont **REAPER 1.2.3**, sauvegarde tes projets et redémarre REAPER.

La simulation de console ne simule pas REAPER : REC capture ses véritables entrées audio. Les installateurs peuvent ne pas être signés/notariés.

## Documentation et médias

- [Guide complet FR](docs/USER_GUIDE_FR.md) · [Full English guide](docs/USER_GUIDE_EN.md)
- [Mon ingé son FR](docs/TUTO_MON_INGE_SON.md) · [English coach tutorial](docs/TUTO_MON_INGE_SON_EN.md)
- [Visite vidéo et transcription](docs/VIDEO_TOUR.md) — montage de six captures en simulation, 42 secondes, sous-titres FR/EN/IT/ES/DE.
- [Nouveautés 2.2.4](docs/RELEASE_NOTES.md) · [Essais manuels et corrections](docs/corrections-tests-manuels.md)
- [Contrôles X-Air détaillés](docs/GUIDE_CONSOLE.md) · [Architecture et API](docs/SQLITE_API.md)

## Développement

Node.js 20+ (CI et installateurs : Node 22). `npm ci`, `npm --prefix web ci`, puis `npm run studio`. Vérifications : `npm test`, `npm run test:web` et `npm run build:all`. Installateurs : `npm run desktop:package`.

Les tests backend et les tests de régression React couvrent notamment OSC, scènes, FX, comptes, retours, REAPER, Lua et profils de console. Ils ne remplacent pas une validation acoustique et un concert complet sur chaque matériel. La publication attend les contrôles des quatre plateformes de construction et conserve les sommes SHA-256.

Les anciens identifiants `xr18-studio`, le dépôt, les clés de données et les chemins REAPER restent pour préserver la compatibilité. Projet indépendant, non affilié à Behringer, Midas ou Music Tribe ; marques de leurs propriétaires. Licence [MIT](LICENSE).

Correctif de démarrage : [panneau de connexion 2.2.1](docs/hotfix-2.2.1.md).

## BandPilot 2.2.2

[Console personnelle et régie des retours](docs/WORKSPACES.md) : disposition par modèle et taille d’écran, mix/EQ/compression par musicien, parcours du signal. Inclut le [correctif REAPER 1.2.3](docs/hotfix-2.2.2.md).
