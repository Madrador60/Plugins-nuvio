# Installation

## Nuvio

Ajoute cette URL dans **Settings > Plugins** ou **Local Scrapers** :

```text
https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/
```

Ensuite, rafraichis la liste et active les providers que tu veux.

## Stremio heberge

URL actuelle :

```text
https://madrador60-stremio-addon.onrender.com/manifest.json
```

Si Render est en veille, le premier chargement peut prendre un peu de temps.

## Stremio local

```powershell
node stremio\server.js
```

Puis ajoute dans Stremio :

```text
http://127.0.0.1:7000/manifest.json
```
