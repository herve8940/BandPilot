> **BandPilot** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# Mon ingé son — BandPilot 2.0

> Ce document décrit le fonctionnement détaillé. Pour apprendre à t’en servir, suis le **[tuto illustré](TUTO_MON_INGE_SON.md)**.

L’accueil propose un parcours pour préparer le groupe sans connaître les noms des paramètres OSC. Le mode avancé et les fonctions de console restent accessibles.

## Commencer

1. **Brancher et connecter** : vérifier les câbles et la connexion, avec les sorties à faible volume pendant la préparation.
2. **Dire qui est branché où** : partir d’un modèle (rock + TD-27, rock + batterie acoustique détaillée, acoustique/duo) ou ajouter la batterie détaillée (kick, snare, tom 1, tom 2, tom 3, OH 1, OH 2), puis adapter entrées et noms aux vrais branchements. Choisir un instrument propose aussitôt sa configuration complète. L’application ne détecte pas les instruments et ne crée pas de lien stéréo.
3. **Régler le gain de chaque instrument** : mesure de la crête (5 s), proposition de gain pour viser −6 dBFS (au plus +6 dB par étape, jamais de 48 V), nouvelle mesure ; pour kick, snare et toms, mesure de la repisse ; puis seuils du compresseur et du gate calculés sur ces mesures. La simulation ne fabrique aucune mesure.
4. **Écouter et corriger** : choisir une gêne (« brouillon », « agressif », « notes coupées »…) ou la décrire avec ses mots. Le conseiller distingue observations OSC, description de l’utilisateur et hypothèses à écouter.
5. **Préparer les retours** : un musicien par bus (Aux 1 à 6), avec rôle et instruments personnels ; mix de départ pré-fader selon le rôle, puis lien QR personnel pour affiner depuis le téléphone.
6. **Garder le bon réglage** : sauvegarder une scène complète. Une nouvelle salle ou un changement de micros nécessite une nouvelle vérification.

Les coches du parcours indiquent les étapes confirmées par l’utilisateur, pas une qualification automatique de la balance. La préparation et ces coches sont conservées dans SQLite.

## Des choix indépendants pour différents groupes (DEV)

BandPilot est conçu pour être diffusé à des utilisateurs aux besoins différents. Une répétition sert à découvrir des cas à traiter et à valider l’application ; ses réglages ne deviennent pas une norme pour tous les groupes. Les presets restent des points de départ, à adapter aux sources, au placement des micros, au système d’écoute et aux mesures disponibles.

Trois choix sont séparés :

| Choix | Où | Effet |
|---|---|---|
| **Base sonore : Rock live / Naturel** | Dire qui est branché où | Traitements des canaux selon l’instrument |
| **Marge à l’entrée : Standard / Plus de marge** | Dire qui est branché où, utilisée à l’étape des gains | Cible de crête −6 / −9 dBFS, avec une zone de ±3 dB |
| **Écoute : in-ears / casque / retour de scène** | Préparer les retours, pour chaque musicien | Mix de retour initial selon le rôle et l’écoute |

Un son Naturel peut donc alimenter des retours de scène, et Rock live peut alimenter des in-ears avec davantage de marge. Un groupe peut mélanger les types d’écoute. Le type de retour est partagé avec la fiche technique : le modifier dans une page met à jour le même choix dans l’autre. Changer un choix conserve les deux autres. Le type d’écoute inconnu reste explicite et conserve la recette historique : BandPilot ne devine pas l’équipement.

Sans choix renseigné, les profils existants conservent Rock live, la marge standard et les retours historiques. Si la fiche technique précise déjà le type de retour, le coach utilise cette information pour sa prochaine proposition. L’ancien choix expérimental `inears-natural` est repris en Naturel + Plus de marge + in-ears, sans écraser des choix indépendants déjà renseignés. Cette reprise ne modifie pas la console. Enregistrer une préférence ne transmet aucun réglage audio ; **Préparer les réglages** affiche les changements avant application, avec sauvegarde et annulation.

