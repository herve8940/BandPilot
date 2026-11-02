# “Mon ingé son” tutorial: make your band sound good, step by step

[🇫🇷 Version française](TUTO_MON_INGE_SON.md) · [Full guide](USER_GUIDE_EN.md) · [Back to the project](https://github.com/herve8940/xr18-studio/blob/main/README.en.md)

This tutorial is for you if **you are not a sound engineer** and want a good band sound on your Behringer XR18 without the jargon. You follow 6 steps in order. On every screenshot, the **orange numbers** match the list below it.

The app's interface is in French, so button names are shown in French, *with the English meaning in italics*.

> **Time**: about 45 minutes the first time, 15 minutes afterwards.
> **You need**: the XR18 switched on and on the same network as the computer, mics and instruments plugged in, and musicians ready to play.

## The 3 golden rules

| | |
|---|---|
| 🔒 **Nothing changes without you** | Before every change, a window shows what will change. You accept or cancel. |
| ↩️ **Everything can be undone** | **Annuler le dernier réglage guidé** *(undo last guided change)* restores everything. |
| 🔉 **Keep volumes low at first** | Keep speakers and in-ears low while preparing. The coach never touches 48 V. |

## The journey at a glance

| Step | What you do | What the coach does |
|---|---|---|
| **1. Connect** | Link the XR18 | Checks the console answers |
| **2. Who is plugged where** | Pick each input's instrument | Prepares each instrument's complete setting |
| **3. Set the gain** | Each musician plays loud, alone | Measures, sets the gain, fits compressor and gate |
| **4. Listen and fix** | Say what bothers you | Suggests a small correction |
| **5. Monitors** | Check who hears what | Prepares each musician's mix and QR code |
| **6. Keep the good setting** | Give it a name | Saves the whole mix |

---

## Before you start: finding the coach

![Mon ingé son home](images/tuto-inge/01-accueil.png)

1. **Jouer › Mon ingé son** *(Play › My sound engineer)* in the left menu.
2. **Les mots du son** *(sound words)*: a glossary explaining each technical word in one sentence.
3. **The 6 steps**. Click a step to open it. Steps get a check mark when you validate them.
4. **Console status**: “XR18 connectée” *(connected)* or “Entraînement sans console” *(practice without a console)*.

![Glossary](images/tuto-inge/02-lexique.png)

1. Gain, compressor, gate, bleed, pre-fader… Each word is explained simply.

---

## Step 1: Connect

![Step 1](images/tuto-inge/03-connecter.png)

1. **Connecter ma XR18** *(connect my XR18)* opens the connection page. The app finds the console by itself, like X-AIR Edit.
2. Once connected, **Préparer mon groupe** *(prepare my band)* goes to the next step.

> 💡 **On a Mac**, if the console is not found: *System Settings › Privacy & Security › Local Network*, then allow XR18 Studio.
> Without a console, you can explore everything in **simulation**: nothing is measured or invented, but you see the whole journey.

---

## Step 2: Who is plugged in where

### Pick a band template

![Pick a template](images/tuto-inge/04-modele.png)

1. **Partir d’une scène vierge** *(start from a blank scene)*, optional: if the console still holds another band’s or an old show’s settings, everything goes back to neutral with levels down. 48 V, gains and routing are left alone.
2. **Pick the template closest to your band.** Here: rock with a detailed acoustic kit (vocals, backing vocals, 2 guitars, bass, kick, snare, 3 toms, 2 overheads).
3. **Ajouter la batterie détaillée** *(add the detailed drum kit)* adds kick, snare, tom 1, tom 2, tom 3, OH 1 and OH 2 on free inputs.

Nothing is sent to the console yet: you are only preparing the list.

### Set each instrument

![An instrument row](images/tuto-inge/05-instrument.png)

1. **Prise** *(input)*: the XR18 input number where the cable is plugged in. Check it on the console!
2. **Instrument**: as soon as you pick it, the coach offers **its complete setting**.
3. **Nom sur la console** *(name on the console)*: 12 characters maximum.
4. **Ce que je règle** *(what I set)*: what each setting does, in plain words.
5. **Appliquer** *(apply)* sends the setting for **this instrument only**.

### The check window

Every time, a window shows what will change **before** the sound is touched.

![Check window](images/tuto-inge/06-fenetre.png)

1. What will be done, and for which instrument.
2. **Voir le détail** *(see details)*: the full before/after list.
3. **The X** closes without changing anything. Escape or a click outside also works.
4. **Annuler, ne rien changer** *(cancel, change nothing)*.
5. **Appliquer sur ma XR18** *(apply to my XR18)* sends the settings. A backup is made just before.

### The whole band at once

![Apply to the whole band](images/tuto-inge/07-tout-le-groupe.png)

1. **Appliquer à tout le groupe** *(apply to the whole band)* sets **every** instrument at once.
2. **Étape suivante : régler les gains** *(next step: set the gains)* goes to the most important step.

> ℹ️ The coach sets name, colour, high-pass, EQ, compressor, gate and left/right position. It **never** touches gain (except in step 3, with your OK), 48 V, faders, mutes or routing.

---

## Step 3: Set each instrument's gain

**This is the most important step.** Gain is the first knob: compressor and gate work on what comes out of the preamp. Wrong gain means everything else is wrong too.

### The overview table

![Gain table](images/tuto-inge/08-tableau-gains.png)

1. For each instrument: its gain, the measured peak level, the bleed, and the compressor and gate thresholds.
2. **State**: **À mesurer** *(to measure)*, **Calé** *(fitted)* or **Gain changé : à refaire** *(gain changed: redo)*. Click a row to work on that instrument.

### Measure and fix the gain

Ask the musician to play **alone**, at the volume of the **loudest part of the show**.

![Gain measurement](images/tuto-inge/09-mesure-gain.png)

1. **Mesurer (5 s)** *(measure)*: the musician plays while the coach watches the levels.
2. **The bar** shows the peak level. The **dashed zone** is the target, around −6 dB.
3. **The verdict**: too weak, clipping, or **Gain bien réglé** *(gain set right)*.
4. **Revoir et appliquer ce gain** *(review and apply this gain)* opens the check window. After applying, **measure again**: changes go in small steps, never more than +6 dB at once.

Repeat until you see **“Gain bien réglé”**.

### Place the gate and apply

![Gain set](images/tuto-inge/10-gain-ok.png)

1. **Gain bien réglé**: the level is in the zone. The coach uses it from here on.
2. **Mesurer la repisse** *(measure the bleed)*, for kick, snare and toms only: this instrument **stays silent** while the others play loud. The coach measures what the mic picks up from the others and places the gate just above it.
3. **The thresholds** computed from your real signal.
4. **Appliquer à …** *(apply to …)* sends the setting with these thresholds.

Then **Instrument suivant** *(next instrument)*, and so on. At the end, **Appliquer tout le groupe** uses every fitted threshold.

> ⚠️ If someone changes a gain later (on the console or in X-AIR Edit), the instrument goes back to **“à refaire”** *(redo)*: just measure it again.
> This step needs the **real XR18** and musicians playing. Nothing is measured in simulation.

---

## Step 4: Listen and fix

Play a song with the whole band and listen.

![Pick what bothers you](images/tuto-inge/11-ecouter.png)

1. **Je m’occupe de** *(I’m working on)*: pick the instrument.
2. **Click what bothers you**: muddy, harsh, too boomy, can’t hear it, feedback, clipping… The coach explains what to check and, when useful, offers a **small** correction you can undo.

![Ask for advice](images/tuto-inge/12-conseil.png)

1. **Or describe it in your own words**, e.g. “we can’t understand the lyrics when the guitars play” (in French).
2. **The coach’s answer**, with what to check by ear.

> 🛑 **Feedback (squealing)?** Lower the level at once, or use **Tout couper** *(mute all)* at the top of the screen. Only then look for the cause.
> The coach does not receive audio, only settings and levels: its advice comes from your description.

---

## Step 5: Each musician’s monitor mix

Each musician gets **their own mix** in their in-ears or wedge, from an **Aux** output of the XR18.

![Suggest musicians](images/tuto-inge/13-musiciens.png)

1. **Proposer les musiciens d’après mon groupe** *(suggest musicians from my band)*: one musician per main instrument (vocals, each guitar, bass, the whole kit, keys).

![One musician’s mix](images/tuto-inge/14-retour-musicien.png)

1. **Sortie / bus** *(output)*: the Aux output their in-ear pack or wedge is plugged into.
2. **Rôle** *(role)*: singer, guitarist, bassist, drummer, keys. The starting mix depends on it.
3. **Their instruments**: put **in front** of their mix (click to add or remove).
4. **The starting mix** that will be sent. For example, the bassist gets bass and kick locked together. The drummer gets no cymbals: they are already loud on stage.
5. **Appliquer** *(apply)* sends this musician’s mix.

![Everyone’s mix and QR codes](images/tuto-inge/15-retours-tous.png)

1. **Appliquer les retours de tous** *(apply everyone’s monitors)*.
2. **Créer les QR codes des musiciens** *(create the musicians’ QR codes)*: one personal link each. The **Retours** *(monitors)* page opens.

![QR codes](images/tuto-inge/16-qr-codes.png)

Each musician **scans their QR code** with their phone camera, on the same Wi-Fi. There is no app to install.

<img src="images/tuto-inge/17-telephone.png" alt="Musician page on a phone" width="300">

On their phone, they adjust **only their own mix**:
- overall volume and **Couper** *(mute)*;
- the level of each instrument;
- saved settings (“Concert”, “Rehearsal”…).

They cannot change anything else. Volume is capped at 0 dB and rises in small steps, to protect their ears.

> ℹ️ Monitors are **pre-fader**: front-of-house changes do not move the musicians’ ears. Start in-ear packs at **low volume**.

---

## Step 6: Keep the good setting

![Save](images/tuto-inge/18-sauvegarder.png)

1. **Nom de la scène** *(scene name)*, e.g. “Thursday rehearsal”.
2. **Sauvegarder ma balance** *(save my mix)*: the whole console is saved. Find it in **Préparer › Scènes** *(Prepare › Scenes)*.
3. **Annuler le dernier réglage guidé**: undo, at any time.
4. **J’ai vérifié cette étape** *(I checked this step)* ticks the step.

> New venue, other mics, other speakers? Redo at least **step 3** (the gains).

---

## What next: refine during rehearsal

Once the balance is done, **Expert** mode can listen to the band with you. Go to **Console**, **Expert** button, **Analyse** view.

![Live analysis](images/tuto-analyse.png)

1. **Switch to Rehearsal mode** if you only work on the ears: button at the top right. The Main is muted and stays locked, even if you recall a scene.
2. **Choose what to listen to**: a musician’s ear mix, or the Main.
3. While the band plays, click **Analyser chaque instrument** *(analyse each instrument)*. The app listens to each channel for one second, one after the other.
4. **Read the recommendations**, ranked Safety, Important and Advice.
5. **Voir et valider** *(review)* shows what changes. Compare **A · Avant** and **B · Après** in the ears, then click **Appliquer** if it sounds better. **Annuler** puts everything back.

> Nothing is applied without your click. The analysis reads the console’s measurements, not the music: your ears decide.

Details are in the [full guide](USER_GUIDE_EN.md).

---

## If something goes wrong

| Problem | What to do |
|---|---|
| Console not found | Same network for computer and XR18. On a Mac, allow **Local Network** (see step 1). |
| “Pas de signal” *(no signal)* | Check the cable, the input number, the instrument volume, and 48 V for a condenser mic (switch it on yourself in the console). |
| “Ça sature” *(clipping)* | The coach offers to lower the gain. If the instrument itself distorts (pedal, DI), fix it at the source. |
| “Gain en butée” *(gain at its limit)* | The preamp is already at maximum or minimum: adjust the instrument output or mic position. |
| E-drums or keyboard: very high gain | This is a line signal: first turn up the module or keyboard output, then bring the console gain down. |
| The gate cuts soft notes | Measure the bleed again, or move the mic closer to the drum. |
| Feedback | Lower the level or **Tout couper**. Move the mic away from the speakers. |
| You don’t like a change | **Annuler le dernier réglage guidé**. |
| A musician can’t open their page | Same Wi-Fi as the computer. Otherwise, create a **Nouveau lien** *(new link)* in **Retours**. |

## Sound words

| Word | In plain words |
|---|---|
| **Gain** | The mic input level (preamp). Everything depends on it. |
| **Peak level** | The loudest moment measured. Target: −6 dB. |
| **High-pass** | Removes useless lows (rumble, stage vibrations). |
| **EQ** | Raises or lowers lows, mids, highs. |
| **Compressor** | Brings loud and soft parts closer together. |
| **Gate** | Mutes a mic when its instrument is not playing. |
| **Bleed** | Other instruments picked up by a mic. |
| **Pan** | Places the sound left or right. |
| **Front of house** | The sound for the audience. |
| **Monitor / bus** | The mix sent to a musician’s ears (Aux output). |
| **Pre-fader** | Monitors do not follow front-of-house levels. |
| **48 V** | Power for condenser mics. The coach never touches it. |

---

More: the [full guide](USER_GUIDE_EN.md) (Simple and Expert console, Rehearsal mode, Analysis, scenes, setlists) and the [coach’s technical details](INGE_SON.md) (per-instrument values, calculation rules, in French).
