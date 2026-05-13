# Providers

## Films et series

| Provider | Langue | Etat | Notes |
|---|---|---|---|
| Frenchstream | FR | OK | Domaines fallback inclus |
| Movix | FR | OK | Source rapide pour films/series |
| Nakios | FR/EN | OK | MP4 et HLS, souvent prioritaire |
| Purstream | FR/EN | OK | VF/VOSTFR/MULTI |
| ToFlix | FR/EN | OK | MP4 utile pour le lecteur web |
| VIDEASY | Multi dont FR | Lent | Peut necessiter un timeout plus haut |
| CinemaCity | Multi dont FR | Limite | Peut demander un acces/cookie |

## Animes

| Provider | Langue | Etat | Notes |
|---|---|---|---|
| Anime-Sama | FR | OK | Gros catalogue anime |
| VoirAnime | FR | OK | VF/VOSTFR |
| Vostfree | FR | OK | VF/VOSTFR |
| French-Anime | FR | OK | VF/VOSTFR |
| AnimeVOSTFR | FR | OK | VF/VOSTFR |
| AnimesUltra | FR | OK | Anime VF/VOSTFR |
| JetAnimes | FR | OK, lent | Tester avec timeout plus haut |
| Mugiwara-no-Streaming | FR | OK | Anime via API Next.js |
| AnimoFlix | FR | Instable | Peut timeout |
| Sekai | FR | Limite | Peut retourner 0 selon le contenu |
| AnimeSite | FR | Instable | Timeout observe |

## Tester

Providers films principaux :

```powershell
node scripts\test-providers.js --only=frenchstream,movix,nakios,toflix --timeout=60000
```

Tous les providers :

```powershell
node scripts\test-providers.js --timeout=60000
```

## Interpreting results

| Resultat | Signification |
|---|---|
| `OK` | Le provider retourne au moins un stream |
| `ZERO` | Aucun stream trouve pour ce titre |
| `ERROR` | Erreur JavaScript, reseau ou timeout |

Un `ZERO` ne veut pas toujours dire que le provider est mort. Le titre peut simplement etre absent de cette source.

## Sources en attente de port JavaScript

Ces sources francaises sont conservees dans `docs/provider-sources/fr/` et referencees dans le manifest avec `enabled: false`.
Elles apparaissent dans la page Providers, mais ne sont pas chargees par le moteur tant que le fichier `providers/*.js` correspondant n'existe pas.

```text
AfterDark, FrenchManga, Frembed, Kidraz, Otakufr, 1Jour1Film, Wiflix
```
