# BandPilot 2.3.4 DEV — BandStudio multipiste

Cette préversion ajoute le lecteur et l'enregistreur BandStudio dans **Enregistrement**. Les commandes REAPER restent disponibles. La version stable de BandPilot est publiée séparément.

1. Installer BandPilot depuis `BandPilot-Windows-2.3.4-dev.1.exe` et ouvrir [BandStudio 0.5 DEV](https://github.com/herve8940/reacue/releases/tag/bandstudio-dev) sur le même ordinateur.
2. Dans BandStudio, ouvrir **Prises** et activer **Relier BandPilot**.
3. Dans BandPilot → **Enregistrement → BandStudio**, choisir explicitement l'interface USB, les entrées et le mode : répétition entière, prise sur le morceau ouvert, ou plage de punch.
4. Appliquer les réglages, puis lancer **REC**. **Arrêter et conserver** crée une piste WAV 24 bits par entrée armée. Les captures brutes restent dans le dossier Audio du projet.

Le bouton de reprise des entrées de la console lit son plan USB et ses noms ; il ne change pas le routage de la console. L'audio passe par USB. BandPilot transmet les commandes à BandStudio par une connexion locale activée volontairement. Le retour d'écoute se fait sur la console. Pour une prise sur un morceau : vitesse 100 %, transposition 0 et boucle désactivée. La compensation de latence est manuelle et se vérifie avec l'interface utilisée.

La connexion exige la version compatible de chaque application. Les commandes sont liées au projet affiché, les requêtes périmées sont refusées, et les départs concurrents REAPER/BandStudio sont bloqués lorsqu'un enregistrement actif est signalé. Le mode Atelier bloque également le départ d'une prise.

Tests automatiques : commandes et permissions, régressions REAPER, panneau web et démarrage du paquet Windows. La capture sur une vraie console et la latence restent à vérifier avec le matériel. Préversion non signée. Aucun réglage XR automatique n'est ajouté par cette intégration.
