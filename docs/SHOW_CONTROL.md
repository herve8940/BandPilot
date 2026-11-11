> **BandPilot** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# Scènes, FX, comptes et ReaCue

Les ajouts partent de `release/desktop-finalization` (PR 21). Ils ne valident pas une XR18 physique.

## Comptes et permissions

Configuration → Comptes et ReaCue → créer le premier administrateur. Mot de passe : 12 caractères minimum. Après activation, une connexion est obligatoire pour toute API et tout WebSocket. Les mots de passe sont dérivés par scrypt ; sessions de 12 heures en cookie HttpOnly/SameSite Strict, jetons hachés en SQLite, limitation des tentatives. La déconnexion invalide la session et ferme les connexions WebSocket ; les sessions expirées sont aussi fermées.

Avant activation, le mode local existant reste administrateur. Le serveur demeure lié à 127.0.0.1. Ces comptes peuvent être utilisés successivement sur cet ordinateur ; l'accès simultané depuis plusieurs appareils n'est pas ouvert. Aucun mot de passe prédéfini.

- Administrateur : gestion des comptes, bibliothèque, commandes, associations et armement.
- Musicien : lecture, modification des seuls envois de ses bus affectés via `/api/monitor/:bus/channels/:channel`.
- Invité : lecture seule.

Le serveur refuse les autres écritures, indépendamment de l'interface. Journal des tentatives de modification autorisées : Configuration → Journal. Il décrit les requêtes et ne constitue pas un accusé de réception matériel. La suppression, la réinitialisation et la modification des comptes ne sont pas encore proposées.

## Scènes applicatives

Page Snapshots → Scènes sauvegardées. SQLite conserve faders et mutes des 16 canaux, master, traitements de simulation, envois de bus suivis et presets FX appliqués par l'application. Export/import JSON. Prévisualiser, comparer puis confirmer dans les 60 secondes ; tout changement de l'état suivi invalide la prévisualisation. Le rappel crée une sauvegarde préalable et remplace les traitements/FX/envois suivis. Les anciennes sauvegardes locales de faders restent accessibles séparément.

Rappel uniquement en simulation. Une scène applicative n'inclut pas tous les réglages de console (gains physiques, routage, DCA, etc.).

## Archives natives complètes .scn

Sur une XR18 connectée : saisir un nom puis « Capturer la XR18 en .scn ». Lecture séquentielle `/node` de l'inventaire XR18 (canaux, auxiliaire, retours/envois FX, bus, LR, DCA, slots FX, routages, headamps). Chaque réponse doit correspondre exactement au nœud demandé. Si un nœud manque, l'opération échoue ; aucune archive incomplète n'est enregistrée comme une scène complète. Le firmware peut donc nécessiter une adaptation de l'inventaire après essai réel.

Import/export préserve les lignes natives, y compris les paramètres FX opaques. Les fichiers importés sont conservés comme archives, sans certification de leur exhaustivité. Un parseur des nœuds connus et un chemin de rappel expérimental sont fournis (`XR18_EXPERIMENTAL_SCENES=true`, mode réel, écritures autorisées). Prévisualisation, confirmation spécifique du 48 V s'il est présent, sauvegarde native préalable intégrale et comparaison après envoi. Tout nœud inconnu, champ invalide ou paramètre FX natif opaque bloque le rappel avant toute écriture. Ainsi les scènes complètes contenant `/fx/N/par` restent à rappeler dans X Air Edit, tant que les correspondances par algorithme ne sont pas validées. Les paramètres natifs en unités physiques ne sont jamais envoyés directement comme des valeurs OSC normalisées. Une capture n'est pas atomique : ne pas modifier la console depuis un autre contrôleur pendant la lecture.

Référence de protocole et d'inventaire (aucun réglage d'exemple appliqué) : https://github.com/stblassitude/xair-scene-manager ; `/node` envoie le chemin sans slash initial et reçoit une ligne native. Le schéma et les codecs sont adaptés du projet MIT (voir THIRD_PARTY_NOTICES.txt). Le protocole communautaire reste à vérifier sur le firmware de l'utilisateur.

