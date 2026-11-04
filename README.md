<div align="center">

# BandPilot

**Ton ingé son de poche pour ton groupe et ta console**

[![Dernière version](https://img.shields.io/github/v/release/herve8940/xr18-studio?label=version&color=3ee0e0)](https://github.com/herve8940/xr18-studio/releases/latest) [![Téléchargements](https://img.shields.io/github/downloads/herve8940/xr18-studio/total?color=2b7cf6)](https://github.com/herve8940/xr18-studio/releases) [![Licence MIT](https://img.shields.io/badge/licence-MIT-green)](LICENSE) [![Windows · macOS · Linux](https://img.shields.io/badge/Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-gratuit-555)](https://github.com/herve8940/xr18-studio/releases/latest)

Application **gratuite** pour préparer la balance, piloter la console, les retours et les répétitions. Cette branche prépare la détection Behringer XR12/XR18/X18, Midas MR12/MR18 et X32. La X32 reste un **adaptateur partiel en validation**, et les nouveaux modèles X-Air nécessitent une validation matérielle : voir la [matrice de compatibilité](docs/multi-model.md). Les versions déjà publiées ne contiennent pas encore cette adaptation.

🇫🇷 Français · [🇬🇧 English](README.en.md)

[**⬇️ Télécharger**](https://github.com/herve8940/xr18-studio/releases/latest) · [**🌐 Site**](https://herve8940.github.io/xr18-studio/) · [**📘 Tuto « Mon ingé son »**](docs/TUTO_MON_INGE_SON.md) · [Guide complet](docs/USER_GUIDE_FR.md) · [Nouveautés](docs/RELEASE_NOTES.md)

<img src="docs/images/hero.png" alt="XR18 Studio : l’assistant Mon ingé son et la page retour d’un musicien sur son téléphone" width="900">

Windows · macOS (Intel et Apple Silicon) · Linux · fonctionne aussi avec X18 et MR18

</div>

---

## Pour qui ?

Pour les **groupes sans ingé son** : répétitions, petites salles, bars, fêtes… Tu as une XR18, des micros, des musiciens, et tu veux que ça sonne **sans apprendre le jargon**.

XR18 Studio se pose sur ta console comme X-AIR Edit, avec en plus :

| 🎧 **Mon ingé son** | 🎚️ **Une console claire** | 📱 **Les retours au téléphone** |
|---|---|---|
| Un assistant en 6 étapes : il configure chaque instrument selon les bonnes pratiques, règle les gains avec toi et prépare les retours. | Un mode **Simple** avec de gros faders pour le concert, un mode **Expert** complet avec Analyse en direct, chaque option expliquée. | Chaque musicien scanne son QR code et règle **son** retour. Il n’a aucune application à installer et ne peut toucher à rien d’autre. |

## 🎧 Mon ingé son, en 6 étapes

| 1. Choisis tes instruments | 2. Règle les gains | 3. Prépare les retours |
|---|---|---|
| ![Choisir les instruments](docs/images/tuto-coach-batterie.png) | ![Régler les gains](docs/images/tuto-coach-gain.png) | ![Retours des musiciens](docs/images/tuto-coach-retours.png) |
| Chant, guitare rythmique et solo, basse, batterie détaillée (kick, snare, 3 toms, 2 overheads)… Choisir un instrument propose sa **configuration complète** : coupe-bas, égaliseur, compresseur, gate, position stéréo. | Chaque musicien joue fort, seul. Le coach **mesure**, propose le bon gain, puis **cale le compresseur et le gate sur ton vrai signal**. | Un mix par musicien selon son rôle : le bassiste a basse et kick soudés, le batteur n’a pas les cymbales qu’il entend déjà. Puis les QR codes en un clic. |

**Rien ne change sans ton accord.** Chaque réglage passe par une fenêtre « avant / après », une sauvegarde est faite, et un bouton annule tout.

👉 **[Le tuto illustré pas à pas, pour débutants](docs/TUTO_MON_INGE_SON.md)**

## 🎚️ La console

| Mode Simple (concert) | Retour d’un musicien | Mode Expert (façon X-AIR Edit) |
|---|---|---|
| ![Console Simple](docs/images/tuto-simple.png) | ![Retour](docs/images/tuto-simple-retour.png) | ![Console Expert](docs/images/tuto-expert.png) |

| Analyse en direct | Valider en écoutant | Égaliseur |
|---|---|---|
| ![Analyse en direct](docs/images/tuto-analyse.png) | ![Valider en écoutant](docs/images/tuto-analyse-valider.png) | ![Égaliseur](docs/images/tuto-expert-eq.png) |

- **6 vues en mode Expert** : Console, Canal, Ears, Effets, Routage, Analyse.
- **Analyse en direct** : spectre du mix, carte « Qui joue où » et recommandations à écouter en A / B avant de les appliquer. Rien ne change sans ton clic.
- **Mode Répétition** : le Main est coupé et verrouillé, on ne travaille que les ears.
- **Mode Simple pour le concert** : toutes les pistes à l’écran, le menu se replie tout seul. En mode Expert, la dernière tranche peut demander un léger défilement en 1440 px.
- **Partir d’une scène vierge** en un clic : toute la console revient à neutre, volumes en bas, sans toucher au 48 V, aux gains ni au routage, avec retour en arrière.
- **Chaque vue explique** en langage simple ce que fait chaque bouton : voir le [guide de la console](docs/GUIDE_CONSOLE.md).

## 📱 Les retours sur le téléphone

| Les QR codes des musiciens | La page du musicien |
|---|---|
| ![QR codes](docs/images/tuto-share.png) | <img src="docs/images/tuto-inge/17-telephone.png" alt="Page du musicien" width="260"> |

Chaque lien est **personnel** : le musicien ne voit que son propre retour. Le volume est plafonné pour protéger les oreilles. Un lien perdu se remplace en un clic.

## ⬇️ Installer

Télécharge le fichier de ton ordinateur sur la [**page des versions**](https://github.com/herve8940/xr18-studio/releases/latest). Tout est inclus, il n’y a rien d’autre à installer.

| Ordinateur | Fichier |
|---|---|
| Windows | `XR18-Studio-Windows-….exe` |
| Mac Apple Silicon (M1, M2, M3…) | `XR18-Studio-macOS-…-arm64.dmg` |
| Mac Intel | `XR18-Studio-macOS-…-x64.dmg` |
| Ubuntu / Debian | `.deb` |
| Autre Linux | `.AppImage` |

Les installateurs ne sont pas signés par un certificat commercial :

- **Mac** : la première fois, fais **clic droit › Ouvrir**. Pour trouver la console, autorise ensuite le **Réseau local** dans *Réglages Système › Confidentialité et sécurité*.
- **Windows** : si SmartScreen s’affiche, clique **Informations complémentaires › Exécuter quand même**.

Détails : [installer l’application](docs/USER_GUIDE_FR.md#2-installer-lapplication).

## 🚀 Premiers pas en 5 minutes

1. Relie l’ordinateur et la XR18 au **même réseau** (Wi-Fi de la console ou routeur du groupe).
2. Ouvre XR18 Studio : la console est **trouvée toute seule**, comme dans X-AIR Edit.
3. Va dans **Jouer › Mon ingé son** et suis les étapes.

Pas de console sous la main ? Tout se découvre en **mode simulation**.

## 📚 Documentation

| | |
|---|---|
| 📘 [Tuto « Mon ingé son »](docs/TUTO_MON_INGE_SON.md) | Le parcours guidé, très illustré, pour débutants |
| 📗 [Guide complet](docs/USER_GUIDE_FR.md) | Installation, connexion, console, retours, scènes, dépannage |
| 🎚️ [Guide de la console](docs/GUIDE_CONSOLE.md) | Chaque option de chaque vue expliquée |
| 🔧 [Mon ingé son : détails techniques](docs/INGE_SON.md) | Valeurs par instrument, règles de calcul des gains et seuils |
| 🔌 [Connexion à la XR18](docs/CONNEXION_XR18.md) | Réseau, découverte, dépannage |
| 📝 [Nouveautés](docs/RELEASE_NOTES.md) · [État du projet](docs/ETAT_DU_PROJET.md) | Ce qui a changé, ce qui est vérifié |

## ⚠️ À savoir

- Le coach lit les **réglages et les niveaux** de la console, **pas le son** : ses conseils d’écoute partent de ta description.
- Les valeurs proposées sont des **points de départ** issus des bonnes pratiques du live : ton oreille a le dernier mot.
- Fais toujours un essai complet sur ta console **avant un concert**.

<details>
<summary><b>Pour les développeurs</b></summary>

```sh
npm run setup      # dépendances
npm run studio     # serveur + interface en local
npm test           # tests
npm run build:all  # backend et interface
npm run desktop:package
```

Les installateurs sont produits par GitHub Actions : le workflow « Desktop packages » à chaque PR, et le workflow « Release » quand la version de `package.json` change sur `main`.

- Le moteur OSC est unique : l’interface, les pages des musiciens et MCP passent par son API et ses droits.
- Une connexion ou une lecture ne change jamais le mixage.
- Les gestes de la console sont envoyés immédiatement, puis relus sur la XR18.
- Le 48 V, le routage et les types d’effets passent par prévisualisation et confirmation.

Références : [alignement sur X-AIR Edit et protocole OSC](docs/XAIR_EDIT_PARITY.md) · [fonctions, HTTPS, ReaCue et MCP](docs/FONCTIONS_0_2.md) · [installation de bureau](docs/INSTALLATION_CLE_EN_MAIN.md) · [application multiplateforme](docs/DESKTOP_MULTIPLATEFORME.md)

</details>

---

<div align="center">
XR18 Studio est un logiciel libre sous <a href="LICENSE">licence MIT</a>, par Hervé Naessens.<br>Projet indépendant, non affilié à Behringer / Music Tribe. XR18, X18, MR18 et X-AIR sont des marques de leurs propriétaires.
</div>

Les essais manuels des 3–4 novembre et leurs corrections sont suivis dans [le bilan des corrections](docs/corrections-tests-manuels.md), avec [le rapport original](docs/tests-manuels-2026-11-04.md).
