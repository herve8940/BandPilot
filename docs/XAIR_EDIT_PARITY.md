> **BandPilot 2.2** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# Compatibilité avec la XR18 et X-AIR Edit

BandPilot est un logiciel **indépendant**, écrit de zéro. Il pilote la console avec le protocole réseau OSC qu’elle propose, comme d’autres applications tierces. Son comportement a été comparé à celui de la console et de l’application officielle X-AIR Edit, utilisées côte à côte, pour que les deux restent **compatibles** sur une même XR18.

Le projet ne contient **aucun code, fichier, image, logo ni autre élément** provenant de Behringer / Music Tribe ou de X-AIR Edit. Les noms de modèles et de fonctions ne sont cités que pour indiquer avec quel matériel l’application fonctionne.

## Ce qui a été vérifié

- Les 689 nœuds OSC du catalogue de `scene-schema.ts` correspondent aux adresses utilisées par la console et X-AIR Edit (`/ch`, `/rtn`, `/bus`, `/fxsend`, `/lr`, `/dca`, `/fx`, `/headamp`, `/routing`, `/config`). Aucune adresse inventée.
- Adresses de service également utilisées : `/xremotenfb`, `/batchsubscribe`, `/renew`, `/unsubscribe`, `/meters/0…7`, `/-stat/solosw/NN`, `/-snap/NN` et `/-prefs/...`.
- Modèles de la famille 18 canaux reconnus : XR18, X18, MR18 et leurs versions V2, comme dans X-AIR Edit.

## Corrections

| Problème | Effet | Correction |
|---|---|---|
| Relecture comparée à ±0,003 | La console quantifie : coupe-bas et pan sur 101 pas, envois sur 161, gain par pas de 0,5 dB… Les écritures normales échouaient avec « Lecture différente », de même que les rampes des retours in-ear. | Tolérance d’un demi-pas par paramètre (`readbackTolerance`), appliquée aussi à la synchro PC/console et aux scènes natives. |
| Détection limitée à XR18/XR18V2 | X18 et MR18 refusés. | Toute la famille 18 canaux est acceptée. XR12/XR16 restent exclus. |
| Liaison « vivante » seulement sur fader, mute ou vumètre | Les autres réponses ne prouvaient pas la connexion. | Toute réponse OSC valide rafraîchit la liaison. |
| Vumètres limités aux 16 entrées | Aux, retours FX, bus, envois FX et main absents. | Les 40 valeurs de `/meters/1` sont exposées (`meters.all`). |
| Affichage fader « 50 % / −6 dB relatif » | Valeur fausse : 0,5 vaut −10 dB sur la loi X-Air. | Loi X-Air en 4 segments (0,75 = 0 dB). |
| IP par défaut 192.168.1.100 | Ne correspond pas au point d’accès XR18. | 192.168.1.1. |
| Catalogue en O(n²) | Lent une fois l’état complet chargé. | État lu une seule fois. |

## Console graphique

Le menu **Console**, onglet **Console**, propose une organisation familière aux utilisateurs de X-AIR Edit, avec une interface et des graphismes propres à BandPilot : Mixer, Canal, Entrée, Gate, EQ, Comp, Envois, Main, Effets, Routage et Vumètres. La banque de faders est en bas et la barre de mix à droite. Chaque option est expliquée dans l’application (« ? Explications ») et dans le [guide de la console](GUIDE_CONSOLE.md).

Le contrôle direct passe par le WebSocket (`{type:'set'}`), comme les gestes de X-AIR Edit : la valeur est envoyée immédiatement, puis relue 300 ms après le dernier mouvement. Le 48 V, le routage et le type d’effet passent par la prévisualisation avec confirmation (`/api/console/preview` puis `/api/console/apply`). Un musicien ne peut régler que les envois de ses propres bus.

Les 61 algorithmes d’effet portent les noms affichés par la console et X-AIR Edit (Hall Reverb, Stereo Delay, Modulation Delay…), pour que l’utilisateur les retrouve.

À vérifier sur la XR18 physique : le mapping solo `/-stat/solosw/01-16` et la cadence des vumètres.

## Marques

Behringer, Music Tribe, X AIR, X-AIR Edit, XR18, X18 et MR18 sont des marques de leurs propriétaires respectifs. BandPilot est un projet indépendant, gratuit et open source (licence MIT), **non affilié, non approuvé et non soutenu** par Behringer / Music Tribe.
