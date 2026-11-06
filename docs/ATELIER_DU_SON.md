# Atelier du son et conseils mesurés — DEV 2.3.0-dev.3

Cette version de développement ajoute un parcours dans **Répéter → Atelier du son**, également accessible depuis **Mon ingé son**. Le pont REAPER passe à **1.5.0**. Les corrections de concurrence et de verrouillage Windows de 1.2.3 sont conservées.

## Préparer un atelier

1. Installe le nouveau pont depuis Répéter puis redémarre REAPER après avoir sauvegardé tes projets.
2. Ouvre le projet source, choisis les prises actives dans REAPER ou dans la répétition et arrête la lecture. Enregistre le projet pour lui donner un chemin.
3. Dans l’atelier, lis les pistes et associe chaque instrument à son canal de console et vérifie sa famille (guitare, voix, basse, batterie, claviers…). Une piste stéréo utilise deux canaux voisins ; les destinations ne peuvent pas se chevaucher. Les deux canaux d’une paire liée doivent être couverts.
4. Choisis un extrait de 1 à 120 secondes. Vérifie que les fichiers sont bruts, avant traitement de console, et que les sorties audio REAPER sont celles de la console USB, dans l’ordre 1–18. Le nombre de sorties seul ne peut pas identifier physiquement l’interface.
5. Confirme la préparation. Les réglages sources sont enregistrés avant les écritures. Un projet REAPER séparé est créé dans le sous-dossier `workshops` des données BandPilot. Ses médias référencent les originaux sans les modifier : ils doivent rester accessibles.

Les prises actives sont recopiées sur de nouvelles pistes, sans effets de piste, automation, gain de clip ni fondu REAPER. Chaque piste va directement vers sa sortie USB, sans passer par le Master REAPER. Les effets de prise, les sources inversées ou découpées en sections, les modes de canal transformés, le pitch, le time-stretch, les portions bouclées au-delà de la source et les éléments superposés sont refusés plutôt que transformés silencieusement. Consolider une copie de ces prises permet de préparer un extrait compatible.

La préparation s’arrête avant la lecture. Elle ne remplace que les sources des canaux sélectionnés, vers USB 1 pour canal 1, etc., avec trim USB nul. Elle conserve leur source USB précédente, leur sélection physique/USB et leur trim. Les entrées non sélectionnées restent actives et peuvent toujours contribuer au mix : choisir un ensemble cohérent et écouter à un niveau adapté.

## Écouter et comparer

**Écouter le passage** lance la boucle. **Stop** l’arrête. Pour modifier une version A/B ou analyser le fichier, arrête d’abord la lecture.

- **A** conserve les traitements de départ.
- **B** mémorise les corrections faites dans la Console et les essais de conseils conservés.
- Les boutons des instruments ouvrent leur canal Expert. Le bandeau « Atelier du son » permet de revenir au parcours.
- A/B porte sur EQ, gate, compresseur, coupe-bas et polarité des canaux sélectionnés. Les gains physiques, le 48 V, les faders, les envois, le traitement des bus et les slots FX ne sont pas rappelés. Le volume perçu peut varier ; il n’y a pas de compensation automatique de sonie.
- Sauvegarde ta préférence et tes notes. L’historique conserve le projet de travail, le passage, les correspondances, les traitements et les mesures dans la base locale. L’interface présente les derniers ateliers ; elle ne rappelle pas silencieusement une ancienne séance.

**Terminer · garder A/B** arrête REAPER, restaure les sources exactes, conserve les traitements choisis et revient au projet original s’il est encore ouvert. Un backing track déjà en USB ne repasse donc pas sur une entrée micro.

## Conseils fondés sur les mesures

Deux mesures locales et complémentaires sont disponibles, sur les 30 premières secondes du passage au maximum :

