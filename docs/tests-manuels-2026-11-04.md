# Tests manuels XR18 Studio 2.2.0-dev.10

Session du 3 au 4 novembre 2026, sur le Mac de l’utilisateur.

## Conditions

Application installée dans /Applications/XR18 Studio.app. Interface accessible après fermeture des instances multiples. Au début : console réelle connectée, contrôle activé. Passage explicite en simulation avant les essais de commandes. L’application est laissée en simulation. Aucun essai de commande audio n’a été effectué sur la console réelle.

Le dossier de travail ne contient pas les sources du logiciel : aucune correction du code n’a été réalisée.

## Résultats vérifiés

| Parcours | Résultat observé |
| --- | --- |
| Réglages : passage en simulation | Message « Simulation activée », écritures matérielles indiquées désactivées. |
| Console Simple : canal 1 | Mute activé puis désactivé ; solo activé puis désactivé. Incrément de volume de -10 à -9,6 dB, puis retour à -10 dB. |
| Console Expert | Ouverture des vues canal, compresseur, égaliseur, effets, routage, analyse et enregistrement. Cela valide leur accès, pas tous leurs paramètres. |
| Retours | Liste des trois musiciens et sélection de bus affichées. Partage réseau non démarré. |
| Répéter | Ouverture des modes « Avec mes morceaux » et « Groupe seul », morceaux, sections et prises affichés. Transport non déclenché. |
| Concert | Setlist affichée verrouillée ; avertissement Main coupé visible ; commandes de transport présentes. Transport non déclenché. |
| Préparer | Ouverture des setlists, notes de répétition et scènes existantes. |
| Scènes | Aperçu de rappel ouvert ; essai en simulation bloqué par une demande de confirmation 48 V. |
| Analyse | « Lancer l’écoute » affiche « L’analyse a besoin de la vraie XR18 connectée. » |
| Enregistrement | Configuration de pistes et création de session accessibles ; aucune session créée et aucun enregistrement lancé. |
| Mon ingé son | Étape de diagnostic et proposition « C’est agressif / ça pique » accessibles. Conseil local affiché ; modification refusée avec explication sur le type de filtre incompatible. |

## Anomalies

### 1. Rappel de scène bloqué en simulation

Reproduction : Préparer → Scènes → scène « lastest » → Rappeler… → Essayer en simulation.

Résultat : la fenêtre se ferme et la page affiche « Confirmation 48 V requise ». Aucun contrôle permettant de donner cette confirmation n’est présenté, y compris dans « Plus d’options ». Le rappel n’est pas validé. La sauvegarde automatique reste à 132 dans l’interface.

À corriger : rendre cohérents l’aperçu et la validation serveur ; proposer un rappel excluant le 48 V ou un parcours de confirmation explicite, adapté à la simulation.

### 2. Indicateurs contradictoires en simulation

Reproduction : Réglages → Passer en simulation → Jouer → Expert.

Résultat : l’en-tête affiche « Simulation » mais le panneau Expert affiche « XR18 connectée » et « Contrôle actif ». L’analyse, elle, refuse correctement de démarrer faute de vraie console connectée.

L’incohérence visuelle est confirmée. Elle ne démontre pas une écriture sur la console : les réglages indiquent que les écritures matérielles sont désactivées.

### 3. Ajout de morceau vide sans retour visible

Reproduction : Préparer → Setlists → Ajouter, avec le titre vide.

Résultat : aucun morceau ajouté, mais aucun message visible ou changement dans l’arbre d’accessibilité. Le bouton reste disponible. Amélioration : désactiver le bouton ou indiquer que le titre est requis.

## Points à approfondir

- Console Simple/Expert : canaux nommés « Ch 01 », etc., alors que le coach et la configuration d’enregistrement affichent E-drums, Basse, Guit solo et Backing. Vérifier la synchronisation des noms et la distinction entre configuration du groupe et état simulé.
- Transport Expert : la barre affiche « Aucune session » et REC désactivé ; la vue Enregistrement affiche « Reaper prêt » avec REC disponible. Vérifier si les deux transports utilisent volontairement des sessions différentes et rendre cette distinction claire.
- Mode simulation : les routages USB affichent Ch01 pour toutes les sorties dans la vue Expert, tandis que l’enregistrement annonce un routage supposé 1 pour 1. Vérifier la cohérence des valeurs simulées et de l’avertissement.

