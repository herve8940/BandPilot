# XR18 Studio 2.1.0 — Nouveau mode Expert et Analyse en direct / New Expert mode and live analysis

![Analyse en direct](https://github.com/herve8940/xr18-studio/raw/main/docs/images/tuto-analyse.png)

## Français

### Quel fichier télécharger ?

| Ordinateur | Fichier |
|---|---|
| Windows | `XR18-Studio-Windows-2.1.0.exe` |
| Mac Apple Silicon (M1, M2, M3, M4) | `XR18-Studio-macOS-2.1.0-arm64.dmg` |
| Mac Intel | `XR18-Studio-macOS-2.1.0-x64.dmg` |
| Ubuntu / Debian | `XR18-Studio-Linux-2.1.0-amd64.deb` |
| Autre Linux | `XR18-Studio-Linux-2.1.0-x86_64.AppImage` |

### Nouveautés

- **Mode Expert entièrement redessiné** : design sombre « studio », 6 vues claires — Console, Canal, Ears, Effets, Routage, Analyse.
  - **Console** : tranches avec mini-courbe d’égaliseur et compresseur ; « Les faders règlent » la façade, un ear ou un effet.
  - **Canal** : toute la chaîne d’un instrument en une page.
  - **Ears** : tableau instruments × musiciens, niveaux et limiteurs de protection.
  - **Routage** : balance virtuelle (les canaux rejouent les pistes USB enregistrées).
- **Mode Répétition** : le Main est coupé et verrouillé (même un rappel de scène ne le rouvre pas) ; on ne travaille que les ears.
- **Analyse en direct** : l’analyseur de spectre de la XR18 (100 bandes), les niveaux et la réduction des compresseurs sont lus en continu. L’appli écoute chaque instrument, montre « qui joue où » et propose des corrections d’ingé son : coupe-bas, basse / grosse caisse, guitare / voix, résonances, compresseur trop fort, ears trop près de la saturation.
- **Valider en écoutant** : chaque proposition s’écoute en **A / B** en direct dans les ears, puis s’applique avec sauvegarde et annulation en un clic. Rien n’est appliqué sans ton accord.

**Validation** : 89 tests automatiques (dont le moteur d’analyse et le mode Répétition), parcours testés contre une XR18 émulée ; les codes de l’analyseur ont été relevés sur une XR18 physique.

## English

### Which file?

| Computer | File |
|---|---|
| Windows | `XR18-Studio-Windows-2.1.0.exe` |
| Apple Silicon Mac (M1, M2, M3, M4) | `XR18-Studio-macOS-2.1.0-arm64.dmg` |
| Intel Mac | `XR18-Studio-macOS-2.1.0-x64.dmg` |
| Ubuntu / Debian | `XR18-Studio-Linux-2.1.0-amd64.deb` |
| Other Linux | `XR18-Studio-Linux-2.1.0-x86_64.AppImage` |

### What’s new

- **Expert mode fully redesigned**: dark “studio” design, 6 clear views — Console, Channel, Ears, Effects, Routing, Analysis.
- **Rehearsal mode**: the Main is muted and locked (even a scene recall does not reopen it); only the ears are worked on.
- **Live analysis**: the XR18’s spectrum analyser (100 bands), levels and compressor gain reduction are read continuously. The app listens to each instrument, shows “who plays where” and proposes sound-engineer fixes: low cut, bass / kick, guitar / voice, resonances, over-compression, ear mixes close to clipping.
- **Decide by listening**: each proposal can be heard **A / B** live in the ears, then applied with a backup and one-click undo. Nothing is applied without you.

**Validation**: 89 automated tests (analysis engine and rehearsal mode included), journeys tested against an emulated XR18; analyser source codes recorded on a physical XR18.

---

# Version précédente / Previous release : 2.0.5

## Français

### Quel fichier télécharger ?

| Ordinateur | Fichier |
|---|---|
| Windows | `XR18-Studio-Windows-2.0.5.exe` |
| Mac Apple Silicon (M1, M2, M3, M4) | `XR18-Studio-macOS-2.0.5-arm64.dmg` |
| Mac Intel | `XR18-Studio-macOS-2.0.5-x64.dmg` |
| Ubuntu / Debian | `XR18-Studio-Linux-2.0.5-amd64.deb` |
| Autre Linux | `XR18-Studio-Linux-2.0.5-x86_64.AppImage` |

Mac : la première fois, **clic droit › Ouvrir**, puis autorise le **Réseau local** (*Réglages Système › Confidentialité et sécurité*). Windows : si SmartScreen s’affiche, **Informations complémentaires › Exécuter quand même**. `SHA256SUMS.txt` permet de vérifier les fichiers.

### Corrigé (trouvé en testant sur une XR18 physique)

- **2.0.5 — Coach, réglage du gain** : « Prévisualisation expirée » si on attendait plus d’une minute avant d’appliquer. Une proposition reste maintenant valable 10 minutes (l’appli vérifie toujours, juste avant d’appliquer, que la console n’a pas bougé). Après avoir appliqué un gain, l’ancienne proposition disparaît et l’appli demande de remesurer.
- **2.0.5 — Batterie électronique et clavier** : au-delà de +20 dB de gain, le coach conseille de monter plutôt le volume de sortie de l’instrument (moins de souffle).
- **2.0.4 — « Paramètre FX invalide »** : la synchronisation Table → PC et la sauvegarde de scène s’arrêtaient sur les effets. La XR18 renvoie toujours 64 valeurs par effet, et les cases que l’effet n’utilise pas sont vides. L’appli garde maintenant seulement les vraies valeurs, et renvoie chaque paramètre d’effet un par un (vérifié sur une XR18 physique).
- **2.0.3 — Toutes les valeurs de ta XR18 sont maintenant reconnues** : un script de diagnostic a lu les 2 636 réglages d’une XR18 physique. Corrigés : la source du retour Aux (USB 17/18) et l’emplacement d’effet inséré sur les canaux, bus et Main (il n’était jamais lu). La synchronisation Table → PC et la sauvegarde de scène vont au bout.
- **2.0.3 — Téléphone** : supprimer un réglage de retour enregistré donnait une erreur. C’est réparé.
- **2.0.3 — Numéro de version** affiché dans Réglages › Connexion et dans le menu « À propos de XR18 Studio ».
- **2.0.2 — Synchronisation Table → PC et sauvegarde de scène** : elles s’arrêtaient sur « Valeur OSC hors plage : /ch/16/config/insrc ». Une valeur que l’appli ne connaît pas est maintenant ignorée et signalée, au lieu de tout bloquer ; le rappel de scène laisse ce réglage tel quel.
- **Synchronisation Table → PC, sauvegarde de scène, étape 6 du coach et rappel** : ils échouaient avec « Pas de réponse XR18 : /config/solo/dimplf ». Le nom du réglage était faux. Si la console ne répond pas pour quelques réglages, la lecture continue et les liste au lieu d’échouer.
- **Capture en .scn** : elle échouait avec « Nœud XR18 absent ». La réponse de la vraie console est maintenant comprise.
- **Coach, « Appliquer »** : des réglages corrects étaient annoncés « non confirmés » (coupe-bas, Q, relâchement). La console arrondit ces valeurs au cran inférieur ; la relecture l’accepte désormais.
- **Mode Simple après une scène vierge** : il n’affichait plus aucune entrée. Tant qu’aucune entrée n’a de nom, les 16 sont affichées.
- **Effets en mode Insert** : la scène vierge les remet en départ / retour (type et réglages gardés). La vue Effets prévient si un effet est en Insert sans qu’aucun canal ne l’utilise.

### Amélioré

- **Tout rallumer** : après **Tout couper**, le bouton remet chaque entrée comme avant (celles qui étaient déjà coupées le restent).
- **Page Scènes refaite** : sauvegarder en un clic, **Rappeler…** ouvre la fenêtre « ce qui va changer », et les sauvegardes automatiques sont rangées à part.
- **Mode Expert sur un portable** : dans les vues Gate, EQ, Comp, Envois…, la banque du bas devient compacte et la courbe d’égaliseur s’adapte. En 1440×800, Entrée, Gate, EQ, Envois et Main tiennent à l’écran ; Canal, Comp et Routage défilent encore un peu. Les explications se masquent d’un clic pour gagner de la place.
- **Mon ingé son** : les messages s’affichent en bas de la fenêtre, toujours visibles, et l’appli se souvient de l’étape en cours.
- **Fenêtres de confirmation** en français, avec l’icône de l’appli. L’appli a maintenant sa propre icône.
- **Tous les paramètres** : les valeurs sont lues tout de suite, sans afficher « Non lu ». L’étiquette « Démonstration » n’apparaît plus avec une vraie console.
- **Scène vierge** : le bouton affiche « Lecture de la console… » pendant la préparation.

**Validation** : 80 tests automatiques, parcours testés dans le navigateur contre une XR18 émulée, et corrections vérifiées à partir des erreurs relevées sur une XR18 physique.

## English

### Which file?

| Computer | File |
|---|---|
| Windows | `XR18-Studio-Windows-2.0.5.exe` |
| Apple Silicon Mac (M1, M2, M3, M4) | `XR18-Studio-macOS-2.0.5-arm64.dmg` |
| Intel Mac | `XR18-Studio-macOS-2.0.5-x64.dmg` |
| Ubuntu / Debian | `XR18-Studio-Linux-2.0.5-amd64.deb` |
| Other Linux | `XR18-Studio-Linux-2.0.5-x86_64.AppImage` |

Mac: the first time, **right-click › Open**, then allow **Local Network** (*System Settings › Privacy & Security*). Windows: if SmartScreen appears, **More info › Run anyway**. Use `SHA256SUMS.txt` to check the files.

### Fixed (found by testing on a physical XR18)

- **2.0.5 — Coach gain setting**: “Prévisualisation expirée” if you waited more than a minute before applying. A proposal now stays valid 10 minutes (the app still checks, right before applying, that the console has not moved). After a gain is applied, the old proposal disappears and the app asks to measure again.
- **2.0.5 — E-drums and keyboards**: above +20 dB of gain, the coach advises turning up the instrument’s own output instead (less hiss).
- **2.0.4 — “Paramètre FX invalide”**: Table → PC sync and scene save stopped on the effects. The XR18 always answers 64 values per effect, with empty slots for the ones the effect does not use. The app now keeps only the real values, and sends each effect parameter one by one (checked on a physical XR18).
- **2.0.3 — Every value of your XR18 is now recognised**: a diagnostic script read all 2,636 settings of a physical XR18. Fixed: the Aux return source (USB 17/18) and the inserted-effect slot on channels, buses and Main (it was never read). Table → PC sync and scene save now complete.
- **2.0.3 — Phone**: deleting a saved monitor profile gave an error. Fixed.
- **2.0.3 — Version number** shown in Réglages › Connexion and in the “About XR18 Studio” menu.
- **2.0.2 — Table → PC sync and scene save** stopped on “Valeur OSC hors plage : /ch/16/config/insrc”. A value the app does not know is now skipped and reported instead of blocking everything; scene recall leaves that setting as it is.
- **Table → PC sync, scene save, coach step 6 and recall** failed with “Pas de réponse XR18 : /config/solo/dimplf”. The setting name was wrong. If the console does not answer a few settings, reading carries on and lists them instead of failing.
- **.scn capture** failed with “Nœud XR18 absent”. The real console’s reply is now understood.
- **Coach “Apply”** reported correct values as “not confirmed” (high-pass, Q, release). The console rounds these down one step; read-back now accepts it.
- **Simple mode after a blank scene** showed no inputs. While no input has a name, all 16 are shown.
- **Effects in Insert mode**: the blank scene puts them back to send/return (type and settings kept). The Effects view warns when an effect is in Insert mode but no channel uses it.

### Improved

- **Tout rallumer** *(unmute all)*: after **Tout couper**, the button puts each input back as it was (inputs already muted stay muted).
- **Redesigned Scenes page**: save in one click, **Rappeler…** opens the “what will change” window, and automatic backups are listed separately.
- **Expert mode on a laptop**: in the Gate, EQ, Comp, Sends… views the bottom bank becomes compact and the EQ curve adapts. At 1440×800, Input, Gate, EQ, Sends and Main fit on screen; Channel, Comp and Routing still scroll a little. Explanations hide in one click to make room.
- **Mon ingé son**: messages appear at the bottom of the window, always visible, and the app remembers the current step.
- **Confirmation windows** in French with the app icon. The app now has its own icon.
- **Tous les paramètres**: values are read straight away instead of showing “Non lu”. The “Démonstration” label no longer appears with a real console.
- **Blank scene**: the button shows “Lecture de la console…” while it prepares.

**Validation**: 80 automated tests, journeys tested in the browser against an emulated XR18, and fixes checked against the errors seen on a physical XR18.

---

# Version précédente / Previous release : 2.0.0 — Ton ingé son de poche / Your pocket sound engineer



## Français

### Quel fichier télécharger ?

| Ordinateur | Fichier |
|---|---|
| Windows | `XR18-Studio-Windows-2.0.0.exe` |
| Mac Apple Silicon (M1, M2, M3, M4) | `XR18-Studio-macOS-2.0.0-arm64.dmg` |
| Mac Intel | `XR18-Studio-macOS-2.0.0-x64.dmg` |
| Ubuntu / Debian | `XR18-Studio-Linux-2.0.0-amd64.deb` |
| Autre Linux | `XR18-Studio-Linux-2.0.0-x86_64.AppImage` |

Mac : la première fois, **clic droit › Ouvrir**, puis autorise le **Réseau local** (*Réglages Système › Confidentialité et sécurité*). Windows : si SmartScreen s’affiche, **Informations complémentaires › Exécuter quand même**. Les paquets ne sont pas signés par un certificat commercial ; `SHA256SUMS.txt` permet de vérifier les fichiers.

### Nouveautés

**Toute la console d’un coup d’œil**

- Les modes **Simple** et **Expert** tiennent dans la fenêtre : toutes les pistes sont visibles en même temps, sans faire défiler. C’est vérifié de 1280×800 à 1920×1080.
- Les tranches s’adaptent à la largeur : noms sur deux lignes, valeurs et boutons compacts quand la place manque.
- En mode Expert, la vue d’ensemble et la banque de faders restent alignées. Les explications et la barre de mix sont dans une colonne à droite.
- Le menu se replie tout seul sur la page Console. Le bouton **Réduire le menu** le replie ou le rouvre partout.

**Partir d’une scène vierge**

- Un bouton remet toute la console à neutre : noms, couleurs, traitements, égaliseurs à plat, pan au centre, envois fermés, volumes en bas.
- Le **48 V**, les **gains**, le **routage** et les **effets** ne sont jamais touchés.
- Une fenêtre montre d’abord ce qui va changer, une sauvegarde est faite, et **Revenir à avant** annule en un clic.
- Le bouton est disponible dans le mode Expert et dans Mon ingé son (étape 2).

**Mon ingé son, version complète**

- **Configuration complète par instrument**, selon les bonnes pratiques live : coupe-bas, égaliseur 4 bandes, compresseur, gate, position stéréo, nom et couleur. Choisir un instrument la propose aussitôt.
- **Batterie détaillée** : kick, snare, tom 1, tom 2, tom 3, OH 1, OH 2. Guitare rythmique et guitare solo sont séparées.
- **Modèles de groupe** prêts à l’emploi.
- **Appliquer** par instrument ou **à tout le groupe**. Corrigé : si la console ne confirmait pas un seul réglage, les instruments suivants n’étaient pas appliqués.
- **Gain guidé** : mesure de chaque instrument et gain proposé pour viser −6 dB, par étapes de +6 dB maximum, sans jamais toucher au 48 V. La repisse est mesurée, et le compresseur et le gate sont calés sur ton vrai signal. L’appli te prévient si un gain change ensuite.
- **Retours de chaque musicien** : bus, rôle, instruments personnels, et un mix de départ pré-fader affiché en barres. Les QR codes se créent en un clic.
- **Pour débutants** : un lexique « Les mots du son ». La fenêtre de vérification se ferme par la croix, Échap ou un clic à côté, et elle ne liste que les réglages qui changent.

**Déjà dans les versions précédentes**

- Les retours sur le téléphone de chaque musicien, par QR code personnel :
  - chacun ne règle que **son** retour ;
  - le volume est plafonné à 0 dB ;
  - un lien perdu se remplace en un clic.
- La console graphique façon X-AIR Edit, avec 11 vues, des explications en langage simple et le contrôle direct avec relecture.
- La détection automatique de la console, comme X-AIR Edit (XR18, X18, MR18).

**Validation** : 72 tests automatiques. Les parcours complets (6 étapes du coach, scène vierge, retours, téléphone) ont été testés dans le navigateur contre une XR18 émulée, sans erreur. Les paquets des 4 plateformes sont compilés et lancés en CI. **À vérifier sur ta XR18 physique avant un concert.**

## English

### Which file?

| Computer | File |
|---|---|
| Windows | `XR18-Studio-Windows-2.0.0.exe` |
| Apple Silicon Mac (M1, M2, M3, M4) | `XR18-Studio-macOS-2.0.0-arm64.dmg` |
| Intel Mac | `XR18-Studio-macOS-2.0.0-x64.dmg` |
| Ubuntu / Debian | `XR18-Studio-Linux-2.0.0-amd64.deb` |
| Other Linux | `XR18-Studio-Linux-2.0.0-x86_64.AppImage` |

Mac: the first time, **right-click › Open**, then allow **Local Network** (*System Settings › Privacy & Security*). Windows: if SmartScreen appears, **More info › Run anyway**. The packages are not signed with a commercial certificate; use `SHA256SUMS.txt` to check the files.

### What’s new

**The whole mixer at a glance**

- **Simple** and **Expert** modes fit the window: every track is visible at once, with no scrolling. Checked from 1280×800 to 1920×1080.
- Strips adapt to the width, with two-line names and compact values and buttons when space is short.
- In Expert mode, the overview and the fader bank stay aligned. Explanations and the mix bar sit in a column on the right.
- The menu folds automatically on the Console page. **Réduire le menu** folds or opens it anywhere.

**Start from a blank scene**

- One button resets the whole mixer to neutral: names, colours, processing, flat EQs, centred pan, closed sends, levels down.
- **48 V**, **gains**, **routing** and **effects** are never touched.
- A window first shows what will change, a backup is made, and **Revenir à avant** undoes it in one click.
- The button is available in Expert mode and in Mon ingé son (step 2).

**Complete “Mon ingé son”**

- **Complete per-instrument setup** following live best practice: high-pass, 4-band EQ, compressor, gate, stereo position, name and colour. Picking an instrument offers it straight away.
- **Detailed drum kit**: kick, snare, tom 1, tom 2, tom 3, OH 1, OH 2. Rhythm and lead guitar are separate.
- **Band templates**, ready to use.
- Apply **per instrument** or **to the whole band**. Fixed: if the console did not confirm a single value, the following instruments were not applied.
- **Guided gain staging**: each instrument is measured and the gain proposed to reach −6 dB, in steps of at most +6 dB, never touching 48 V. Bleed is measured, and compressor and gate are fitted to your real signal. The app warns you if a gain changes later.
- **Each musician’s monitor mix**: bus, role, own instruments, and a pre-fader starting mix shown as bars. QR codes are created in one click.
- **For beginners**: a “sound words” glossary. The check window closes with the X, Escape or a click outside, and lists only the settings that change.

**Already in previous versions**

- Monitors on each musician’s phone, through a personal QR code:
  - each musician adjusts only **their own** mix;
  - volume is capped at 0 dB;
  - a lost link is replaced in one click.
- The X-AIR Edit–style graphical console, with 11 views, plain-language explanations, and direct control with read-back.
- Automatic console discovery, like X-AIR Edit (XR18, X18, MR18).

**Validation**: 72 automated tests. The full journeys (the coach’s 6 steps, blank scene, monitors, phone) were tested in the browser against an emulated XR18, with no errors. Packages for all 4 platforms are built and launched in CI. **Check on your physical XR18 before a show.**
