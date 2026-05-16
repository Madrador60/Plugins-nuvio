# Madrador Film - Plugins Nuvio FR

Madrador Film est un catalogue web sombre et responsive pour explorer des films, series et animes, tester des providers Nuvio francais, suivre leur etat, et deployer facilement sur Render.

Le projet ne stocke aucune video, ne contourne aucun DRM, ne contourne aucun paywall et ne doit pas utiliser de cookies prives ou d'acces caches.

## Ouvrir le site

| Page | Lien |
|---|---|
| Catalogue | [https://madrador60-stremio-addon.onrender.com/](https://madrador60-stremio-addon.onrender.com/) |
| Lecteur de test | [https://madrador60-stremio-addon.onrender.com/test-player](https://madrador60-stremio-addon.onrender.com/test-player) |
| Fournisseurs | [https://madrador60-stremio-addon.onrender.com/providers](https://madrador60-stremio-addon.onrender.com/providers) |
| Admin | [https://madrador60-stremio-addon.onrender.com/admin](https://madrador60-stremio-addon.onrender.com/admin) |

## Installation locale

Le plus simple sur Windows :

```text
ouvrir-madrador.bat
```

Ou depuis `site-madrador/` :

```text
ouvrir-site.bat
```

Ne double-clique pas directement sur `index.html`, car le site a besoin du serveur pour les API.

```powershell
npm install
copy .env.example .env
npm start
```

Puis ouvre `http://127.0.0.1:7000/`.

## Scripts utiles

```powershell
npm run check
npm run test:routes
npm run test:site
npm run test:quick
npm run test:films
npm run test:anime
npm run test:domains
npm run test:all
npm run manifest:update
```

Les rapports JSON sont generes dans `data/reports/`.

## Architecture V2

- `site/server.js` : compatibilite Render, importe `src/server/app.js`.
- `src/server/app.js` : serveur HTTP principal et routes compatibles.
- `site-madrador/` : vrai front-end HTML/CSS/JS servi par `/`, `/catalog`, `/details`, `/player`, `/providers`, `/admin`.
- `src/services/` : domaines, score providers, cache futur, services metier.
- `src/utils/` : logger, reponses JSON, sanitization, fetch avec timeout.
- `providers/anime/`, `providers/movies/`, `providers/disabled/` : providers classes proprement.
- `data/` : cache, rapports et etats persistants.
- `docs/` : documentation projet.
- `archive/` : anciens fichiers conserves avec explication.

## Providers

Les providers actifs sont declares dans `manifest.json`. Chaque provider doit retourner des streams dans un format coherent :

```js
{
  provider: "frenchstream",
  title: "...",
  url: "...",
  quality: "1080p",
  language: "VF",
  type: "mp4",
  external: false,
  score: 0
}
```

Les providers non portes ou instables restent dans `providers/disabled/` ou avec `enabled: false`.

## Score providers

Les tests mettent a jour `data/provider-status.json` :

- `OK`
- `LENT`
- `INSTABLE`
- `TIMEOUT`
- `ZERO_RESULT`
- `DISABLED`
- `ERROR`

Le score monte quand une source est trouvee rapidement, baisse lors des erreurs, timeouts ou resultats vides.

## Domaines

`domains.json` accepte l'ancien format et le nouveau :

```json
{
  "frenchstream": {
    "domains": ["https://fstream.info", "https://fs03.lol"],
    "lastChecked": null,
    "status": "unknown"
  }
}
```

Teste les domaines avec :

```powershell
npm run domains:check
```

## Admin

La page `/admin` affiche l'etat du serveur. Les actions sensibles exigent `ADMIN_TOKEN`.

Variables utiles :

```env
ENABLE_ADMIN=true
ADMIN_TOKEN=change-moi
```

## Render

Le deploiement Render utilise `render.yaml` et `node site/server.js`.

Variables recommandees :

- `NODE_ENV=production`
- `TMDB_API_KEY` pour avoir le catalogue complet TMDB avec affiches, nouveautes et tendances
- `ADMIN_TOKEN`
- `PROVIDER_TIMEOUT_MS=45000`
- `CATALOG_CACHE_TTL_MS=1800000`

Sans `TMDB_API_KEY`, le site garde un catalogue de secours avec affiches, mais il ne peut pas afficher automatiquement toutes les nouveautes TMDB.

## Nouveautes V3

- Fiche detail plus proche d'une plateforme streaming : grand fond, casting, trailer, recommandations.
- Series : saisons, episodes, miniatures, resume, episode precedent/suivant, episodes vus.
- Lecteur : source suivante/prececente, filtres MP4/HLS/VF/MULTI/VOSTFR, reprise automatique.
- Sources : tri MP4 puis VF/MULTI, score provider affiche, bouton signaler une source morte.
- Catalogue : recherche universelle films/series/acteurs, filtres annee/genre/type, tri populaire/recent/note/A-Z.
- Providers : domaine actif, score, succes/erreurs, dernier test et page plus lisible.

## Documentation

Lis aussi :

- [Installation](docs/INSTALL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Providers](docs/PROVIDERS.md)
- [Tests](docs/TESTING.md)
- [Securite](docs/SECURITY.md)
- [Legal](docs/LEGAL.md)
- [Depannage](docs/TROUBLESHOOTING.md)
- [Changelog](docs/CHANGELOG.md)
