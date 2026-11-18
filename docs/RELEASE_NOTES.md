# Scènes et presets · bureau 2.3.14 / Android 2.4.0-android.5 · 18 novembre 2026

- **Presets par entrée** : sauvegarder EQ/coupe-bas, compresseur et gate, choisir les traitements à rappeler et l’entrée de destination ; extraction possible depuis une scène complète.
- **Bibliothèque réorganisée** : scènes complètes, presets par piste, fiches de balance et historique automatique. Recherche, import/export JSON et fichiers X-Air `.scn`.
- **Rappels contrôlés** : aperçu, confirmation, sauvegarde et retour au réglage précédent. Les presets de canal conservent gain, 48 V, volumes, retours et routage. Les scènes complètes peuvent modifier ces paramètres, sauf le 48 V exclu du rappel de bibliothèque.
- **FX** : rappel sur le slot choisi et restauration de sa sauvegarde. Les rappels natifs `.scn` comprennent les effets pris en charge.
- **Fiabilité** : une réponse OSC retardée entraîne une nouvelle lecture, sans rejouer la commande audio. Après un rappel interrompu, la sauvegarde de récupération reste immédiatement accessible.
- **Exports natifs** : choix du fichier sur Windows, macOS, Linux et Android ; téléchargement lorsqu’on utilise un navigateur. Annulation et erreurs du dialogue sont traitées explicitement dans les applications natives.
- **Compatibilité** : anciens fichiers conservés, pas de conversion implicite entre modèles, pas de rappel mono sur une paire liée. `.scn` limité à XR18/X18/MR18 et aux effets HALL, AMBI, RPLT, ROOM, CHAM, PLAT, DLY et MODD ; les autres algorithmes restent archivables/exportables. X32 reste partielle. Les presets sont des points de départ.
- **Plateformes** : tests serveur et interface, construction et démarrage des paquets Windows, macOS Intel/Apple Silicon et Linux ; validation Android ARM32/ARM64/x86_64 avec le moteur SQLite portable. Les tests logiciels ne certifient pas toutes les consoles physiques. Les essais utilisateur de cette évolution ont été réalisés sur Mac/XR18.

## English

Save and selectively recall input EQ/HPF, compressor and gate presets on another input of the same mixer model, or extract processing from a complete saved scene. The library now separates scenes, track presets, soundcheck sheets and automatic recovery backups. JSON import/export, supported native X-Air scene recall and FX destination-slot selection are included.

Saving/importing does not apply mixer settings. Recall requires preview and confirmation, with a backup. Input presets preserve gain, phantom power, levels, sends and routing; complete scenes can change levels and routing but library recall excludes phantom power. Delayed OSC readback retries only the read, never the audio command. Recovery backups remain accessible after an interrupted recall. Native exports report cancellation and errors.

No implicit model conversion or mono recall onto linked stereo pairs. Native `.scn` recall is limited to XR18/X18/MR18 with HALL, AMBI, RPLT, ROOM, CHAM, PLAT, DLY and MODD effects. Unsupported files remain exportable. X32 remains partial. Software checks and package tests do not certify every physical mixer. Install the signed Android APK over the previous version to retain data; do not uninstall.

---

# Android 2.4.0-android.4 · 15 novembre 2026

- **Statistiques d’utilisation sur Android.** L’avis au premier lancement et l’option **Réglages → Statistiques anonymes** sont désormais inclus dans l’APK. Le compteur peut transmettre au plus une fois par jour un numéro aléatoire d’installation, la version, la plateforme, le canal et le modèle de console. Aucun nom, audio, réglage, scène ou journal n’est transmis par ce compteur. La désactivation efface le numéro local.
- **Interface commune à jour.** Boutons du menu latéral alignés et accessibles dans les fenêtres basses, avec les raccourcis d’aide Discord.
- **Discord sur Android.** Entraide, guide, idées et signalement de bug depuis **Réglages → Aide et incidents**. Le message d’incident inclut la version Android et se copie dans le presse-papiers natif, après relecture, pour être collé dans **#bugs-tests**. Aucun message ni diagnostic n’est envoyé automatiquement.
- **Mise à jour sur place.** Même identifiant d’application et même clé de signature ; installer par-dessus l’ancienne version conserve les profils et préférences. Ne pas désinstaller.
- **Périmètre inchangé.** Pilotage local disponible sans Internet, aucune modification audio liée au choix des statistiques. REAPER et son Atelier restent sur ordinateur ; les limites de compatibilité Android et console restent applicables.

## English