## Couverture restante

Ce passage est une exploration manuelle et quelques essais fonctionnels en simulation, pas une validation exhaustive. Restent notamment : transport et fichiers audio REAPER sur une session de test isolée, lecture et enregistrement réels, qualité audio, échanges OSC et synchronisation avec la console, rappel de scène après correction du blocage, import/export et persistance après redémarrage, retours sur un téléphone, comptes et droits, ReaCue et IA connectée. Aucun compte ni accès réseau n’a été créé ; aucun élément existant n’a été supprimé.


## Deuxième passage — 4 novembre 2026

### Enregistrement réellement effectué

Création d’un nouvel onglet REAPER vide avant la préparation, pour préserver les projets existants. XR18 Studio a créé et ouvert une session de test à quatre pistes dans le dossier `Tests audio` de cet espace de travail. Le nom saisi « Codex test 2026-11-04 » a été suffixé automatiquement par « 2026-11-03 » : décalage de date à vérifier (session après minuit en Belgique).

Démarrage REC depuis la vue Enregistrement, ajout d’un marqueur, puis Stop : réussi. Retour à « Reaper prêt ». REAPER affiche les quatre prises et son transport arrêté. Relecture brève depuis REAPER : transport Playing observé, puis arrêté.

Vérification des fichiers WAV : quatre fichiers mono PCM 24 bits, 48 000 Hz, 11,951 secondes chacun. Marqueur présent dans le RPP à 6,0556 secondes. Crêtes mesurées : E-drums -39,3 dBFS, Basse -94,1 dBFS, Guit solo -95,9 dBFS, Backing -96,7 dBFS. Les données sont valides mais le signal est très faible ; aucune conclusion sur la qualité musicale ou acoustique. Le mode simulation de la console ne simule pas REAPER : il a bien enregistré les entrées audio réelles.

Les fichiers de test occupent environ 10 Mo et sont conservés.

### Connexion et lecture de la console réelle

Détection réussie et connexion en lecture seule ; contrôle matériel non activé. Synchronisation Table → PC réussie, avec message final « 2636 paramètres et les quatre effets conservés sur le PC ». Lancement et pause de l’analyse possibles sur la vraie console en lecture seule ; la pertinence du spectre avec instruments actifs n’est pas validée.


### Sauvegarde, export et import

Copie de scène « CODEX TEST copie console 2026-11-04 » créée par lecture de la console : réussie. Export JSON sauvegardé dans cet espace de travail : 91 161 octets, JSON valide. Réimport via le sélecteur de fichiers : réussi, message d’import confirmé, liste passée de 7 à 8 scènes. Deux copies de test sont conservées. Aucun rappel réel effectué.

### Setlists

Ajout d’un morceau « CODEX TEST morceau », artiste « Test local », 120 BPM : réussi. Ajout à la setlist active puis sauvegarde « CODEX TEST setlist 2026-11-04 » : réussi, message « Setlist enregistrée ». Ces données de test sont conservées ; la setlist active contient ce morceau de test.

### Retours réseau

Partage démarré avec autorisation explicite. Page musicien accessible dans Chrome sur le Mac ; l’utilisateur confirme que les faders s’affichent aussi sur son téléphone. Le compteur affiche deux clients. Page en lecture seule avec niveau du bus d’Hervé -10 dB, sources E-drums -3 dB, Basse -5 dB, Guit solo -15 dB. Aucun besoin d’installer une application sur le téléphone.

Activation des écritures matérielles arrêtée par la validation automatique avant confirmation ; une autorisation explicite distincte est demandée à l’utilisateur pour activer le contrôle, baisser légèrement le bus 1 puis le rétablir. Aucun contournement effectué.