- **Analyser la prise** : lecture des échantillons par REAPER, avant les effets, en blocs bornés d’une seconde. Calcul des crêtes, de la moyenne RMS, de l’écart crête/moyenne, du nombre d’échantillons proches du plafond numérique, du spectre et de la compatibilité mono des pistes stéréo. Les blocs sont regroupés par trois secondes pour réduire les échanges avec REAPER. Les pistes mono sont mesurées sur un canal, sans doubler les échantillons. Les chiffres ne décrivent ni le niveau acoustique des écouteurs ni la compression actuellement appliquée dans la console.
- **Écouter et mesurer les compresseurs** : lecture explicite sur la console, relevés réels de réduction de gain associés à la position REAPER, puis arrêt. Les positions sont des repères de lecture à la cadence de mesure, pas une synchronisation à l’échantillon. Une absence de mesures, un changement de projet ou de traitement, une interruption ou une déconnexion invalide le résultat.

Les **trois premières priorités** restent visibles immédiatement. Les filtres **EQ**, **Phase** et **Tous** donnent accès à tous les constats, y compris ceux des autres instruments. Chaque conseil indique le fait mesuré, une hypothèse à écouter, le passage et la portée du réglage. Les libellés utilisent les unités musicales (Hz, dB, ratio), pas les adresses OSC.

### Égalisation

Le spectre affiche 28 bandes de tiers d’octave, mesurées séparément sur les deux côtés d’une piste stéréo : une opposition de polarité ne fait donc pas disparaître artificiellement son énergie spectrale. La courbe est relative à la bande la plus forte de la piste ; elle ne représente ni une réponse de salle ni une cible à rendre plate.

- **Bas-médiums très présents** : une zone large entre 160 et 400 Hz domine une part significative du passage. Pour une guitare, une voix, des chœurs ou un clavier, l’atelier propose un essai de −3 dB à 250 Hz, Q 1,2. Une note isolée, un unique transitoire, une basse ou une batterie ne déclenchent pas ce conseil.
- **Grave sous le registre utile** : une présence importante sous 71 Hz peut proposer un coupe-bas prudent, selon la famille : 80 Hz pour la guitare, 90 Hz pour le chant, 100 Hz pour les chœurs. Cela ne prouve pas un ronflement électrique et peut correspondre à un effet volontaire.
- L’essai utilise une bande plate disponible. Un EQ désactivé contenant des réglages n’est pas activé à l’aveugle ; une coupe déjà présente dans la zone n’est pas empilée. Si les bandes sont occupées, le constat reste visible et invite à ouvrir la console.
- Une paire stéréo reçoit la même proposition EQ sur ses deux canaux. Une paire liée n’accepte que des changements symétriques ; les autres essais sont refusés.

### Phase et mono

La mesure présente la corrélation gauche/droite (−1 : opposition, 0 : décorrélé, +1 : identique) et la perte lors d’une somme mono. Une stéréo décorrélée perd normalement environ 3 dB avec cette convention de sommation ; cela ne suffit pas à déclencher une alerte. Les silences et les pistes dont un côté est insuffisant ne produisent pas de conseil de polarité.

- **Opposition presque constante** : si les niveaux sont comparables et que la console n’applique pas déjà une compensation, un essai inverse uniquement le canal droit. Il se garde ou s’annule comme l’EQ et fait partie de A/B.
- **Opposition par moments** : l’atelier localise le passage et ne propose pas une inversion globale qui abîmerait les sections correctes. Corriger la prise dans REAPER ou préparer un atelier limité à cette section permet de travailler le problème précisément.
- Une paire liée ou déjà compensée affiche une explication plutôt qu’un bouton d’inversion trompeur. L’analyse porte sur la prise avant la console, pas sur l’effet acoustique dans les oreilles. Elle ne mesure pas les retards entre deux micros sur deux pistes mono différentes.

**Essayer sur B → Garder / Revenir avant l’essai** permet une comparaison réversible. Les réglages sont relus sur la console ; si une autre application les a modifiés depuis la mesure, l’essai est refusé. Les mesures de la prise restent visibles après un passage A/B et les propositions sont recalculées avec les réglages courants. L’historique conserve aussi les constats pour relire le bilan une fois l’atelier terminé.

Aucune hausse aveugle de préampli, aucun changement de 48 V ni de volume des ears n’est proposé par ces règles. Un fichier déjà écrêté ne peut pas être réparé par un EQ. Les conseils sont des essais d’écoute fondés sur les mesures, pas une garantie d’équilibre artistique. Aucun envoi d’audio ni appel à une IA distante n’est nécessaire.

