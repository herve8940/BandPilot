# BandPilot Android 2.4.0-android.1

Première version Android autonome, publiée le 8 novembre 2026, issue du moteur BandPilot 2.3.3. Les installateurs Windows, macOS et Linux restent en version 2.3.3.

## Français

- **APK signé autonome** : interface, moteur OSC et base de données embarqués. Connexion Wi-Fi directe à la console, sans PC ni Docker.
- **Tablettes** : Android 8 minimum, WebView 111 minimum ; ARM 32/64 bits et x86_64 ; portrait et paysage.
- **Les fonctions de préparation** : Mon ingé son, fiche technique, plan de scène, PDF, ambiances des sources, retours, scènes et répertoire selon la console.
- **Installation durable** : aucune nouvelle signature tous les sept jours. Recherche des prochaines versions Android au démarrage ; téléchargement après choix de l’utilisateur.
- **Diagnostic** : rapport debug exportable et ouverture d’une issue GitHub dans le navigateur après vérification du rapport.
- **Interruption réseau** : le contrôle passe en lecture seule. Un redémarrage ne réactive pas les écritures automatiquement. Les noms accentués sont convertis correctement pour l’affichage sur la console.

### Validation et limites

211 tests moteur, 28 tests interface, 39 tests utilisant l’adaptateur SQLite Android et un test de persistance de cet adaptateur passent. L’APK signé a passé les parcours instrumentés sur Android 15 x86_64, dont les échanges UDP avec une console de test locale, la conservation des données et trois formats d’écran. Installation et démarrage en simulation également vérifiés sur une Xiaomi Redmi Pad sous Android 14, ARM 64 bits ; fonctionnement confirmé par l’utilisateur.

La connexion de cette tablette à une console physique n’a pas été vérifiée par le test de démarrage. Autres tablettes et versions Android à valider. Appareils à pages mémoire de 16 Ko non certifiés. REAPER, les prises USB multipistes et l’Atelier associé restent sur ordinateur. Les limites X-Air/M-Air et X32 restent applicables.

[Installation et compatibilité](ANDROID.md)

## English

First standalone signed Android APK: embedded UI, OSC engine and database; direct Wi-Fi mixer control without a PC or Docker. Android 8+, WebView 111+, ARM 32/64-bit and x86_64. Includes the sound coach, technical rider and stage plot, PDF export, source ambience and monitor controls according to mixer capabilities. No weekly re-signing; startup checks for future Android releases. Debug reports can be exported and pasted into a GitHub issue.

Instrumented Android 15 emulator tests pass. Installation and startup were also checked on a Xiaomi Redmi Pad running Android 14 (ARM64), and its user confirmed operation. Other hardware combinations still require validation; 16 KB-page devices are not certified. REAPER and recording-based Workshop features remain desktop-only. Desktop installers stay on 2.3.3.
