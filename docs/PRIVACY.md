---
title: Données et confidentialité / Data and privacy
---

# Données et confidentialité

Cette page décrit le fonctionnement observé dans les sources lors de la revue du
11 novembre 2026. Elle distingue l'application locale, le site et les services externes.

## Application et réseau local

Groupes, musiciens, fiches techniques, scènes, notes, préférences et journaux sont
conservés sur l'appareil qui fait fonctionner BandPilot. Les retours personnels partagent
les informations utiles sur le réseau local. Le contrôle fonctionne sans compte Internet.
Conserve des sauvegardes et ne partage les liens musicien qu'aux personnes concernées.
Les noms et coordonnées d'une fiche technique peuvent apparaître dans ses PDF exportés.

## Quand des informations quittent l'appareil

| Fonction | Destination et données | Déclenchement |
|---|---|---|
| Recherche de mise à jour | GitHub : versions et métadonnées publiques ; le service reçoit les informations réseau habituelles, dont l'adresse IP | Au démarrage des applications qui proposent cette fonction et lors d'une recherche manuelle |
| Statistiques anonymes | Compteur BandPilot : numéro aléatoire d'installation, version, plateforme, canal (release ou sources) et modèle de console ; aucune adresse IP conservée | Au plus une fois par jour, après l'avis affiché au premier lancement ; désactivable dans Paramètres |
| Rapport de problème | GitHub : description et diagnostic de l'aperçu ; une issue est publique | Action explicite de création/envoi ou copie dans le navigateur |
| Conseiller IA facultatif | OpenAI : question, type de source, mode/état de connexion et langue ; aucun flux audio envoyé par ce conseiller | Clé et modèle configurés, puis accord explicite avant la question |
| Liens externes | GitHub, documentation, Discord ou Ko-fi | Ouverture du lien par l'utilisateur |

Les filtres de diagnostic masquent plusieurs catégories de données sensibles. Une
description libre ou capture peut encore contenir des informations personnelles : relis-la
avant publication. Exporter localement un rapport ne l'envoie pas. Les vingt derniers
rapports natifs restent dans le dossier `reports` de l'application. Les journaux ont
une rotation ; les fichiers exportés restent là où tu les enregistres.

Sur ordinateur, clés IA et jeton GitHub enregistrés par l'interface utilisent le chiffrement
du système ; le stockage est refusé si ce coffre n'est pas disponible. Les installations
configurées par variables d'environnement sont administrées par leur propriétaire.
Déconnecter GitHub ou retirer la configuration IA supprime les identifiants enregistrés
par cette fonction, pas les publications déjà faites chez le service externe.

## Statistiques anonymes d'utilisation

Pour savoir combien de musiciens utilisent BandPilot, l'application peut envoyer
**au plus une fois par jour** un court message à un compteur exploité par le projet :

- un numéro d'installation tiré au hasard (il ne permet pas de savoir qui tu es) ;
- la version de BandPilot et la plateforme (Windows, macOS, Linux ou Android) ;
- le canal (version publiée ou lancement depuis les sources) ;
- le modèle de console connectée, `simulation` ou `none`.

Rien d'autre : ni nom, ni adresse, ni réglage, ni scène, ni audio, ni journal. Le
compteur ne conserve pas l'adresse IP et efface les données de plus de 400 jours. Les
chiffres servent uniquement à mesurer l'audience de BandPilot (nombre d'installations,
plateformes, versions et consoles utilisées) ; ils ne sont ni vendus ni croisés avec
d'autres données. Le code du compteur est public dans `services/usage-counter`.

Rien n'est envoyé avant l'affichage de l'avis au premier lancement. Désactive le
comptage avec **Désactiver** dans cet avis ou dans **Paramètres › Statistiques
anonymes** : le numéro aléatoire est alors effacé de l'appareil. La variable
d'environnement `BANDPILOT_USAGE_STATS=0` le désactive aussi. Pour faire effacer les
données déjà reçues, communique ce numéro (fichier `usage-stats.json` du dossier de
données) via [l'assistance BandPilot](https://github.com/herve8940/BandPilot/blob/main/SUPPORT.md).

## Communauté Discord

Les liens Discord du site et de l’application ouvrent un service externe sur action
de l’utilisateur. Aucun widget Discord n’est intégré et aucun diagnostic, réglage
de console ou enregistrement n’est envoyé automatiquement à Discord. Ce que tu
publies dans les salons est partagé avec leurs membres ; relis et masque les données
privées avant envoi. Le compte Discord est facultatif pour utiliser BandPilot.

## Site et soutien

Le site charge images, vidéo et scripts depuis GitHub Pages. Il n'intègre ni mesure
d'audience ajoutée par BandPilot, ni formulaire de paiement, ni widget Ko-fi. L'hébergeur
traite ses propres requêtes et journaux techniques. Les badges du README peuvent charger
des ressources de GitHub et Shields.io.

Un simple lien ouvre [la page Ko-fi de BandPilot](https://ko-fi.com/bandpilot) ;
aucun paiement ne transite par BandPilot. Les règles des
services externes s'appliquent lors de leur utilisation :
[GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement),
[OpenAI](https://openai.com/policies/privacy-policy/), [Ko-fi](https://ko-fi.com/Home/PrivacyPolicy).

Sauvegarde tes données locales avant suppression. Pour un contenu publié ou un paiement
externe, utilise les outils du service concerné. Consulte [l'assistance BandPilot](https://github.com/herve8940/BandPilot/blob/main/SUPPORT.md)
sans publier les données privées.

<a id="english"></a>
## English

BandPilot stores band profiles, musician details, riders, scenes, notes, preferences and
logs on the device running it. Monitor sharing uses the local network. Control works
without an internet account. Exported riders can include the contact details you entered.

Update checks contact GitHub at startup and on manual requests. Public version queries
expose normal network metadata, including your IP, to that service. Bug reports reach
GitHub only when you send them or submit them in your browser; issues are public.
Review descriptions, screenshots and diagnostics even though filters exist. Local
export does not send a report. The desktop app retains its latest twenty native reports;
logs rotate, and exported files remain where you save them.

Optional AI sends your question, source type, connection state/mode and language to
OpenAI after explicit consent, with your configured key/model. That adviser sends no
audio stream. Desktop credentials saved through the UI use encrypted system storage,
or saving is refused. Environment-based configuration is the operator's responsibility.
Disconnecting credentials does not remove already published content.

The website adds no analytics or Ko-fi widget; GitHub Pages handles its hosting requests.
README badges may load GitHub/Shields.io resources. Support uses an external link to
[BandPilot on Ko-fi](https://ko-fi.com/bandpilot). BandPilot processes no payments.
External providers' policies apply on their services. Back up local data before deletion;
use the relevant provider to manage published content or payments. Never post private data
in a public support request.

Anonymous usage statistics: at most once a day, BandPilot can send its usage counter a
random installation number, the app version, the platform, the channel (release or
source) and the connected mixer model (or `simulation`/`none`). Nothing else: no name,
address, setting, scene, audio or log. The counter keeps no IP address, deletes data
after 400 days and only measures BandPilot's audience; data is never sold or combined.
Nothing is sent before the first-launch notice is shown. Turn it off with **Disable** in
that notice or in **Settings › Anonymous statistics**, which erases the random number;
`BANDPILOT_USAGE_STATS=0` also disables it. The counter's code is in `services/usage-counter`.

Discord links open an external service only when selected. No Discord widget is
embedded and no diagnostic, mixer setting or recording is automatically sent to
Discord. Messages you post are shared with channel members. Review private data
before posting. A Discord account is not required to use BandPilot.
