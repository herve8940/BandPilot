# Sécurité / Security

## Versions et signalement

Indique la version exacte et précise si elle est stable, Android ou DEV. Les anciens
installateurs ne reçoivent pas automatiquement les corrections. Consulte les
[versions publiées](https://github.com/herve8940/BandPilot/releases) et
l'[état du projet](docs/ETAT_DU_PROJET.md).

Pour une vulnérabilité, utilise **Security → Advisories → Report a vulnerability**
si ce bouton est disponible. Sinon, ouvre une issue intitulée « Contact sécurité privé
demandé », sans détails exploitables ni données privées, pour demander au mainteneur
un canal confidentiel. Le rapport debug public n'est pas un canal confidentiel.

En privé, indique version, plateforme, préconditions, impact et reproduction minimale
sur données fictives. Ne teste que les systèmes pour lesquels tu as une autorisation.
Aucun délai de réponse ni programme de récompense n'est garanti.

## Périmètre

Le serveur principal écoute par défaut en local. Son exposition réseau exige HTTPS
et des comptes configurés. Garde les liens musicien sur un réseau de confiance.
Ne publie pas les ports de contrôle de la console sur Internet.

Les installateurs de bureau peuvent être non signés/non notariés. Télécharge-les depuis
les releases et compare leur somme au fichier SHA-256 publié. Une somme de contrôle ne
remplace pas une signature d'éditeur. La signature de projet Android ne constitue pas
une certification de magasin d'applications.

L'audit npm du 11 novembre 2026 relève des alertes dans les outils de construction et
Electron, qui est embarqué dans l'application de bureau malgré sa déclaration en
`devDependencies`. Voir le [rapport d'audit](docs/REPOSITORY_AUDIT.md). L'absence d'alerte
dans les dépendances serveur de production ne certifie pas la sécurité du logiciel complet.

## English

Report the exact version/channel. Older installers do not automatically receive fixes.
Use **Security → Advisories → Report a vulnerability** when available. Otherwise open
an issue titled “Private security contact requested” without exploit details or private
data, and ask the maintainer for a confidential channel. Public debug reports are not
private disclosures. Privately provide platform, prerequisites, impact and a minimal
reproduction with dummy data. Test only authorized systems. No response deadline or bounty
is promised.

Keep mixer control and musician links on a trusted local network. Exposing the main server
requires accounts and HTTPS. Desktop packages may be unsigned/unnotarized; check the
release and its SHA-256 file. A checksum is not a publisher signature. The November 11,
2026 audit found alerts including the bundled Electron runtime; see the
[audit report (FR)](docs/REPOSITORY_AUDIT.md).
