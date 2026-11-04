# BandPilot 2.2.1 — console, coach et répétitions / mixer, coach and rehearsals

XR18 Studio devient **BandPilot**. L’application reste gratuite et open source, avec les identifiants de données historiques conservés.

![BandPilot 2.2 — console en simulation](https://herve8940.github.io/BandPilot/images/bandpilot-2.2/console.png)

## Correctif 2.2.1 / Hotfix

Corrige la duplication du panneau de connexion lors des mises à jour d’état de la console : deux composants frères utilisaient la même clé React. Les droits locaux ne sont plus affichés comme restreints pendant leur chargement ; un échec de lecture propose une nouvelle tentative. Les contrôles serveur et les vrais rôles restreints restent inchangés.

Fixes duplicated connection panels during mixer state updates caused by colliding React sibling keys. Permission loading and request errors now have explicit states and retry. Server authorization and genuine restricted roles are preserved.

Validation : **137 tests backend + 4 régressions React**, avec reproduction de 17 panneaux avant correction contre un seul après 15 rafraîchissements. Le contrôle de démarrage des installateurs ouvre aussi la vraie page de connexion et vérifie ses commandes.

## Français

### Télécharger

| Ordinateur | Installateur |
|---|---|
| Windows | `BandPilot-Windows-2.2.1.exe` |
| Mac Intel | `BandPilot-macOS-2.2.1-x64.dmg` |
| Mac Apple Silicon | `BandPilot-macOS-2.2.1-arm64.dmg` |
| Ubuntu / Debian | `BandPilot-Linux-2.2.1-amd64.deb` |
| Autre Linux | `BandPilot-Linux-2.2.1-x86_64.AppImage` |

Les cinq installateurs et leurs sommes SHA-256 sont publiés ensemble après réussite des tests et des démarrages sur les plateformes de construction. Les installateurs peuvent ne pas être signés/notariés. Sauvegarde tes scènes et projets avant mise à jour.

### Nouveautés

- Menu compact, nouvelle console Expert, traitements visuels, sorties et groupes ; adaptation aux tailles d’écran.
- Tableau de bord Mon ingé son : étapes, instruments, état des mesures et prochain pas conseillé.
- Répéter : lecteur adaptable, sections, prises valides, présence liée au projet ouvert, boucle confirmée et restitution des mutes après écoute Original.
- Pont REAPER **1.2.2** : protection contre les prises vides et les changements de projet/REC. Installer depuis Répéter puis redémarrer REAPER après sauvegarde.
- Notes et setlist active sauvegardées dans SQLite, indépendantes du port navigateur. Dates de session au calendrier local.
- Téléphones déjà ouverts : mise à jour du contrôle sans rechargement. Simulation clairement indiquée ; rappel de scène avec exclusion explicite du 48 V.
- Détection et profils par marque/modèle : XR12/XR18/X18, MR12/MR18, X32 et variantes. Contrôles bornés aux capacités.
- Guides FR/EN, six nouvelles captures et vidéo illustrée de 42 secondes avec sous-titres.

### Compatibilité honnête

Les essais physiques ont été faits sur **XR18**. MR18/X18 et XR12/MR12 demandent encore une validation sur leurs appareils. XR12/MR12 disposent de 2 Aux physiques et d’un enregistreur USB stéréo sur clé, sans interface USB multipiste PC.

**X32 : support partiel et expérimental.** Mélangeur, EQ, dynamique principale, envois, bus/DCA/matrices de base. Préamplis, routage complet, FX, vumètres, scènes complètes, coach, retours téléphone et USB complets restent indisponibles ou à adapter. Les fichiers X-Air ne sont pas envoyés comme scènes X32.

La qualité acoustique, le concert complet et certaines intégrations externes restent à vérifier dans le contexte réel. [Matrice détaillée](https://herve8940.github.io/BandPilot/multi-model.html).

### Vérifications

**137 tests backend et 4 régressions React réussis** sur la préparation de cette version, compilation serveur/interface réussie ; contrôles de construction et lancement des installateurs dans le workflow de publication. Les tests Lua utilisent une doublure de l’API REAPER et ne constituent pas une certification acoustique. [Rapport manuel et corrections](https://herve8940.github.io/BandPilot/corrections-tests-manuels.html).

## English

XR18 Studio is now **BandPilot 2.2.1**, retaining legacy data identifiers. New responsive Expert console, coach dashboard, rehearsal player, project-aware presence and original playback, verified loops, persistent notes/setlists, live phone permission updates and model-aware discovery.

Install the matching Windows, Intel Mac, Apple Silicon Mac, Debian/Ubuntu or AppImage package. Packages and SHA-256 checksums are released together after build/startup checks. Installers may be unsigned/unnotarized. Back up scenes and projects first. Update REAPER bridge to **1.2.2**, save projects and restart REAPER.

Physical testing was performed on **XR18 only**. Other model profiles need hardware validation. XR12/MR12 have two physical Aux outputs and stereo USB-stick recording, not PC multitrack USB. **X32 remains partial and experimental**, with full preamp/routing/FX/meters/scenes/coach/phone-monitor/USB integration unavailable. See the [compatibility matrix](https://herve8940.github.io/BandPilot/multi-model.html).

137 backend tests and 4 React regressions passed during preparation, including production Lua against a REAPER API double; real acoustic and complete concert validation remain necessary. Updated [English guide](https://herve8940.github.io/BandPilot/USER_GUIDE_EN.html) and captioned [video tour](https://herve8940.github.io/BandPilot/VIDEO_TOUR.html).