### Traitement Naturel

Les coupe-bas restent adaptés aux instruments. Les quatre gains d’EQ sont remis à zéro dans la proposition, le gain de compensation vaut 0 dB et la compression est modérée : chant 3:1 (2–4 dB de réduction visés), kick 3:1 (2–3 dB), snare 3:1 (2–4 dB), toms 2:1 (0–3 dB), basse 3:1 (3–4 dB). Guitares électriques, overheads et charleston commencent sans compression. Ces traitements de canal sont partagés par les sorties qui les reçoivent ; ce choix n’installe pas une chaîne séparée par musicien.

Les **gates restent désactivés** en Naturel. Pour les fûts, les paramètres d’un expandeur 2:1 à atténuation limitée (6 dB pour la snare, 9 dB pour kick/toms) sont préparés mais non activés. Une mesure de repisse seule ne prouve pas que les coups faibles seront conservés. Utiliser les repères repos/note faible de l’Atelier sur une prise adaptée, puis écouter avant de garder. Un enregistrement ayant déjà imprimé le gate ne permet pas de retrouver les notes coupées.

### Marge et écoute

**Plus de marge** vise −9 dBFS, dans une zone de −12 à −6 dBFS, quel que soit le style. Une ancienne mesure hors de la zone choisie est à refaire. Les seuils de compression restent des estimations issues de la crête, à ajuster avec la réduction affichée et l’écoute : ils ne constituent pas une analyse de la dynamique musicale. La marge d’entrée ne choisit pas le point de prélèvement de l’enregistrement USB.

Pour le batteur aux in-ears ou au casque, le mix proposé conserve des toms à −18 dB et des overheads à −26 dB. Pour le retour de scène et l’écoute non précisée, la recette historique reste disponible. Ce sont des niveaux d’envoi initiaux, pas des niveaux acoustiques dans les oreilles, ni une garantie adaptée à tous les casques. Chaque musicien ajuste ensuite son propre mix selon son isolation, le son de la pièce et ses préférences.

Les valeurs des tableaux historiques ci-dessous décrivent la base **Rock live**, la marge **Standard** et le mix de retour historique. Elles ne constituent pas un réglage imposé à tous les utilisateurs.

## Configuration complète par instrument

Chaque instrument reçoit nom, couleur, coupe-bas, égaliseur 4 bandes, compresseur (taux, attaque, relâchement, seuil de départ, genou doux, détection RMS), gate et position stéréo. Les seuils du tableau sont des **points de départ** ; dès que le gain d’un instrument est mesuré (étape 3), ils sont remplacés par des seuils calculés sur le signal réel.

| Instrument | Coupe-bas | Compresseur (départ) | Gate (départ) | Pan |
|---|---|---|---|---|
| Chant principal | 100 Hz | 3:1 dès −20 dB | — | centre |
| Chœurs | 120 Hz | 2,5:1 dès −22 dB | — | 15 % G |
| Guitare rythmique | 85 Hz | 2:1 dès −16 dB | — | 35 % G |
| Guitare solo | 85 Hz | 2,5:1 dès −18 dB | — | 35 % D |
| Basse (DI) | 40 Hz | 4:1 dès −20 dB | — | centre |
| Kick | 35 Hz | 4:1 dès −16 dB | gate −40 dB | centre |
| Snare | 90 Hz | 4:1 dès −16 dB | expandeur −45 dB | centre |
| Tom 1 / 2 / 3 | 80 / 65 / 45 Hz | 3:1 dès −18 dB | gate −42 / −42 / −44 dB | 30 % G / 10 % D / 45 % D |
| OH 1 / OH 2 | 180 Hz | 2:1 dès −18 dB | — | 70 % G / 70 % D |
| Charleston | 300 Hz | 1,5:1 dès −18 dB | — | 45 % G |
| Batterie électronique L/R | 35 Hz | désactivé | — | 100 % G / D |
| Clavier | 80 Hz | 2:1 dès −20 dB | — | 20 % D |