### Essai réel autorisé du bus 1

Après autorisation explicite de l’utilisateur, activation du contrôle confirmée. Sur la page musicien d’Hervé dans Chrome : baisse au clavier de -10,0 à -10,8 dB, puis remontée à -10,0 dB. Le niveau reste -10,0 dB après rechargement de la page. Valeur normalisée affichée par le contrôle : 0,4995 (valeur initiale reçue : environ 0,499511). Aucun autre réglage audio volontairement modifié. Cela valide le parcours de commande et sa valeur retournée ; aucune appréciation acoustique n’a été faite.

Défaut observé : le client musicien ouvert avant activation reste en lecture seule après activation du contrôle dans l’application. Un rechargement le rend modifiable. L’état d’autorisation ne se propage donc pas automatiquement au client déjà ouvert pendant cet essai.

Fin de l’essai : contrôle désactivé, état « Lecture seule activée », écritures matérielles désactivées. Partage arrêté, bouton revenu à « Démarrer le partage », client indiqué non connecté.

### Notes de répétition

Sans date : message « Renseigne le nom et la date de répétition ». Avec nom « CODEX TEST repetition 2026-11-04 », note de test et date du 4 novembre 2026 à 18:00 : sauvegarde réussie et entrée affichée. Ces données de test sont conservées.


### Redémarrage et persistance

Arrêt effectif confirmé dans l’inventaire des applications, puis relance (le port local passe de 56273 à 57066). Reconnexion à la console en lecture seule, écritures désactivées. Les huit scènes, le morceau de test, la setlist sauvegardée et la répétition sauvegardée sont conservés. Le chargement de la setlist sauvegardée fonctionne.

Anomalie supplémentaire : le brouillon « Objectifs et notes », présent avant fermeture et présenté comme sauvegardé localement dans le navigateur, est vide après relance. La répétition explicitement enregistrée conserve bien la note. La liste active de morceaux est vide au redémarrage, mais la setlist sauvegardée se recharge. Le changement de port de l’application pourrait expliquer la perte du stockage navigateur ; il s’agit d’une hypothèse, sans vérification du code.

### Limites après ce deuxième passage

Tests réalisés : chaîne création de projet → REC → marqueur → Stop → fichiers WAV et relecture REAPER ; détection console ; synchronisation Table → PC ; analyse lancement/pause ; sauvegarde/export/import JSON ; création/chargement setlist ; note de répétition ; accès téléphone ; commande réelle réversible limitée au volume du bus 1 ; redémarrage et persistance.

Restent non validés : qualité acoustique avec instruments actifs, rappel complet de scènes et transfert PC → Table sur matériel réel, routage réel et alimentation 48 V, concert et répétition sur un véritable set complet, import/export .scn, droits des comptes (comptes non activés), IA connectée (non configurée), intégration ReaCue externe (adaptateur non raccordé). L’autorisation de test matériel était limitée au bus 1 : aucun autre réglage matériel n’a été essayé.

Éléments de test conservés : projet et quatre WAV dans `Tests audio`, export JSON, deux scènes « CODEX TEST copie console 2026-11-04 », morceau « CODEX TEST morceau », setlist « CODEX TEST setlist 2026-11-04 », répétition « CODEX TEST repetition 2026-11-04 ». Aucun élément antérieur supprimé. Les sections du premier passage décrivent l’état et les limites de cette première phase ; les résultats de ce deuxième passage les complètent.


## Test ciblé : Répéter → Avec mes morceaux — 4 novembre 2026

### Préparation

Projet original actif : « Nouveau concert », morceau reconnu « la sentinelle », 03:33, une piste REC E-drums armée. Projet déjà marqué modifié avant l’essai. Duplication dans un nouvel onglet vers `Tests audio/CODEX TEST Repeter avec morceaux.rpp` pour les essais qui modifient les pistes et enregistrent. Les métadonnées de concert ne suivent pas automatiquement la copie : XR18 Studio la présente comme « Projet ouvert », 03:42, avec les sections et pistes disponibles. Les essais de lecture et de navigation de section ont aussi été faits dans le projet original reconnu.

