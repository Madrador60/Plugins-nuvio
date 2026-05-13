# Depannage

## Le site ne charge pas

1. Ouvre `https://madrador-film.onrender.com/health.json`.
2. Si Render etait en veille, attends le premier reveil puis recharge la page.
3. Teste aussi `https://madrador-film.onrender.com/catalog.json`.

## Aucune source trouvee

Certains films recents ou rares ne sont pas disponibles chez les providers actifs.

1. Essaie un autre titre connu.
2. Clique sur `Relancer` dans la fiche.
3. Verifie `/providers` pour voir les providers actifs ou instables.

## La video ne se lance pas

1. Essaie une source `MP4` en priorite.
2. Essaie une source `HLS` si MP4 ne marche pas.
3. Ouvre le meme titre dans `/test-player` pour voir les erreurs du lecteur.

## Tests rapides

```powershell
node --check site\server.js
node --check scripts\test-providers.js
node site\server.js
```
