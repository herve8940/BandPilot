---
lang: en
title: "BandPilot 2.3.15 — Mixer control, MIDI and phone rehearsals"
---

# BandPilot 2.3.15 — Mixer control, MIDI and phone rehearsals

[FR](NEW_2_3_15_FR.md) · [EN](NEW_2_3_15_EN.md) · [IT](NEW_2_3_15_IT.md) · [ES](NEW_2_3_15_ES.md) · [DE](NEW_2_3_15_DE.md)

BandPilot 2.3.15 brings together new mixer controls, selective recall, software groups, MIDI and REAPER rehearsals on musicians’ phones.

This update concerns the Windows, Intel/Apple Silicon macOS and Linux desktop apps. Android remains a separate 2.4.0-android.5 release and does not include every desktop feature described here. BandStudio is an independent companion app.

- **Mixer and monitors** — Custom banks and surfaces, software groups, stereo pairs, meters and RTA. Available controls and destinations depend on the connected model and selected mix.
- **Scenes and presets** — Selective input, output and FX recall, protection by parameter family, preview and backup. Explicit preset and portable scene conversion within the supported X-Air/M-Air scope.
- **Effects and analysis** — Named editors for the 61 X-Air algorithms, tap tempo and 31-band GEQ/True EQ on supported outputs. Microphone measurements and correction proposals require user review and explicit application.
- **MIDI and commands** — Fader and mute learning, absolute or relative CC, notes, Program Change, favorite commands and conditions. Explicit session activation and backups for supported commands.
- **Rehearsal and song sheets** — Open REAPER project tabs, sections, loops, count-in, separate takes and a phone rehearsal manager. Compatible BandStudio song sheets provide chords and lyrics with an optional full-screen view.

## Get started

### 1. Install and connect

Install the latest desktop version from the official downloads. Export important scenes. Explore simulation, select the correct model and connect read-only. Read Mixer → PC before enabling control.

### 2. Prepare the mixer

In Console → Expert, select the main or monitor mix and prepare banks, groups and surfaces. A software group adjusts selected channels or sends; it does not create a hardware DCA. Set each musician’s listening context independently: wedge, in-ears, headphones or unknown.

### 3. Recall a scene

In Scenes and presets, prepare protections and recall scope. Explicitly select inputs, outputs or FX and their destinations. Review target values, then confirm. Use history to prepare a backup restoration. Saving a preference, group or selection does not itself change audio.

### 4. Use MIDI

Open MIDI, select the device and learn an assignment. Specify the encoding for a relative encoder. Select and review commands before activation. Keep the control view open; closing it, disconnecting or stopping disables the session. MIDI selective recall covers inputs, excluding gain, phantom power, routing, outputs and FX.

### 5. Prepare REAPER

Reinstall the bridge supplied with 2.3.15, even if it already displays version 1.5.0, then restart REAPER. Open one project per tab with its media. In Rehearse → With my songs, select the project and check its inputs, armed tracks, Original track and ending. REC creates a separate take in that project; verify real audio inputs before trying it.

### 6. Assign the manager

In Monitors → Phones, create each musician’s monitor link and assign the rehearsal manager on their card. On the same local network, their QR opens My monitor, My song and Rehearse. The role can be revoked. The manager chooses a song, original, backing or take, the full song or a section, and available loop/count-in options.

### 7. Read chords and lyrics

Open My song on a phone and select Chords, Lyrics or Both. The sheet follows the REAPER project and playback position. Full screen and keeping the screen awake are optional. If a BandStudio source sheet is offered, the manager checks its timing before sharing it; Return to exported sheet reverses this choice. Missing sheets are not generated automatically.

## Scope and validation

Presets and corrections are starting points. Microphone measurements depend on calibration, placement, background noise and signal path; they do not guarantee a universal sound. Processing cannot recover an already clipped recording. Portable conversion covers independent mono inputs and selected parameters; linked tracks and X32 conversion are excluded. X32 remains partial and experimental. MIDI does not imply MCU/HUI, SysEx or motorized-fader support. Software tests and simulation do not certify every mixer, controller or acoustic setup. Mixer simulation does not simulate REAPER: recording uses its real audio inputs.

Older general-guide screenshots and the 2.2 video tour are historical illustrations. This tutorial describes the 2.3.15 workflow.

[BandPilot](https://herve8940.github.io/BandPilot/en.html#download) · [GitHub](https://github.com/herve8940/BandPilot/releases/latest) · [Discord](https://discord.gg/FtWwEPmwE7)
