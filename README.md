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

- Anime-Sama (`anime-sama`)
- VoirAnime (`voiranime`)
- Vostfree (`vostfree`)
- AnimoFlix (`animoflix`)
- French-Anime (`french-anime`)
- AnimeVOSTFR (`animevostfr`)
- AnimesUltra (`animesultra`)
- JetAnimes (`jetanimes`)
- Sekai (`sekai`)
- Movix (`movix`)
- Mugiwara-no-Streaming (`mugiwarastream`)
- AnimeSite (`animesite`)
- Frenchstream (`frenchstream`)
- Nakios (`nakios`)
- Purstream (`purstream`)
- ToFlix (`toflix`)
- VIDEASY (`videasy`)
- CinemaCity (`cinemacity`)

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

- Mettre a jour automatiquement les domaines qui changent souvent, surtout Frenchstream et ses miroirs.
- Tester regulierement les providers pour savoir lesquels retournent vraiment des streams.
- Ajouter un petit script de test qui lance tous les providers et affiche `OK`, `0 stream`, ou `erreur`.
- Ajouter une colonne dans le README avec le type principal : anime, films, series, multi.
- Nettoyer les providers bundles quand c'est possible pour faciliter les corrections.
- Ajouter plus de logos stables, de preference heberges sur GitHub ou un CDN fiable.
- Verifier les providers marques `limited` et indiquer leurs limites dans le README.

## Notes importantes

- Certains providers peuvent apparaitre dans Nuvio mais retourner `0` stream selon le film, la serie, la langue ou le domaine actuel.
- Les domaines changent souvent. Quand un site change de domaine, il faut mettre a jour le provider ou ajouter le nouveau domaine dans ses fallbacks.
- Ce repo ne stocke aucune video.

## Disclaimer

Ce repository ne contient aucun contenu video et n'heberge aucun stream. Les providers fonctionnent comme des scrapers locaux pour Nuvio. Les utilisateurs sont responsables de leur utilisation et du respect des lois applicables.
