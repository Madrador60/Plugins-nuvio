# Sources francaises

Ce depot garde deux niveaux de sources francaises :

- **Actives** : provider JavaScript present dans `providers/`, active dans `manifest.json`, utilisable par le site Madrador Film.
- **A porter** : source Kotlin conservee dans `docs/provider-sources/fr/`, ajoutee au `manifest.json`, mais `enabled: false` pour ne pas casser Render tant que le port JavaScript n'est pas termine.

## Actives

| Provider | Type | Fichier |
| --- | --- | --- |
| Anime-Sama | Anime / films / series | `providers/anime-sama.js` |
| VoirAnime | Anime | `providers/voiranime.js` |
| Vostfree | Anime VF/VOSTFR | `providers/vostfree.js` |
| AnimoFlix | Anime | `providers/animoflix.js` |
| French-Anime | Anime VF/VOSTFR | `providers/french-anime.js` |
| AnimeVOSTFR | Anime VF/VOSTFR | `providers/animevostfr.js` |
| AnimesUltra | Anime VF/VOSTFR | `providers/animesultra.js` |
| JetAnimes | Anime | `providers/jetanimes.js` |
| Sekai | Anime | `providers/sekai.js` |
| Mugiwara-no-Streaming | Anime / scans | `providers/mugiwarastream.js` |
| AnimeSite | Anime | `providers/animesite.js` |
| Frenchstream | Films / series | `providers/frenchstream.js` |
| Movix | Films / series | `providers/movix.js` |
| Nakios | Films / series FR/EN | `providers/nakios.js` |
| Purstream | Films / series FR/EN | `providers/purstream.js` |
| ToFlix | Films / series FR/EN | `providers/toflix.js` |
| VIDEASY | Multi-langue dont FR | `providers/videasy.js` |
| CinemaCity | Multi-langue dont FR | `providers/cinemacity.js` |

## Sources Kotlin ajoutees en reference

| Provider | Domaine actuel | Source |
| --- | --- | --- |
| AfterDark | `https://afterdark.best` | `docs/provider-sources/fr/AfterDarkProvider.kt` |
| FrenchManga | `https://w16.french-manga.net` | `docs/provider-sources/fr/FrenchMangaProvider.kt` |
| Frembed | `https://frembed.one` | `docs/provider-sources/fr/FrembedProvider.kt` |
| FrenchAnime | `https://french-anime.com` | `docs/provider-sources/fr/FrenchAnimeProvider.kt` |
| FrenchStream | `https://fs03.lol` / `https://fstream.info` | `docs/provider-sources/fr/FrenchStreamProvider.kt` |
| Kidraz | `https://www.kidraz.com/saby1jy/home/kidraz` | `docs/provider-sources/fr/KidrazProvider.kt` |
| Otakufr | `https://otakufr.cc` | `docs/provider-sources/fr/OtakufrProvider.kt` |
| 1Jour1Film | `https://1jour1film0126b.site` | `docs/provider-sources/fr/UnJourUnFilmProvider.kt` |
| Wiflix | `http://flemmix.best` | `docs/provider-sources/fr/WiflixProvider.kt` |

## Prochaine etape

Porter les sources Kotlin une par une vers `providers/*.js`, puis passer `enabled` a `true` seulement apres :

1. `node --check providers/nom.js`
2. test `/stream/movie/...json`
3. test sur Render
4. verification que le provider ne ralentit pas trop les autres sources
