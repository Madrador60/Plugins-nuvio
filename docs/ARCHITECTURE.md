# Architecture

## Vue d'ensemble

Le projet garde une compatibilite simple avec Render :

```text
site/server.js -> src/server/app.js
src/server/app.js -> site-madrador/*.html
```

`site/server.js` est volontairement petit. Toute la logique vit dans `src/`.

## Dossiers

```text
src/
  server/
    app.js
    routes/
    middlewares/
    controllers/
  services/
  config/
  utils/
  public/
  views/

providers/
  anime/
  movies/
  mixed/
  disabled/
  utils/

data/
  cache/
  reports/

archive/
site-madrador/
```

## Compatibilite

Les routes historiques restent actives :

- `/`
- `/catalog`
- `/details`
- `/player`
- `/catalog.json`
- `/details.json`
- `/search.json`
- `/stream/:type/:id.json`
- `/providers`
- `/test-player`

Les routes V2 ajoutent l'admin, la sante, le legal et les rapports providers.

## Routes V3 utiles

- `/episodes.json?id=TV_ID&season=1` : episodes d'une saison, avec miniatures et resumes quand TMDB est configure.
- `/recommendations.json?type=movie&id=TMDB_ID` : titres similaires.
- `/search.json?type=all&q=...` : recherche films, series et acteurs.
- `/search.json?type=person&q=...` : recherche acteurs.
- `POST /report/source` : signale une source morte dans `data/reports/dead-sources.json`.

Le front `site-madrador/` consomme ces routes directement pour la fiche detail, le lecteur, le catalogue et la page providers.
