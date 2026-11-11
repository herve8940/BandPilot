# Activer Ko-fi pour BandPilot

L'intégration est préparée, **sans compte de paiement actif**. Aucun identifiant Ko-fi
n'est deviné et aucun bouton de paiement ne pointe vers un compte d'exemple.
Les pages proposent déjà les contributions non financières.

## Étapes réservées au propriétaire du compte

1. Crée ton compte sur [Ko-fi](https://ko-fi.com/). Choisis un nom public lié à BandPilot
   si disponible ; vérifie l'adresse exacte de ta page.
2. Connecte ton moyen de réception des paiements dans Ko-fi. Le service demande PayPal
   ou Stripe ; suis ses instructions et vérifie les conditions/frais affichés dans ton compte.
3. Renseigne la présentation ci-dessous et vérifie la page publique en étant déconnecté.
4. Fournis uniquement l'URL publique de la page. Aucun mot de passe, jeton ou détail de
   paiement n'est nécessaire pour l'intégration GitHub.

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

Depuis la racine du dépôt, remplace `IDENTIFIANT_VERIFIE` par l'identifiant réel de la page :

```sh
node scripts/sync-support.mjs --username IDENTIFIANT_VERIFIE
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

Le script ne supprime que le fichier FUNDING qu'il a lui-même généré. La configuration
initiale ne contient pas de FUNDING actif. `--check` vérifie la synchronisation sans écrire.
