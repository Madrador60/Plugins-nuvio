# Depannage

## Stremio affiche `No streams were found`

1. Verifie que l'addon installe est bien :

```text
https://madrador60-stremio-addon.onrender.com/manifest.json
```

2. Supprime l'ancien addon dans Stremio.
3. Recharge Stremio Web avec `Ctrl + F5`.
4. Reinstalle l'addon.
5. Teste le titre sur `/test-player`.

## Le site lit la video mais pas Stremio Web

Le proxy fonctionne, mais le lecteur Stremio Web peut bloquer certains formats.

Actions conseillees :

1. Essaie une source `MP4`.
2. Essaie Stremio Desktop.
3. Supprime et reinstalle l'addon pour vider le cache.

## Render met longtemps a repondre

Le plan gratuit peut mettre le service en veille.

Attends 30 a 60 secondes, puis recharge.

## Un provider retourne 0 stream

Ca peut venir de :

- titre absent de la source ;
- domaine change ;
- site temporairement bloque ;
- timeout trop court ;
- contenu uniquement disponible dans une autre langue.

## Verifier le serveur

```text
https://madrador60-stremio-addon.onrender.com/health.json
https://madrador60-stremio-addon.onrender.com/diagnostics.json
```

## Tester localement

```powershell
node stremio\server.js
node scripts\test-providers.js --only=frenchstream,movix,nakios,toflix --timeout=60000
```
