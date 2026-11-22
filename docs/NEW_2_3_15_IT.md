---
lang: it
title: "BandPilot 2.3.15 — Console, MIDI e prove dal telefono"
---

# BandPilot 2.3.15 — Console, MIDI e prove dal telefono

[FR](NEW_2_3_15_FR.md) · [EN](NEW_2_3_15_EN.md) · [IT](NEW_2_3_15_IT.md) · [ES](NEW_2_3_15_ES.md) · [DE](NEW_2_3_15_DE.md)

BandPilot 2.3.15 riunisce nuovi controlli della console, richiami selettivi, gruppi software, MIDI e prove con REAPER sui telefoni dei musicisti.

Questa novità riguarda le app desktop Windows, macOS Intel/Apple Silicon e Linux. Android resta una distribuzione separata 2.4.0-android.5 e non comprende tutte le funzioni desktop descritte. BandStudio è un’app complementare indipendente.

- **Console e monitor** — Banchi e superfici personalizzabili, gruppi software, coppie stereo, meter e RTA. Controlli e destinazioni dipendono dal modello connesso e dal mix scelto.
- **Scene e preset** — Richiamo selettivo di ingressi, uscite ed effetti, protezioni per famiglia di parametri, anteprima e backup. Conversione esplicita di preset e scene portabili entro il perimetro X-Air/M-Air supportato.
- **Effetti e analisi** — Editor con nomi per i 61 algoritmi X-Air, tap tempo e GEQ/True EQ a 31 bande sulle uscite compatibili. Misure al microfono e correzioni da verificare e applicare esplicitamente.
- **MIDI e comandi** — Apprendimento di fader e mute, CC assoluti o relativi, note, Program Change, comandi preferiti e condizioni. Attivazione esplicita della sessione e backup per i comandi supportati.
- **Prove e schede** — Progetti REAPER aperti in schede, sezioni, loop, conteggio iniziale, take separate e responsabile dal telefono. Accordi e testi dalle schede BandStudio compatibili, anche a schermo intero.

## Primi passi

### 1. Installare e connettere

Installa l’ultima versione desktop dai download ufficiali ed esporta le scene importanti. Esplora la simulazione, scegli il modello corretto e connettiti in sola lettura. Leggi Console → PC prima di attivare il controllo.

### 2. Preparare la console

In Console → Expert scegli il mix principale o monitor e prepara banchi, gruppi e superfici. Un gruppo software regola canali o mandate selezionati; non crea un DCA hardware. Scegli separatamente l’ascolto di ogni musicista: spia, in-ear, cuffie o non ancora noto.

### 3. Richiamare una scena

In Scene e preset prepara protezioni e ambito del richiamo. Seleziona ingressi, uscite o FX e le destinazioni. Controlla i valori e conferma. La cronologia permette di preparare un ripristino. Salvare una preferenza, un gruppo o una selezione non modifica da solo l’audio.

### 4. Usare MIDI

Apri MIDI, scegli il dispositivo e apprendi un’assegnazione. Per un encoder relativo indica la codifica. Controlla i comandi prima di attivarli. Mantieni aperta la vista di controllo: chiusura, disconnessione o arresto disattivano la sessione. Il richiamo selettivo MIDI riguarda gli ingressi, esclusi gain, phantom, routing, uscite ed effetti.

### 5. Preparare REAPER

Reinstalla il bridge fornito con 2.3.15 anche se indica già 1.5.0, poi riavvia REAPER. Apri un progetto per scheda con i suoi media. In Prove → Con i miei brani scegli il progetto, verifica ingressi, tracce armate, traccia Originale e fine. REC crea una take separata nel progetto: verifica prima gli ingressi audio reali.

### 6. Assegnare il responsabile

In Monitor → Telefoni crea un link per musicista e assegna il responsabile dalla sua scheda. Sulla stessa rete locale il QR apre Il mio monitor, Il mio brano e Prove. Il ruolo è revocabile. Il responsabile sceglie brano, originale, accompagnamento o take, brano intero o sezione, loop e conteggio disponibili.

### 7. Leggere accordi e testi

Apri Il mio brano sul telefono e scegli Accordi, Testi o Entrambi. La scheda segue progetto e posizione REAPER. Schermo intero e schermo sempre acceso sono facoltativi. Se disponibile, il responsabile verifica la sincronizzazione della scheda sorgente BandStudio prima di condividerla; Tornare alla scheda esportata annulla la scelta. Le schede mancanti non vengono generate automaticamente.

## Limiti e verifiche

Preset e correzioni sono punti di partenza. Le misure al microfono dipendono da calibrazione, posizione, rumore e percorso audio; nessun risultato sonoro universale è garantito. Una registrazione già distorta per clipping non può essere recuperata. La conversione portabile riguarda ingressi mono indipendenti e parametri selezionati, non tracce collegate o X32. X32 resta parziale e sperimentale. MIDI non implica MCU/HUI, SysEx o fader motorizzati. Test software e simulazione non certificano ogni console, controller o ambiente. La simulazione della console non simula REAPER: la registrazione usa ingressi audio reali.

Le vecchie immagini della guida generale e il video 2.2 sono illustrazioni storiche. Questo tutorial descrive il percorso 2.3.15.

[BandPilot](https://herve8940.github.io/BandPilot/it.html#download) · [GitHub](https://github.com/herve8940/BandPilot/releases/latest) · [Discord](https://discord.gg/FtWwEPmwE7)
