# Changelog

## 2.0.0

- Migration du serveur vers `src/server/app.js`.
- Conservation de `site/server.js` pour Render et les anciennes commandes.
- Providers ranges par type dans `providers/anime`, `providers/movies` et `providers/disabled`.
- Ajout du score providers persistant dans `data/provider-status.json`.
- Ajout du service de verification des domaines.
- Ajout des routes `/health`, `/admin`, `/legal`, `/dmca`, `/security`, `/providers/status.json`.
- Ajout des scripts de tests routes, domaines, syntaxe et rapports.
- Documentation reorganisee.
- Fichiers obsoletes archives dans `archive/`.
