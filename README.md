# Madrador Film - Plugins Nuvio FR

![Madrador Film](assets/banner.svg)

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
| Catalogue | [Ouvrir](https://madrador60-stremio-addon.onrender.com/) |
| Lecteur | [Ouvrir](https://madrador60-stremio-addon.onrender.com/test-player) |
| Providers | [Ouvrir](https://madrador60-stremio-addon.onrender.com/providers) |

Le service Render gratuit peut dormir. Si la page met du temps au premier chargement, attends 30 a 60 secondes puis recharge. L'adresse technique Render peut garder son ancien nom meme si le site s'appelle Madrador Film.

## Ce qu'il y a dedans

| Partie | Role |
| --- | --- |
| `manifest.json` | Liste publique des providers pour Nuvio |
| `providers/` | Providers JavaScript actifs |
| `domains.json` | Domaines connus et fallbacks |
| `site/server.js` | Serveur web Madrador Film |
| `assets/banner.svg` | Banniere GitHub Madrador Film |
| `assets/brand.svg` | Logo public du site |
| `docs/provider-sources/fr/` | Sources Kotlin FR a porter en JavaScript |

## Catalogue automatique

Le catalogue du site est genere depuis TMDB avec un cache court. Il affiche plusieurs rails : tendances du jour, tendances de la semaine, sorties cinema France, bientot au cinema, films populaires, genres, series, animes et contenus francais.

Quand TMDB ajoute un nouveau film ou met a jour une sortie, le site le recupere automatiquement a la prochaine regeneration du cache. Par defaut, la verification se fait toutes les 30 minutes. Le bouton **Actualiser maintenant** sur le catalogue force une regeneration immediate.

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
node site\server.js
```

Puis ouvre :

```text
http://127.0.0.1:7000/
```

## Tester

```powershell
node --check site\server.js
node --check scripts\test-providers.js
node scripts\test-providers.js --only=frenchstream,movix,nakios,toflix --timeout=60000
```

## Notes

- Le depot ne contient aucune video.
- Les providers cherchent des liens depuis des sources externes.
- Certains domaines changent souvent.
- Les sources Kotlin ajoutees en reference ne sont pas activees tant qu'elles ne sont pas portees en JavaScript.
- Chaque utilisateur reste responsable de son utilisation et du respect des lois applicables.
