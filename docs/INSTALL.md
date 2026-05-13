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

## Site public

Ouvre le site :

[Catalogue Madrador Film](https://madrador60-stremio-addon.onrender.com/)

Page de test :

[Lecteur Madrador Film](https://madrador60-stremio-addon.onrender.com/test-player)

Sur Render gratuit, le service peut dormir. Le premier chargement peut donc prendre 30 a 60 secondes. L'adresse technique Render peut garder son ancien nom meme si le site s'appelle Madrador Film.

## Site local

Depuis la racine du depot :

```powershell
node site\server.js
```

Puis ouvre :

```text
http://127.0.0.1:7000/
```

## Variables utiles

```powershell
$env:PORT='7100'
$env:PROVIDER_FILTER='frenchstream,movix,nakios,toflix'
$env:PROVIDER_TIMEOUT_MS='60000'
node site\server.js
```
