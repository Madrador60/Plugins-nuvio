# Plugins Nuvio FR

Providers francais pour **Nuvio**, avec un petit addon local pour **Stremio**.

Le but du repo est simple : tu copies une URL, tu l'ajoutes dans l'application, et tu actives les sources qui t'interessent.

## Installer sur Nuvio

### 1. Copier l'URL du repo

```text
https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/
```

### 2. Ajouter l'URL dans Nuvio

Dans Nuvio :

1. Ouvre **Settings**
2. Va dans **Plugins** ou **Local Scrapers**
3. Colle l'URL du repo
4. Rafraichis la liste
5. Active les providers que tu veux utiliser

### 3. Tester

Lance un film, une serie ou un anime. Si un provider ne donne rien, essaie un autre provider : certains sites changent souvent de domaine ou ne proposent pas tous les contenus.

## Installer sur Stremio

L'addon Stremio est local : il faut laisser le serveur ouvert sur ton PC pendant que tu utilises Stremio.

### 1. Lancer l'addon

Dans le dossier du repo :

```powershell
node stremio\server.js
```

### 2. Ajouter l'addon dans Stremio

Dans Stremio, ajoute :

```text
http://127.0.0.1:7000/manifest.json
```

Si tu utilises Stremio sur une TV ou un telephone, remplace `127.0.0.1` par l'adresse IP du PC qui lance le serveur.

Exemple :

```text
http://192.168.1.20:7000/manifest.json
```

### Options utiles

Changer le port :

```powershell
$env:PORT='7100'
node stremio\server.js
```

Limiter les providers utilises par Stremio :

```powershell
$env:STREMIO_PROVIDERS='frenchstream,movix,nakios'
node stremio\server.js
```

## Providers inclus

### Films et series

| Provider | Langue | Etat |
|---|---|---|
| Frenchstream | FR | Fonctionne, domaines fallback inclus |
| Movix | FR | Fonctionne |
| Nakios | FR/EN | Fonctionne |
| Purstream | FR/EN | Fonctionne |
| ToFlix | FR/EN | Fonctionne |
| VIDEASY | Multi dont FR | Fonctionne mais peut etre lent |
| CinemaCity | Multi dont FR | Limite, peut demander un acces/cookie |

### Animes

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

## Pourquoi un provider peut ne rien afficher ?

- Le site a change de domaine.
- Le film ou l'episode n'existe pas sur ce site.
- Le site bloque temporairement les requetes.
- Le provider est lent et depasse le timeout.
- Certains liens demandent des headers speciaux selon le lecteur.

## Tester les providers

Depuis le dossier du repo :

```powershell
node scripts\test-providers.js
```

Tester seulement certains providers :

```powershell
node scripts\test-providers.js --only=frenchstream,movix,nakios
```

Donner plus de temps aux providers lents :

```powershell
node scripts\test-providers.js --timeout=45000
```

Le dernier rapport est disponible ici : [TESTING.md](TESTING.md)

## Pour contribuer

Un provider Nuvio doit etre dans `providers/` et exporter une fonction `getStreams`.

```javascript
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return Promise.resolve([]);
}

module.exports = { getStreams };
```

Ensuite, il faut l'ajouter dans [manifest.json](manifest.json).

## Structure du repo

```text
Plugins-nuvio/
  providers/          Providers Nuvio
  stremio/            Addon Stremio local
  scripts/            Outils de test
  manifest.json       Liste des providers Nuvio
  domains.json        Domaines connus / fallbacks
  TESTING.md          Derniers tests
```

## Notes

- Le repo ne contient aucune video.
- Les providers ne font que chercher des liens depuis des sites externes.
- Les domaines changent souvent, donc certains providers peuvent casser puis etre corriges.
- Utilise ce repo en respectant les lois applicables dans ton pays.
