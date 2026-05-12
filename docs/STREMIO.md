# Addon Stremio

L'addon Stremio reutilise les providers Nuvio du dossier `providers/`.

## URL publique

```text
https://madrador60-stremio-addon.onrender.com/manifest.json
```

## Endpoints

| URL | Role |
|---|---|
| `/` | Page d'accueil lisible |
| `/manifest.json` | Manifest Stremio |
| `/health.json` | Statut du serveur |
| `/providers.json` | Providers actifs |
| `/stream/movie/:id.json` | Streams films |
| `/stream/series/:id:season:episode.json` | Streams series |

## Variables utiles

| Variable | Exemple | Role |
|---|---|---|
| `PORT` | `7000` | Port du serveur |
| `HOST` | `0.0.0.0` | Adresse d'ecoute |
| `STREMIO_PROVIDERS` | `frenchstream,movix,nakios` | Limite les providers |
| `PROVIDER_TIMEOUT_MS` | `45000` | Timeout par provider |
| `TMDB_API_KEY` | `...` | Cle TMDB personnalisee |
