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
