<div align="center">

# XR18 Studio

**A pocket sound engineer for the Behringer XR18**

[![Latest version](https://img.shields.io/github/v/release/herve8940/xr18-studio?label=version&color=3ee0e0)](https://github.com/herve8940/xr18-studio/releases/latest) [![Downloads](https://img.shields.io/github/downloads/herve8940/xr18-studio/total?color=2b7cf6)](https://github.com/herve8940/xr18-studio/releases) [![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE) [![Windows · macOS · Linux](https://img.shields.io/badge/Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-free-555)](https://github.com/herve8940/xr18-studio/releases/latest)

A **free** app to control a **Behringer XR18, X18 or MR18** digital mixer: an X-AIR Edit alternative designed for beginners. It offers a step-by-step assistant, a clear console, and each musician's in-ear mix on their own phone.

[🇫🇷 Français](README.md) · 🇬🇧 English

[**⬇️ Download**](https://github.com/herve8940/xr18-studio/releases/latest) · [**🌐 Website**](https://herve8940.github.io/xr18-studio/en.html) · [**📘 “Mon ingé son” tutorial**](docs/TUTO_MON_INGE_SON_EN.md) · [Full guide](docs/USER_GUIDE_EN.md) · [Release notes](docs/RELEASE_NOTES.md)

<img src="docs/images/hero.png" alt="XR18 Studio: the Mon ingé son assistant and a musician's monitor page on a phone" width="900">

Windows · macOS (Intel and Apple Silicon) · Linux · also works with X18 and MR18

</div>

---

## Who is it for?

**Bands without a sound engineer**: rehearsals, small venues, bars, parties… You have an XR18, mics and musicians, and you want a good sound **without learning the jargon**.

XR18 Studio controls your console like X-AIR Edit, plus:

| 🎧 **“Mon ingé son”** | 🎚️ **A clear console** | 📱 **Monitors on phones** |
|---|---|---|
| A 6-step assistant: it sets up each instrument with live best practice, sets the gains with you and prepares the monitor mixes. | A **Simple** mode with big faders for the show, and a full **Expert** mode with live analysis, every option explained. | Each musician scans their QR code and adjusts **their own** mix. No app to install, and nothing else they can touch. |

## 🎧 “Mon ingé son” in 6 steps

| 1. Pick your instruments | 2. Set the gains | 3. Prepare the monitors |
|---|---|---|
| ![Pick instruments](docs/images/tuto-coach-batterie.png) | ![Set gains](docs/images/tuto-coach-gain.png) | ![Musicians' monitors](docs/images/tuto-coach-retours.png) |
| Vocals, rhythm and lead guitar, bass, detailed drums (kick, snare, 3 toms, 2 overheads)… Picking an instrument offers its **complete setting**: high-pass, EQ, compressor, gate, stereo position. | Each musician plays loud, alone. The coach **measures**, proposes the right gain, then **fits compressor and gate to your real signal**. | One mix per musician based on their role: the bassist gets bass and kick locked together, and the drummer gets no cymbals since they are already loud. Then QR codes in one click. |

**Nothing changes without your OK.** Every change goes through a before/after window, a backup is made, and one button undoes it all.

👉 **[The illustrated step-by-step tutorial for beginners](docs/TUTO_MON_INGE_SON_EN.md)**

> The app's interface is in French; the guides and tutorial are available in English.

## 🎚️ The console

| Simple mode (show) | A musician's mix | Expert mode (X-AIR Edit style) |
|---|---|---|
| ![Simple console](docs/images/tuto-simple.png) | ![Monitor mix](docs/images/tuto-simple-retour.png) | ![Expert console](docs/images/tuto-expert.png) |

| Live analysis | Check by ear | EQ |
|---|---|---|
| ![Live analysis](docs/images/tuto-analyse.png) | ![Check by ear](docs/images/tuto-analyse-valider.png) | ![EQ](docs/images/tuto-expert-eq.png) |

- **6 views in Expert mode**: Console, Channel, Ears, Effects, Routing, Analysis.
- **Live analysis**: mix spectrum, “Who plays where” map and recommendations to compare A / B before applying them. Nothing changes without your click.
- **Rehearsal mode**: the Main stays muted and locked, you only work on the ears.
- **Simple mode for the show**: every track on screen and the menu folds automatically. In Expert mode, the last strip may need a little scrolling at 1440 px.
- **Start from a blank scene** in one click: the whole mixer goes back to neutral with levels down, without touching 48 V, gains or routing, and it can be undone.
- **Each view explains** every control in plain words: see the [console guide](docs/GUIDE_CONSOLE.md) (in French).

## 📱 Monitors on the phone

| Musicians' QR codes | The musician's page |
|---|---|
| ![QR codes](docs/images/tuto-share.png) | <img src="docs/images/tuto-inge/17-telephone.png" alt="Musician page" width="260"> |

Each link is **personal**: a musician only sees their own mix. Volume is capped to protect ears. A lost link is replaced in one click.

## ⬇️ Install

Download the file for your computer from the [**releases page**](https://github.com/herve8940/xr18-studio/releases/latest). Everything is included; there is nothing else to install.

| Computer | File |
|---|---|
| Windows | `XR18-Studio-Windows-….exe` |
| Apple Silicon Mac (M1, M2, M3…) | `XR18-Studio-macOS-…-arm64.dmg` |
| Intel Mac | `XR18-Studio-macOS-…-x64.dmg` |
| Ubuntu / Debian | `.deb` |
| Other Linux | `.AppImage` |

The installers are not signed with a commercial certificate:

- **Mac**: the first time, **right-click › Open**. To find the console, then allow **Local Network** in *System Settings › Privacy & Security*.
- **Windows**: if SmartScreen appears, click **More info › Run anyway**.

Details: [installing the app](docs/USER_GUIDE_EN.md).

## 🚀 Get started in 5 minutes

1. Put the computer and the XR18 on the **same network** (the console's Wi-Fi or the band's router).
2. Open XR18 Studio: the console is **found automatically**, like in X-AIR Edit.
3. Go to **Jouer › Mon ingé son** and follow the steps.

No console at hand? Explore everything in **simulation mode**.

## 📚 Documentation

| | |
|---|---|
| 📘 [“Mon ingé son” tutorial](docs/TUTO_MON_INGE_SON_EN.md) | The guided journey, fully illustrated, for beginners |
| 📗 [Full guide](docs/USER_GUIDE_EN.md) | Install, connect, console, monitors, scenes, troubleshooting |
| 🎚️ [Console guide](docs/GUIDE_CONSOLE.md) | Every option of every view (French) |
| 🔧 [Coach technical details](docs/INGE_SON.md) | Per-instrument values, gain and threshold rules (French) |
| 📝 [Release notes](docs/RELEASE_NOTES.md) | What changed |

## ⚠️ Good to know

- The coach reads the console's **settings and levels**, **not the audio**: listening advice comes from your description.
- Proposed values are **starting points** from live best practice: your ears have the final say.
- Always run a full test on your console **before a show**.

<details>
<summary><b>For developers</b></summary>

```sh
npm run setup      # dependencies
npm run studio     # local server + interface
npm test           # tests
npm run build:all  # backend and interface
npm run desktop:package
```

Installers are built by GitHub Actions: the “Desktop packages” workflow runs on every PR, and the “Release” workflow runs when the `package.json` version changes on `main`.

- There is a single OSC engine: the interface, the musicians' pages and MCP all go through its API and permissions.
- Connecting or reading never changes the mix.
- Console gestures are sent immediately, then read back from the XR18.
- 48 V, routing and effect types go through preview and confirmation.

References: [X-AIR Edit alignment and OSC protocol](docs/XAIR_EDIT_PARITY.md) · [desktop app](docs/DESKTOP_MULTIPLATEFORME.md)

</details>

---

<div align="center">
XR18 Studio is free software under the <a href="LICENSE">MIT License</a>, by Hervé Naessens.<br>Independent project, not affiliated with Behringer / Music Tribe. XR18, X18, MR18 and X-AIR are trademarks of their respective owners.
</div>
