# BandPilot — état de l’adaptation multi-modèle

Cette matrice décrit les profils de la version stable 2.3.3 et leurs limites ; ce n’est pas une certification de tous les matériels. **La compatibilité complète X32 n’est pas terminée.**

## État par famille

| Modèle | Profil d’interface et de détection | État |
|---|---|---|
| Behringer XR18 / X18 | 16 tranches mono + auxiliaire stéréo, 16 préamplis, 6 sorties Aux, interface USB 18×18 | Fonctionnement existant conservé. XR18V2 reconnue sur le réseau réel, firmware 1.23 ; aucune écriture audio pendant cette adaptation. |
| Midas MR18 | Même famille de protocole, identité Midas conservée | Identités et profils testés par simulateurs ; validation matérielle à faire. |
| Behringer XR12 / Midas MR12 | 12 entrées physiques affichées, 4 préamplis micro, 2 sorties Aux physiques ; enregistreur stéréo sur clé, pas d’interface USB multipiste PC | Profils, limites et garde-fous ajoutés. MR12 inspectée en simulation. Vérification sur appareil réel indispensable, notamment gains des entrées ligne, routage et banques de mesures. |
| Behringer X32, Rack, Compact, Producer, Core | 32 canaux, 16 bus, 8 DCA, 6 matrices, Main stéréo et mono ; port OSC 10023 | **Adaptateur partiel en validation.** Mélangeur de base, EQ, commandes principales de dynamique et envois des canaux aux 16 bus. Protocoles testés sur faux équipement local. |

Les six bus internes de la petite famille X-Air ne signifient pas six prises de retour : XR12/MR12 disposent de deux sorties Aux physiques. Les retours guidés et QR sont bornés à ces sorties. La rangée Aux de l’interface est distincte des douze entrées physiques.

## X32 : fonctions encore à adapter

- Préamplis et affectation des sources (prises locales, stageboxes AES50, gains partagés, trim et 48 V).
- Routage complet, affectation des sorties et envois des bus vers les matrices.
- Aux/retours FX, huit processeurs FX et leurs paramètres spécifiques.
- Scènes complètes et synchronisation Table↔PC ; aucun fichier X-Air n’est envoyé comme scène X32.
- Décodage des vumètres, spectre et réduction de gain X32.
- Détection de la carte audio et de son routage, préparation multipiste REAPER.
- Adaptation du coach et des retours téléphone aux 32 canaux / 16 bus.
- Validation physique de chaque trajet, avant utilisation live.

Les fonctions concernées sont signalées ou bloquées côté serveur. L’absence de vumètre n’est pas remplacée par un faux signal. Un brouillon X32 partiel est archivé à part avant une connexion réelle, sans le présenter comme une scène complète synchronisable.

## Détection et architecture

`shared/mixer-models.ts` centralise modèle, marque, famille, ports et capacités. `/info` et `/xinfo` sont sondés sur UDP 10024 (X-Air/M-Air) et 10023 (X32). L’identité renvoyée détermine le profil ; l’adresse IP ne détermine jamais le modèle. Les appareils inconnus sont refusés. Si plusieurs consoles répondent, l’interface laisse choisir ; elle ne sélectionne pas arbitrairement la première. Au démarrage d’une connexion réelle mémorisée, l’identité est relue ; faute d’identité vérifiée, les écritures sont désactivées.

Le nom du modèle est conservé : une MR18 ne devient plus artificiellement une « XR18 » dans les résultats. Les variantes V2 et X32 sont normalisées vers un profil de capacité reconnu. La connexion manuelle recherche les deux ports sans imposer un modèle.

`src/mixer-capabilities.ts` borne les paramètres par modèle et traduit le noyau X32 : Main `/main/st/...`, bus `/bus/01/...` et affectation LR `/mix/st`. Les chemins canoniques de l’application ne sont pas envoyés tels quels à une autre famille. Les entrées inexistantes et les fonctions non prises en charge sont également refusées par le serveur ; ce n’est pas uniquement un masquage visuel.

Les anciennes adresses X-Air restent un ensemble distinct des paramètres ajoutés à la X32. Captures, synchronisation et scène vierge prennent le catalogue du modèle. Les nouvelles scènes complètes portent leur modèle ; un rappel croisé requiert une conversion explicite. L’identité des prévisualisations inclut le modèle et le changement de console invalide leur usage. Les liens QR hors des capacités du nouveau modèle sont refusés.

## Nom et données existantes

Le nom affiché devient **BandPilot** (interface, titre, menus de bureau et noms des installateurs). La marque et le modèle sont affichés séparément. L’appId, le dossier de données `xr18-studio`, les clés de stockage et les chemins du pont REAPER restent des identifiants de compatibilité : ils ne sont pas renommés à l’aveugle, pour préserver les réglages, scènes, comptes et intégrations. Les liens GitHub historiques et documents des versions déjà publiées restent historiques. Le packaging inclut maintenant `dist/shared`.

La publication des installateurs est effectuée par le workflow de version après ses contrôles ; elle ne remplace pas automatiquement l’application déjà installée.

## Vérifications réalisées

- Compilation serveur TypeScript et interface Vite.
- Batterie complète : 131 tests réussis, y compris les tests existants de scènes, FX, gains guidés, retours téléphone, comptes, OSC, REAPER et synchronisation.
- Tests supplémentaires du profil matériel : XR12/MR12, MR18/V2, X32/variantes ; rejet des identités inconnues ; conservation de marque et firmware ; changement de nombre de canaux ; refus d’accès à une entrée ou fonction non disponible.
- Faux X32 UDP : Main stéréo natif, bus 16, canal 32 et écriture avec lecture de retour. Aucun trafic matériel réel dans ces tests.
- Détection physique uniquement : XR18 à 192.168.68.83, firmware 1.23, port 10024, par demandes `/info` et `/xinfo` sans argument de réglage.
- Inspection visuelle sur instance isolée avec base temporaire : canal 32 et ses 16 envois ; profil Midas MR12 avec 12 entrées + Aux. Le contrôle du navigateur est devenu irrégulier pendant les derniers essais ; aucune connexion réelle n’a été activée dans cette instance.
- Vérification ciblée finale de l’archivage du brouillon X32 et des protections de scènes natives.

Seule une XR18 est disponible chez l’utilisateur. Aucune validation matérielle XR12, MR12, MR18 ou X32 n’est donc annoncée.

## Références

- [Behringer XR12](https://www.behringer.com/en/products/0605-AAB) : équipement physique et enregistreur USB stéréo.
- [Midas MR12](https://www.midasconsoles.com/en/products/0605-AAE) : préamplis, bus internes et fonctions.
- [Manuel fabricant MR18/MR12](https://mediadl.musictribe.com/media/PLM/data/docs/M-Air/M_MI_0605-AAF_MR18-MR12_EN.pdf) : distinction interface USB multipiste / enregistreur stéréo.
- [Documentation et recherches de Patrick-Gilles Maillot sur le protocole X32](https://pmaillot.github.io/X32-Behringer/) : référence primaire de l’auteur des recherches de protocole. Aucun code externe n’a été copié.
