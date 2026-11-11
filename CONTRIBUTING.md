# Contribuer à BandPilot / Contributing to BandPilot

BandPilot est un projet indépendant, gratuit et open source sous [licence MIT](LICENSE).
Retours de terrain, traductions et documentation comptent autant que le code.
Le soutien financier est facultatif : [aider le projet](docs/SUPPORT_FR.md).

## Signaler un problème

Utilise les [formulaires GitHub](https://github.com/herve8940/BandPilot/issues/new/choose).
Indique la version exacte (stable, Android ou DEV), le système, le modèle et le firmware
de la console, les étapes, le résultat attendu et le résultat observé. Distingue
simulation et matériel. Précise le contexte : façade, retours de scène, in-ears, casque
ou groupe aux écoutes mixtes.

Les issues sont publiques. Relis captures et rapports debug : retire noms, contacts,
chemins privés, adresses et secrets inutiles au diagnostic. Ne joins pas une base de
données ou des pistes audio personnelles. Pour une faille, suis [SECURITY.md](SECURITY.md).

## Développer et vérifier

Utilise Node.js 22 comme en CI, dans une copie du dépôt :

```sh
npm ci
npm --prefix web ci
npm run studio
```

La simulation permet de travailler sans console. Utilise des données fictives et des
copies de projets REAPER ; la simulation de console ne simule pas l'enregistrement REAPER.

```sh
npm test
npm run test:web
npm run build:all
node scripts/sync-support.mjs --check
python3 scripts/check-docs.py
```

Pour la documentation seule, les deux dernières commandes suffisent. Pour un changement
audio, ajoute des vérifications pertinentes et indique les essais physiques effectués
ou encore nécessaires. Les tests automatiques ne certifient pas un concert.

- Respecte les capacités de chaque console et les contrôles centralisés du serveur.
- Préserve les profils anciens et les valeurs par défaut. Enregistrer une préférence
  n'applique pas à lui seul un réglage audio à la console.
- Sépare caractère du son, marge à l'entrée et écoute par musicien ; prévois les choix
  inconnus et configurations mixtes. Les presets sont des points de départ.
- Préserve aperçus, confirmations et sauvegardes des opérations guidées sensibles.
- Accompagne les changements visibles des traductions FR, EN, IT, ES et DE
  ([guide](docs/TRANSLATION.md)).
- Ne publie aucune donnée personnelle de répétition, clé API ou clé de signature.

Décris dans la pull request le problème, le comportement obtenu, les vérifications et
les limites restantes. Pour les contenus de soutien, modifie `config/support-copy.json`
et lance `node scripts/sync-support.mjs` ([activation Ko-fi](docs/KOFI_SETUP.md)).

## English

Use the [issue forms](https://github.com/herve8940/BandPilot/issues/new/choose). Include
exact release/channel, OS, mixer/firmware, reproduction steps, expected and actual results.
Distinguish simulation from hardware and describe the listening setup. Issues are public:
review screenshots/reports and remove private data. See [SECURITY.md](SECURITY.md) for
vulnerabilities and [data/privacy](docs/PRIVACY.md#english) for external services.

Use Node 22 and the commands above; documentation-only changes need the last two checks.
Add relevant coverage for behavior changes and disclose hardware tests still needed.
Preserve old profiles, defaults, model-specific capabilities, guided confirmations and
backups. Saving preferences must not itself send audio changes. Consider different
instruments, experience levels and mixed listening setups; presets are starting points.
Update all five languages for user-facing changes. Do not distribute personal rehearsal data.

Contributions use the MIT license. Follow the [community guidelines](CODE_OF_CONDUCT.md).
Financial support is optional: [ways to help](docs/SUPPORT_EN.md).
