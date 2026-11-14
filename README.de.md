# BandPilot

<!-- community-badge:start -->
[![Discord](https://img.shields.io/badge/Discord-BandPilot-5865F2?logo=discord&logoColor=white)](https://discord.gg/FtWwEPmwE7)
<!-- community-badge:end -->

**Deine Band. Dein Mischpult. Dein Sound.**

[Download](https://herve8940.github.io/BandPilot/de.html#download) · [Website](https://herve8940.github.io/BandPilot/de.html) · [Vollständiger Leitfaden](docs/USER_GUIDE_DE.md) · [Français](README.md) · [Videotour](https://herve8940.github.io/BandPilot/VIDEO_TOUR.html)

BandPilot ist eine kostenlose lokale App zur Steuerung von Behringer X-Air und Midas M-Air: geführte Soundchecks, persönliche Monitormixe und REAPER-Proben am Computer. Windows, macOS, Linux und eigenständiges Android. BandPilot ist der neue Name von XR18 Studio.

**Mehrsprachige App: Englisch, Französisch, Italienisch, Spanisch und Deutsch.** Wählen Sie Ihre Sprache unter **Einstellungen → Optionen · Sprache**; Ihre Auswahl wird auf diesem Gerät gespeichert. Musiker können auf ihren Telefonen ihre eigene Sprache wählen. Weitere Sprachen können auf Anfrage hinzugefügt werden.

[Français](README.md) · [English](README.en.md) · [Italiano](README.it.md) · [Español](README.es.md) · [Deutsch](README.de.md)

![BandPilot 2.2.4 Expert Mischpult in Simulation](docs/images/bandpilot-2.2.4/expert-canal-de.jpg)

<!-- community:start -->

## Die BandPilot-Community auf Discord

Ein Ort, an dem Musiker einander bei Soundchecks, Monitormischungen, Proben und Aufnahmen helfen. Alle Instrumente, Bands und Erfahrungsstufen sind willkommen.

Stelle Fragen, teile Erfahrungen und schlage Verbesserungen für BandPilot vor. Austausch auf Französisch oder Englisch.

**[Discord beitreten](https://discord.gg/FtWwEPmwE7)** · [Kanäle entdecken](docs/COMMUNITY_DE.md)

### Discord direkt in BandPilot

Öffne in den neuen Versionen „Hilfe und Probleme“ über das Menü oder die Einstellungen: Hilfe in #entraide-help, Einstiegshilfe, Ideen und Fehlermeldungen in #bugs-tests. Die Nachricht enthält die App-Version: Prüfe sie, kopiere sie und sende sie selbst in Discord. Protokolle oder Audio werden nicht automatisch angehängt.

[Hilfe anfragen](https://discord.com/channels/1570533717917573260/1570534770297806888) · [Problem melden](https://discord.com/channels/1570533717917573260/1570534866049699882)
<!-- community:end -->

## Versionen und Verfügbarkeit

Desktop: [neueste stabile Version](https://github.com/herve8940/BandPilot/releases/latest) (Windows, macOS, Linux). Android: **2.4.0-android.3 Vorabversion**, separates APK.

[Downloads und Einschränkungen](https://herve8940.github.io/BandPilot/de.html#download)

Um Instrumente zu trennen, an Liedtexten zu arbeiten und Songs für REAPER vorzubereiten, entdecke [BandStudio (auf Englisch)](https://herve8940.github.io/BandStudio/en.html), eine eigenständige, ergänzende App.

## Neu: Technical Rider, Effekte und Android

Die erste eigenständige Android-Version ist als signierte APK verfügbar. Keine wöchentliche Neusignierung nötig. REAPER bleibt auf dem Computer.

- **Technical Rider und Bühnenplan** — Plane Eingänge, Musiker, Monitore und Anschlüsse. Platziere die Band auf dem Bühnenplan und drucke ihn aus oder exportiere ein PDF. Ein direkter Zugang ist im Soundcoach sichtbar.
- **Effekte für Quellen** — Wähle einen passenden Effekt für Stimme oder Instrument, prüfe den Vorschlag und dosiere ihn für jeden Monitormix. Übernimm das Ergebnis oder stelle die vorherigen Einstellungen wieder her.
- **Eigenständiges Android** — Installiere die APK auf einem kompatiblen Tablet und verbinde es direkt per WLAN mit dem Mischpult. Oberfläche, Steuerung und Daten laufen auf dem Tablet: ohne PC oder Docker.

[Android APK](https://github.com/herve8940/BandPilot/releases/download/android-v2.4.0-android.3/BandPilot-Android-2.4.0-android.3-universal.apk) · [Android-Anleitung (FR)](docs/ANDROID.md)

Android-Version: 2.4.0-android.3. Android 8+ und Android System WebView 111+. APK für ARM mit 32/64 Bit und x86_64; Hoch- und Querformat. Installation und Start auf einem Xiaomi Redmi Pad mit Android 14 geprüft; Funktion vom Nutzer bestätigt. Andere Tablets und Mischpultkombinationen müssen noch geprüft werden. Geräte mit 16-KB-Speicherseiten sind nicht zertifiziert. REAPER und die auf Aufnahmen basierende Klangwerkstatt bleiben Desktop-Funktionen.


## Funktionen
- Sechs-Schritte-Coach: Anschließen, Eingänge konfigurieren, Verstärkung messen, Fehler beheben, Monitore vorbereiten und speichern. Es liest Messungen, keine Audiodaten.
- Mischpult im einfachen und im Expertenmodus, kompakte Seitenleiste, Kanalbänke, EQ/Gate/Komprimierung/Sends/Busse/DCAs/FX/Routing, wie vom Modell unterstützt.
- Persönliche QR-Monitor-Links, Nur-Bus-Steuerungen, gespeicherte Profile und Pegelgrenzen und schrittweise Pegelerhöhungen.
- REAPER-Songs/Band-Probe: Abschnitte, gültige Takes, Wellenformen, projektbewusste Präsenz, Originalwiedergabe, Loops und Aufnahmemarkierungen.
- Showvorbereitung, Songbibliothek, Setlisten, dauerhafte Probennotizen, Szenen-JSON-Import/Export, Vorschauen und Backups.
- Modellbewusste Erkennung, schreibgeschützte Erstverbindung, optionale Konten, Diagnose und optional verbundene KI mit Ihrem eigenen Schlüssel.

Lokaler Betrieb erfordert kein Konto oder Internet; Mischpult, Computer und Telefone teilen sich ein Netzwerk. REAPER ist eine separate Software mit eigener Lizenz. Vernetzte KI ist optional und erfordert Internet.

## Kompatibilität ist modellspezifisch

**XR18** ist das am Gerät getestete Primärmodell. **X18/MR18** teilen Profile/Protokoll, benötigen aber dennoch eine eigene Hardwarevalidierung. **XR12/MR12** verfügen über angepasste 12-Eingangsprofile, 4 Mikrofonvorverstärker und 2 physische Aux-Ausgänge: Stereo-USB-Stick-Aufnahme, **kein PC-Multitrack-USB**. Die Hardwarevalidierung steht noch aus.

**X32-Varianten sind partiell und experimentell**: Mischen, EQ, Kerndynamik und Sends. Die vollständige Vorverstärker-/Routing-/FX-/Meter-/Szenen-/Coach-/Monitorsteuerung am Telefon-/USB-Integration ist weiterhin nicht verfügbar. Lesen Sie die [Matrix](docs/multi-model.md) vor dem Live-Einsatz.

## Fangen Sie an

Sichern Sie Szenen, installieren Sie das passende Paket, erkunden Sie die Simulation, entdecken Sie die schreibgeschützte Hardware und ziehen Sie dann **Mischpult → PC**, bevor Sie die Steuerung aktivieren. Folgen Sie dem [illustrierten Coach-Tutorial](docs/TUTO_MON_INGE_SON_DE.md). Installieren Sie Bridge **1.5.0** von Rehearse, speichern Sie Projekte und starten Sie REAPER neu. Die Mischpultsimulation simuliert keine REAPER-Audioeingänge. Pakete können nicht signiert/nicht notariell beglaubigt sein.

[Illustriertes Video und Transkript](docs/VIDEO_TOUR.md) · [Versionshinweise](docs/RELEASE_NOTES.md) · [Manuelle Korrekturen](docs/corrections-tests-manuels.md)

## Entwicklung und Validierung

Node.js 20+ (CI/Pakete: Node.js 22). `npm ci`, `npm --prefix web ci`, `npm run studio`; prüft: `npm test`, `npm run test:web`, `npm run build:all`; Pakete: `npm run desktop:package`.

Backend-Tests und React-Regressionen decken OSC, Szenen, FX, Konten, Monitore, REAPER/Lua und Modellprofile ab. Sie zertifizieren nicht die akustischen Ergebnisse oder jedes Hardwaremodell. Pakete werden nach Plattformprüfungen gemeinsam mit SHA-256-Prüfsummen veröffentlicht. Aus Kompatibilitätsgründen bleiben alte Datenbezeichner und REAPER-Pfade erhalten.

Unabhängiges MIT-Projekt, nicht verbunden mit Behringer, Midas oder Music Tribe. Marken gehören ihren Eigentümern.

Startup-Fix: [Anschlussfeld 2.2.1](docs/hotfix-2.2.1.md).

## BandPilot 2.2.2

[Persönliche Layouts und Monitorpult](docs/WORKSPACES.md#english): modell-/bildschirmspezifische Layouts, Mix/EQ/Komprimierung pro Musiker und Signalpfade. Enthält den [REAPER Bridge 1.2.3 Fix](docs/hotfix-2.2.2.md).

<!-- support:start -->
## BandPilot unterstützen

Mehr Zeit zum Spielen, weniger Zeit beim Suchen nach Einstellungen. BandPilot hilft Bands, ihren Soundcheck vorzubereiten und vertraute Einstellungen wiederzufinden – kostenlos und quelloffen.

Freiwillige Unterstützung schafft Zeit für Fehlerbehebungen, Mischpulttests und Anleitungen in fünf Sprachen. Erfahrungsberichte, Übersetzungen und das Weiterempfehlen des Projekts helfen ebenfalls.

[Auf Ko-fi unterstützen](https://ko-fi.com/bandpilot) · [So kannst du helfen](docs/SUPPORT_DE.md) · [Mitwirken](CONTRIBUTING.md)
<!-- support:end -->

[Sicherheit](SECURITY.md) · [Daten und Datenschutz](docs/PRIVACY.md) · [Hilfe](SUPPORT.md) · [MIT](LICENSE)
