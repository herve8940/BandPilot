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
| Rapport de problème | GitHub : description et diagnostic de l'aperçu ; une issue est publique | Action explicite de création/envoi ou copie dans le navigateur |
| Conseiller IA facultatif | OpenAI : question, type de source, mode/état de connexion et langue ; aucun flux audio envoyé par ce conseiller | Clé et modèle configurés, puis accord explicite avant la question |
| Liens externes | GitHub, documentation ou Ko-fi | Ouverture du lien par l'utilisateur |

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