## Reprise et protections

L’état est écrit dans SQLite avant les changements. Après interruption, un bandeau propose de restaurer les sources. Aucune restauration automatique n’est envoyée au lancement. Il faut retrouver la même console, disposer du contrôle et pouvoir vérifier l’arrêt de REAPER. **Stop** reste accessible même si la console est déconnectée.

Pendant l’atelier, les lancements REC et les opérations concurrentes de préparation de session, de routage global, de scènes et de ReaCue sont bloqués côté serveur. Les réglages directs de canal et les commandes Stop restent accessibles. Les modifications depuis un autre logiciel ou directement dans REAPER restent possibles ; le logiciel vérifie les conditions avant la lecture et les corrections. L’atelier est réservé à l’administrateur.

## Matériel et validation

- Cible : XR18 / X18 / MR18, USB 18×18, 44,1 ou 48 kHz communs à REAPER et à la console.
- XR12 / MR12 : pas de lecture multipiste USB PC ; atelier indisponible.
- X32 : atelier indisponible tant que son adaptateur USB/routage n’est pas validé.
- Interface vérifiée dans Chrome à 390, 1024 et 1440 pixels, sans débordement horizontal sur le parcours de préparation.
- Tests automatisés : calculs, affectations, A/B, reprise après redémarrage, panne partielle, refus des propositions périmées, permissions, accès HTTP et handlers Lua de copie/routage/lecture/nettoyage.
- Vérification native avec REAPER 7.83 sur Mac : création d’un projet séparé, copie et offset exacts, sortie directe configurée, mesure audio réelle avec piste muette (sinusoïde connue : crête 0,250000, RMS 0,176774), retour au projet source intact. Aucune lecture sonore. Après reconnexion USB, test répété sans simulation : périphérique CoreAudio XR18, 18 sorties, 48 kHz, résultats identiques. Le pont rouvre désormais le périphérique si REAPER l’a fermé en arrière-plan. Des essais ultérieurs sur canaux coupés ont validé les commandes, les mesures de compression réelles, les essais et annulations et la restauration ; ils ne constituent pas une validation acoustique dans les ears.
- Cette livraison est testée sur la XR18 disponible. La compatibilité acoustique avec chaque installation et les autres modèles ne peut pas être déduite de ces essais.

### Essai matériel à effectuer avant une version stable

Sur un projet de test, à bas niveau : comparer une piste mono et une paire stéréo, confirmer les sorties physiques et USB, vérifier qu’un backing USB retrouve sa source exacte, écouter A/B, contrôler les mesures sur une prise connue, déconnecter/reconnecter pour tester la restauration, puis vérifier REC/Stop hors atelier sur macOS et Windows. Vérifier aussi que le projet source et ses médias sont intacts.

