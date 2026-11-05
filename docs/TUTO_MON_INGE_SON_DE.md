# BandPilot 2.2 – Soundcheck-Coach, Schritt für Schritt

[Français](TUTO_MON_INGE_SON.md) · [English](TUTO_MON_INGE_SON_EN.md) · [Italiano](TUTO_MON_INGE_SON_IT.md) · [Español](TUTO_MON_INGE_SON_ES.md) · [Deutsch](TUTO_MON_INGE_SON_DE.md)

[Français](TUTO_MON_INGE_SON.md) · [Vollständiger Leitfaden](USER_GUIDE_DE.md) · [Videotour](VIDEO_TOUR.md)

Der Coach unterstützt Sie beim Soundcheck. Es empfängt kein Audio und ersetzt auch nicht das Zuhören. Dieser Workflow gilt für unterstützte X-Air/M-Air-Modelle, **nicht X32** in dieser Version. Neue Screenshots zeigen Simulation. Überprüfen Sie die [Hardware-Grenzwerte](multi-model.md). UI-Beschriftungen in den Aufnahmen sind französisch.

![Soundcheck-Dashboard](images/bandpilot-2.2.4/coach.jpg)

## 1. Verbinden

Halten Sie Ausgänge und Kopfhörer niedrig. Verbinden Sie Computer und Mischpult mit einem lokalen Netzwerk. Entdecken Sie das Mischpult in den Einstellungen, überprüfen Sie sein Modell und starten Sie ihn schreibgeschützt. Ziehen Sie **Mischpult → PC** und speichern Sie eine Backup-Szene. Aktivieren Sie die Kontrolle nur für beabsichtigte Änderungen. Die Simulation dient der Erkundung und liefert keine realen Messungen.

![Verbindung und Simulation](images/bandpilot-2.2.4/connexion.jpg)

## 2. Beschreiben Sie Ihre Eingaben

Öffnen Sie den Eingabekonfigurationsschritt. Wählen Sie eine Bandvorlage oder fügen Sie tatsächliche Instrumente und Buchsen hinzu. Überprüfen Sie die Eingänge für Stimme, Bass, Gitarren und Mono/Stereo-Schlagzeug. Detaillierte Trommeln müssen der echten Mikrofonverkabelung folgen. Die Eingangs- und Vorverstärkergrenzen hängen vom Modell ab. Ein vorbereitetes Bandprofil benennt Hardware nicht stillschweigend um.

Überprüfen Sie die Vorschläge für Hochpass, Gate, EQ und Kompressor. Die Schwellenwerte hängen von den tatsächlichen Eingangspegeln ab. Der Trainer ändert die Phantomspeisung nicht stillschweigend.

## 3. Verstärkung messen

Lassen Sie einen Musiker die lauteste erwartete Passage spielen. Messung starten. Wiederholen Sie diesen Vorgang, wenn Daten fehlen, zu leise oder zu kurz sind. Überprüfen Sie die vorgeschlagene Verstärkung und sehen Sie sich eine Vorschau an, bevor Sie sie anwenden, und messen Sie dann erneut: Die alte Messung stammt aus der Zeit vor der Änderung. Ein Line-Eingang ohne steuerbaren Mikrofonvorverstärker darf keine künstliche Vorverstärkersteuerung aufweisen.

## 4. Zuhören und Fehler beheben

Beschreiben Sie, was Sie hören, und ändern Sie jeweils eine Sache. Wenn ein Vorschlag mit einem EQ-Filtertyp nicht kompatibel ist, überprüfen Sie den Kanal im Expertenmodus, anstatt ihn zu erzwingen.

![Kompressor- und EQ-Übersicht](images/bandpilot-2.2.4/expert-canal.jpg)

Direktfader wirken sofort, wenn die Steuerung aktiviert wird. Geführte Änderungen nutzen Vorschau, Sicherung und Rückgängigmachen. Das Rückgängigmachen der letzten geführten Änderung ist keine universelle Geschichte manueller Aktionen. Analysen und A/B-Vergleiche erfordern verfügbare Hardwaremessungen und menschliches Zuhören. Die optionale vernetzte KI erfordert Ihren eigenen Schlüssel und Internet; Beratung vor Ort bleibt weiterhin verfügbar.

## 5. Monitore vorbereiten

Fügen Sie jeden Musiker, jede Rolle, jede Quelle und jeden Bus hinzu. Überprüfen Sie die physischen Buchsen: XR18/MR18/X18 verfügen über sechs Aux-Ausgänge; XR12/MR12 haben trotz ihrer internen Busse zwei. Starten Sie vor dem Fader, damit die Hauptfader-Änderungen nicht automatisch in ihre Ohren übertragen werden.

![Monitormatrix](images/bandpilot-2.2.4/regie-retours.jpg)

Wenden Sie einen Startmix auf niedrigen Ebenen an, erstellen Sie persönliche Links, starten Sie die lokale Freigabe und scannen Sie jeden QR im selben Netzwerk. Jeder Musiker kontrolliert nur seinen Bus. Speichern Sie bei Bedarf ein Profil und beenden Sie anschließend die Freigabe. Pegelobergrenzen und -begrenzer allein garantieren keine sicheren Hörpegel.

## 6. Speichern Sie Ihren Soundcheck

Speichern Sie eine benannte Szene und exportieren Sie JSON als Backup. Überprüfen Sie vor dem Rückruf das Modell und die Synchronisierungsrichtung. Der geführte Rückruf schließt Phantomspeisung standardmäßig aus und behält einen vorherigen Zustand bei. Vollständige X32-Szenen und automatische modellübergreifende Konvertierungen sind nicht verfügbar.

Notizen und aktive Setlists bleiben in der Anwendungsdatenbank, auch wenn sich der lokale Port ändert.

![Notizen und Speicherbestätigung](images/bandpilot-2.2.4/notes.jpg)

Befolgen Sie für die Aufnahme und Wiedergabe die [REAPER-Proben](USER_GUIDE_DE.md#reaper). Die Mischpult-Simulation simuliert kein REAPER-Audio.
