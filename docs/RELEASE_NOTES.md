# BandPilot 2.2.2 — ma console, mes retours et liaison REAPER

## Français

- **Ma console** : tranches visibles au choix, largeur compacte/confortable, sorties et Master repliables. Disposition sauvegardée localement par modèle et classe d’écran. Masquer ne coupe aucun son.
- **Régie des retours** : accès depuis Retours ou Expert/Ears ; sélection par musicien, instruments attribués surlignés, envois, EQ à six bandes et compression du bus dans le même espace. Réduction de gain lorsqu’une mesure récente est disponible.
- **Parcours du signal** : source physique/USB et prélèvement avant/après EQ ou fader. La matrice complète et les bus internes restent disponibles.
- **Pont REAPER 1.2.3** : échanges isolés entre instances, transport prioritaire, demandes d’état regroupées, réponse conservée lors d’un verrouillage temporaire de fichier, sans réexécuter REC. Stop reste utilisable après une perte de liaison ; les nouvelles formes d’onde attendent la fin de la prise.

**Après installation, mettre à jour le pont dans Répéter, sauvegarder les projets et redémarrer REAPER.** La mise à jour de l’application seule ne recharge pas un script déjà actif.

[Guide illustré des nouveautés](https://herve8940.github.io/BandPilot/WORKSPACES.html) · [Correctif REAPER](https://herve8940.github.io/BandPilot/hotfix-2.2.2.html)

![Régie des retours — simulation](https://herve8940.github.io/BandPilot/images/bandpilot-2.2.2/regie-retours.png)

### Télécharger

| Plateforme | Installateur |
|---|---|
| Windows | `BandPilot-Windows-2.2.2.exe` |
| Mac Intel | `BandPilot-macOS-2.2.2-x64.dmg` |
| Mac Apple Silicon | `BandPilot-macOS-2.2.2-arm64.dmg` |
| Debian / Ubuntu | `BandPilot-Linux-2.2.2-amd64.deb` |
| Autres Linux | `BandPilot-Linux-2.2.2-x86_64.AppImage` |

Les paquets et les sommes SHA-256 sont publiés ensemble après les contrôles du workflow. Installateurs potentiellement non signés/notariés. Sauvegarder scènes et projets avant mise à jour.

### Validation et compatibilité

140 tests serveur et 7 tests React réussis en préparation ; compilation serveur/interface et vérification visuelle à 1280, 1024 et 390 pixels. Les tests couvrent le bon bus, la lecture seule, les dispositions par modèle/écran, les verrous de fichiers et les chemins Windows. Les captures sont en simulation, sans audio matériel inventé.

La liaison REAPER corrigée a été testée sur le Mac avec une prise réelle et deux clients concurrents. Les verrous Windows sont simulés ; une validation sur le PC Windows concerné reste nécessaire.

XR18 validée matériellement. XR12/MR12 : deux sorties Aux physiques, pas d’interface USB multipiste PC. MR18/X18 et XR12/MR12 demandent encore leurs essais matériels. Cette nouvelle régie concerne X-Air/M-Air. **X32 reste partielle et expérimentale**, avec interface séparée ; pas d’extension implicite du coach, des FX, du routage complet ou des retours téléphone. [Matrice de compatibilité](https://herve8940.github.io/BandPilot/multi-model.html).

## English

Personal layouts remember visible strips, widths and output/Master visibility per model and screen class. The monitor desk combines each musician’s sends, bus EQ and compression, with signal-path explanations and the existing full matrix retained. Read-only controls remain disabled. No automatic processing or dynamic EQ is added.

**Update the REAPER bridge to 1.2.3, save projects and restart REAPER.** The bridge isolates concurrent exchanges, prioritizes transport and retries transient file writes without repeating Record. Stop remains available after a lost connection.

140 backend and 7 React tests passed during preparation. Physical testing remains XR18-only; Windows file-lock behaviour is simulated and needs confirmation on the affected PC. X32 remains partial/experimental. [Illustrated guide](https://herve8940.github.io/BandPilot/WORKSPACES.html#english).
