> **BandPilot** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# Scènes, FX et comptes

Les ajouts partent de `release/desktop-finalization` (PR 21). Ils ne valident pas une XR18 physique.

## Comptes et permissions

Configuration → Comptes et accès → créer le premier administrateur. Mot de passe : 12 caractères minimum. Après activation, une connexion est obligatoire pour toute API et tout WebSocket. Les mots de passe sont dérivés par scrypt ; sessions de 12 heures en cookie HttpOnly/SameSite Strict, jetons hachés en SQLite, limitation des tentatives. La déconnexion invalide la session et ferme les connexions WebSocket ; les sessions expirées sont aussi fermées.

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

Import/export préserve le fichier original. Le rappel `.scn` passe désormais par le même plan de synchronisation que les scènes JSON : lecture de l’état actuel, aperçu, relecture avant application, sauvegarde JSON complète puis écritures avec vérification. Le 48 V est exclu du rappel depuis la bibliothèque. Les blocs FX sont décodés selon leur algorithme, avec types OSC et bornes vérifiés avant toute écriture. Algorithmes actuellement pris en charge : HALL, AMBI, RPLT, ROOM, CHAM, PLAT, DLY et MODD. Un autre algorithme, un type absent, des champs invalides ou des paramètres manquants empêchent la préparation du rappel ; le fichier original reste exportable pour X-AIR Edit. Aucun drapeau expérimental n’est nécessaire pour ce parcours.

Le rappel couvre XR18, MR18 et X18, en simulation ou avec une connexion réelle contrôlable. Les huit gains de remplissage `/headamp/17…24` présents dans les fichiers X-AIR Edit, sans préampli physique sur ces modèles, ne sont pas envoyés et sont signalés dans l’aperçu. Ils restent intacts à l’export. Une capture n’est pas atomique : éviter les modifications depuis un autre contrôleur pendant l’opération.

Correspondances FX : plages et énumérations de protocole vérifiées dans [XAirSetScene](https://github.com/pmaillot/X32-Behringer/blob/master/XAir_fxparse1.c) (Patrick-Gilles Maillot / Ken Mitchell), codec déclaratif indépendant. La validation logicielle et sur simulateur UDP ne constitue pas une validation sonore sur chaque firmware.

Référence de protocole et d'inventaire (aucun réglage d'exemple appliqué) : https://github.com/stblassitude/xair-scene-manager ; `/node` envoie le chemin sans slash initial et reçoit une ligne native. Le schéma et les codecs sont adaptés du projet MIT (voir THIRD_PARTY_NOTICES.txt). Le protocole communautaire reste à vérifier sur le firmware de l'utilisateur.

## Presets FX matériels

Onglet Effets → Presets FX de console. Bibliothèque JSON persistante et exportable :

```json
{"slot":1,"algorithm":0,"parameters":[{"type":"f","value":0.25},{"type":"i","value":1}]}
```

Cet exemple décrit uniquement le format, pas un preset musical utilisable. L'algorithme et l'ordre/type des paramètres doivent provenir d'une correspondance XR18 vérifiée ; les valeurs des fiches de conseils ne sont pas converties automatiquement. La bibliothèque valide le format et les bornes OSC génériques, pas les plages propres à chaque algorithme.

Simulation : mémorise les quatre slots. Matériel : chemin expérimental désactivé par défaut. Il exige mode réel, écritures autorisées, connexion récente et `XR18_EXPERIMENTAL_FX=true`. Avant envoi : sauvegarde brute du type et de `/fx/N/par` en SQLite (`fx-backup`). Envoi séquentiel, type d'abord puis paramètres ; lecture de chaque valeur pour comparaison. Une erreur peut laisser un preset partiellement envoyé : aucun rollback automatique. La sauvegarde brute est destinée à un diagnostic/rétablissement manuel, pas à un rappel automatique.

Ne pas activer ce chemin avant essai contrôlé sur la console. Les presets musicaux livrés restent des propositions documentaires ; leur traduction complète en presets matériels reste à établir.

## Concert

Ouvre tes projets dans REAPER. Dans **Répéter**, choisis **Préparer la setlist**. Sélectionne les titres à ajouter. Dans **Setlist**, déplace les morceaux et place les rappels. **Ouvrir le concert** affiche cet ordre au pupitre. Le bouton Suivant avance la liste. La lecture de l’accompagnement, de l’original ou d’une prise se lance séparément. Une fiche PDF déjà jointe au morceau est consultable sur scène.

## Windows et validation

Le workflow Desktop packages installe maintenant le paquet NSIS sur le runner Windows, puis lance l'exécutable installé avec `--smoke-test` : démarrage backend, base SQLite et rendu de l'interface. Le test utilise un profil temporaire en simulation. Une réussite CI confirme ce démarrage dans le runner, pas le fonctionnement sur le PC de l'utilisateur ni sur la XR18 réelle.

Validation locale : `npm test`, `npm run build:all`. Voir les résultats de la PR pour les vérifications effectivement exécutées.


## Version 0.2.0

Les restrictions de rappel applicatif et d’automatisation décrites ci-dessus concernent les scènes version 1. Les scènes complètes JSON version 2 couvrent le catalogue de paramètres connu, les routages, les DCA et les vecteurs FX typés. Leur rappel et les FX disposent désormais d’un chemin matériel contrôlé. Le rappel natif `.scn` est limité aux algorithmes FX détaillés ci-dessus. Voir `FONCTIONS_0_2.md` et `ETAT_DU_PROJET.md` pour l’état actuel et les limites.

## Presets de canal et bibliothèque (2.3.14)

La bibliothèque comporte quatre vues : scènes complètes, presets par piste, fiches de balance et historique. Un preset de canal sauvegarde les sections cochées EQ/coupe-bas, compresseur et gate. Son rappel cible une entrée du même modèle et laisse gain, 48 V, volumes, retours et routage inchangés. Une sidechain externe ou une destination liée en stéréo est refusée. Les traitements peuvent être extraits d’une scène complète version 2.

Sauvegarder/importer ne modifie pas la console. Les rappels demandent aperçu et confirmation, vérifient l’état courant et gardent une sauvegarde restaurable. Un preset FX peut cibler un autre slot ; sa sauvegarde permet de restaurer le processeur précédent. L’export JSON/.scn utilise le dialogue natif sur bureau et Android, et le téléchargement dans un navigateur.

La vérification de lecture après écriture OSC réessaie uniquement les lectures retardées ; la commande n’est jamais renvoyée. Après une interruption, la bibliothèque actualise les sauvegardes disponibles et propose d’ouvrir l’historique.
