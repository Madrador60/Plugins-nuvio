# Architecture

## Vue d'ensemble

```text
Nuvio
  lit manifest.json
  charge providers/*.js

Stremio
  lit stremio/manifest.json via /manifest.json
  appelle /stream/movie/:imdb.json ou /stream/series/:imdb:s:e.json
  recoit des streams proxifies
```

## Dossiers

| Chemin | Role |
|---|---|
| `manifest.json` | Manifest Nuvio |
| `providers/` | Providers compatibles Nuvio |
| `stremio/server.js` | Serveur addon Stremio |
| `stremio/manifest.json` | Manifest Stremio |
| `scripts/test-providers.js` | Test manuel des providers |
| `domains.json` | Domaines connus et fallbacks |
| `render.yaml` | Deploiement Render |

## Flux Stremio

1. Stremio demande `/manifest.json`.
2. Stremio demande `/stream/...`.
3. Le serveur convertit l'ID IMDb en TMDB avec l'API TMDB.
4. Le serveur appelle les providers.
5. Les liens video sont transformes en URLs `/proxy/.../stream.mp4` ou `/proxy/.../stream.m3u8`.
6. Stremio lit l'URL proxifiee.

## Proxy media

Le proxy sert a :

- ajouter les headers `Referer`, `Origin`, `User-Agent` quand ils sont requis ;
- exposer `Content-Range`, `Accept-Ranges`, `Content-Length` pour les lecteurs web ;
- reecrire les playlists HLS pour que les segments passent aussi par le proxy ;
- donner une extension visible (`stream.mp4`, `stream.m3u8`) aux lecteurs.