Les mesures audio utilisent les [API officielles REAPER](https://www.reaper.fm/sdk/reascript/reascripthelp.html#GetAudioAccessorSamples), avec lecture immédiatement avant les effets et inclusion des silences dans la moyenne RMS.

## Validation EQ / phase des 4–5 novembre 2026

Sur six pistes synthétiques de 30 secondes, mesure native REAPER : environ 32 secondes pour tout le groupe. Le test distingue le grave chargé de la guitare (55 % d’énergie entre 160 et 400 Hz) de sa référence propre (16 %), et repère l’opposition de polarité variable des chœurs après 19 secondes. Les mesures de niveaux restent cohérentes avec les fichiers générés. Des tests séparés couvrent silence, note isolée, transitoire, stéréo identique/décorrélée/opposée, compensation préexistante, EQ occupé et restauration A/B.

Dans l’application installée, les sept constats attendus sont accessibles. Sur la vraie XR18, les essais −3 dB à 250 Hz / Q 1,2, coupe-bas 80 Hz et inversion du seul canal droit ont chacun été vérifiés par relecture : essai, annulation, conservation et rappel A/B. L’inversion n’est proposée que sur le passage 20–30 s où l’opposition est constante. Les canaux 9–13 et 15–16 sont restés coupés pendant les essais ; 679 paramètres ont ensuite été restaurés et vérifiés, REAPER arrêté sur le projet source. Les résultats tiennent à 390 et 1024 pixels sans débordement horizontal. L’analyse complète dans l’application avec plusieurs interfaces et les tests en parallèle dépasse une minute sur ce Mac ; les 32 secondes ci-dessus correspondent à la mesure native isolée.

Le pont conserve la précision des faibles énergies lors de l’échange JSON, tolère le remplacement atomique de son fichier de présence, et donne régulièrement la main à l’analyse même lorsque l’interface interroge le transport. REC et Stop restent prioritaires. Le test de fin de boucle couvre le retour de 29,36 s à 0,38 s sans échantillon exactement sur la frontière.

## Évolution DEV.3 : gate et compression par instrument

Après **Analyser la prise**, choisir **Je travaille sur → instrument**. Les constats et leurs filtres sont limités à cet instrument ; un essai en cours reste toujours accessible. Le parcours demeure : analyser, comprendre, proposer, essayer sur B, écouter A/B, garder ou revenir avant l’essai.

Pour le gate, ouvrir **Gate · nettoyer les pauses**. Écouter les deux repères et les ajuster : un repos réel de l’instrument (bruit/repisse seulement), puis une note faible à préserver. Chaque mesure couvre une demi-seconde. La lecture démarre au repère et continue dans le passage : appuyer sur **Stop** avant de proposer. Les repères automatiques sont des suggestions de niveau, pas une reconnaissance de l’intention musicale. La case d’identification doit être cochée avant de préparer le conseil.

La proposition utilise le bruit au 95e percentile et les notes faibles au 20e percentile. Si leur séparation est inférieure à 10 dB, si le repos est déjà presque silencieux, si le détecteur utilise une autre source/un filtre, ou si la prise est stéréo, elle explique la limite sans appliquer de gate. Sinon, un expandeur doux 2:1 est proposé avec seuil, atténuation limitée, attaque, maintien et relâchement. La réduction est limitée à 6 dB pour la voix et les chœurs, 12 dB pour les fûts et 8 dB pour les autres familles. Les fins de mots et de notes restent à écouter avant de garder.

Le pont mesure désormais des enveloppes de crête et RMS toutes les 20 ms. La proposition de compression exclut les pauses du calcul de dynamique et réutilise les familles de presets de **Mon ingé son**. Elle estime les attaques et décroissances, borne les réglages et laisse la compensation à zéro. Une résolution de 20 ms ne mesure pas précisément les transitoires très courtes : les temps proposés restent des points de départ. Cette proposition concerne les compresseurs désactivés ; les mesures de réduction de gain et le réglage manuel restent disponibles pour un compresseur déjà actif. Une paire stéréo reçoit des réglages symétriques, sans changer sa liaison.

Les références musicales appartiennent à l’analyse courante et sont effacées à la prochaine analyse. Tout changement du détecteur ou des paramètres concernés après la proposition invalide celle-ci. Les protections de sauvegarde, A/B, essai et restauration s’appliquent aussi à ces nouveaux conseils. Les ambiances créatives de voix se trouvent dans **Mon ingé son**, hors de l’Atelier ; voir [le parcours vocal](INGE_SON.md#ambiances-guidées).

### Validation de cette évolution

Les nouveaux calculs, les enveloppes Lua (y compris silence et dernière fenêtre incomplète), l’essai/annulation du gate, les propositions périmées et les interfaces sont couverts par des tests automatisés. Les tests matériels de la section précédente concernent DEV.2 : ils ne valident pas à eux seuls les nouveaux réglages gate, compression et ambiances de DEV.3. L’écoute sur la console et dans les ears reste à réaliser avant d’en faire une version stable.

## Comparer le kick et la basse

Affecte un **Kick** et une **Basse** mono, puis analyse un passage où les deux jouent. Si la même zone du grave ressort sur plusieurs fenêtres communes, un constat apparaît dans **EQ**. Écoute le passage avant l’essai, passe sur B, puis essaie la coupe de 2 dB proposée sur la basse si une bande peut être utilisée. Arrête la lecture pour basculer entre **A · Sans la correction** et **B · Avec la correction**, puis réécoute le même passage. Garde ou annule ensuite. Le recouvrement spectral des prises brutes donne un endroit à vérifier à l’oreille.
