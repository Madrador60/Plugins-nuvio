# Addon Stremio

L'addon Stremio reutilise les providers Nuvio du dossier `providers/`.

## URLs publiques

| Usage | URL |
|---|---|
| Manifest | `https://madrador60-stremio-addon.onrender.com/manifest.json` |
| Accueil | `https://madrador60-stremio-addon.onrender.com/` |
| Catalogue | `https://madrador60-stremio-addon.onrender.com/catalog` |
| Test player | `https://madrador60-stremio-addon.onrender.com/test-player` |
| Statut | `https://madrador60-stremio-addon.onrender.com/status` |
| Diagnostic | `https://madrador60-stremio-addon.onrender.com/diagnostics.json` |

## Endpoints

| Endpoint | Role |
|---|---|
| `/` | Page d'accueil |
| `/manifest.json` | Manifest Stremio |
| `/health.json` | Statut minimal du serveur |
| `/config.json` | Configuration active |
| `/providers.json` | Providers actifs |
| `/catalog` | Page catalogue films/series |
| `/catalog.json` | Donnees catalogue TMDB avec cache |
| `/diagnostics.json` | Test rapide des providers principaux |
| `/search.json?type=movie&q=Interstellar` | Recherche TMDB |
| `/test-player` | Lecteur web de diagnostic |
| `/status` | Page de statut providers |
| `/stream/movie/:id.json` | Streams films |
| `/stream/series/:id:season:episode.json` | Streams series |
| `/proxy/:payload/stream.ext` | Proxy media MP4/HLS |

## Lecture video

Le serveur renvoie a Stremio :

- des streams MP4 en priorite quand ils existent ;
- des streams HLS en second choix ;
- des URLs proxifiees pour ajouter les headers requis ;
- `filename`, `bingeGroup` et `notWebReady` dans `behaviorHints`.

## Si Stremio Web ne lance pas la video

1. Teste le meme titre sur `/test-player`.
2. Si `/test-player` lit la video, le proxy fonctionne.
3. Supprime puis rajoute l'addon dans Stremio.
4. Essaie en priorite les sources `MP4`.
5. Teste Stremio Desktop si Stremio Web bloque encore.

## Variables utiles

| Variable | Exemple | Role |
|---|---|---|
| `PORT` | `7000` | Port du serveur |
| `HOST` | `0.0.0.0` | Adresse d'ecoute |
| `STREMIO_PROVIDERS` | `frenchstream,movix,nakios` | Limite les providers |
| `PROVIDER_TIMEOUT_MS` | `45000` | Timeout par provider |
| `TMDB_API_KEY` | `...` | Cle TMDB personnalisee |
