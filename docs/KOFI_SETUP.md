# Gérer le soutien Ko-fi de BandPilot

Le compte du projet est [ko-fi.com/bandpilot](https://ko-fi.com/bandpilot).
Le 11 novembre 2026, son propriétaire a terminé la configuration du profil et la
connexion aux paiements dans Ko-fi. La page affiche le logo, la présentation de
BandPilot et le formulaire de soutien. Aucun paiement de test n'a été effectué.

Les liens de soutien sont activés dans les cinq README, les pages du site et
`.github/FUNDING.yml`. Les contributions non financières restent proposées.

## Gestion du compte par son propriétaire

1. Gère le moyen de réception des paiements directement dans Ko-fi et chez PayPal
   ou Stripe ; vérifie les conditions, frais, devise et montant affichés dans ton compte.
2. Garde la présentation à jour et vérifie la page publique après chaque changement.
3. Si l'adresse change, vérifie la nouvelle URL avant de synchroniser les liens du dépôt.
   Aucun mot de passe, jeton ou détail de paiement n'est nécessaire pour cette intégration.

Sources : [démarrer sur Ko-fi](https://help.ko-fi.com/hc/en-us/articles/360014098514-Getting-started-on-Ko-fi),
[recevoir les paiements](https://help.ko-fi.com/hc/en-us/articles/115003980093-How-do-I-get-paid),
[bouton de soutien GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository).

## Textes prêts pour la page

**Nom :** BandPilot — par Hervé Naessens

**Accroche :** Plus de temps pour jouer, moins de temps à chercher un réglage.

**Présentation :**

Je développe BandPilot, une application gratuite et open source pour aider les groupes
à préparer leur balance, piloter une console compatible et organiser les retours des
musiciens. Le projet vise des usages variés, du premier groupe aux musiciens expérimentés,
avec des guides et une interface en cinq langues.

Ton soutien m'aide à consacrer du temps aux corrections, à la maintenance des versions,
aux essais sur différentes consoles et à une documentation plus claire. Ces essais
comptent : une fonction testée sur un modèle ne garantit pas le même résultat partout.

BandPilot reste gratuit sous licence MIT. Le soutien est facultatif, sans fonction payante
à débloquer ni promesse de délai ou de compatibilité. Tu peux aussi aider en signalant
un problème, en testant une configuration, en traduisant ou en partageant le projet.

**Remerciement :** Merci de soutenir BandPilot ! Ton aide encourage la maintenance et
les essais qui font avancer le projet. Les nouveautés et leurs limites sont publiées
sur GitHub. Si tu veux partager ton expérience, indique ta version, ta console et ton usage.

**English short bio:** I build BandPilot, a free, open-source tool for sound checks,
compatible mixer control and personal monitor mixes. Optional support helps me spend
time on fixes, testing and guides in five languages. No paid features, promised deadlines
or guaranteed hardware compatibility. Feedback, translations and sharing also help.

## Activation technique

Depuis la racine du dépôt, pour synchroniser le compte actuel :

```sh
node scripts/sync-support.mjs --username bandpilot
node scripts/sync-support.mjs --check
python3 scripts/check-docs.py
```

Relis le diff avant publication. Le script synchronise cinq README, cinq pages d'accueil,
cinq pages de soutien et `.github/FUNDING.yml` à partir de `config/support.json` et
`config/support-copy.json`. Le bouton Sponsor de GitHub dépend aussi de l'option
**Settings → General → Features → Sponsorships**. Le fichier doit être sur la branche par défaut.

Il n'y a ni widget externe ni requête à Ko-fi au chargement des pages. Un clic ouvre le
service ; aucune commande de console n'est liée au soutien.

Pour retirer les liens financiers et conserver les contributions non financières :

```sh
node scripts/sync-support.mjs --disable
```

Le script ne supprime que le fichier FUNDING qu'il a lui-même généré.
`--check` vérifie la synchronisation sans écrire.
