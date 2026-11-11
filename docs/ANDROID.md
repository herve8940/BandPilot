# Installer BandPilot sur Android

> **Préversion Android 2.4.0-android.1** : APK distribué séparément de la version stable de bureau 2.3.3.

**BandPilot Android 2.4.0-android.1 est disponible en APK signé.** La tablette embarque l’interface, le moteur de console et les données : elle se connecte directement à la table par Wi-Fi, sans PC ni Docker.

[Télécharger l’APK Android](https://github.com/herve8940/BandPilot/releases/download/android-v2.4.0-android.1/BandPilot-Android-2.4.0-android.1-universal.apk) · [Version et sommes de contrôle](https://github.com/herve8940/BandPilot/releases/tag/android-v2.4.0-android.1)

## Compatibilité

- Android **8.0 minimum**, avec **Android System WebView 111 minimum**.
- APK universel pour ARM 32 bits, ARM 64 bits et x86_64. Portrait et paysage.
- Installation et démarrage en simulation vérifiés sur **Xiaomi Redmi Pad (22081283G), Android 14, ARM 64 bits** ; fonctionnement confirmé par son utilisateur. Des essais automatisés ont aussi été réalisés sur un émulateur Android 15.
- Les autres modèles de tablettes et les combinaisons tablette/console doivent encore être validés. Les appareils utilisant des pages mémoire de **16 Ko ne sont pas certifiés** pour cette première version.
- Les limites propres à chaque console restent applicables : voir la [matrice de compatibilité](multi-model.md). X32 demeure partielle et expérimentale.

## Installation

1. Télécharge l’APK sur la tablette depuis le lien ci-dessus.
2. Ouvre **Fichiers / Mes fichiers → Téléchargements**, puis touche le fichier APK.
3. Si Android le demande, autorise l’installation depuis ce gestionnaire de fichiers, puis choisis **Installer**. Avec Family Link, le parent doit autoriser l’installation dans les réglages de l’appareil supervisé.
4. Ouvre BandPilot. Le premier lancement est en **simulation**. Autoriser les notifications permet d’afficher la notification de session et son bouton **Fermer**.

L’installation est durable : **aucune signature à renouveler tous les sept jours**. Une prochaine version signée avec la même clé s’installe par-dessus et conserve les données. Une désinstallation supprime les données privées de l’application.

## Connexion directe à la console

1. Connecte la tablette au même réseau Wi-Fi que la console, même si ce réseau n’a pas Internet.
2. Dans **Réglages**, détecte la console ou renseigne son adresse IP.
3. Lis ses réglages, conserve une sauvegarde, puis active explicitement le contrôle.

Après un redémarrage ou un changement de réseau, le contrôle doit être réactivé. Aucun câble USB vers un ordinateur n’est nécessaire pour utiliser BandPilot. La connexion de la Redmi Pad à une console physique n’a pas été vérifiée par le test de démarrage.

## Ce qui est disponible

**Mon ingé son**, préparation des instruments, console, retours, ambiances des sources, scènes, répertoire, setlists, notes et fiche technique sont disponibles selon les capacités de la console. Le PDF passe par l’impression Android : **Enregistrer au format PDF**.

Les fonctions REAPER, l’enregistrement USB multipiste et l’Atelier lié à l’analyse des prises REAPER nécessitent la version ordinateur. Le conseiller local reste disponible sur Android.

**Signaler un problème** prépare un rapport debug à vérifier, enregistrer ou copier dans une issue GitHub. L’ouverture de l’issue sur Android passe par le navigateur. La recherche des prochaines versions Android se lance au démarrage lorsqu’Internet est disponible ; elle propose un téléchargement et n’interrompt pas la session.

[Compilation et détails techniques](https://github.com/herve8940/BandPilot/tree/main/android) · [Retour au site](index.html)
