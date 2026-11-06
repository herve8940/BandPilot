> **BandPilot 2.2** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# Connexion sans configuration technique

1. Relier le PC et la XR18 au même réseau local, puis ouvrir BandPilot.
2. Ouvrir Configuration et cliquer sur **Détecter et connecter ma XR18**.
3. Une seule XR18 : connexion immédiate en lecture seule. Plusieurs consoles : choisir **Se connecter** sur la bonne ligne.
4. Pour piloter le mixage, cliquer sur **Activer le contrôle** et confirmer. La connexion seule ne change aucun réglage audio.

L’adresse, le mode et l’autorisation de contrôle sont mémorisés et repris au prochain démarrage. Le backend reste démarré pendant les changements ; HTTP, WebSocket, scènes et droits utilisent la même instance XR18. **Passer en simulation** ferme le transport matériel et réinitialise les valeurs affichées. Une réponse OSC du mixage est requise avant d’annoncer la connexion réelle ; ensuite, toute réponse de la console (valeur, vumètre) maintient la liaison. Après connexion, l’état complet de la console est relu en arrière-plan, comme la synchronisation « Mixer → PC » de X-AIR Edit, pour remplir la console graphique.

Si la recherche ne trouve rien, vérifier alimentation, réseau commun et autorisation du pare-feu pour BandPilot. Les VLAN, réseaux invités et certains Wi-Fi bloquent les broadcasts. Une saisie IP facultative reste disponible dans le panneau. La détection recherche les consoles 18 canaux (XR18, X18, MR18 et leurs versions V2, comme X-AIR Edit 1.8.1) qui répondent à `/info` sur UDP 10024. Elle ne traverse pas les routeurs. En connexion au Wi-Fi propre de la XR18, l’adresse est 192.168.1.1.

Les commandes de connexion et la détection sont réservées à l’administrateur lorsque les comptes sont activés. Une recherche concurrente partage le même scan. La connexion vérifie à nouveau l’identité de la console et lit le mixage avant de mémoriser le choix. En cas d’échec après changement de transport, la configuration précédente est restaurée. Une erreur d’identité laisse la session courante intacte.

Application de bureau : configuration dans le dossier utilisateur, fichier `connection.json`. Démarrage Node : fichier voisin de la base SQLite ; emplacement personnalisable par `XR18_CONNECTION_PATH`. Sans fichier valide, les variables d’environnement servent de valeurs initiales. Le fichier sauvegardé prend ensuite priorité.

Validation : compilation TypeScript backend et React/Vite, tests unitaires et intégration HTTP/WebSocket, émulateur OSC UDP (identité, connexion, absence d’écriture audio, erreurs, persistance et retour en simulation). La détection broadcast et le pilotage restent à vérifier avec une XR18 physique sur le réseau du PC. Aucun essai matériel n’est revendiqué.

## Diagnostiquer la connexion

Dans **Réglages → Connexion à ma console → Diagnostiquer la connexion**, BandPilot indique si tu es en simulation, si la console ne répond pas, ou si elle est joignable avec ou sans contrôle. **Vérifier le pont REAPER** distingue un pont actif, un pont à mettre à jour et un pont installé mais non démarré. L’installation du pont se fait depuis **Répéter**.
