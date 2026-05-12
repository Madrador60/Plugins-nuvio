# Madrador60 Stremio Addon

Addon Stremio local qui reutilise les providers du repo Nuvio.

## URL publique

```text
https://madrador60-stremio-addon.onrender.com/manifest.json
```

Page d'accueil :

```text
https://madrador60-stremio-addon.onrender.com/
```

## Lancer en local

Depuis la racine du repo :

```powershell
node stremio\server.js
```

Puis ajoute cette URL dans Stremio :

```text
http://127.0.0.1:7000/manifest.json
```

Sur une TV ou un telephone, remplace `127.0.0.1` par l'adresse IP du PC :

```text
http://192.168.1.20:7000/manifest.json
```

## Options

Changer le port :

```powershell
$env:PORT='7100'
node stremio\server.js
```

Tester seulement certains providers :

```powershell
$env:STREMIO_PROVIDERS='frenchstream,movix,nakios'
node stremio\server.js
```

Changer le timeout :

```powershell
$env:PROVIDER_TIMEOUT_MS='60000'
node stremio\server.js
```

## Notes

- Stremio envoie des IDs IMDb (`tt...`). Le serveur les convertit en TMDB avant d'appeler les providers.
- Les films utilisent surtout les providers films/series.
- Les series peuvent utiliser les providers anime et films/series.
- Certains streams qui demandent des headers speciaux peuvent ne pas marcher dans tous les lecteurs Stremio.
- `/` affiche une page lisible pour les visiteurs.
- `/health.json` permet de verifier que le serveur repond.
- `/providers.json` liste les providers actifs.
