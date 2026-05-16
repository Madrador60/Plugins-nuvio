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
