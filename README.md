# Madrador60's Nuvio Providers

Providers francais pour Nuvio.

## Installation

Dans Nuvio, ajoute cette URL dans les Local Scrapers :

```text
https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/
```

## Providers inclus

- Anime-Sama
- VoirAnime
- VostFree
- AnimoFlix
- French Anime
- AnimeVostFR
- AnimesUltra
- JetAnimes
- Sekai
- Movix VF
- MugiwaraStream
- AnimeSite
- FrenchStream
- Nakios
- Purstream
- ToFlix
- VIDEASY
- CinemaCity

## Notes

Le fichier `manifest.json` ne garde que les providers avec `fr` dans `contentLanguage`.

Les providers doivent rester compatibles avec l'environnement Nuvio :

- pas de `async/await`
- utiliser `fetch()`
- exporter `getStreams(tmdbId, mediaType, seasonNum, episodeNum)`

## Disclaimer

Ce repo ne stocke et n'heberge aucun contenu video. Les providers fonctionnent comme des scrapers locaux pour Nuvio.