Le placement de la batterie suit la perspective du batteur (charleston et tom aigu à gauche). Les gains d’entrée, le 48 V, les faders, mutes et routages ne sont jamais modifiés. **Appliquer** configure une ligne, **Appliquer à tout le groupe** configure tous les instruments ; si la console ne confirme pas une valeur, l’application la réessaie, poursuit avec les autres et liste celles à relancer.

## Gain et seuils calés sur la mesure

| Mesure | Règle |
|---|---|
| Crête entre −9 et −3 dBFS | gain correct, mesure enregistrée avec le gain du préampli |
| Crête plus basse / plus haute | gain proposé vers −6 dBFS, au plus +6 dB ou −12 dB par étape, arrondi à 0,5 dB |
| Crête ≥ −1 dBFS | saturation probable : −6 dB puis nouvelle mesure |
| Crête < −55 dBFS | pas de signal : aucune hausse, vérifier câble, entrée, 48 V |
| Préampli en butée / retour USB | aucune proposition, régler à la source |
| Compresseur | crête − 8 dB (voix, chœurs, basse), − 6 dB (guitares, fûts, clavier), − 4 dB (cymbales) |
| Gate avec repisse mesurée | repisse + 4 dB, sans dépasser crête − 12 dB (coups doux) ; sinon à mi-chemin, avec conseil de placement micro |
| Gate sans repisse mesurée | crête − 24 dB (estimation signalée) |

Une mesure n’est valable que pour le gain avec lequel elle a été faite : si le gain du préampli change (application, X-AIR Edit, table), l’instrument passe en « à refaire » et la configuration complète revient aux seuils de départ avec un avertissement. Les mesures sont conservées côté serveur ; une sauvegarde du groupe depuis le navigateur ne les efface pas.

## Retours par musicien

Le mix de départ est envoyé en **pré-fader** (indépendant de la façade). Les instruments du musicien sont à −3 dB ; le reste suit son rôle :

| Rôle | Voix | Guitares | Basse | Kick | Snare | Toms | Cymbales |
|---|---|---|---|---|---|---|---|
| Chanteur·se | −3 | −16 | −14 | −10 | −14 | −24 | −26 |
| Guitariste | −8 | −12 | −14 | −10 | −12 | −24 | −26 |
| Bassiste | −10 | −16 | −4 | −5 | −10 | −20 | −26 |
| Batteur·se | −8 | −15 | −5 | −6 | −14 | −22 | coupé |
| Claviériste | −8 | −15 | −12 | −10 | −12 | −24 | −26 |

Pour un batteur sur batterie acoustique, ses propres micros suivent ce tableau (il entend déjà son kit) ; sur batterie électronique, le kit passe devant. Le bus est nommé, retiré de la façade (LR off) et démarré à −10 dB. Les retours d’effets ne sont pas modifiés. **Créer les QR codes des musiciens** crée un lien personnel par bus qui n’en a pas encore.

## Corrections à l’écoute

Les corrections sont des essais bornés : une réduction EQ ciblée ou la désactivation du gate d’un canal. Une bande utilisant un autre type de filtre n’est pas remplacée à l’aveugle. Une bande déjà très réduite ne continue pas à être creusée. Les fréquences proposées sont des hypothèses musicales, pas le résultat d’une analyse du signal.

Les problèmes de larsen, saturation, bruit, déséquilibre, compression et réverbération donnent d’abord des vérifications adaptées ; aucun seuil de compresseur, fréquence de larsen ou re-routage n’est inventé. Les slots FX partagés ne sont pas remplacés par le conseiller.

Chaque réglage suit prévisualisation, confirmation, sauvegarde et comparaison du moteur existant. **Annuler le dernier réglage guidé** prépare le retour des seuls paramètres concernés ; vérifier la comparaison si des changements manuels ont été faits entre-temps. Une proposition expire au bout d’une minute et devient inutilisable si son état de référence a changé.

