# Compteur anonyme d’utilisation

Petit service (Cloudflare Workers + base D1, offre gratuite) qui reçoit le message
quotidien des applications BandPilot et calcule les totaux. Il n’est **pas** inclus
dans l’application.

Ce qui est conservé, par jour et par installation : le numéro aléatoire, la version,
la plateforme (`windows`, `macos`, `linux`, `android`), le canal (`release` ou
`source`) et le modèle de console. Aucune adresse IP, aucun en-tête, aucun autre
contenu. Les lignes de plus de 400 jours sont effacées chaque nuit.

## Mise en service (une seule fois)

1. Crée un compte gratuit sur <https://dash.cloudflare.com/sign-up>.
2. Dans ce dossier :

   ```sh
   npx wrangler login
   npx wrangler d1 create bandpilot-usage --location=weur
   ```

   Copie l’identifiant affiché (`database_id`) dans `wrangler.toml`.
3. Crée la table et le mot de passe des statistiques :

   ```sh
   npx wrangler d1 execute bandpilot-usage --remote --file=schema.sql
   npx wrangler secret put STATS_TOKEN
   ```

   Pour `STATS_TOKEN`, choisis une longue phrase secrète : elle protège la lecture des chiffres.
4. Publie le compteur :

   ```sh
   npx wrangler deploy
   ```

   Wrangler affiche l’adresse, par exemple `https://bandpilot-usage.<ton-compte>.workers.dev`.
5. Dans le dépôt BandPilot, mets cette adresse suivie de `/v1/ping` dans
   `shared/usage-endpoint.ts`, puis publie une nouvelle version. Tant que ce champ est
   vide, l’application n’envoie rien et n’affiche pas l’avis.

## Lire les chiffres

```sh
curl -H "Authorization: Bearer TA_PHRASE_SECRETE" "https://bandpilot-usage.<ton-compte>.workers.dev/v1/stats?days=30"
```

Réponse : installations sur la période, utilisateurs actifs par jour, nouvelles
installations par jour, et répartition par plateforme, version et modèle de console.
Les lancements depuis les sources (`npm run …`) sont comptés à part dans `fromSource`.

## Vérifications

- Les journaux du Worker sont désactivés dans `wrangler.toml` (`observability`), pour
  ne pas conserver d’adresse IP. Ne les réactive pas.
- Un message invalide (format, date à plus d’un jour, champ inconnu) est refusé.
- Une même installation n’est comptée qu’une fois par jour.
