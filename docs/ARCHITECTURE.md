# Architecture

## Vue d'ensemble

```text
Nuvio
  lit manifest.json
  charge providers/*.js

Madrador Film
  sert le catalogue web
  appelle les providers
  proxifie les liens MP4/HLS pour le lecteur
```

## Dossiers

| Chemin | Role |
|---|---|
| `assets/` | Images et logos publics |
| `manifest.json` | Manifest Nuvio |
| `providers/` | Providers compatibles Nuvio |
| `stremio/server.js` | Serveur web Madrador Film |
| `scripts/test-providers.js` | Test manuel des providers |
| `scripts/update-manifest.js` | Ajout automatique des nouveaux providers au manifest |
| `domains.json` | Domaines connus et fallbacks |
| `render.yaml` | Deploiement Render |

## Pages web

| Page | Role |
|---|---|
| `/` | Catalogue films/series |
| `/catalog` | Alias du catalogue |
| `/test-player` | Lecteur de test avec recherche et filtres MP4/HLS |
| `/status` | Diagnostic providers |
| `/providers` | Etat public des providers, langues, formats et domaines |

## Lecture

1. Le site cherche un titre avec TMDB.
2. Le serveur appelle les providers actifs.
3. Les liens video sont transformes en URLs `/proxy/.../stream.mp4` ou `/proxy/.../stream.m3u8`.
4. Le lecteur web lit l'URL proxifiee.

## Proxy media

Le proxy sert a :

- ajouter les headers `Referer`, `Origin`, `User-Agent` quand ils sont requis ;
- exposer `Content-Range`, `Accept-Ranges`, `Content-Length` pour les lecteurs web ;
- reecrire les playlists HLS pour que les segments passent aussi par le proxy ;
- donner une extension visible (`stream.mp4`, `stream.m3u8`) aux lecteurs.

## Cache

| Cache | Duree par defaut |
|---|---|
| Recherche TMDB | 10 minutes |
| Streams providers | 3 minutes |
| Diagnostic | 2 minutes |
| Catalogue | 30 minutes |