## Presets FX matériels

Onglet Effets → Presets FX de console. Bibliothèque JSON persistante et exportable :

```json
{"slot":1,"algorithm":0,"parameters":[{"type":"f","value":0.25},{"type":"i","value":1}]}
```

Cet exemple décrit uniquement le format, pas un preset musical utilisable. L'algorithme et l'ordre/type des paramètres doivent provenir d'une correspondance XR18 vérifiée ; les valeurs des fiches de conseils ne sont pas converties automatiquement. La bibliothèque valide le format et les bornes OSC génériques, pas les plages propres à chaque algorithme.

Simulation : mémorise les quatre slots. Matériel : chemin expérimental désactivé par défaut. Il exige mode réel, écritures autorisées, connexion récente et `XR18_EXPERIMENTAL_FX=true`. Avant envoi : sauvegarde brute du type et de `/fx/N/par` en SQLite (`fx-backup`). Envoi séquentiel, type d'abord puis paramètres ; lecture de chaque valeur pour comparaison. Une erreur peut laisser un preset partiellement envoyé : aucun rollback automatique. La sauvegarde brute est destinée à un diagnostic/rétablissement manuel, pas à un rappel automatique.

Ne pas activer ce chemin avant essai contrôlé sur la console. Les presets musicaux livrés restent des propositions documentaires ; leur traduction complète en presets matériels reste à établir.

## ReaCue

Créer une association unique (identifiant morceau, section, cible scène/FX). Armer explicitement. Émettre :

```json
{"eventId":"concert1-song2-refrain-1","songId":"song2","section":"refrain"}
```

`POST /api/reacue/event` utilise la session administrateur et refuse les événements non armés, inconnus ou matériels. Un même `eventId` réussi est ignoré lors des répétitions réseau dans une session d'armement. Une nouvelle occurrence nécessite un nouvel identifiant. Déduplication en mémoire ; le désarmement explicite ou le redémarrage réinitialise la liste. Toute commande manuelle de mixage désarme l'automatisation, qui ne se réarme jamais seule.

`integrations/reacue_bridge.py` est un client Python standard (sans dépendance) importable depuis un déclencheur ReaCue. Variables : `XR18_STUDIO_URL` (URL locale, port choisi par le backend), `XR18_STUDIO_USER`, `XR18_STUDIO_PASSWORD`. L'appel `client.login()` puis `client.section(song_id, section, event_id)` envoie l'événement. Le script CLI accepte ces trois paramètres. Il ne s'installe pas automatiquement dans REAPER/ReaCue ; le déclencheur de section doit encore être raccordé et testé dans le projet ReaCue existant. Le mode bureau choisit un port dynamique ; utiliser le backend au port fixe pour les premiers essais du pont.

## Windows et validation

Le workflow Desktop packages installe maintenant le paquet NSIS sur le runner Windows, puis lance l'exécutable installé avec `--smoke-test` : démarrage backend, base SQLite et rendu de l'interface. Le test utilise un profil temporaire en simulation. Une réussite CI confirme ce démarrage dans le runner, pas le fonctionnement sur le PC de l'utilisateur ni sur la XR18 réelle.

Validation locale : `npm test`, `npm run build:all`, compilation Python du pont. Voir les résultats de la PR pour les vérifications effectivement exécutées.


## Version 0.2.0

Les restrictions de rappel applicatif et d’automatisation décrites ci-dessus concernent les scènes version 1. Les scènes complètes JSON version 2 couvrent le catalogue de paramètres connu, les routages, les DCA et les vecteurs FX typés. Leur rappel, les FX et les automatismes ReaCue dédiés disposent désormais d’un chemin matériel contrôlé. Le rappel natif `.scn` avec FX textuels opaques reste bloqué. Voir `FONCTIONS_0_2.md` et `ETAT_DU_PROJET.md` pour l’état actuel et les limites.
