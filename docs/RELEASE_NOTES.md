# BandPilot 2.2.3 — français / English

## Français

BandPilot devient multilingue : **français et anglais**, avec un sélecteur dans **Réglages → Options · Langue**. Le changement est immédiat et le choix reste mémorisé après redémarrage, même si le port local de l’application change.

- Console Simple/Expert, préparation, retours, répétitions, enregistrement, aides et confirmations traduits.
- Langue indépendante sur le téléphone de chaque musicien ; choix également disponible à la connexion.
- Menus et confirmations de l’application de bureau adaptés à la langue choisie.
- Conseiller local capable de reconnaître les problèmes décrits en anglais ; conseiller connecté invité à répondre dans la langue sélectionnée.
- Les noms personnels, projets REAPER, adresses OSC et valeurs audio restent inchangés.
- **D’autres langues peuvent être ajoutées suivant la demande.**

Cette version part de la branche stable 2.2.2, sans intégration de la branche `dev`. Elle conserve la régie des retours, les dispositions personnalisées et le correctif de liaison **REAPER 1.2.3**. Si ce pont n’est pas encore installé, mets-le à jour dans Répéter, sauvegarde tes projets et redémarre REAPER.

## English

BandPilot is now multilingual: **English and French**, selectable in **Settings → Options · Language**. Switching is immediate and the choice survives a restart, including changes to the desktop app’s local port.

- Translated Simple/Expert mixer, setup, monitors, rehearsals, recording, help and confirmations.
- Each musician can choose a language on their phone; selection is also available at sign-in.
- Native desktop menus and confirmations follow the selected language.
- The local adviser understands English problem descriptions; connected advice uses the selected language.
- Personal names, REAPER projects, OSC addresses and audio values remain unchanged.
- **More languages can be added on request.**

Based on stable 2.2.2, without merging `dev`. Includes the monitor desk, personal layouts and the **REAPER 1.2.3** connection fix. If that bridge is not installed yet, update it from Rehearse, save projects and restart REAPER.

## Installers / Installateurs

| Platform | Package |
|---|---|
| Windows | `BandPilot-Windows-2.2.3.exe` |
| macOS Intel | `BandPilot-macOS-2.2.3-x64.dmg` |
| macOS Apple Silicon | `BandPilot-macOS-2.2.3-arm64.dmg` |
| Debian / Ubuntu | `BandPilot-Linux-2.2.3-amd64.deb` |
| Other Linux | `BandPilot-Linux-2.2.3-x86_64.AppImage` |

Packages and SHA-256 checksums are published together after platform tests and native startup checks. Packages may be unsigned/unnotarised. Back up scenes before updating.

## Compatibilité / Compatibility

Essais physiques sur XR18. X18, MR18, XR12 et MR12 : profils testés, validation physique propre à chaque appareil restante. X32 : prise en charge **partielle et expérimentale**. XR12/MR12 : USB stéréo sur clé, pas d’interface USB multipiste vers le PC.

Hardware testing has been performed on XR18. Other model profiles still need their own physical validation. X32 support is **partial and experimental**. XR12/MR12 offer stereo USB-drive recording, not a PC multitrack USB interface. See the [compatibility matrix](https://herve8940.github.io/BandPilot/multi-model.html).
