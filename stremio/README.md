# Madrador Film Server

Serveur web du site Madrador Film.

## Lancer

```powershell
node stremio\server.js
```

Puis ouvre :

```text
http://127.0.0.1:7000/
```

## Pages

| Page | Role |
|---|---|
| `/` | Catalogue |
| `/catalog` | Catalogue |
| `/test-player` | Lecteur de test |
| `/providers` | Etat des providers |
| `/status` | Diagnostic |

## Notes

- Le dossier garde son nom historique pour eviter de casser le deploiement Render existant.
- Le site ne fournit plus d'addon externe.
