# Atelier du son et conseils mesurés — DEV 2.3.0-dev.1

Cette version de développement ajoute un parcours dans **Répéter → Atelier du son**, également accessible depuis **Mon ingé son**. Le pont REAPER passe à **1.3.0**. Les corrections de concurrence et de verrouillage Windows de 1.2.3 sont conservées.

## Préparer un atelier

1. Installe le nouveau pont depuis Répéter puis redémarre REAPER après avoir sauvegardé tes projets.
2. Ouvre le projet source, choisis les prises actives dans REAPER ou dans la répétition et arrête la lecture. Enregistre le projet pour lui donner un chemin.
3. Dans l’atelier, lis les pistes et associe chaque instrument à son canal de console. Une piste stéréo utilise deux canaux voisins ; les destinations ne peuvent pas se chevaucher. Les deux canaux d’une paire liée doivent être couverts.
4. Choisis un extrait de 1 à 120 secondes. Vérifie que les fichiers sont bruts, avant traitement de console, et que les sorties audio REAPER sont celles de la console USB, dans l’ordre 1–18. Le nombre de sorties seul ne peut pas identifier physiquement l’interface.
5. Confirme la préparation. Les réglages sources sont enregistrés avant les écritures. Un projet REAPER séparé est créé dans le sous-dossier `workshops` des données BandPilot. Ses médias référencent les originaux sans les modifier : ils doivent rester accessibles.

Les prises actives sont recopiées sur de nouvelles pistes, sans effets de piste, automation, gain de clip ni fondu REAPER. Chaque piste va directement vers sa sortie USB, sans passer par le Master REAPER. Les effets de prise, les sources inversées ou découpées en sections, les modes de canal transformés, le pitch, le time-stretch, les portions bouclées au-delà de la source et les éléments superposés sont refusés plutôt que transformés silencieusement. Consolider une copie de ces prises permet de préparer un extrait compatible.

La préparation s’arrête avant la lecture. Elle ne remplace que les sources des canaux sélectionnés, vers USB 1 pour canal 1, etc., avec trim USB nul. Elle conserve leur source USB précédente, leur sélection physique/USB et leur trim. Les entrées non sélectionnées restent actives et peuvent toujours contribuer au mix : choisir un ensemble cohérent et écouter à un niveau adapté.

## Écouter et comparer

**Écouter le passage** lance la boucle. **Stop** l’arrête. Pour modifier une version A/B ou analyser le fichier, arrête d’abord la lecture.

- **A** conserve les traitements de départ.
- **B** mémorise les corrections faites dans la Console et les essais de conseils conservés.
- Les boutons des instruments ouvrent leur canal Expert. Le bandeau « Atelier du son » permet de revenir au parcours.
- A/B porte sur EQ, gate, compresseur et coupe-bas des canaux sélectionnés. Les gains physiques, le 48 V, les faders, les envois, le traitement des bus et les slots FX ne sont pas rappelés. Le volume perçu peut varier ; il n’y a pas de compensation automatique de sonie.
- Sauvegarde ta préférence et tes notes. L’historique conserve le projet de travail, le passage, les correspondances, les traitements et les mesures dans la base locale. L’interface présente les derniers ateliers ; elle ne rappelle pas silencieusement une ancienne séance.

**Terminer · garder A/B** arrête REAPER, restaure les sources exactes, conserve les traitements choisis et revient au projet original s’il est encore ouvert. Un backing track déjà en USB ne repasse donc pas sur une entrée micro.

## Conseils fondés sur les mesures

Deux mesures locales et complémentaires sont disponibles, sur les 30 premières secondes du passage au maximum :

- **Analyser la prise** : lecture des échantillons par REAPER, avant les effets, en blocs bornés d’une seconde. Calcul des crêtes, de la moyenne RMS, de l’écart crête/moyenne et du nombre d’échantillons proches du plafond numérique. Les chiffres ne décrivent ni le niveau acoustique des écouteurs ni la compression actuellement appliquée dans la console.
- **Écouter et mesurer les compresseurs** : lecture explicite sur la console, relevés réels de réduction de gain associés à la position REAPER, puis arrêt. Les positions sont des repères de lecture à la cadence de mesure, pas une synchronisation à l’échantillon. Une absence de mesures, un changement de projet ou de traitement, une interruption ou une déconnexion invalide le résultat.

