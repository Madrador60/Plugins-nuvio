# Providers

## Films et series

| Provider | Langue | Etat |
|---|---|---|
| Frenchstream | FR | Fonctionne, domaines fallback inclus |
| Movix | FR | Fonctionne |
| Nakios | FR/EN | Fonctionne |
| Purstream | FR/EN | Fonctionne |
| ToFlix | FR/EN | Fonctionne |
| VIDEASY | Multi dont FR | Fonctionne mais peut etre lent |
| CinemaCity | Multi dont FR | Limite, peut demander un acces/cookie |

## Animes

| Provider | Langue | Etat |
|---|---|---|
| Anime-Sama | FR | Fonctionne |
| VoirAnime | FR | Fonctionne |
| Vostfree | FR | Fonctionne |
| French-Anime | FR | Fonctionne |
| AnimeVOSTFR | FR | Fonctionne |
| AnimesUltra | FR | Fonctionne |
| JetAnimes | FR | Fonctionne mais parfois lent |
| Mugiwara-no-Streaming | FR | Fonctionne |
| AnimoFlix | FR | Instable selon les tests |
| Sekai | FR | Limite selon les contenus |
| AnimeSite | FR | Instable selon les tests |

## Tester

```powershell
node scripts\test-providers.js --timeout=45000
```

Tester seulement quelques providers :

```powershell
node scripts\test-providers.js --only=frenchstream,movix,nakios
```
