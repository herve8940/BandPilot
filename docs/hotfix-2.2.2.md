---
layout: default
title: Correctif REAPER 2.2.2
lang: fr
---
# Correctif REAPER 2.2.2

Le décrochage signalé concerne la liaison avec REAPER : REAPER reste ouvert et continue d’enregistrer.

## Corrections

- Pont **1.2.3** : échanges isolés par requête, pour que deux instances de BandPilot ne puissent plus consommer leurs réponses respectives. Lecture des anciennes versions conservée pour permettre la mise à jour.
- REC, Stop et transport prioritaires sur les demandes de formes d’onde ; demandes simultanées d’état regroupées.
- Verrouillage temporaire d’un fichier sous Windows : une réponse reste en attente et est réécrite au tour suivant, sans réexécuter REC. Une requête qui n’a pas pu être retirée n’est pas exécutée.
- Calcul des nouvelles formes d’onde suspendu pendant la prise.
- Stop reste utilisable si l’application a perdu la liaison pendant une prise.

## Mise à jour nécessaire

Mettre à jour BandPilot, puis aller dans **Répéter → Installer le pont**, sauvegarder les projets et redémarrer REAPER. Vérifier que le pont indique **1.2.3**. La mise à jour de l’application seule ne remplace pas automatiquement un script déjà actif dans REAPER.

## Validation et limites

140 tests serveur et 4 tests React ont réussi. Après le dernier renforcement du retrait des requêtes, les 17 tests ciblés du pont et des régressions ont été rejoués avec succès. Les tests couvrent deux clients concurrents, la priorité du transport, les fins de ligne Windows et les refus temporaires de suppression/renommage de fichiers. Les tests de verrouillage Windows sont simulés ; une validation sur le PC Windows concerné reste nécessaire.

Sur le Mac, deux anciens serveurs de test perturbaient l’application installée. Les délais de lecture atteignaient six secondes. Après leur arrêt, une prise réelle sur le projet de test a été confirmée et arrêtée depuis BandPilot. Ce conflit constaté sur Mac ne suffit pas à expliquer à lui seul le cas d’une installation Windows neuve.

La construction locale macOS Intel **2.2.2** a été installée et le pont **1.2.3** rechargé sur le Mac. Une nouvelle prise a été confirmée depuis BandPilot ; deux clients supplémentaires ont simultanément obtenu huit séries de réponses de transport correctes (86 à 582 ms). Stop a terminé la prise et le transport est revenu à `ready`, sans alerte. Les essais ont utilisé le projet « CODEX TEST Repeter avec morceaux ». Ces essais précèdent la publication 2.2.2 qui regroupe ce correctif et la console personnelle. Ils ne constituent pas une validation de l’enregistrement sur le PC Windows concerné.
