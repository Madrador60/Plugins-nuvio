# Installation

## Local

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
   - `TMDB_API_KEY`
   - `ADMIN_TOKEN`
   - `PROVIDER_TIMEOUT_MS`
4. Deploie.

Le health check est `/health`.
