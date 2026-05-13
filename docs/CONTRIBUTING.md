# Contribution

## Ajouter un provider

1. Cree un fichier dans `providers/mon-provider.js`.
2. Exporte une fonction `getStreams`.
3. Ajoute l'entree dans `manifest.json`.
4. Teste le provider.

Exemple minimal :

```javascript
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return Promise.resolve([]);
}

module.exports = { getStreams };
```

## Entree manifest

```json
{
  "id": "mon-provider",
  "name": "Mon Provider",
  "filename": "providers/mon-provider.js",
  "supportedTypes": ["movie", "tv"],
  "enabled": true,
  "contentLanguage": ["fr"],
  "formats": ["mp4", "m3u8"]
}
```

## Tests recommandes

```powershell
node --check providers\mon-provider.js
node scripts\test-providers.js --only=mon-provider --timeout=60000
```

## Bonnes pratiques

- Prioriser les liens directs `mp4` et `m3u8`.
- Eviter les cookies prives dans le code.
- Ajouter des fallbacks de domaines si le site change souvent.
- Retourner un tableau vide plutot que faire planter le provider.
- Garder les logs utiles mais pas trop bruyants.
