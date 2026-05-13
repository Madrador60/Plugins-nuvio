# Rapport de tests

Dernier test manuel : 2026-05-13

## Site Madrador Film

| Verification | Resultat | Notes |
|---|---|---|
| `/` | OK | Catalogue en premiere page |
| `/catalog` | OK | Alias du catalogue |
| `/catalog.json?refresh=1` | OK | 24 categories, environ 864 titres, regeneration forcee |
| `/test-player` | OK | Recherche, filtres et lecteur integre |
| `/brand.svg` | OK | Logo public du site |
| `/banner.svg` | OK | Banniere GitHub |
| `/catalog.json` | OK | Catalogue TMDB mis en cache |
| `/details.json?type=movie&id=157336` | OK | Donnees de fiche film |
| `/providers` | OK | Etat public des providers |
| `/providers` filtre | OK | Recherche provider/domaine/format |
| `/providers` test | OK | Diagnostic rapide par provider |
| `/search.json?type=movie&q=Interstellar` | OK | Recherche TMDB |
| `/stream/movie/tt0816692.json` | OK | Retourne des sources MP4/HLS quand les providers en trouvent |
| Proxy MP4 | OK | Supporte `Range`, `Content-Range` et `Accept-Ranges` |
| Proxy HLS | OK | Reecrit les playlists pour passer les segments par le proxy |

## Commandes utiles

```powershell
node --check site\server.js
node --check scripts\test-providers.js
node scripts\test-providers.js --only=frenchstream,movix,nakios,toflix --timeout=60000
```

## Providers films

| Statut | Provider | Notes |
|---|---|---|
| OK | `movix` | Retourne des sources rapidement |
| OK | `frenchstream` | Fonctionne, parfois plus lent |
| OK | `nakios` | Retourne plusieurs sources |
| OK | `purstream` | Fonctionne selon les titres |
| OK | `toflix` | Retourne au moins une source sur les tests |
| OK, lent | `videasy` | Peut demander un timeout plus long |
| Limite | `cinemacity` | A garder documente tant qu'un acces public fiable n'est pas confirme |

## Providers animes

| Statut | Provider | Notes |
|---|---|---|
| OK | `anime-sama` | Sources trouvees sur les tests |
| OK | `voiranime` | Sources trouvees sur les tests |
| OK | `vostfree` | Sources trouvees sur les tests |
| Instable | `animoflix` | Peut fonctionner puis timeout |
| OK | `french-anime` | Sources trouvees sur les tests |
| OK | `animevostfr` | Sources trouvees sur les tests |
| OK | `animesultra` | Sources trouvees sur les tests |
| OK, lent | `jetanimes` | Mieux avec `--timeout=45000` ou plus |
| Zero | `sekai` | Peut ne rien trouver selon le titre |
| OK | `mugiwarastream` | Sources trouvees sur les tests |
| Timeout | `animesite` | A surveiller |

## Notes

- Un provider qui retourne `0` n'est pas forcement mort : le titre peut manquer ou le domaine peut avoir change.
- Les providers lents doivent etre testes avec un timeout plus haut.
- Le site ne contient aucune video et affiche seulement les sources trouvees par les providers externes.
