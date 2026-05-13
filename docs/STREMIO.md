# Addon Stremio

L'addon Stremio reutilise les providers Nuvio du dossier `providers/`.

## URL publique

```text
https://madrador60-stremio-addon.onrender.com/manifest.json
```

Page publique :

```text
https://madrador60-stremio-addon.onrender.com/
```

Page de test avec recherche :

```text
https://madrador60-stremio-addon.onrender.com/test-player
```

## Endpoints

| URL | Role |
|---|---|
| `/` | Page d'accueil lisible |
| `/manifest.json` | Manifest Stremio |
| `/health.json` | Statut du serveur |
| `/config.json` | Configuration active |
| `/providers.json` | Providers actifs |
| `/diagnostics.json` | Test rapide des providers principaux |
| `/search.json?type=movie&q=Interstellar` | Recherche TMDB pour la page de test |
| `/test-player` | Lecteur web de diagnostic |
| `/status` | Page de statut des providers |
| `/stream/movie/:id.json` | Streams films |
| `/stream/series/:id:season:episode.json` | Streams series |

## Si Stremio Web ne lance pas la video

1. Teste la meme recherche sur `/test-player`.
2. Si `/test-player` lit la video, le proxy fonctionne.
3. Supprime puis rajoute l'addon dans Stremio.
4. Essaie en priorite les streams `MP4`, puis les streams `M3U8`.
5. Si Stremio Web bloque encore, teste l'application Stremio Desktop : elle gere parfois mieux certains streams que le site web.

## Variables utiles

| Variable | Exemple | Role |
|---|---|---|
| `PORT` | `7000` | Port du serveur |
| `HOST` | `0.0.0.0` | Adresse d'ecoute |
| `STREMIO_PROVIDERS` | `frenchstream,movix,nakios` | Limite les providers |
| `PROVIDER_TIMEOUT_MS` | `45000` | Timeout par provider |
| `TMDB_API_KEY` | `...` | Cle TMDB personnalisee |
