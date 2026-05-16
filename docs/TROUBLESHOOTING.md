# Depannage

## Le site ne charge pas

Teste :

```powershell
npm run check
npm start
```

Puis ouvre `/health`.

## Le catalogue est vide

- Verifie `TMDB_API_KEY`.
- Force un refresh avec `/catalog.json?refresh=1`.
- Regarde les logs Render.

## Un provider ne retourne rien

Lance :

```powershell
npm run test:quick
npm run test:domains
```

Un domaine mort ou un timeout externe n'est pas forcement bloquant pour tout le site.
