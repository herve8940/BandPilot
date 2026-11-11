# BandPilot Android autonome

Version Android disponible : **2.4.0-android.2**, avec les mises à jour vérifiées, les logs et les nouveaux choix du coach.

[Télécharger l’APK signé](https://github.com/herve8940/BandPilot/releases/download/android-v2.4.0-android.2/BandPilot-Android-2.4.0-android.2-universal.apk) · [Guide d’installation](../docs/ANDROID.md)

L’APK embarque l’interface et le moteur OSC. La tablette échange directement avec la console sur le Wi-Fi ; aucun PC, Docker ou accès Internet n’est nécessaire au pilotage. Les données restent dans le stockage privé de l’application. Une mise à jour avec la même signature conserve ces données ; une désinstallation les supprime.

## Compatibilité

- Android 8.0 / API 26 minimum ; Android System WebView **111 ou plus récent**.
- APK unique : ARM 64 bits (`arm64-v8a`), ARM 32 bits (`armeabi-v7a`) et x86_64. Pas de x86 32 bits.
- Portrait, paysage, téléphone et tablette : interface adaptée à la largeur disponible.
- Le runtime natif amont utilise des pages mémoire de 4 Ko. **Les appareils configurés en pages de 16 Ko ne sont pas certifiés pour cette première version.** Leur prise en charge nécessite une mise à jour du runtime et des tests dédiés. Ne pas présenter cet APK comme compatible avec toutes les tablettes Android.
- Les émulateurs ne remplacent pas la validation sur les tablettes physiques Samsung, Lenovo, Xiaomi, etc. ni sur chaque console.

## Installation et première connexion

1. Copier l’APK signé fourni sur la tablette, puis l’ouvrir avec le gestionnaire de fichiers. Autoriser l’installation depuis ce gestionnaire si Android le demande. Aucune publication Play Store n’est nécessaire ; ne pas désactiver Play Protect.
2. Ouvrir BandPilot. La première ouverture est en simulation.
3. Connecter la tablette au même réseau Wi-Fi que la console, même si ce réseau n’a pas Internet.
4. Dans **Réglages**, détecter la console. Si le routeur bloque les annonces réseau, renseigner son adresse IP.
5. Lire les réglages de la console, puis activer son contrôle explicitement. Après un redémarrage ou un changement de réseau, le contrôle doit être réactivé.

La notification BandPilot maintient le moteur pendant la session. Son bouton **Fermer**, ou le bouton Retour Android confirmé, arrête la connexion de la tablette ; les réglages audio déjà présents dans la console restent en place.

## Fonctions

Coach, configuration du groupe, ambiances guidées, console simple et experte, retours, scènes, répertoire, setlists, notes, fiche technique et diagnostic utilisent le même moteur que la version ordinateur, avec les mêmes restrictions par modèle. X32 reste partiel/expérimental.

REAPER, l’enregistrement USB multipiste et l’Atelier qui analyse les prises REAPER nécessitent la version ordinateur et ne sont pas proposés dans les espaces Android. Le conseiller local reste disponible ; la configuration d’une clé d’IA connectée dans le coffre Android n’est pas incluse dans cette première version.

L’export PDF utilise le panneau d’impression Android (**Enregistrer au format PDF**). Les fichiers JSON utilisent le sélecteur de fichiers Android. Le rapport debug peut être enregistré ou copié dans une nouvelle issue GitHub ouverte dans le navigateur, après lecture et confirmation ; aucune issue n’est envoyée automatiquement.

La recherche automatique à l’ouverture puis toutes les six heures pendant l’utilisation consulte uniquement les releases portant le préfixe `android-v` et proposant un APK correspondant. Elle nécessite Internet, mais son échec n’empêche pas le démarrage ou le contrôle local. Dans **Aide, logs et mises à jour**, le téléchargement automatique est une option explicite, désactivée par défaut et conservée sur cet appareil. Le téléchargement manuel reste disponible. Les APK sont vérifiés (taille et SHA-256 fourni par GitHub), puis leur identité, leur version et leur signature sont comparées à l’application installée. Sans empreinte, seul le lien de téléchargement manuel est proposé.

**Installer** demande une confirmation, puis Android présente son installateur. Si nécessaire, Android demande d’autoriser BandPilot comme source d’installation ; revenir ensuite dans l’app et appuyer à nouveau sur Installer. Le contrôle de la console est suspendu avant d’ouvrir l’installateur. Une session n’est jamais interrompue par un téléchargement automatique. Si l’installation est annulée, le contrôle doit être réactivé dans Réglages. Une mise à jour conserve les profils ; ne pas désinstaller l’application.

Le journal consultable montre les 100 derniers événements. Son export comprend les journaux bornés du moteur et d’Android, après masquage des informations sensibles ; aucun partage n’est automatique. Les nouveaux choix **Rock live / Naturel**, marge d’entrée et écoute de chaque musicien sont indépendants et facultatifs. Les anciens profils conservent leur comportement et enregistrer une préférence n’envoie pas de réglage à la console.

## Construire

Pré-requis : JDK 17, SDK Android 35, build-tools 35.0.0, NDK 27.2.12479018, CMake 3.22.1, Node 22+, Python 3. Définir `ANDROID_HOME` et `JAVA_HOME` (ou `android/local.properties` pour le SDK).

À la racine du dépôt :

```sh
npm ci
npm --prefix web ci
npm --prefix android/runtime ci
python3 android/scripts/fetch-runtime.py
npm run build:all
node android/scripts/prepare.mjs
cd android
./gradlew assembleDebug assembleDebugAndroidTest
```

Le runtime nodejs-mobile 18.20.4 est téléchargé depuis sa release amont et vérifié par SHA-256. Les binaires et sorties de compilation ne sont pas versionnés. SQLite portable (sql.js 1.13.0) remplace uniquement le module natif de bureau ; toutes les connexions partagent la même base, les transactions sont conservées et les fichiers sont remplacés atomiquement après synchronisation.

Pour un APK durable, définir `BANDPILOT_SIGNING_PROPERTIES` vers un fichier privé contenant `storeFile`, `storePassword`, `keyAlias`, `keyPassword`, puis lancer `./gradlew assembleRelease`. **Conserver la clé privée hors de Git** : elle est nécessaire pour signer les futures mises à jour. La clé créée pour cette livraison est valable 30 ans.

## Vérifier

```sh
npm test
npm run test:web
node --test android/tests/sqlite.test.mjs
node android/scripts/test-runtime.mjs
cd android
./gradlew lint connectedDebugAndroidTest
```

Le test instrumenté vérifie l’interface, l’ajout et la validation d’un instrument, un nom accentué, l’aperçu d’ambiance, le diagnostic et la persistance après rechargement. Il lance une console OSC de test dans Android et vérifie des commandes UDP natives et le passage en lecture seule lors d’une interruption. Aucun appareil audio réel n’est utilisé par ce test.

Validation de cette première version : 211 tests du moteur, 28 tests de l’interface, 39 tests exécutés avec l’adaptateur SQLite Android et un test de persistance de cet adaptateur passent. L’APK signé a été installé sur un émulateur Android 15 / API 35, x86_64, WebView 124 : parcours instrumenté complet, fermeture puis redémarrage et affichages 1280 × 800 et 800 × 1280 vérifiés. Les bibliothèques des trois architectures sont contrôlées dans l’APK, et une Xiaomi Redmi Pad (22081283G) sous Android 14, ARM 64 bits, WebView 156 et pages de 4 Ko a ensuite été utilisée pour vérifier l’installation et le démarrage en simulation. Son utilisateur a confirmé le bon fonctionnement. Les autres modèles, ARM 32 bits et Android 8–13 restent à valider sur appareil. La connexion de cette tablette à une console physique n’a pas été vérifiée par le test de démarrage.

Pour tester l’APK release, utiliser `-PtestBuildType=release assembleRelease assembleReleaseAndroidTest` avec les propriétés de signature, installer les deux APK puis exécuter d’abord `AutonomousTest` et ensuite `PersistenceTest` après un `am force-stop`. Le second test conserve le profil du premier ; ne pas effacer les données entre les deux.

Les clés de signature, jetons de démarrage, dossiers de données et rapports privés ne doivent jamais être joints à une issue. Le rapport intégré masque les informations sensibles.

## Dépendances Android

- [nodejs-mobile](https://github.com/nodejs-mobile/nodejs-mobile/tree/v18.20.4), licence Node.js et notices des dépendances incluses dans sa distribution source.
- [sql.js](https://github.com/sql-js/sql.js/tree/v1.13.0), licence MIT ; SQLite dans le domaine public.
- Android SDK/NDK et WebView sous leurs licences respectives.

## Validation de 2.4.0-android.2

Les tests du moteur couvrent aussi les anciens profils, les groupes avec écoutes mixtes et les marges d’entrée. Les tests de mise à jour vérifient les versions, les empreintes, les tailles, les redirections, les coupures réseau et la désactivation du téléchargement automatique. Les tests Android vérifient les logs dans l’interface et le refus d’un APK altéré ou d’une réinstallation de la même version. Le fournisseur de fichiers n’expose en lecture que l’APK préparé. Cette validation sur émulateur ne certifie pas les appareils physiques ni la prise en charge des pages de 16 Ko.

Les futures versions doivent conserver `applicationId` et la clé de signature, augmenter `versionCode` et `versionName` ainsi que `android/runtime/package*.json`, puis publier un APK nommé `BandPilot-Android-VERSION-universal.apk` dans une release non expérimentale `android-vVERSION`. Le client récupère l’empreinte SHA-256 de l’asset GitHub. Les secrets de signature restent hors du dépôt.
