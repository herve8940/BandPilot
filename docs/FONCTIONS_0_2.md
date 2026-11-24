> **BandPilot 2.2** : [guide illustré actuel](USER_GUIDE_FR.md), [vidéo](VIDEO_TOUR.md) et [limites par modèle](multi-model.md). Les descriptions détaillées X-Air ci-dessous ne signifient pas une compatibilité complète X32. Les éventuelles anciennes captures de référence ne montrent pas toutes la nouvelle interface.

# Guide BandPilot 0.2.0

## Console et scènes

Dans Configuration : **Détecter et connecter ma XR18**, puis **Activer le contrôle** pour autoriser les modifications. La connexion ne modifie pas le son.

L’onglet **Contrôles** propose les canaux, bus, master, envois/retours FX, DCA, préamplis, routages et configuration. Cliquer sur **Lire les réglages**, saisir les modifications puis **Prévisualiser** et confirmer. Les unités sont Hz, dB, ms, pourcentage ou options selon le paramètre. Le 48 V exige une confirmation distincte. Les autres onglets ouvrent leurs groupes respectifs.

Dans Effets, **Lire le slot** charge son algorithme et son vecteur de paramètres typés. Les valeurs sont des OSC normalisés 0–1 ou des entiers selon le type reçu, jamais selon l’apparence du nombre. Modifier puis enregistrer/appliquer. Après un changement d’algorithme : appliquer puis relire pour obtenir ses nouveaux paramètres. Les cartes musicales restent des suggestions consultatives.

Dans Snapshots, renseigner un nom et **Sauvegarder la scène complète**. La capture réelle exige toutes les lectures et peut prendre du temps. Prévisualiser puis confirmer le rappel. Les prévisualisations expirent après une minute ou une modification de l’état suivi. Les sauvegardes antérieures apparaissent dans la bibliothèque et sont rappelables. Une erreur indique le caractère potentiellement partiel de l’opération et l’identifiant de sauvegarde.

Les `.scn` natifs restent des archives importables/exportables ; les paramètres FX textuels opaques bloquent leur rappel. Capturer une scène JSON version 2 pour un rappel complet utilisant les valeurs OSC.

## Retours in-ear

L’administrateur attribue les bus aux comptes musiciens. **Retours in-ear** affiche les bus autorisés et les niveaux lus, avec boutons ±5 %. Le serveur refuse les bus non attribués, les niveaux supérieurs à 0,75 et les gestes de plus de 0,10 pour un musicien. Sauvegarder le mix courant ; le rappel d’un profil est progressif. Ce plafond numérique ne garantit pas un niveau acoustique sûr à l’oreille.

## Concert

Dans Répéter, ouvre les projets REAPER du concert, puis choisis **Préparer la setlist**. Sélectionne les titres à ajouter. Dans **Setlist**, déplace les morceaux et place les rappels. **Ouvrir le concert** affiche cet ordre au pupitre. Le bouton Suivant avance la liste. La lecture de l’accompagnement, de l’original ou d’une prise se lance séparément. Une fiche PDF déjà jointe au morceau est consultable sur scène.

## Multiappareils HTTPS

Le démarrage standard reste local. Créer d’abord les comptes en local, puis définir les variables suivantes pour le backend réseau :

```text
XR18_HTTP_HOST=0.0.0.0
HTTP_PORT=3443
XR18_TLS_CERT=/chemin/studio-cert.pem
XR18_TLS_KEY=/chemin/studio-key.pem
XR18_ALLOWED_HOSTS=studio.exemple.local
XR18_WEB_DIST=/chemin/xr18-studio/web/dist
```

Le certificat doit être approuvé par les clients. Ouvrir `https://studio.exemple.local:3443` sur le téléphone et se connecter avec le compte musicien. Le serveur refuse le démarrage réseau sans HTTPS et comptes existants. Hôtes, schémas et ports d’origine doivent correspondre. Limiter l’accès au réseau local.

## MCP

Lancer `npm run mcp` dans un client MCP stdio. `XR18_STUDIO_URL` pointe vers le backend HTTP local. Utiliser les identifiants d’environnement ci-dessus si les comptes sont activés.

Outils : statut, catalogue, rafraîchissement, prévisualisation/application des paramètres, capture de scène complète, bibliothèque, prévisualisation/rappel de preset, niveau de retour attribué. Les mutations exigent `confirm: true`, avec autorisation distincte du 48 V. Les droits sont exécutés par le backend.

## Vérifications

Tests automatisés : unités et formats OSC, noms, ratio entier, routages, DCA, retours, FX typés dont float32 0/1, confirmations, sauvegardes, scènes, droits, origines HTTPS et passerelle MCP authentifiée. Compilation backend/frontend, syntaxe Electron et parcours navigateur connexion/contrôles/routage/DCA/FX sans erreur JavaScript.

Sur matériel : vérifier chaque famille de contrôles sur le firmware de la XR18, les FX et leur lecture vectorielle, capturer/rappeler une scène de test, connecter les clients HTTPS, essayer le déclencheur REAPER et contrôler les niveaux avant utilisation en concert.

Références : [Music Tribe, protocole X AIR](https://cdn.mediavalet.com/aunsw/musictribe/hmivS7F05kKSJlWDYPGLpA/agTKkSIWS0y1bJl97YZEjg/Original/X%20AIR%20Remote%20Control%20Protocol.pdf), [xair-scene-manager](https://github.com/stblassitude/xair-scene-manager), [transport xair-api-go](https://github.com/stblassitude/xair-api-go/blob/main/WIRE_PROTOCOL.md). Attribution MIT des schémas dans `THIRD_PARTY_NOTICES.txt`.

## Installateurs

Les Actions GitHub produisent Windows, Linux et deux paquets macOS distincts : Intel (x64, pour le MacBook Intel) et Apple Silicon (arm64). Choisir le paquet correspondant au processeur. Les applications ne sont pas signées/notariées ; installation et test sur le poste cible restent nécessaires.
