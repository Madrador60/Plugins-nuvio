# Securite et limites

## Ce que le depot contient

- du code JavaScript de providers ;
- un serveur local/hebergeable pour Stremio ;
- un proxy technique pour rendre certains liens lisibles par les lecteurs.

## Ce que le depot ne contient pas

- aucune video ;
- aucun fichier media ;
- aucun contenu heberge ;
- aucun cookie prive volontairement versionne.

## Bonnes pratiques

- Ne jamais commit de cookie personnel.
- Ne jamais commit de cle API privee.
- Utiliser `.env` en local pour les secrets.
- Garder `.env.example` public et sans secret.

## Signalement

Pour un bug ou un provider casse, ouvre une issue avec :

- le provider concerne ;
- le titre teste ;
- le type : film, serie ou anime ;
- l'erreur observee ;
- si possible, le resultat de `/diagnostics.json`.
