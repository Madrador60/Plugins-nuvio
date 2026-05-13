# Installation

## Nuvio

Ajoute cette URL dans **Settings > Plugins** ou **Local Scrapers** :

```text
https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/
```

Puis :

1. Rafraichis la liste.
2. Active les providers souhaites.
3. Lance un film, une serie ou un anime.

## Stremio public

URL a ajouter dans Stremio :

```text
https://madrador60-stremio-addon.onrender.com/manifest.json
```

Page de test :

```text
https://madrador60-stremio-addon.onrender.com/test-player
```

Page de statut :

```text
https://madrador60-stremio-addon.onrender.com/status
```

Sur Render gratuit, le service peut dormir. Le premier chargement peut donc prendre 30 a 60 secondes.

## Stremio local

Depuis la racine du depot :

```powershell
node stremio\server.js
```

Puis ouvre :

```text
http://127.0.0.1:7000/
```

URL addon locale :

```text
http://127.0.0.1:7000/manifest.json
```

## Variables utiles

```powershell
$env:PORT='7100'
$env:STREMIO_PROVIDERS='frenchstream,movix,nakios,toflix'
$env:PROVIDER_TIMEOUT_MS='60000'
node stremio\server.js
```
