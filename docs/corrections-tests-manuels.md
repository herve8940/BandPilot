# Corrections issues des essais manuels — 4 novembre 2026

Le [rapport original](tests-manuels-2026-11-04.md) conserve les observations de la session du 3 au 4 novembre. Il décrit l’ancienne application installée, avant ces corrections. Cette page distingue les corrections dans les sources des validations qui restent à effectuer dans REAPER et sur matériel.

| Observation | Correction et vérification |
| --- | --- |
| Erreur `SetActiveTake` sur « Prise 3 » | Le pont valide chaque pointeur de prise, ignore les emplacements vides et refuse proprement un numéro absent. Les choix proposés utilisent les indices valides des pistes REC de la plage, sans supposer des nombres de prises identiques. Test du script Lua de production avec emplacements vides et contrôle des indices. |
| « Original ReaCue » sans résultat confirmé | Écoute de l’original avec les REC coupées et les stems ouverts. Retour restaure les mutes précédents, y compris les REC déjà coupées. État relu depuis REAPER, sauvegarde distincte par projet. Sélectionner une prise ou appliquer la présence quitte ce mode. Test Lua de restauration et de répétition de la commande. |
| Boucle sans confirmation | Vérification des bornes, du repeat et de leur lecture après commande. Plages invalides refusées. Arrêt de boucle possible même hors d’une section. Changements refusés pendant REC. Test Lua des bornes et de l’état. |
| Présence conservée à tort entre projets | Cases dérivées des pistes REC réellement armées du projet ouvert ; suppression du fichier de présence global comme source d’état. Les commandes présence/prises/boucle/original portent le chemin du projet et sont refusées si celui-ci change avant leur exécution. |
| Formes d’onde conservées entre projets | Réinitialisation des pistes du lecteur lors du changement de projet pour ne pas réutiliser les pics d’un autre fichier. |
| Rappel de scène bloqué par le 48 V en simulation | L’interface demande explicitement une exclusion du 48 V ; cette option appartient au jeton d’aperçu. La confirmation reste obligatoire pour les autres rappels qui incluent le 48 V. Sauvegarde préalable conservée. Test automatique et parcours HTTP complet sur instance simulée. |
| « Console connectée / Contrôle actif » en simulation | Mentions « Simulation · aucune console pilotée » et « Simulation modifiable ». Explication de la distinction entre noms simulés et configuration du groupe. |
| Téléphone déjà ouvert restant en lecture seule | Nouvel instantané envoyé à chaque changement de connexion/autorisation. Test WebSocket : lecture seule → contrôle → lecture seule, sans rechargement du téléphone. |
| Brouillon et setlist active perdus au changement de port | Persistance SQLite côté application avec état de sauvegarde affiché ; migration du brouillon navigateur quand aucun brouillon serveur n’existe. Une copie locale est conservée si un ancien brouillon navigateur diffère de celui du serveur. Test fermeture/réouverture de la base et essai visuel entre ports 5177 et 5178. Les données déjà perdues ne sont pas reconstruites. |
| Ajouter un morceau vide sans explication | Bouton désactivé et indication de titre requis. Vérification visuelle. |
| Date de session décalée après minuit | Suffixe fondé sur le calendrier local de l’ordinateur ; test à 00:05 en Europe/Brussels, quand la date UTC est encore celle de la veille. |
| USB simulé pointant partout sur Ch01 | Affectations analogiques et USB initiales distinctes, canal pour canal ; modifications explicites du simulateur conservées. Test automatique. Le simulateur ne constitue pas une lecture du routage matériel. |
| REC disponible dans une vue mais désactivé dans le dock | Les deux vues demandent une session préparée. Le parcours Répéter conserve le REC dans le projet ouvert selon ses pistes armées. Avertissement explicite : la simulation de console ne simule pas les entrées audio de REAPER. |

## Validation de cette correction

- Compilation TypeScript serveur et interface Vite réussie.
- Suite complète : **137 tests réussis** (dont régressions Lua, sauvegarde du brouillon, 48 V, date locale, routage simulé et permissions téléphone).
- Le script Lua est exécuté dans un interpréteur de test avec une doublure de l’API REAPER ; cela ne remplace pas la relecture de la prise de test dans REAPER réel.
- Le parcours de rappel de scène a été exécuté sur une instance isolée en simulation, avec base temporaire et sauvegarde préalable.
- Aucun nouveau réglage n’a été envoyé à la console réelle. Aucun projet audio existant n’a été modifié pour ces vérifications.

## Déploiement et limites

Les corrections du pont nécessitent **la version 1.2.2**, proposée dans Répéter après mise à jour de l’application, puis un redémarrage de REAPER lorsque les projets sont sauvegardés. Le pont actuellement chargé dans REAPER et l’application installée ne sont pas remplacés par ces changements de sources.

Restent à valider sur un vrai parcours musical : écoute et qualité audio, nouvelles prises puis sélection/relecture dans REAPER, coexistence avec ReaCue actif, scènes complètes PC → Table, routage et 48 V matériels, concert complet, comptes activés, IA connectée et import/export natif expérimental. Ce sont des validations ou intégrations restantes ; elles ne sont pas présentées comme des bugs tous reproduits et corrigés. Le refus du coach sur un type de filtre incompatible conserve sa protection explicite.

La compatibilité X32 complète reste un chantier distinct, décrit dans [l’état multi-modèle](multi-model.md).

Référence API utilisée pour les vérifications de pointeurs de prises et la lecture des boucles : [documentation officielle ReaScript de REAPER](https://www.reaper.fm/sdk/reascript/reascripthelp).