## Deux façons de dialoguer

### Conseiller local

Disponible sans compte API, il reconnaît des descriptions françaises de problèmes courants et propose des conseils explicites. Il s’agit d’un moteur local de règles et de recommandations, pas d’une conversation générée par ChatGPT. Aucune description n’est envoyée à un service externe dans ce mode.

### IA connectée facultative

Dans l’application de bureau, ouvrir l’étape Écouter et corriger, puis **Configurer l’IA dans l’application de bureau**. Saisir une clé OpenAI API et le nom d’un modèle du compte compatible Responses et sorties structurées. La clé n’est pas un identifiant ChatGPT ; l’application n’utilise pas automatiquement l’abonnement de cette conversation. L’utilisation est facturée selon le compte API configuré.

La clé est enregistrée chiffrée via le mécanisme du système fourni par Electron safeStorage ; une configuration refusant le chiffrement n’enregistre pas la clé. Sous Linux, le backend basic_text est refusé. Seule la fenêtre principale locale, avec une session administrateur, peut configurer l’IA. L’API web ne renvoie jamais la clé. Le champ est vidé après enregistrement et la clé peut être supprimée depuis le même formulaire.

Pour un démarrage Node/web, définir sur le serveur, sans jamais les mettre dans le code ou dans le navigateur :

```text
XR18_OPENAI_API_KEY=clé_du_compte_API
XR18_OPENAI_MODEL=modèle_compatible_du_compte
```

Activer ensuite l’option IA et accepter l’envoi. Chaque demande connectée envoie uniquement la question, le type d’instrument, le mode simulation/réel et l’état de connexion. Aucun audio, clé de configuration, adresse IP de la console, scène complète ou mot de passe utilisateur n’est inclus dans le contexte. La clé API sert uniquement à l’en-tête d’authentification du serveur vers OpenAI. Le paramètre API store est false ; cela ne constitue pas une promesse d’absence de toute conservation technique par le fournisseur.

La réponse contient conseils, vérifications et une question éventuelle. Elle n’est jamais interprétée comme des commandes. Les corrections applicables proviennent exclusivement du moteur local avec ses contrôles. Une erreur IA n’envoie aucun réglage et laisse le conseiller local disponible. Aucun appel IA réel n’a été effectué pendant les tests : le protocole est testé avec une réponse simulée.

## Ce que le conseiller ne sait pas faire

Il ne reçoit pas les signaux audio par OSC et ne prétend pas entendre le mixage, détecter le spectre, identifier une fréquence de larsen ou mesurer le niveau acoustique dans les écouteurs. Il ne remplace pas une écoute sur place. Les chemins matériels, l’ergonomie dans la répétition et le dialogue connecté doivent encore être essayés dans l’installation réelle de l’utilisateur.

## Références

