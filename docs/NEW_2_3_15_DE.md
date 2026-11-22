---
lang: de
title: "BandPilot 2.3.15 — Mischpult, MIDI und Proben per Smartphone"
---

# BandPilot 2.3.15 — Mischpult, MIDI und Proben per Smartphone

[FR](NEW_2_3_15_FR.md) · [EN](NEW_2_3_15_EN.md) · [IT](NEW_2_3_15_IT.md) · [ES](NEW_2_3_15_ES.md) · [DE](NEW_2_3_15_DE.md)

BandPilot 2.3.15 verbindet neue Mischpultsteuerung, selektiven Szenenabruf, Softwaregruppen, MIDI und REAPER-Proben auf den Smartphones der Musiker.

Diese Aktualisierung betrifft die Desktop-Apps für Windows, macOS Intel/Apple Silicon und Linux. Android bleibt eine separate Version 2.4.0-android.5 und enthält nicht alle hier beschriebenen Desktop-Funktionen. BandStudio ist eine eigenständige ergänzende App.

- **Mischpult und Monitore** — Anpassbare Bänke und Oberflächen, Softwaregruppen, Stereopaare, Pegelanzeigen und RTA. Verfügbare Regler und Ziele hängen vom verbundenen Modell und gewählten Mix ab.
- **Szenen und Presets** — Selektiver Abruf von Eingängen, Ausgängen und FX, Schutz nach Parameterfamilie, Vorschau und Sicherung. Ausdrückliche Konvertierung von Presets und portablen Szenen innerhalb des unterstützten X-Air/M-Air-Umfangs.
- **Effekte und Analyse** — Benannte Editoren für die 61 X-Air-Algorithmen, Tap Tempo und 31-Band-GEQ/True-EQ für passende Ausgänge. Mikrofonmessungen und Korrekturvorschläge müssen geprüft und bewusst angewendet werden.
- **MIDI und Befehle** — Anlernen von Fadern und Mutes, absolute oder relative CC, Noten, Program Change, Favoriten und Bedingungen. Ausdrückliche Aktivierung pro Sitzung und Sicherung bei unterstützten Befehlen.
- **Proben und Songblätter** — Geöffnete REAPER-Projekttabs, Abschnitte, Schleifen, Einzählen, getrennte Takes und Probenleitung per Smartphone. Akkorde und Texte aus kompatiblen BandStudio-Songblättern, optional im Vollbild.

## Erste Schritte

### 1. Installieren und verbinden

Installiere die aktuelle Desktop-Version aus den offiziellen Downloads und exportiere wichtige Szenen. Erkunde die Simulation, wähle das richtige Modell und verbinde zunächst schreibgeschützt. Lies Mischpult → PC ein, bevor du die Steuerung aktivierst.

### 2. Mischpult vorbereiten

Wähle unter Console → Expert den Haupt- oder Monitormix und bereite Bänke, Gruppen und Oberflächen vor. Eine Softwaregruppe verändert gewählte Kanäle oder Sends; sie erzeugt keinen Hardware-DCA. Wähle den Abhörweg jedes Musikers getrennt: Bodenmonitor, In-Ears, Kopfhörer oder noch unbekannt.

### 3. Szene abrufen

Bereite unter Szenen und Presets Schutz und Abrufumfang vor. Wähle Eingänge, Ausgänge oder FX sowie ihre Ziele ausdrücklich aus. Prüfe die Werte und bestätige. Der Verlauf erlaubt die Vorbereitung einer Wiederherstellung. Das Speichern einer Einstellung, Gruppe oder Auswahl verändert allein noch keinen Audioparameter.

### 4. MIDI verwenden

Öffne MIDI, wähle das Gerät und lerne eine Zuweisung an. Gib bei relativen Encodern das Format an. Prüfe Befehle vor der Aktivierung. Halte die Steueransicht offen; Schließen, Verbindungsabbruch oder Stopp deaktivieren die Sitzung. Selektiver MIDI-Abruf betrifft Eingänge, ohne Gain, Phantomspannung, Routing, Ausgänge und FX.

### 5. REAPER vorbereiten

Installiere die mit 2.3.15 gelieferte Bridge erneut, auch wenn bereits 1.5.0 angezeigt wird, und starte REAPER neu. Öffne ein Projekt pro Tab mit seinen Medien. Wähle unter Proben → Mit meinen Songs das Projekt und prüfe Eingänge, aufnahmebereite Spuren, Originalspur und Ende. REC erzeugt einen getrennten Take in diesem Projekt; prüfe vorher die echten Audioeingänge.

### 6. Probenleitung zuweisen

Erstelle unter Monitore → Smartphones einen Monitorlink pro Musiker und weise auf dessen Karte die Probenleitung zu. Im selben lokalen Netzwerk öffnet der QR Mein Monitor, Mein Song und Proben. Die Rolle ist widerrufbar. Die Leitung wählt Song, Original, Begleitung oder Take, ganzen Song oder Abschnitt sowie verfügbare Schleifen- und Einzähloptionen.

### 7. Akkorde und Texte lesen

Öffne auf dem Smartphone Mein Song und wähle Akkorde, Text oder Beides. Das Blatt folgt REAPER-Projekt und Wiedergabeposition. Vollbild und Bildschirm wach halten sind optional. Wird ein BandStudio-Quellblatt angeboten, prüft die Leitung dessen Timing vor der Freigabe; Zum exportierten Blatt zurückkehren nimmt diese Wahl zurück. Fehlende Blätter werden nicht automatisch erzeugt.

## Umfang und Prüfung

Presets und Korrekturen sind Ausgangspunkte. Mikrofonmessungen hängen von Kalibrierung, Position, Hintergrundgeräusch und Signalweg ab; ein universelles Klangergebnis ist nicht garantiert. Bereits übersteuerte Aufnahmen lassen sich damit nicht wiederherstellen. Portable Konvertierung umfasst unabhängige Monoeingänge und ausgewählte Parameter, keine gekoppelten Spuren oder X32-Konvertierung. X32 bleibt teilweise und experimentell unterstützt. MIDI bedeutet keine MCU/HUI-, SysEx- oder Motorfader-Unterstützung. Softwaretests und Simulation zertifizieren nicht jedes Pult, jeden Controller oder Raum. Die Mischpultsimulation simuliert REAPER nicht: Aufnahmen nutzen echte Audioeingänge.

Ältere Bilder der allgemeinen Anleitung und das Video 2.2 sind historische Darstellungen. Diese Anleitung beschreibt den Ablauf in 2.3.15.

[BandPilot](https://herve8940.github.io/BandPilot/de.html#download) · [GitHub](https://github.com/herve8940/BandPilot/releases/latest) · [Discord](https://discord.gg/FtWwEPmwE7)
