# Securite

Mesures V2 :

- timeouts sur les appels externes ;
- headers HTTP simples (`nosniff`, `referrer-policy`, permissions policy) ;
- actions admin protegees par `ADMIN_TOKEN` ;
- pas de secrets en dur dans `.env.example` ;
- erreurs JSON propres ;
- validation minimale des providers et domaines ;
- fichiers obsoletes archives plutot que conserves au hasard.

Ne jamais commiter :

- cles API privees ;
- cookies ;
- tokens personnels ;
- URLs cachees reservees a un compte.
