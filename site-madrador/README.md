# Ouvrir Madrador Film

Ne double-clique pas directement sur `index.html`.

Le site a besoin du serveur pour appeler :

- `/catalog.json`
- `/search.json`
- `/details.json`
- `/stream/...`
- `/providers.json`

## Methode simple

Double-clique sur :

```text
ouvrir-site.bat
```

ou, depuis la racine du projet :

```text
ouvrir-madrador.bat
```

Le serveur demarre et le navigateur ouvre :

```text
http://127.0.0.1:7000/
```

Garde la fenetre noire ouverte pendant que tu utilises le site.

Le lanceur cherche Node.js dans cet ordre :

1. `node` installe normalement sur Windows
2. le runtime Node integre de Codex
3. `C:\Program Files\nodejs\node.exe`

Si aucun n'est trouve, utilise l'adresse Render en ligne.