Conseils de placement, feedback et écoute : [Shure — How do I fix my feedback problem?](https://service.shure.com/articles/en_US/Knowledge/how-do-i-fix-my-feedback-problem), [Shure — Basics of equalization and feedback](https://service.shure.com/articles/en_US/Knowledge/basics-of-equalization-and-feedback), [Yamaha — How to use a compressor](https://hub.yamaha.com/proaudio/livesound/tools-of-the-trade-how-to-use-a-compressor/), [Yamaha — Band PA beginners guide](https://europe.yamaha.com/en/audio/portable-pa/explore/pa-beginners-guide/setting/band-pa.html).

Interface de dialogue : [OpenAI — Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Les valeurs de départ sont des suggestions éditables ; elles ne sont pas des presets officiels Behringer.

## Ambiances guidées

Dans **Mon ingé son → Écouter et corriger → Ambiances des sources**, la boîte à outils **Une ambiance, chacun son dosage** propose :

1. Choisir une source déclarée dans le groupe.
2. Choisir parmi les presets proposés pour cette source. Les valeurs sont des points de départ à écouter.
3. Choisir le dosage pour chaque musicien, de **Sec** à **Ample** ; **Discret pour tous** prépare un départ commun.
4. Cliquer sur **Préparer mon ambiance**, lire les destinataires et confirmer **Essayer dans les ears**.
5. Écouter quelques phrases, puis **Garder cette ambiance** ou **Revenir avant l’essai**.

Le type d’effet et ses paramètres sont communs ; la quantité est indépendante dans chaque retour. Le musicien utilise le fader **Voix FX** ou **Ambiance FX** sur son téléphone. **Relire les dosages des musiciens** récupère ces changements dans la préparation. L’annulation d’un changement de style conserve les nouveaux dosages personnels ; **Retirer l’ambiance** restaure les réglages précédant sa création.

La boîte utilise un seul processeur FX libre, alimenté par une source à la fois. Elle évite les effets déjà alimentés, insérés ou reliés à d’autres effets. Une source liée en stéréo reste à configurer dans la console. Les deux côtés d’un retour stéréo lié doivent avoir le même dosage. Aucun volume de canal sec, master de retour, préampli ou 48 V n’est modifié. L’effet est envoyé en pré-fader aux seuls retours préparés et son affectation façade est désactivée ; le signal direct conserve son chemin existant.

La proposition expire après dix minutes et devient invalide si la console change. Une sauvegarde durable précède les commandes ; après une panne partielle, le retour aux réglages précédents reste explicite. Si quelqu’un change le processeur, le routage ou ajoute un instrument dans son envoi, l’application refuse de remplacer ces changements. Pendant l’Atelier du son, terminer/restaurer l’Atelier avant d’essayer ou retirer une ambiance. L’annulation vocale est indépendante de **Annuler le dernier réglage guidé** du conseiller historique.

Ce parcours vise X-Air / M-Air ; l’adaptation X32 n’est pas activée. Les programmes utilisent Hall, Plate et Stereo Delay (signal traité uniquement pour le délai), avec une correspondance indépendante des faits de protocole documentés dans [XAir_fxparse1.c de Patrick-Gilles Maillot](https://github.com/pmaillot/X32-Behringer/blob/master/XAir_fxparse1.c). Les programmes et leurs sauvegardes sont testés en simulation ; leur rendu acoustique doit encore être écouté sur le matériel réel.

| Source | Proposition | Pré-délai / durée |
| --- | --- | --- |
| Chœurs | Scène courte | 18 ms / 0,85 s |
| Guitare acoustique | Plaque acoustique | 20 ms / 1,30 s |
| Guitare solo | Espace pour solo | 24 ms / 0,80 s |
| Caisse claire, toms | Petite salle (Hall court) | 20 ms / 0,65 s |
| Caisse claire | Plaque caisse claire | 16 ms / 1,05 s |
| Clavier | Petit hall | 16 ms / 1,15 s |

Le chant conserve les cinq ambiances vocales. BandPilot privilégie un signal sec pour la basse, la grosse caisse, les cymbales, le module de batterie, la guitare rythmique et les pistes d’accompagnement. Pour un pédalier ou un clavier déjà traité, écoute d’abord son effet existant.

Le choix des familles s’appuie sur les presets [Yamaha 03D](https://my.yamaha.com/files/download/other_assets/3/326073/03D_E.pdf) et [REV100](https://usa.yamaha.com/files/download/other_assets/7/318757/REV100E.pdf), le [guide de référence Yamaha](https://br.yamaha.com/files/download/other_assets/8/2925678/effect_reference_guide_en_A0.pdf) et ses [conseils de mixage live](https://hub.yamaha.com/proaudio/livesound/using-reverb-and-delay-part-2/). Les durées et filtres sont adaptés à BandPilot pour les retours X-Air / M-Air.

Un essai simulé est remis à zéro avec la connexion simulée. Les sauvegardes d’un essai réel restent associées à leur console.