Au maximum trois conseils montrent le **fait mesuré**, une **hypothèse à écouter**, le **passage** et la **portée du réglage**. Les règles initiales concernent le signal très faible, la proximité du plafond numérique, les écarts crête/moyenne élevés et la compression forte persistante. Les avis de faible niveau et de saturation ne modifient pas le gain à l’aveugle. Une réduction de compression ou un essai léger à 2:1 doit être confirmé puis gardé ou annulé. Une proposition périmée est refusée si les paramètres de référence ont changé. Les conseils automatiques issus du fichier concernent les pistes mono ; les paires liées se règlent dans la Console, puis se comparent avec A/B, pour éviter une correction implicite du second canal.

L’analyse spectrale existante reste dans la Console. Cette version ne prétend pas détecter automatiquement tous les défauts d’EQ, de gate, de phase ou de masquage, ni qualifier la qualité artistique d’une prise. Aucun appel IA externe ni envoi d’audio n’est nécessaire pour ces nouveaux conseils.

## Reprise et protections

L’état est écrit dans SQLite avant les changements. Après interruption, un bandeau propose de restaurer les sources. Aucune restauration automatique n’est envoyée au lancement. Il faut retrouver la même console, disposer du contrôle et pouvoir vérifier l’arrêt de REAPER. **Stop** reste accessible même si la console est déconnectée.

Pendant l’atelier, les lancements REC et les opérations concurrentes de préparation de session, de routage global, de scènes et de ReaCue sont bloqués côté serveur. Les réglages directs de canal et les commandes Stop restent accessibles. Les modifications depuis un autre logiciel ou directement dans REAPER restent possibles ; le logiciel vérifie les conditions avant la lecture et les corrections. L’atelier est réservé à l’administrateur.

## Matériel et validation

- Cible : XR18 / X18 / MR18, USB 18×18, 44,1 ou 48 kHz communs à REAPER et à la console.
- XR12 / MR12 : pas de lecture multipiste USB PC ; atelier indisponible.
- X32 : atelier indisponible tant que son adaptateur USB/routage n’est pas validé.
- Interface vérifiée dans Chrome à 390, 1024 et 1440 pixels, sans débordement horizontal sur le parcours de préparation.
- Tests automatisés : calculs, affectations, A/B, reprise après redémarrage, panne partielle, refus des propositions périmées, permissions, accès HTTP et handlers Lua de copie/routage/lecture/nettoyage.
- Vérification native avec REAPER 7.83 sur Mac : création d’un projet séparé, copie et offset exacts, sortie directe configurée, mesure audio réelle avec piste muette (sinusoïde connue : crête 0,250000, RMS 0,176774), retour au projet source intact. Aucune lecture sonore. Après reconnexion USB, test répété sans simulation : périphérique CoreAudio XR18, 18 sorties, 48 kHz, résultats identiques. Le pont rouvre désormais le périphérique si REAPER l’a fermé en arrière-plan. La lecture audible et le retour physique complet restent à valider.
- Cette livraison DEV n’est pas une validation acoustique sur matériel. L’essai réel complet doit précéder une publication stable.

### Essai matériel à effectuer avant une version stable

Sur un projet de test, à bas niveau : comparer une piste mono et une paire stéréo, confirmer les sorties physiques et USB, vérifier qu’un backing USB retrouve sa source exacte, écouter A/B, contrôler les mesures sur une prise connue, déconnecter/reconnecter pour tester la restauration, puis vérifier REC/Stop hors atelier sur macOS et Windows. Vérifier aussi que le projet source et ses médias sont intacts.

Les mesures audio utilisent les [API officielles REAPER](https://www.reaper.fm/sdk/reascript/reascripthelp.html#GetAudioAccessorSamples), avec lecture immédiatement avant les effets et inclusion des silences dans la moyenne RMS.
