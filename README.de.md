# BandPilot

[Français](README.md) · [English](README.en.md) · **Deutsch** · [Español](README.es.md) · [Italiano](README.it.md)

**Vom Soundcheck zum Auftritt.** Bereite die Eingänge deiner Band vor, stelle für jeden Musiker einen Monitormix ein und behalte die Setlist im Blick. BandPilot steuert dein Mischpult über das lokale Netzwerk.

[BandPilot herunterladen](https://herve8940.github.io/BandPilot/de.html#download) · [Erste Schritte](docs/USER_GUIDE_DE.md) · [Versionshinweise](docs/RELEASE_NOTES.md#release-de)

[![Mischpult · Französische Oberfläche im Simulationsmodus](docs/images/bandpilot-3.0/hero.jpg)](https://herve8940.github.io/BandPilot/de.html#view-mixer)

## BandPilot installieren

| Desktop-Version 3.0.0 | Downloads |
| --- | --- |
| Windows | [Windows (.exe)](https://github.com/herve8940/BandPilot/releases/download/v3.0.0/BandPilot-Windows-3.0.0.exe) |
| macOS | [Apple Silicon](https://github.com/herve8940/BandPilot/releases/download/v3.0.0/BandPilot-macOS-3.0.0-arm64.dmg) · [Intel](https://github.com/herve8940/BandPilot/releases/download/v3.0.0/BandPilot-macOS-3.0.0-x64.dmg) |
| Linux | [AppImage](https://github.com/herve8940/BandPilot/releases/download/v3.0.0/BandPilot-Linux-3.0.0-x86_64.AppImage) · [Debian / Ubuntu](https://github.com/herve8940/BandPilot/releases/download/v3.0.0/BandPilot-Linux-3.0.0-amd64.deb) |

[Alle Dateien und SHA-256-Prüfsummen](https://github.com/herve8940/BandPilot/releases/tag/v3.0.0)

**Eigenständige Android-App.** Auf einem Android-Tablet steuert die APK das Pult ohne Computer. Für den persönlichen Monitormix auf dem Smartphone genügt der QR-Code deiner Band. [APK herunterladen · 2.4.0-android.5](https://github.com/herve8940/BandPilot/releases/download/android-v2.4.0-android.5/BandPilot-Android-2.4.0-android.5-universal.apk)

## Dein erster Soundcheck

1. Installiere BandPilot und erkunde die Bedienelemente in der Simulation.
2. Verbinde Computer und Mischpult mit demselben lokalen Netzwerk und wähle das erkannte Pult aus.
3. Wähle die Instrumente und prüfe die Eingänge und Monitorausgänge, bevor du den Soundcheck bestätigst.

Beginne mit einer leeren oder gespeicherten Szene. Wenn du einen neuen Soundcheck für die Band bestätigst, werden unbenutzte Eingänge und ihre Sends stumm. Vorverstärkung und Phantomspeisung bleiben erhalten. Weise jedem Musiker einen Ausgang zu. Unter Monitore → Telefone kannst du den QR-Code für seinen Mix im lokalen Netz teilen. Beim Speichern der Besetzung werden die Links aktualisiert, ohne den Klang zu ändern.

Lege bei der Probe die Reihenfolge der Stücke fest. Beim Auftritt kannst du der Setlist folgen und das PDF zum aktuellen Stück öffnen. Am Computer verbindet die REAPER-Erweiterung Probenprojekte mit deinem Repertoire. REAPER ist separat erhältlich.

[Anleitung zum geführten Soundcheck](docs/TUTO_MON_INGE_SON_DE.md) · [Offizielle Website](https://herve8940.github.io/BandPilot/de.html)

## Mischpulte

- **Behringer XR18 / X18 · Midas MR18** — Sechs physische Aux-Ausgänge für Monitore. Die XR18 wurde an echter Hardware erkannt. Das MR18-Profil wurde in der Simulation geprüft.
- **Behringer XR12 · Midas MR12** — Zwei physische Aux-Ausgänge für Monitore. Der USB-Recorder nimmt in Stereo auf. Mehrspuraufnahmen am Computer erfordern ein anderes Modell.
- **Behringer X32 · Rack · Compact · Producer · Core** — Teilweise und experimentell unterstützt. Grundlegende Mischfunktionen und Bus-Sends sind verfügbar. Vollständige Szenen und Monitormixe am Telefon sind noch in Entwicklung.

[Detaillierte Kompatibilitätstabelle (FR)](docs/multi-model.md)

## Das Projekt lokal starten

Führe mit Node.js ab Version 22.13 im Hauptverzeichnis des Repositorys die folgenden Befehle aus und öffne die von Vite angezeigte Adresse.

```sh
npm run ci:deps
npm --prefix web ci
npm run studio
```

[Mitwirken](CONTRIBUTING.md) · [Problem melden](https://github.com/herve8940/BandPilot/issues/new/choose) · [MIT-Lizenz](LICENSE)

<!-- community:start -->
## Die BandPilot-Community auf Discord

Stelle Fragen, teile Erfahrungen und schlage Verbesserungen für BandPilot vor. Austausch auf Französisch oder Englisch.

[Discord beitreten](https://discord.gg/FtWwEPmwE7) · [Kanäle entdecken](docs/COMMUNITY_DE.md)
<!-- community:end -->

<!-- community-badge:start -->
[![Discord](https://img.shields.io/badge/Discord-BandPilot-5865F2?logo=discord&logoColor=white)](https://discord.gg/FtWwEPmwE7)
<!-- community-badge:end -->

<!-- support:start -->
## BandPilot unterstützen

Freiwillige Unterstützung schafft Zeit für Fehlerbehebungen, Mischpulttests und Anleitungen in fünf Sprachen. Erfahrungsberichte, Übersetzungen und das Weiterempfehlen des Projekts helfen ebenfalls.

[Auf Ko-fi unterstützen](https://ko-fi.com/bandpilot) · [So kannst du helfen](docs/SUPPORT_DE.md) · [Mitwirken](CONTRIBUTING.md)
<!-- support:end -->
