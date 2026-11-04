# Ingé son : tableau de bord et guidage

## Changements

L’accueil conserve le parcours, les modèles d’instruments, les gains/repisse, les conseils locaux et l’option IA, les retours, les scènes et l’annulation. Un tableau de bord ajoute :

- une prochaine étape conseillée selon connexion, groupe, niveaux reçus et validité des calibrations ;
- les niveaux des instruments du profil, issus de la connexion WebSocket déjà utilisée par l’application ;
- un état explicite si la mesure est absente, ancienne, non numérique ou simulée ;
- le nombre de calibrations valides et une actualisation à la demande ;
- l’ouverture du contrôle des niveaux du bon instrument, ou de sa tranche Expert ;
- un accès direct à l’analyse du mix existante, sans démarrer automatiquement l’analyse ;
- le retour en haut du panneau de l’étape choisie et un état d’étape enregistrée normalisé au catalogue courant.

Les mesures et applications faites dans le parcours actualisent le tableau de bord. La calibration est lue avec la route existante `/api/coach/calibration` : cette route ne change pas le son. Elle est relue à l’ouverture, lors d’une modification de la liste d’entrées, après une mesure/application et via Actualiser ; aucun sondage permanent supplémentaire de toutes les entrées n’a été ajouté.

Une étape cochée ne prouve pas qu’un instrument a été mesuré : une calibration absente ou périmée passe avant la proposition de sauvegarde. Un niveau instantané élevé propose de vérifier l’instrument, sans en déduire automatiquement quel gain modifier. La simulation n’affiche pas de niveau matériel.

## Vérifications

- Compilation TypeScript serveur et interface Vite.
- Cinq tests du guidage : absence de mesures, simulation, déconnexion, niveau élevé ciblé, calibrations prioritaires sur les coches. Test existant de l’IA connectée avec requête simulée, sans appel externe.
- Inspection de la liaison vers Basse : étape des gains et bon instrument sélectionnés, puis bonne tranche Expert.
- Inspection du lien Analyse : vue Analyse ouverte sans lancement automatique.
- Cas réel observé en lecture seule : les six étapes sont cochées, mais un instrument a un gain changé et seuls 1/4 des instruments ont une calibration valide. Le tableau de bord propose bien de refaire la mesure concernée.
- Largeurs 320, 390, 1024 et 1440 px : pas de débordement horizontal de la page ou du tableau de bord. Vue Mac rétablie en fin d’inspection.

Aucune application de réglage, mesure avec musicien, requête IA externe ou nouvelle prise REAPER pendant cette revue. L’application installée n’est pas remplacée.

## Priorités suggérées pour la suite

1. Fiabiliser les prises REAPER, dont le défaut de sélection de prise déjà consigné dans le rapport de tests, puis valider les parcours en conditions réelles sur macOS et Windows.
2. Rapprocher les conseils de timbre de l’analyse spectrale et des réductions de gain, en indiquant toujours quelle mesure soutient la proposition et quelle part reste une hypothèse d’écoute.
3. Ajouter un retour après correction : mieux, identique, moins bien ; relier ce retour à la sauvegarde et à la proposition d’annulation existantes.
4. Mémoriser le contexte d’une séance (salle, micros, disposition, groupe et scène) pour aider à comparer deux balances sans considérer qu’une ancienne mesure reste valable ailleurs.
