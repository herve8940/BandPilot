# XR18 Studio 2.1.0 — état du développement

Cette version expose les 2 636 paramètres du catalogue XR18 connu. Les essais sur émulateur ne constituent pas une qualification matérielle ni une validation pour le concert.

## Implémenté

- Détection et connexion sans redémarrage (XR18, X18, MR18 et V2), mode lecture/contrôle, configuration persistante.
- Console graphique (1.3) façon X-AIR Edit : tranches, faders en dB, 40 vumètres, mix sur les faders, EQ interactif, gate/compresseur, envois. Contrôle direct par WebSocket avec relecture ; 48 V, routage et algorithme FX exclus. Voir `XAIR_EDIT_PARITY.md`.
- Retours sur téléphone (1.3) : liens personnels par QR code servis sur le réseau local (port 8018 par défaut, `XR18_EARS_PORT`), limités au bus du musicien, plafond 0 dB, montée progressive, profils, révocation. Arrêté par défaut.
- Affichage (2.0) qui tient dans l’écran : toutes les tranches visibles d’un bloc en mode Simple et Expert (17 à 21 tranches de 1280×800 à 1920×1080), menu repliable automatiquement sur la console, vues détaillées défilant dans leur cadre.
- Scène vierge (2.0) : remise à neutre de ~800 paramètres avec prévisualisation, sauvegarde et retour en un clic, sans 48 V, gains, routage ni effets.
- Relecture des écritures tolérante à la quantification de chaque paramètre (pas de la console).
- Entrées : nom/couleur réels, gain, 48 V avec confirmation distincte, inversion, coupe-bas, EQ, gate, compresseur, fader, mute, pan et sources.
- Aux stéréo, six bus, master, quatre envois et retours FX, quatre DCA, affectations, liens, groupes de mute, source d’écoute/solo, routages analogiques/USB/P16.
- Paramètres typés avec unités physiques, prévisualisation, sauvegarde et comparaison OSC après écriture. Les ratios de compression utilisent des indices entiers.
- Application matérielle des presets EQ/gate/compresseur ; seuils absents conservés, ratio matériel présenté, valeurs hors plage refusées.
- FX : choix des 61 algorithmes, capture/édition de vecteurs OSC typés, presets persistants, sauvegarde du slot précédent et comparaison après application. Les unités de l’éditeur FX sont les unités OSC ; les cartes musicales restent consultatives.
- Scènes JSON version 2 : capture exhaustive du catalogue connu et des quatre vecteurs FX, sauvegarde avant rappel, confirmation 48 V, rappel simulation ou transport réel avec lectures comparées. Une lecture absente fait échouer la capture.
- Retours personnels : droits par bus, plafond et pas de variation, profils SQLite et rappel progressif.
- ReaCue : associations morceau/section, armer/arrêter, déduplication, interruption avant la prochaine écriture, scènes version 2 sans 48 V, action REAPER et client Python de surveillance.
- Comptes, droits HTTP/WebSocket et accès multiappareils configurable sous HTTPS. Local par défaut.
- MCP de lecture et écriture confirmée via la même API authentifiée, sans deuxième moteur OSC.
- Morceaux, setlists, répétitions, notes et bibliothèques SQLite existants conservés.

## Limites connues

- Partage des retours en HTTP local non chiffré : à utiliser sur un Wi-Fi privé protégé.
- Solo `/-stat/solosw/01-16` et cadence des vumètres de la console graphique à confirmer sur le matériel.
- Aucun essai sur la XR18 physique ou l’installation REAPER de l’utilisateur pendant ce développement. Adresses, plages et réponses de groupe à confirmer sur son firmware.
- Les `.scn` natifs sont conservés/exportables. Le rappel des fichiers contenant des paramètres FX textuels opaques reste refusé avant toute écriture : les scènes JSON version 2 évitent cette conversion incertaine en utilisant les vecteurs OSC capturés.
- Une opération interrompue peut laisser un état partiel ; la sauvegarde est conservée et aucun retour automatique silencieux n’est envoyé.
- Les anciennes scènes version 1 restent rappelables en simulation. Capturer une version 2 pour le matériel.
- Le catalogue n’inclut pas tous les paramètres de tous les firmwares, les autres modèles X AIR, les réglages réseau ou les mises à jour firmware.
- Pas d’analyse acoustique audio ni de correction automatique par IA : OSC transporte paramètres et niveaux, pas les signaux audio.

Voir `FONCTIONS_0_2.md` pour l’utilisation et la validation.

## Mode guidé 0.3

Accueil Mon ingé son, préparation de groupe persistante, parcours de balance en six étapes, configuration complète par instrument (coupe-bas, EQ, compresseur, gate, pan) avec batterie détaillée et modèles de groupe, application tolérante multi-instruments, gain guidé avec seuils compresseur/gate calés sur la mesure, retours par musicien (bus, rôle, mix pré-fader, QR), test des niveaux OSC récents, conseils locaux selon symptômes, petites corrections prévisualisées, sauvegarde et annulation. Dialogue OpenAI facultatif, sans exécution de ses réponses ; configuration de bureau avec clé chiffrée via Electron safeStorage (refus du backend basic_text), ou variables serveur. Le conseiller ne reçoit pas d’audio. Guide : `INGE_SON.md`.

## Distribution 1.0

Guides illustrés français et anglais, installateur Windows par utilisateur en un clic, DMG Intel/Apple Silicon, AppImage et Debian. Le workflow release ne publie qu’après réussite des quatre plateformes et de leurs tests de démarrage. Les résultats réels sont visibles dans GitHub Actions ; une définition de workflow ne prouve pas sa réussite. Les paquets ne sont pas signés/notariés.
