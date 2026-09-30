# MathIA — architecture cible et décisions du MVP

L’image d’architecture fournie sert de proposition produit et technique. Les composants notés « NEW » sont des éléments de feuille de route, pas des services supposés déjà provisionnés. Les clés, contrats et décisions juridiques des équipes restent à fournir avant la mise en production.

## Architecture retenue

Le dépôt évolue vers un monolithe modulaire. Le front-end Next.js/PWA et le back-end FastAPI restent deux applications déployables séparément, mais le domaine métier, les données et les contrôles restent dans un même produit. Redis/Celery exécutent les tâches asynchrones ; ce n’est pas un découpage en microservices.

| Bloc | Implémentation du MVP | État |
| --- | --- | --- |
| Front-end | Next.js App Router, TypeScript, Tailwind v4, KaTeX, manifest PWA et service worker avec page texte hors ligne | Parcours élève/parent à `/atelier` et console admin à `/admin` ; l’ancienne interface reste montée dans Next.js pendant la migration progressive |
| API | FastAPI en routers modulaires, SQLAlchemy asynchrone, PostgreSQL et extension pgvector | En place pour les profils, consentements, séances, progression, rapports et contenus RAG |
| Identité | Vérification JWT/JWKS compatible OIDC, rôles élève, parent, admin et super-admin ; jetons démo à durée courte en environnement local uniquement | Contrat serveur posé ; écran Clerk/Supabase et rattachement de comptes à intégrer avec le fournisseur choisi |
| Orchestration | Machine à états serveur pour accueil, rappel, entraînement guidé, entraînement autonome, réflexion et fin | En place ; seule une réponse validée peut autoriser l’étape suivante |
| Pipeline tuteur | Filtre entrée → OCR conditionnel → calcul exact → RAG/LLM → vérification exacte → filtre de sortie | En place pour les exercices fractionnaires démo ; LiteLLM, embeddings et Mathpix sont activés par configuration |
| Progression | Bayesian Knowledge Tracing avec décroissance temporelle, tentatives et aide persistées | En place pour la compétence de l’exercice |
| Tâches et cache | Redis pour le rate limiting, Celery pour produire les rapports parent | Rapport asynchrone de démonstration ; notifications externes différées |
| Observabilité | Langfuse et Sentry activables par variables d’environnement | Intégrations optionnelles ; aucune trace de réponse libre n’est envoyée par le pipeline |
| Paiement, notifications, voix | Interfaces et fournisseurs à choisir : Wave/Orange Money/carte, WhatsApp/SMS/e-mail, TTS/STT | Phase croissance, hors de ce socle |

## Invariants du pipeline

1. Le client envoie un identifiant d’exercice présent dans le catalogue serveur ; il ne choisit pas la réponse attendue.
2. Le filtre d’entrée rejette les coordonnées personnelles et les demandes de contournement de règles. Les journaux n’enregistrent pas les réponses libres.
3. Une photo n’est transmise à Mathpix que si le parent a un consentement actif, que l’option OCR est activée et que les identifiants du fournisseur existent. La photo n’est pas persistée par l’API.
4. SymPy calcule la valeur exacte à partir d’une grammaire volontairement limitée aux additions et soustractions de fractions. Le moteur, et non le LLM, décide si la réponse est juste.
5. LiteLLM rédige une explication à partir du contexte de programme. Le résultat proposé par le modèle est comparé au résultat exact ; une sortie non conforme est remplacée par l’explication locale déterministe.
6. La machine à états reçoit la décision du moteur et seule elle écrit l’étape suivante. Le LLM ne peut ni valider une réponse ni faire progresser la séance.
7. Le retriever utilise pgvector quand la recherche par embeddings est disponible et alimentée. Sans clé ou sans chunks indexés, il retourne le contexte pédagogique local explicitement identifié comme mode de secours.

## Protection des profils mineurs

- La création d’un profil API exige un jeton parent et un consentement versionné ; chaque consentement et retrait est horodaté et audité.
- Un retrait du consentement met le profil en pause. Les séances refusent alors les nouvelles actions.
- Les rôles sont vérifiés côté API et les requêtes sont limitées par adresse source avec Redis.
- Les jetons de démonstration ne fonctionnent que si `ENVIRONMENT=development` et `ALLOW_DEMO_AUTH=true`. Le démarrage refuse ce réglage en production.
- Les secrets fournisseur ne sont lus que par le serveur. Sans clé, le tuteur utilise le fournisseur local déterministe et l’OCR externe reste désactivé.
- Le bootstrap `AUTO_CREATE_DB=true` est destiné au compose local. Une migration versionnée et la configuration des sauvegardes sont requises avant un déploiement durable.

Ces mesures techniques ne remplacent pas la validation du consentement par un conseil juridique, les règles de conservation et suppression, le chiffrement au repos, une analyse de menace ni la revue de sécurité du fournisseur d’identité choisi.

## Feuille de route selon la proposition des équipes

### Priorité 1 — socle avant le pilote

- Pipeline séquentiel avec vérité mathématique déterministe.
- FastAPI unique et découpé en modules métier.
- Machine à états pédagogique dont le LLM ne contrôle pas la progression.

### Priorité 2 — MVP produit

- OCR/Vision math activable après consentement et configuration fournisseur.
- RAG de programme avec stockage pgvector et ingestion des contenus officiels par l’admin.
- Langfuse/Sentry optionnels, consentement parental, rapports parent asynchrones et mesure de maîtrise.
- À terminer avant un pilote : authentification gérée côté interface, rattachement des comptes élève, migration complète de la vieille interface vers des composants React typés, ingestion des embeddings du programme, revue pédagogique des contenus et procédure de suppression réelle.

### Priorité 3 — croissance

- Paiement Wave, Orange Money et carte après choix du prestataire et règles de facturation.
- Notifications WhatsApp, SMS et e-mail via un fournisseur choisi.
- Voix en streaming et fonctions PWA hors ligne plus complètes après tests sur appareils et réseaux cibles.

## Sources techniques consultées

- [Guide PWA Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps) et [guide Tailwind pour Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
- [Guide FastAPI pour applications modulaires](https://fastapi.tiangolo.com/tutorial/bigger-applications/) et [intégration pgvector pour SQLAlchemy](https://github.com/pgvector/pgvector-python).
- [Instrumentation du SDK Python Langfuse](https://langfuse.com/docs/observability/sdk/instrumentation).