Android 2.4.0-android.4 includes the shared usage-counting notice and **Settings → Anonymous statistics**, plus the latest sidebar layout and Discord help. Open help, the guide, ideas and bug reporting from **Settings → Help and incidents**. Review an incident message with the Android version, copy it with the native clipboard and paste it into **#bugs-tests**. No message or diagnostic is sent automatically. The counter can send a random installation ID, version, platform, release/source channel and mixer model at most once a day. No names, audio, settings, scenes or logs are included. Disabling it removes the local ID. Install over the previous signed APK to preserve profiles and preferences. Local mixer control still works without Internet; REAPER features remain desktop-only.

[APK and checksums](https://github.com/herve8940/BandPilot/releases/tag/android-v2.4.0-android.4) · [Données / Privacy](PRIVACY.md)

---

# Mise à jour macOS : préparation corrigée · 14 novembre 2026

Le nettoyage des archives de l’application fonctionne maintenant dans Electron : il ne bloque plus la préparation de la mise à jour ni la suppression de l’ancienne version après un démarrage réussi. Les tests macOS exécutent ces deux étapes dans Electron avec le véritable paquet publié. Les versions déjà touchées doivent installer une fois cette édition pour bénéficier de la correction.

## English

Application archive cleanup now works inside Electron, allowing macOS updates to finish staging and removing the previous version after a successful launch. macOS package tests exercise both steps in Electron with the actual installer payload. Affected existing versions require a one-time installation of this fixed edition.

---

# Menu latéral : boutons alignés · 14 novembre 2026

Les boutons Discord, aide, ouverture du menu et connexion sont maintenant alignés et régulièrement espacés dans le menu réduit. Dans une fenêtre basse, la navigation défile pour garder les commandes du bas accessibles. Le libellé de l’aide reste visible dans Réglages, même quand le menu est réduit.

## English

Discord, help, sidebar and connection controls now have consistent spacing and centered icons in the collapsed menu. Navigation scrolls in shorter windows so the footer controls stay accessible. The help label in Settings stays visible when the sidebar is collapsed.

---

# Discord : aide et incidents depuis BandPilot · 14 novembre 2026

- **Le bon salon, directement.** « Aide et incidents » donne accès à l’entraide, au guide de démarrage et aux suggestions. Le raccourci est aussi dans **Réglages**, sur téléphone et tablette.
- **Signaler un incident simplement.** Saisir un résumé, les étapes et le contexte de console. Relire le message avec la version de BandPilot, le copier, puis ouvrir `#bugs-tests` pour le coller et l’envoyer. Aucun journal, audio ou message n’est envoyé automatiquement.
- **Cinq langues.** Français, anglais, italien, espagnol et allemand. L’aide reste accessible si le serveur local est indisponible ; le diagnostic détaillé et les issues GitHub restent réservés aux administrateurs.
- **Diffusion.** Interface commune Windows, macOS Intel/Apple Silicon, Linux et Android. Android est distribué séparément en **2.4.0-android.3**, avec la même signature et conservation des données lors d’une mise à jour. iPad reste un portage de développement, sans publication App Store.

[Rejoindre Discord](https://discord.gg/FtWwEPmwE7) · [Guide des salons](https://herve8940.github.io/BandPilot/COMMUNITY_FR.html) · [Téléchargements](https://herve8940.github.io/BandPilot/#download)

## English

Help and issue reporting now open the right Discord channels from BandPilot, including Settings on small screens. Review and copy a short issue message with the app version, then paste and send it yourself in `#bugs-tests`. No logs, audio or messages are sent automatically. Available in five interface languages on desktop and Android; Android 2.4.0-android.3 is distributed as a separate signed APK. iPad remains a development port, not an App Store release.

---

# Mises à jour automatiques depuis main

- Chaque modification de `main` déclenche la construction et les tests des quatre cibles de bureau. Une version stable unique est publiée seulement après leur réussite. Les publications sont sérialisées ; si plusieurs changements arrivent pendant une construction, GitHub peut regrouper les changements en attente dans le prochain build.
- Sur les installations modifiables macOS, Windows et Linux AppImage : recherche au démarrage puis toutes les heures, téléchargement automatique, vérification SHA-256 fournie par GitHub, installation à la fermeture normale de BandPilot. Aucun redémarrage forcé pendant une session.
- L’option peut être désactivée dans « Signaler un problème ». Elle est enregistrée séparément des profils audio. Une désactivation annule le téléchargement et l’installation en attente.
- macOS utilise une archive ZIP de l’application avec signature ad hoc vérifiée, sans modifier Gatekeeper ni les attributs de quarantaine. L’ancienne application est conservée jusqu’au démarrage réussi de la nouvelle. Les volumes en lecture seule et les emplacements sans droit d’écriture restent en installation manuelle.
- Linux `.deb` reste soumis à l’installation par le gestionnaire de paquets. Les permissions du système ne sont pas contournées. Android conserve son circuit de mise à jour séparé.
- Les versions installées `-dev` peuvent rejoindre une version stable équivalente ou supérieure. Les versions anciennes doivent installer une fois cette nouvelle édition pour bénéficier de l’automatisation.

## English

Desktop builds now follow main after all four platform builds and tests succeed. Each release has a unique stable version and identifies its source commit. Writable macOS, Windows and Linux AppImage installations download verified updates in the background and install on normal quit. The setting can be disabled without changing audio profiles. System-managed Debian packages and unwritable locations retain manual installation. Existing older apps need a one-time installation of this updater-enabled version. Android remains separate.

---

# BandPilot — nouveautés

## Android 2.4.0-android.1 · 8 novembre 2026

La première application Android autonome est disponible en APK signé, avec connexion directe à la console en Wi-Fi, sans PC ni Docker. Elle reprend la fiche technique, le plan de scène, l’export PDF et les ambiances des sources. [Télécharger et installer](ANDROID.md) · [Notes Android, essais et limites](RELEASE_ANDROID_2_4_0_1.md).

Les installateurs de bureau restent en **2.3.3**.

# BandPilot 2.3.3

## Français

- **Validation des instruments.** Les erreurs restent visibles dans la fenêtre de confirmation. Après un échec, elle invite à préparer une nouvelle proposition ; un double clic ne renvoie plus la même opération.
- **Connexion et interruption.** Une réponse OSC perdue est relue une fois avant toute écriture. Une reconnexion ou une interruption pendant la vérification bloque l’application et les nouvelles tentatives d’écriture. Une modification partielle conserve sa sauvegarde dans « Annuler le dernier réglage guidé ».
- **Mesures adaptées à la bonne source.** Remplacer ou supprimer un instrument invalide ses anciennes mesures. Un gain qui ne peut pas être relu n’est plus considéré comme vérifié.
- **Préparation du groupe.** Changer la prise d’un instrument conserve son association au musicien. Ajouter une batterie détaillée vérifie la place pour tout le kit avant de modifier le groupe.
- **Premier démarrage.** Le coffre du système n’est plus consulté tant qu’aucune connexion GitHub n’a été enregistrée.
- **Installateur Windows.** Intégration du correctif amont electron-builder pour la copie du chemin d’installation utilisateur, qui pouvait provoquer un plantage de l’installateur NSIS.
- **Contrôle de l’application installée.** Le test de démarrage parcourt désormais l’ajout d’un instrument, un nom accentué, la préparation, la validation, le rechargement et l’aperçu d’ambiance dans un profil de simulation isolé. Il s’ajoute aux vérifications de connexion, langues, fiche technique et rapport debug.

Les fonctions de la 2.3.2 sont conservées : récupération d’ambiance, fiche technique accessible, rapport debug avec issue GitHub et recherche de mises à jour au lancement. Une recherche de mise à jour propose le téléchargement ; elle ne redémarre pas l’application automatiquement.

## English

Instrument validation errors now remain visible, and repeated clicks cannot submit an operation twice. Lost OSC preflight replies are retried once; reconnects and cancellation stop further writes. Interrupted changes retain their guided undo backup. Replaced instruments lose obsolete gain measurements; moving an input preserves its musician. Drum-kit insertion is atomic. The Windows installer includes the upstream NSIS path-copy fix. Native startup tests now exercise adding, naming, applying and reloading an instrument, plus ambience preview.

## Italiano

Gli errori di convalida restano visibili e i clic ripetuti non inviano due volte la stessa operazione. Una risposta OSC persa viene riletta una volta; riconnessioni e interruzioni bloccano ulteriori scritture. Le modifiche parziali conservano il backup per l’annullamento. Le misure obsolete vengono eliminate e il musicista resta associato quando cambia l’ingresso. L’installer Windows include la correzione NSIS originale. Il test dell’app installata verifica anche aggiunta, convalida e persistenza degli strumenti.

## Español

Los errores de validación permanecen visibles y los clics repetidos no duplican la operación. Una respuesta OSC perdida se vuelve a leer una vez; la reconexión o cancelación detiene las escrituras. Los cambios parciales conservan su copia para deshacer. Se descartan las medidas antiguas al cambiar de instrumento y se mantiene el músico al cambiar de entrada. El instalador Windows incorpora la corrección original de NSIS. Se amplían las pruebas de la aplicación instalada.

## Deutsch

Validierungsfehler bleiben sichtbar; wiederholte Klicks senden einen Vorgang nicht doppelt. Eine verlorene OSC-Antwort wird einmal erneut gelesen. Verbindungswechsel und Abbruch stoppen weitere Schreibvorgänge. Teilweise ausgeführte Änderungen behalten ihre Sicherung zum Rückgängigmachen. Veraltete Messungen werden verworfen, die Musikerzuordnung bleibt beim Eingangswechsel erhalten. Der Windows-Installer enthält die ursprüngliche NSIS-Pfadkorrektur. Der Starttest prüft zusätzlich Instrumente, Bestätigung und gespeicherte Daten.
