# Console Expert visuelle

Révision inspirée de la référence « XR18 Studio en mode expert.png » fournie par Hervé.

## Organisation

- Menu latéral de 64 px par défaut, agrandissable. Bandeau commun compact, palette bleu nuit / violet / cyan, cartes et boutons cohérents dans le projet.
- Les anciens outils de console restent dans le menu « Outils » du bandeau, sans rangée supplémentaire permanente.
- Vue Canal : banques Canaux, Bus/Main, FX et DCA ; sélection par icônes vectorielles communes à macOS et Windows. Le canal sélectionné revient dans la zone visible de sa banque.
- Tranche sélectionnée : vrai niveau, vumètre, mute, solo si disponible, panorama si disponible, navigation précédent/suivant. Sur les petits formats, le fader devient horizontal pour conserver de la place pour les traitements.
- Accès direct Préampli, Gate, Compresseur, EQ, Envois et Sortie/groupes. Les traitements non applicables au type de tranche sont absents.
- Compresseur : courbe calculée depuis les paramètres reçus et commandes rotatives de seuil, ratio, attaque, relâchement et gain. Les autres paramètres et presets restent dans « Réglages avancés ».
- Aperçu EQ multicolore, redimensionné par ResizeObserver sans déformer les points ni les textes. Le bouton EQ ouvre les contrôles complets (quatre bandes sur entrée, six sur bus/Main).
- Mélangeur : banque des 16 entrées ou Aux/retours FX, puis 15 sorties/groupes et fiche continue des paramètres, comme dans la première adaptation.
- Transport REAPER en bas des vues : enregistrement, lecture, stop, marqueur et configuration ; 16 vumètres d’entrée sur les grandes fenêtres.

## Données et protections

Les commandes utilisent les adresses et les contrôles existants ; les conversions du compresseur reprennent celles du panneau d’origine. La lecture seule, le verrouillage du Main en Ears seulement et les confirmations des opérations sensibles sont conservés. Les boutons rotatifs ont désormais un viewBox et un état ARIA désactivé explicite ; les faders exposent aussi cet état.

GET `/api/dynamics` demande les banques de mesures existantes, sans changer le son, et expose la dernière trame `/meters/6` uniquement si la console est connectée et la trame date de moins de deux secondes. L’indicateur choisit le compresseur du canal, du bus ou du Main. Sans mesure récente, en cas d’erreur ou avec l’ancien serveur, il affiche « — ». Une réponse 404 arrête les requêtes répétées jusqu’au prochain changement de canal. Aucun niveau ou état CPU fictif n’est affiché.

L’aperçu 5174 utilise encore le serveur de l’application installée : le nouvel endpoint de réduction de gain prendra effet après intégration du serveur modifié. Cette mesure en direct n’a pas été validée sur le matériel pendant cette adaptation. Les boutons REAPER sont raccordés aux routes existantes ; aucune lecture ou prise réelle n’a été lancée pendant la revue visuelle.

## Vérifications

- Compilation serveur TypeScript et interface Vite. Sept tests du transport REAPER réussis (confirmation de prise, erreurs, compteur figé, arrêt et perte de liaison).
- Douze tests de décodage OSC, analyse et protection Ears seulement réussis, dont les trames de réduction de gain via un faux équipement local.
- Navigation entrée, gate et dix envois ; ouverture EQ quatre bandes, bus six bandes ; DCA sans commandes de traitement audio ; sélection et retour en haut de panneau.
- Contrôles en lecture seule pendant l’inspection.
- Affichage dans Chrome/macOS aux formats 320×700, 390×844, 1024×600, 1366×768 et 1920×1080. Aucun débordement horizontal de la page constaté. Banques et onglets défilent localement ; les petites fenêtres conservent un défilement vertical pour les paramètres détaillés.
- Cohérence visuelle inspectée sur Répéter et Setlists. Validation native Windows non effectuée.

Sources et aperçu modifiés ; application dans /Applications non remplacée. Aucun commit ni publication.
