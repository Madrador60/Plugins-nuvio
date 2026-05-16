# Providers

Les providers sont classes par type :

- `providers/movies/` : films et series.
- `providers/anime/` : animes.
- `providers/mixed/` : providers transverses futurs.
- `providers/disabled/` : references conservees mais non actives.

`manifest.json` est la source officielle. Un provider desactive doit avoir `enabled: false`.

## Format de sortie conseille

```js
{
  provider: "frenchstream",
  title: "Titre source",
  url: "https://example.test/video.m3u8",
  quality: "1080p",
  language: "VF",
  type: "hls",
  external: false,
  score: 0
}
```

## Tester

```powershell
npm run test:quick
npm run test:films
npm run test:anime
```

Les resultats mettent a jour `data/provider-status.json`.
