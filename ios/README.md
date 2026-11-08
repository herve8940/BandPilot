# BandPilot pour iPad — développement autonome

Portage natif pour **iPadOS 16.4 minimum**. L’interface, le moteur OSC et la base de données tournent dans l’application. Aucun ordinateur, Docker ou serveur externe n’est nécessaire pendant l’utilisation. L’iPad mini 2 sous iOS 12 ne peut pas exécuter cette version.

Cette branche prépare la version iPad ; elle n’est pas publiée sur l’App Store. Un binaire non signé fourni par la validation GitHub **n’est pas un fichier installable** sur une tablette. Aucun essai sur iPad physique n’est encore attesté.

## Utilisation prévue

1. Installer BandPilot depuis l’App Store une fois sa publication approuvée.
2. Relier l’iPad au même réseau Wi-Fi que la console et autoriser l’accès au réseau local.
3. Dans Connexion, saisir l’adresse IP de la console. La première connexion est en lecture seule ; activer le contrôle séparément.
4. Utiliser Mon ingé son, la fiche technique et le plan de scène, les ambiances, la console et les retours selon les capacités du modèle de console.

La fiche technique est exportée en PDF via le partage iPad (Enregistrer dans Fichiers, AirDrop…). Les rapports debug sont exportables ; l’utilisateur vérifie le rapport avant de le copier dans une issue GitHub. Le choix de langue est conservé. Les prochaines mises à jour seront recherchées sur l’App Store, sans interrompre la session.

Le contrôle repasse en lecture seule après une interruption réseau, une mise en arrière-plan ou un redémarrage. Garder BandPilot au premier plan pendant les réglages et le partage des retours : iPadOS peut suspendre le moteur en arrière-plan. Aucun mode audio fictif n’est utilisé pour contourner cette limitation.

La recherche automatique par broadcast n’est pas proposée dans cette première version : elle nécessiterait l’autorisation multicast d’Apple. La connexion OSC directe utilise l’adresse IP de la console. REAPER, l’enregistrement USB et l’Atelier qui analyse les prises restent sur ordinateur. Le conseiller local reste disponible ; la clé du conseiller distant n’est pas configurable dans cette version iPad.

## Construire

Outils : macOS, **Xcode 26.2 ou plus récent**, Node 22, Python 3 et XcodeGen. Le projet est généré ; les binaires téléchargés et les éléments de signature restent hors Git.

```sh
npm ci
npm --prefix web ci
npm --prefix ios/runtime ci
npm run build:all
python3 ios/scripts/fetch-runtime.py
node ios/scripts/prepare.mjs
xcodegen generate --spec ios/project.yml
xcodebuild -project ios/BandPilot.xcodeproj -scheme BandPilot \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath ios/build/device CODE_SIGNING_ALLOWED=NO build
```

Le moteur NodeMobile 18.20.4 est épinglé par SHA-256. SQLite utilise `sql-asm.js` pour fonctionner sans JIT ni WebAssembly dans le moteur iOS. L’adaptateur de base de données est partagé avec Android. Tous les fichiers JavaScript sont embarqués, sans chargement de code distant. L’interface et le moteur communiquent exclusivement sur localhost, avec un jeton aléatoire privé et une vérification de l’origine des messages natifs.

## Vérifications

```sh
npm test
npm run test:web
node ios/scripts/test-runtime.mjs
# Sur un Mac équipé de Xcode et d’un simulateur iPad :
xcodebuild -project ios/BandPilot.xcodeproj -scheme BandPilot \
  -destination 'platform=iOS Simulator,name=NOM_DU_SIMULATEUR' \
  CODE_SIGNING_ALLOWED=NO test
```

Le workflow `iPad standalone validation` compile l’application ARM64 sans signature et teste son moteur embarqué, l’accès privé, les échanges OSC avec une console de test UDP, la validation d’un instrument accentué, les ambiances, le rechargement des données et l’export PDF dans un simulateur iPad. Les journaux, résultats Xcode et application non signée sont des artefacts de développement, pas une distribution utilisateur.

La version minimale déclarée (16.4) et les autres tailles d’iPad doivent être vérifiées sur matériel réel avant de revendiquer leur compatibilité. Les tests d’une version récente du simulateur ne certifient pas iPadOS 16.4 ni une console physique.

## Installation durable et publication

Une publication App Store nécessite un compte Apple Developer, un identifiant d’application enregistré, la signature de distribution et la revue Apple. Au 8 novembre 2026, Apple indique 99 USD par an, ou le tarif local applicable : <https://developer.apple.com/programs/enroll/>. L’abonnement concerne l’éditeur ; les utilisateurs ne resignent pas l’application chaque semaine.

Un lien App Store non répertorié peut être demandé à Apple, mais son acceptation n’est pas garantie et toute personne possédant le lien peut y accéder. TestFlight est réservé aux essais et ses builds expirent ; ce n’est pas une installation permanente. Le compte gratuit impose le renouvellement périodique de l’installation de développement.

Avant soumission : essais sur un iPad physique compatible et une console, captures d’écran, page de confidentialité publique, déclarations App Store (confidentialité, chiffrement), métadonnées et validation de la signature. Ne jamais ajouter de certificat privé, de mot de passe ou de profil de provisionnement au dépôt.
