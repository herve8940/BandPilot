# Cahier des charges — XR18 Studio

Version initiale : 2026-10-28.

## 1. Vision
Une application de répétition et de pilotage de la Behringer X Air XR18, moderne, sombre, responsive et simple d'utilisation, sans sacrifier les fonctions avancées. Fonctionnement autonome en réseau local.

## 2. Profils
- Administrateur : configuration de la console, routage, permissions et automatisations.
- Musicien : contrôle de son retour in-ear et consultation des répétitions.
- Invité : accès restreint à la setlist selon autorisations.

## 3. XR18
- Connexion OSC via UDP, découverte/configuration IP, reconnexion surveillée.
- Lecture/écriture bidirectionnelle des paramètres effectivement pris en charge : canaux, gain, nom/couleur, mute, fader, panoramique, EQ/filtres, gate, compresseur, bus, FX, DCA, mix principal, routage.
- Vumètres et saturation dans la limite des données fournies par la console.
- Snapshots : sauvegarde, différences, prévisualisation, rappel contrôlé.
- Moteur OSC unique avec file de commandes, modèle d'état, journal et gestion des erreurs.
- Toutes les commandes doivent être vérifiées dans la documentation OSC puis testées sur la vraie console.

## 4. Retours in-ear
- Bus mono/stéréo affectés à des musiciens, droits par bus et par réglage.
- Mix personnel sur téléphone, profils persistants, sauvegarde/restauration.
- Protection auditive : plafonds et variation maximale configurables, confirmation des changements risqués.

## 5. Répétitions
- Groupe, membres, morceaux, setlists et ordre des morceaux.
- Calendrier des répétitions, présences, objectifs, annotations individuelles et collectives.
- Historique, progression, presets associés aux morceaux et aux sessions.
- Mode sans chanteur ; aucun changement de niveau sensible sans prévisualisation.

## 6. MCP et assistant IA
- Serveur MCP basé sur le SDK officiel, exposant des outils typés de lecture et d'écriture soumis aux permissions.
- Exemples : état console, lecture canaux, réglage fader/mute/EQ, bus, snapshots, setlists.
- Refuser les commandes OSC arbitraires non contrôlées.
- Demander une confirmation explicite pour le 48 V, les modifications globales et les niveaux sensibles.
- Les données OSC seules ne permettent pas une analyse acoustique du son : module audio séparé requis.

## 7. Concert
- Sélection des projets ouverts dans Répéter.
- Ordre défini dans Setlist et suivi manuel au pupitre.
- Lecture des fichiers sur action du musicien.

## 8. UX
- React + TypeScript + Tailwind CSS + shadcn/ui.
- Thème sombre, interface tactile et responsive, PWA.
- Modes simple/avancé, navigation rapide, visualisation claire des niveaux et état de connexion.
- Assistant IA facultatif ; application pleinement exploitable sans lui.

## 9. Architecture
- Backend Node.js/TypeScript.
- OSC/UDP centralisé ; WebSocket pour synchronisation des clients.
- MCP comme adaptateur au backend et non comme moteur OSC concurrent.
- SQLite pour utilisateurs, groupe, répétitions, presets et audit.
- Docker Compose ou installation locale ; aucune exposition directe de la XR18 à Internet.
- Tests sur simulateur puis validation XR18 réelle.

## 10. Fiabilité et sécurité
- Rôles et permissions ; journal des écritures.
- Snapshot préalable aux opérations globales.
- Détection de déconnexion, état périmé explicite ; ne jamais rejouer automatiquement les commandes sensibles après reconnexion.
- Annulation des automatisations ; limites de volumes configurables.
- Aucune modification silencieuse par l'IA.

## 11. Livrables et acceptation
1. Connectivité OSC et simulateur validés.
2. Mixeur web + retours in-ear validés.
3. Répétitions + setlists + snapshots opérationnels.
4. MCP sécurisé testé.
5. Parcours Répéter, Setlist et Concert testé.

Critères transversaux : tests automatisés, documentation des commandes OSC, comparaison des états, sécurité auditive, compatibilité tactile, validation sur console réelle.

## 12. GitHub et publication
- `main` : version stable.
- `DEV` : intégration.
- `feature/*` : fonctionnalités isolées avec pull requests.
- GitHub Actions : lint, typage, tests, build et contrôles de sécurité.
- GitHub Releases : versions publiées ; images Docker sur GHCR si nécessaire.
- Secrets et adresses réseau privées exclus du dépôt ; exemples dans `.env.example`.

**Principe directeur : simplicité sans compromis sur l'accès aux fonctionnalités prises en charge.**
