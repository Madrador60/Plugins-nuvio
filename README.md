# Plugins Nuvio FR

Providers francais pour **Nuvio** + addon **Stremio** hebergeable.

## Installation rapide

### Nuvio

Ajoute cette URL dans **Settings > Plugins** ou **Local Scrapers** :

```text
https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/
```

### Stremio

Ajoute cette URL dans Stremio :

```text
https://madrador60-stremio-addon.onrender.com/manifest.json
```

Page publique de l'addon :

```text
https://madrador60-stremio-addon.onrender.com/
```

Page de test avec recherche :

```text
https://madrador60-stremio-addon.onrender.com/test-player
```

Sur Render gratuit, le premier chargement peut prendre un peu de temps si le serveur etait en veille.

## Ce qu'il y a dedans

| Partie | Description |
|---|---|
| `manifest.json` | Liste des providers pour Nuvio |
| `providers/` | Scrapers Nuvio |
| `stremio/` | Serveur addon Stremio |
| `docs/` | Guides courts |
| `scripts/` | Tests des providers |
| `domains.json` | Domaines connus / fallbacks |

## Providers

Films et series : Frenchstream, Movix, Nakios, Purstream, ToFlix, VIDEASY, CinemaCity.

Animes : Anime-Sama, VoirAnime, Vostfree, French-Anime, AnimeVOSTFR, AnimesUltra, JetAnimes, Mugiwara-no-Streaming, AnimoFlix, Sekai, AnimeSite.

Liste detaillee : [docs/PROVIDERS.md](docs/PROVIDERS.md)

## Tester

Verifier la syntaxe :

```powershell
node --check stremio\server.js
node --check scripts\test-providers.js
```

Tester quelques providers :

```powershell
node scripts\test-providers.js --only=frenchstream,movix,nakios --timeout=45000
```

Tester tous les providers :

```powershell
node scripts\test-providers.js
```

## Heberger l'addon Stremio

Le repo est pret pour Render avec [render.yaml](render.yaml).

1. Va sur [Render](https://render.com)
2. Choisis **New > Blueprint**
3. Selectionne `Madrador60/Plugins-nuvio`
4. Lance le deploiement
5. Mets l'URL `/manifest.json` dans Stremio

Guide complet : [docs/STREMIO.md](docs/STREMIO.md)

## Lancer en local

```powershell
node stremio\server.js
```

Puis ouvre :

```text
http://127.0.0.1:7000/
```

## Pourquoi un provider peut ne pas marcher ?

- Le site a change de domaine.
- Le contenu n'existe pas sur cette source.
- Le site bloque temporairement les requetes.
- Le provider est lent et depasse le timeout.
- Certains liens demandent des headers speciaux selon le lecteur.

## Notes

Ce repo ne contient aucune video et n'heberge aucun contenu. Les providers cherchent des liens depuis des sites externes. Utilise ce projet en respectant les lois applicables dans ton pays.
