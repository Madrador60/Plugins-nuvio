# Plugins Nuvio FR

Providers francais pour **Nuvio** et addon local/hebergeable pour **Stremio**.

Ce depot sert deux usages :

- charger des providers dans Nuvio avec un `manifest.json` public ;
- proposer une interface Stremio + une page de test web avec recherche et lecteur integre.

## Liens rapides

| Usage | URL |
|---|---|
| Nuvio | `https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/` |
| Stremio | `https://madrador60-stremio-addon.onrender.com/manifest.json` |
| Page publique | `https://madrador60-stremio-addon.onrender.com/` |
| Catalogue | `https://madrador60-stremio-addon.onrender.com/catalog` |
| Lecteur de test | `https://madrador60-stremio-addon.onrender.com/test-player` |
| Statut providers | `https://madrador60-stremio-addon.onrender.com/status` |
| Diagnostic JSON | `https://madrador60-stremio-addon.onrender.com/diagnostics.json` |

## Installation

### Nuvio

Dans Nuvio, ajoute cette URL dans **Settings > Plugins** ou **Local Scrapers** :

```text
https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/
```

Ensuite, rafraichis la liste et active les providers souhaites.

### Stremio

Dans Stremio, ajoute :

```text
https://madrador60-stremio-addon.onrender.com/manifest.json
```

Si Stremio Web ne lit pas une source, teste la meme recherche sur :

```text
https://madrador60-stremio-addon.onrender.com/test-player
```

## Fonctionnalites

| Fonction | Description |
|---|---|
| Providers Nuvio | Fichiers `providers/*.js` compatibles avec le manifest Nuvio |
| Addon Stremio | Serveur HTTP sans dependance externe obligatoire |
| Proxy media | Ajoute les headers requis et expose des URLs compatibles MP4/HLS |
| Catalogue | Rangees films/series inspirees des plateformes de streaming |
| Test player | Interface web bleu/violet avec recherche TMDB et lecteur integre |
| Diagnostic | Page `/status` et endpoint `/diagnostics.json` |
| Deploiement | Pret pour Render avec `render.yaml` |

## Providers

Films et series :

```text
Frenchstream, Movix, Nakios, Purstream, ToFlix, VIDEASY, CinemaCity
```

Animes :

```text
Anime-Sama, VoirAnime, Vostfree, French-Anime, AnimeVOSTFR, AnimesUltra,
JetAnimes, Mugiwara-no-Streaming, AnimoFlix, Sekai, AnimeSite
```

Details : [docs/PROVIDERS.md](docs/PROVIDERS.md)

## Documentation

| Document | Role |
|---|---|
| [docs/INSTALL.md](docs/INSTALL.md) | Installation Nuvio, Stremio, local |
| [docs/STREMIO.md](docs/STREMIO.md) | Endpoints, variables, diagnostic Stremio |
| [docs/PROVIDERS.md](docs/PROVIDERS.md) | Liste et etat des providers |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure technique du projet |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Problemes courants et solutions |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Ajouter ou maintenir un provider |
| [docs/SECURITY.md](docs/SECURITY.md) | Securite, secrets et limites |
| [TESTING.md](TESTING.md) | Derniers tests manuels |

## Structure

```text
Plugins-nuvio/
  Assets/              Images et logos
  docs/                Documentation projet
  providers/           Providers Nuvio
  scripts/             Outils de test
  stremio/             Serveur addon Stremio
  domains.json         Domaines connus et fallbacks
  manifest.json        Manifest Nuvio
  render.yaml          Deploiement Render
```

## Tests

Verifier la syntaxe :

```powershell
node --check stremio\server.js
node --check scripts\test-providers.js
```

Tester les providers principaux :

```powershell
node scripts\test-providers.js --only=frenchstream,movix,nakios,toflix --timeout=60000
```

Tester tous les providers :

```powershell
node scripts\test-providers.js --timeout=60000
```

## Lancer en local

```powershell
node stremio\server.js
```

Puis ouvre :

```text
http://127.0.0.1:7000/
```

## Notes

- Ce depot ne contient aucune video.
- Les providers cherchent des liens depuis des sources externes.
- Les domaines changent souvent, donc un provider peut tomber temporairement.
- Les utilisateurs sont responsables de leur utilisation et du respect des lois applicables.
