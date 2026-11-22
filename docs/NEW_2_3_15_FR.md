---
lang: fr
title: "BandPilot 2.3.15 — Console, MIDI et répétition sur téléphone"
---

# BandPilot 2.3.15 — Console, MIDI et répétition sur téléphone

[FR](NEW_2_3_15_FR.md) · [EN](NEW_2_3_15_EN.md) · [IT](NEW_2_3_15_IT.md) · [ES](NEW_2_3_15_ES.md) · [DE](NEW_2_3_15_DE.md)

BandPilot 2.3.15 réunit les nouvelles commandes de console, les rappels sélectifs, les groupes logiciels, le MIDI et la répétition REAPER sur les téléphones des musiciens.

Cette évolution concerne les applications de bureau Windows, macOS Intel/Apple Silicon et Linux. Android reste distribué séparément en 2.4.0-android.5 ; ses fonctions ne sont pas toutes celles de cette version de bureau. BandStudio est une application complémentaire indépendante.

- **Console et retours** — Banques et surfaces personnalisables, groupes logiciels, paires stéréo, vumètres et RTA. Les réglages et destinations proposés dépendent du modèle connecté et du mix sélectionné.
- **Scènes et presets** — Rappels sélectifs des entrées, sorties et FX, protections par famille de réglages, aperçu et sauvegarde. Conversion explicite de presets et de scènes portables au sein de X-Air/M-Air, dans le périmètre pris en charge.
- **Effets et analyse** — Éditeurs nommés pour les 61 algorithmes X-Air, tap tempo, GEQ/True EQ 31 bandes sur les sorties compatibles. Mesure acoustique au micro et propositions de correction à vérifier, avec application volontaire.
- **MIDI et commandes** — Apprentissage des faders et mutes, CC absolus ou relatifs, notes, Program Change, commandes favorites et conditions. Activation explicite pour la session et sauvegarde avant les commandes prises en charge.
- **Répétition et fiches** — Projets REAPER ouverts par onglet, sections, boucles, décompte, prises séparées et gestionnaire sur téléphone. Accords et paroles disponibles dans les fiches compatibles BandStudio, avec affichage plein écran.

## Prendre en main la version

### 1. Installer et connecter

Installe la dernière version de bureau depuis les téléchargements officiels. Exporte tes scènes importantes. Explore la simulation, choisis le bon modèle et connecte-toi en lecture seule. Relis Table → PC avant d’activer le contrôle.

### 2. Préparer la console

Dans Console → Expert, sélectionne façade ou retour, puis prépare tes banques, groupes et surfaces. Un groupe logiciel agit sur les canaux ou envois sélectionnés ; il ne crée pas un DCA matériel. Vérifie séparément l’écoute de chaque musicien : retour de scène, in-ears, casque ou choix encore inconnu.

### 3. Rappeler une scène

Dans Scènes et presets, prépare les protections et le périmètre du rappel. Choisis explicitement entrées, sorties ou FX et destinations. Lis les valeurs proposées, puis confirme. Retrouve la sauvegarde dans l’historique pour préparer une restauration. Enregistrer une préférence, un groupe ou une sélection ne suffit pas à modifier le son.

### 4. Utiliser le MIDI

Ouvre MIDI, choisis le périphérique et apprends une affectation. Pour un encodeur relatif, indique son format. Sélectionne et relis les commandes avant activation. Garde la vue de contrôle ouverte ; fermeture, perte de connexion ou arrêt désactive la session. Le rappel sélectif MIDI concerne les entrées, sans gain, 48 V, routage, sorties ou FX.

### 5. Préparer REAPER

Installe à nouveau le pont livré avec 2.3.15, même si son numéro affiche déjà 1.5.0, puis redémarre REAPER. Ouvre un projet par onglet avec ses médias. Dans Répéter → Avec mes morceaux, sélectionne le projet, vérifie ses entrées et pistes armées, sa piste Original et sa fin. REC crée une prise séparée dans ce projet ; vérifie les véritables entrées audio avant l’essai.

### 6. Donner la main au gestionnaire

Dans Retours → Téléphones, crée un lien de retour par musicien et désigne le gestionnaire sur sa fiche. Sur le même réseau local, son QR donne accès à Mon retour, Mon morceau et Répéter. Le rôle est révocable. Le gestionnaire choisit le morceau, l’original, l’accompagnement ou une prise, le morceau entier ou une section, la boucle et le décompte proposés.

### 7. Lire les accords et paroles

Sur le téléphone, ouvre Mon morceau et choisis Accords, Paroles ou Les deux. La fiche suit le projet et la position REAPER. Plein écran et maintien de l’écran allumé sont facultatifs. Si une fiche source BandStudio est proposée, le gestionnaire vérifie son calage avant de la partager ; Revenir à la fiche exportée annule ce choix. Une fiche absente n’est pas reconstruite automatiquement.

## Portée et vérifications

Les presets et corrections sont des points de départ. Une mesure au micro dépend de la calibration, du placement, du bruit et du trajet audio ; elle ne garantit pas un résultat sonore universel. Aucun traitement ne restaure un enregistrement déjà écrêté. Les conversions portables concernent des entrées mono indépendantes et des paramètres sélectionnés ; les pistes liées et conversions X32 ne sont pas incluses. X32 reste partielle et expérimentale. MIDI ne signifie pas prise en charge MCU/HUI, SysEx ou faders motorisés. Les tests logiciels et la simulation ne certifient pas chaque console, contrôleur ou installation acoustique. La simulation de console ne simule pas REAPER : un enregistrement utilise ses entrées réelles.

Les anciennes captures du guide général et la visite vidéo 2.2 restent des illustrations historiques. Ce tutoriel décrit le parcours 2.3.15.

[BandPilot](https://herve8940.github.io/BandPilot/#download) · [GitHub](https://github.com/herve8940/BandPilot/releases/latest) · [Discord](https://discord.gg/FtWwEPmwE7)