La copie utilise des chemins relatifs pour deux anciennes prises. Ces fichiers étaient absents du dossier de test au chargement ; les fichiers originaux existent bien dans le dossier Media du concert. Ils ont été copiés dans `Tests audio/Media`, puis leurs formes d’onde sont redevenues visibles en réactivant l’onglet. Ce problème de copie ne doit pas être présenté comme des fichiers originaux perdus.

### Résultats

- Lecture : transport REAPER Playing et vumètres actifs confirmés ; chronomètre XR18 Studio progresse.
- Stop : transport REAPER Stopped confirmé. Après lecture depuis une section, le curseur revient à son point de départ.
- Navigation : Refrain 1 amène le curseur à 53,620 s ; Couplet 1 à 25,533 s ; Intro guitare près de 2 s. Le morceau original revient au début en cliquant sur son nom.
- Mute Chant puis rétablissement : état du bouton confirmé. Solo Batterie puis rétablissement : état du bouton confirmé.
- Présence Basse dans la copie : création d’une piste REC Basse avec entrée 2 et armement ; compteur passe à deux pistes armées. Les pistes ReaCue Batterie et Basse sont coupées après application de la présence. Basse remise absente en fin d’essai, piste REC Basse désarmée.
- REC avec accompagnement depuis la copie : état « Enregistrement confirmé par Reaper », transport Recording vérifié ; marqueur ajouté ; Stop finalise et affiche Prise 3.
- WAV créés : `10-REC E-drums-261104_0020.wav` et `11-REC Basse-261104_0020.wav`, chacun 23,012 s, 48 kHz, 24 bits. Marqueur 16 à 16,4876458 s présent dans le RPP sauvegardé.
- Pendant REC : navigation de morceau, sections, choix des prises et présence des musiciens désactivés, Stop et Marqueur disponibles.
- Après boîtes de dialogue REAPER bloquantes : XR18 Studio affiche temporairement « Reaper ne répond pas », puis récupère automatiquement après fermeture.

### Défaut confirmé : sélection de la nouvelle prise

Cliquer sur « Prise 3 » affiche :

`XR18_Studio_Bridge.lua:151: bad argument #1 to 'SetActiveTake' (MediaItem_Take expected)`

Erreur reproduite deux fois, dont une après restauration des deux médias de la copie et affichage de leurs formes d’onde. La sélection/réécoute de la nouvelle prise n’est donc pas validée.

Lecture du script installé à la ligne 151 : appel direct à `SetActiveTake(GetTake(...))` sans validation de l’objet retourné. La cause précise de la prise invalide n’a pas été établie ; il faut examiner les items dont les nombres de prises diffèrent ou qui contiennent des prises vides avant de conclure. Aucun script installé n’a été modifié.

### Autres observations et limites

- Les cases de présence restent identiques lors d’un changement de projet, alors que les pistes armées et les mutes du nouveau projet peuvent différer : après retour à l’original, Basse était encore cochée mais une seule piste était armée et sa piste ReaCue restait ouverte. Cohérence à revoir.
- « Original ReaCue » a été actionné dans la copie sans changement visible confirmé des mutes : retour à l’original non validé.
- « Boucler cette section » a été actionné dans la copie sans activation visible confirmée du repeat ou de ses bornes dans REAPER : boucle non validée. Le bouton n’était pas proposé dans toutes les sections observées.
- Pas d’évaluation acoustique par l’agent ; le transport et les fichiers ont été vérifiés. Les commandes REAPER ont été testées alors que la XR18 restait en lecture seule ; aucune écriture de mixage matériel effectuée.

### État final

Projet original « Nouveau concert » au premier plan, transport arrêté au début du morceau. Son état modifié préexistant conservé, aucune sauvegarde de l’original déclenchée. Copie de test sauvegardée et conservée dans un autre onglet, avec les deux nouveaux WAV et des copies des deux médias anciens. Présence Basse rétablie à Absent. Console toujours en lecture seule.
