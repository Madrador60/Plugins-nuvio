# Madrador Film - Plugins Nuvio FR

Depot de providers francais pour **Nuvio** avec un site public **Madrador Film**.

L'objectif est simple : installer facilement les sources FR dans Nuvio, ou utiliser le site web avec catalogue, fiches, favoris et lecteur integre.

## Installer dans Nuvio

Dans **Nuvio > Settings > Plugins** ou **Local Scrapers**, ajoute cette URL :

```text
https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/
```

Ensuite, rafraichis la liste des providers et active ceux que tu veux.

## Ouvrir le site

| Page | Lien |
| --- | --- |
| Catalogue | https://madrador60-stremio-addon.onrender.com/ |
| Lecteur | https://madrador60-stremio-addon.onrender.com/test-player |
| Providers | https://madrador60-stremio-addon.onrender.com/providers |

Le service Render gratuit peut dormir. Si la page met du temps au premier chargement, attends 30 a 60 secondes puis recharge.

## Ce qu'il y a dedans

| Partie | Role |
| --- | --- |
| `manifest.json` | Liste publique des providers pour Nuvio |
| `providers/` | Providers JavaScript actifs |
| `domains.json` | Domaines connus et fallbacks |
| `stremio/server.js` | Serveur web Madrador Film |
| `docs/provider-sources/fr/` | Sources Kotlin FR a porter en JavaScript |

## Providers actifs

Films et series :

```text
Frenchstream, Movix, Nakios, Purstream, ToFlix, VIDEASY, CinemaCity
```

Animes :

```text
Anime-Sama, VoirAnime, Vostfree, French-Anime, AnimeVOSTFR, AnimesUltra,
JetAnimes, Mugiwara-no-Streaming, AnimoFlix, Sekai, AnimeSite
```

Sources FR ajoutees en reference, a porter en JavaScript :

```text
AfterDark, FrenchManga, Frembed, Kidraz, Otakufr, 1Jour1Film, Wiflix
```

Voir le detail : [docs/FRENCH_SOURCES.md](docs/FRENCH_SOURCES.md)

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/INSTALL.md](docs/INSTALL.md) | Installation Nuvio, site public, lancement local |
| [docs/PROVIDERS.md](docs/PROVIDERS.md) | Etat des providers actifs |
| [docs/FRENCH_SOURCES.md](docs/FRENCH_SOURCES.md) | Sources francaises actives et sources a porter |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure technique |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Problemes courants |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Ajouter ou maintenir un provider |
| [docs/SECURITY.md](docs/SECURITY.md) | Securite et limites |
| [TESTING.md](TESTING.md) | Derniers tests manuels |

## Lancer en local

```powershell
node stremio\server.js
```

Puis ouvre :

```text
http://127.0.0.1:7000/
```

## Tester

```powershell
node --check stremio\server.js
node --check scripts\test-providers.js
node scripts\test-providers.js --only=frenchstream,movix,nakios,toflix --timeout=60000
```

## Notes

- Le depot ne contient aucune video.
- Les providers cherchent des liens depuis des sources externes.
- Certains domaines changent souvent.
- Les sources Kotlin ajoutees en reference ne sont pas activees tant qu'elles ne sont pas portees en JavaScript.
- Chaque utilisateur reste responsable de son utilisation et du respect des lois applicables.
