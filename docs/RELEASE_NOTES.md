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
