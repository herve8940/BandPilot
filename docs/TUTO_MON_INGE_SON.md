# BandPilot 2.2 — Mon ingé son, pas à pas

[Français](TUTO_MON_INGE_SON.md) · [English](TUTO_MON_INGE_SON_EN.md) · [Italiano](TUTO_MON_INGE_SON_IT.md) · [Español](TUTO_MON_INGE_SON_ES.md) · [Deutsch](TUTO_MON_INGE_SON_DE.md)

[English](TUTO_MON_INGE_SON_EN.md) · [Guide complet](USER_GUIDE_FR.md) · [Visite vidéo](VIDEO_TOUR.md)

Le coach accompagne la balance ; il ne reçoit pas le son, ne remplace pas ton écoute et ne décide pas seul d’une bonne qualité acoustique. Ce parcours concerne les modèles X-Air/M-Air pris en charge, **pas la X32** dans cette version. Les captures 2.2.4 sont réalisées en simulation. Lis les [limites matérielles](multi-model.md).

![Le tableau de bord Mon ingé son](images/bandpilot-2.2.4/coach.jpg)

## 1. Brancher et connecter

Garde les sorties et écouteurs bas. Relie ordinateur et console au même réseau. Dans Réglages, détecte la console, vérifie son modèle et commence en lecture seule. Récupère l’état **Table → PC**, puis garde une scène de sauvegarde. Active le contrôle seulement pour appliquer une modification voulue. En simulation, tu peux explorer mais aucune mesure réelle n’est produite.

![Connexion en lecture seule ou simulation explicite](images/bandpilot-2.2.4/connexion.jpg)

## 2. Dire qui est branché où

Ouvre **Mon ingé son → Dire qui est branché où**. Choisis un modèle de groupe ou ajoute tes instruments et leurs prises. Vérifie chant, basse, guitares, batterie ou module stéréo. Une batterie détaillée doit suivre les micros vraiment branchés. Le nombre d’entrées et les préamplis pilotables dépendent du modèle. Les noms de ton groupe restent une préparation tant que tu n’appliques pas les réglages correspondants à la console.

Relis chaque proposition de coupe-bas, gate, EQ et compression. Les seuils dépendent du niveau réel. Le coach ne change pas silencieusement l’alimentation 48 V.

## 3. Mesurer le gain, un musicien à la fois

Demande au musicien de jouer son passage le plus fort. Lance sa mesure ; si elle est absente, trop faible ou trop courte, recommence. Examine le gain proposé, ouvre l’aperçu puis applique si adapté. Remesure après changement : l’ancienne mesure ne décrit plus le nouvel état. Une entrée ligne sans préampli micro pilotable ne doit pas proposer un gain de préampli fictif.

## 4. Écouter et corriger un problème

Décris ce qui gêne : brouillon, agressif, trop sourd, voix masquée… Lis l’explication et change une chose à la fois. Le coach peut refuser une proposition incompatible avec le type de filtre : vérifie le canal dans Expert au lieu de forcer une écriture.

![Compresseur et aperçu EQ dans le canal Expert](images/bandpilot-2.2.4/expert-canal.jpg)

Les faders directs modifient immédiatement le mix lorsque le contrôle est actif. Les propositions guidées utilisent aperçu, sauvegarde et annulation. **Annuler le dernier réglage guidé** ne constitue pas un historique universel de tous les gestes manuels. L’analyse et les comparaisons A/B demandent des mesures matérielles disponibles et une écoute humaine.

## 5. Préparer les retours

Ajoute chaque musicien, son rôle, ses sources et son bus. Vérifie la vraie sortie physique : XR18/MR18/X18 ont six Aux ; XR12/MR12 en ont deux malgré leurs bus internes. Commence pré-fader pour que les réglages de façade ne suivent pas automatiquement dans les oreilles.

![Envois et retours dans le mode Expert](images/bandpilot-2.2.4/regie-retours.jpg)

Applique une proposition de départ à faible volume. Crée les liens personnels, démarre le partage local et fais scanner chaque QR sur le même réseau. Le musicien ne règle que son bus. Contrôle les niveaux, sauvegarde un profil si utile et arrête le partage après usage. Le plafond et les limiteurs ne garantissent pas à eux seuls un niveau d’écoute sûr.

## 6. Garder le bon réglage

Enregistre une scène nommée et exporte le JSON pour sauvegarde. Avant un rappel, vérifie le modèle et le sens de synchronisation. Le rappel guidé exclut le 48 V par défaut et garde un état précédent. Les scènes complètes X32 et les conversions automatiques entre modèles ne sont pas disponibles.

Prépare aussi tes notes et la setlist active : elles sont conservées sur l’ordinateur, indépendamment du port utilisé au prochain démarrage.

![Notes et confirmation de sauvegarde](images/bandpilot-2.2.4/notes.jpg)

Pour enregistrer ou rejouer les morceaux, suis [Répéter avec REAPER](USER_GUIDE_FR.md#reaper). La simulation de console ne transforme pas REAPER en simulateur audio.
