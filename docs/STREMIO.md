# Addon Stremio

L'addon Stremio reutilise les providers Nuvio du dossier `providers/`.

## URLs publiques

| Usage | URL |
|---|---|
| Manifest | `https://madrador60-stremio-addon.onrender.com/v3/manifest.json` |
| Catalogue / accueil | `https://madrador60-stremio-addon.onrender.com/` |
| Catalogue direct | `https://madrador60-stremio-addon.onrender.com/catalog` |
| Test player | `https://madrador60-stremio-addon.onrender.com/test-player` |
| Providers | `https://madrador60-stremio-addon.onrender.com/providers` |
| Statut | `https://madrador60-stremio-addon.onrender.com/status` |
| Diagnostic | `https://madrador60-stremio-addon.onrender.com/diagnostics.json` |

## Endpoints

| Endpoint | Role |
|---|---|
| `/` | Catalogue public |
| `/manifest.json` | Manifest Stremio |
| `/v3/manifest.json` | Manifest Stremio versionne pour eviter le cache de Stremio Web |
| `/health.json` | Statut minimal du serveur |
| `/config.json` | Configuration active |
| `/providers.json` | Providers actifs |
| `/providers` | Page publique des providers, etats, formats et domaines |
| `/catalog` | Page catalogue films/series |
| `/catalog/movie/madrador-movies.json` | Catalogue films expose a Stremio |
| `/catalog/series/madrador-series.json` | Catalogue series expose a Stremio |
| `/catalog/:type/:id/search=query.json` | Recherche catalogue exposee a Stremio |
| `/catalog.json` | Donnees catalogue TMDB avec cache |
| `/details.json?type=movie&id=157336` | Fiche detail TMDB |
| `/diagnostics.json` | Test rapide des providers principaux |
| `/search.json?type=movie&q=Interstellar` | Recherche TMDB |
| `/stremio-open.json?type=movie&id=157336` | Genere les liens Stremio Desktop/Web depuis un ID TMDB |
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

## Integration Stremio

Le manifest declare maintenant :

- `stream` avec `types` et `idPrefixes: ["tt"]`, pour que Stremio demande les streams sur les fiches Cinemeta IMDb ;
- `catalog`, avec un catalogue films et un catalogue series visibles dans Stremio ;
- la recherche catalogue via l'extra `search`.

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
| `SEARCH_CACHE_TTL_MS` | `600000` | Cache des recherches TMDB |
| `STREAM_CACHE_TTL_MS` | `180000` | Cache court des streams |
| `DIAGNOSTIC_CACHE_TTL_MS` | `120000` | Cache du diagnostic providers |
