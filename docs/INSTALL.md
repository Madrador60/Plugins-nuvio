# Installation

## Local

Methode simple sur Windows :

```text
ouvrir-madrador.bat
```

ou depuis `site-madrador/` :

```text
ouvrir-site.bat
```

Garde la fenetre ouverte pendant que tu utilises le site.

Le lanceur cherche aussi le Node integre de Codex. Si le message indique que Node est introuvable, installe Node.js 18+ ou utilise l'adresse Render en ligne.

Methode terminal :

```powershell
npm install
copy .env.example .env
npm start
```

Ouvre `http://127.0.0.1:7000/`.

## Render

1. Connecte le repo GitHub.
2. Garde `render.yaml`.
3. Configure les variables utiles :
   - `TMDB_API_KEY` pour les affiches, acteurs, saisons, episodes, recommandations, nouveautes et tendances TMDB
   - `ADMIN_TOKEN`
   - `PROVIDER_TIMEOUT_MS`
4. Deploie.

Le health check est `/health`.

## TMDB_API_KEY sur Render

Dans Render, ouvre ton service puis `Environment` et ajoute :

```text
TMDB_API_KEY=ta_cle_tmdb
```

Ne mets jamais la cle directement dans le code ou dans GitHub. Sans cette variable, Madrador Film garde un catalogue de secours, mais les vraies nouveautes, acteurs, saisons, episodes et recommandations seront limites.
