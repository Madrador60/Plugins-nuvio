# Madrador60 Nuvio Providers FR

Collection de providers francais pour Nuvio. Le repo contient des fichiers JavaScript prets a charger dans l'app via les Local Scrapers.

## Installation rapide

1. Ouvre **Nuvio**
2. Va dans **Settings** puis **Plugins** ou **Local Scrapers**
3. Ajoute cette URL :

```text
https://raw.githubusercontent.com/Madrador60/Plugins-nuvio/refs/heads/main/
```

4. Rafraichis la liste
5. Active les providers que tu veux utiliser

## Providers inclus

| Provider | ID | Type | Langue | Notes |
|---|---|---|---|---|
| Anime-Sama | `anime-sama` | Anime | FR | Gros catalogue anime |
| VoirAnime | `voiranime` | Anime | FR | Anime VF/VOSTFR |
| Vostfree | `vostfree` | Anime | FR | Anime VF/VOSTFR |
| AnimoFlix | `animoflix` | Anime | FR | Anime VF/VOSTFR |
| French-Anime | `french-anime` | Anime | FR | Anime VF/VOSTFR |
| AnimeVOSTFR | `animevostfr` | Anime | FR | Anime VF/VOSTFR |
| AnimesUltra | `animesultra` | Anime | FR | Anime VF/VOSTFR |
| JetAnimes | `jetanimes` | Anime | FR | Anime |
| Sekai | `sekai` | Anime | FR | Streams directs rapides |
| Movix | `movix` | Films/series | FR | VF/VOSTFR |
| Mugiwara-no-Streaming | `mugiwarastream` | Anime | FR | API Next.js |
| AnimeSite | `animesite` | Anime | FR | Provider limite |
| Frenchstream | `frenchstream` | Films/series | FR | Domaines fallback inclus |
| Nakios | `nakios` | Films/series | FR/EN | Qualite 4K possible |
| Purstream | `purstream` | Films/series | FR/EN | VF/VOSTFR/MULTI |
| ToFlix | `toflix` | Films/series | FR/EN | VF/VOSTFR |
| VIDEASY | `videasy` | Multi | FR/multi | Provider limite |
| CinemaCity | `cinemacity` | Multi | FR/multi | Peut necessiter un acces/cookie selon les contenus |

## Structure

```text
Plugins-nuvio/
├── providers/          # Providers JavaScript charges par Nuvio
├── manifest.json       # Liste des providers disponibles
├── README.md           # Documentation du repo
└── LICENSE
```

## Comment ca marche

Nuvio lit d'abord `manifest.json`. Chaque entree du manifest pointe vers un fichier dans `providers/`.

Exemple :

```json
{
  "id": "frenchstream",
  "name": "Frenchstream",
  "filename": "providers/frenchstream.js",
  "supportedTypes": ["movie", "tv"],
  "enabled": true,
  "contentLanguage": ["fr"],
  "formats": ["mp4", "mkv", "m3u8"]
}
```

Chaque fichier provider doit exporter une fonction :

```javascript
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return Promise.resolve([]);
}

module.exports = { getStreams };
```

## Format des streams

Un provider doit retourner un tableau d'objets comme celui-ci :

```javascript
{
  name: "Provider",
  title: "VF - 1080p",
  url: "https://...",
  quality: "1080p",
  size: "Unknown",
  headers: {
    "Referer": "https://source.example/"
  }
}
```

## Tester un provider

Tu peux tester un provider avec Node.js :

```powershell
cd C:\Users\madra\Desktop\teste
node -e "const p=require('./providers/frenchstream.js'); p.getStreams('872585','movie').then(x=>console.log(x.length, x)).catch(console.error)"
```

Tu peux aussi utiliser le script de test inclus :

```powershell
node scripts\test-providers.js
```

Pour un test plus realiste, surtout avec les providers lents :

```powershell
node scripts\test-providers.js --timeout=45000
```

Tester seulement certains providers :

```powershell
node scripts\test-providers.js --only=frenchstream,movix,cinemacity
```

Limiter le nombre de providers testes :

```powershell
node scripts\test-providers.js --limit=3
```

Le dernier rapport de test est dans `TESTING.md`.

Exemples TMDB utiles :

```text
872585  Oppenheimer
157336  Interstellar
1399    Game of Thrones
```

Pour une serie :

```powershell
node -e "const p=require('./providers/frenchstream.js'); p.getStreams('1399','tv',1,1).then(x=>console.log(x.length, x)).catch(console.error)"
```

## Ajouter un provider

1. Ajoute le fichier dans `providers/monprovider.js`
2. Verifie qu'il exporte `getStreams`
3. Ajoute une entree dans `manifest.json`
4. Teste la syntaxe :

```powershell
node --check providers\monprovider.js
```

5. Commit et push :

```powershell
git add .
git commit -m "Add MonProvider"
git push
```

## A ameliorer

- Utiliser `scripts/test-providers.js` regulierement et desactiver les providers qui restent morts trop longtemps.
- Ajouter un fichier `domains.json` pour centraliser les domaines qui changent souvent.
- Ajouter le meme systeme de fallback de domaines a Movix, Purstream, ToFlix et Nakios.
- Corriger ou remplacer `sekai`, `animesite` et `cinemacity` si les prochains tests restent a `0` ou en timeout.
- Nettoyer les providers bundles quand c'est possible pour faciliter les corrections.
- Ajouter plus de logos stables, de preference heberges sur GitHub ou un CDN fiable.
- Verifier les providers marques `limited` et indiquer leurs limites dans le README.

## Notes importantes

- Certains providers peuvent apparaitre dans Nuvio mais retourner `0` stream selon le film, la serie, la langue ou le domaine actuel.
- Les domaines changent souvent. Quand un site change de domaine, il faut mettre a jour le provider ou ajouter le nouveau domaine dans ses fallbacks.
- Ce repo ne stocke aucune video.

## Disclaimer

Ce repository ne contient aucun contenu video et n'heberge aucun stream. Les providers fonctionnent comme des scrapers locaux pour Nuvio. Les utilisateurs sont responsables de leur utilisation et du respect des lois applicables.
