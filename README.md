# MathIA

MVP francophone de soutien en mathématiques, organisé comme un **monolithe modulaire** : front-end Next.js PWA, API FastAPI, pipeline pédagogique séquentiel et moteur de calcul déterministe. L’identité visuelle reste bleu intense et cyan électrique.

## Démarrage local

Prérequis : Docker Desktop avec Docker Compose. Depuis la racine du dépôt :

```powershell
docker compose up --build
```

Ouvre [http://localhost:3000](http://localhost:3000) pour l’interface MathIA, [http://localhost:3000/atelier](http://localhost:3000/atelier) pour le parcours élève et le suivi parent pilotés par l’API, et [http://localhost:3000/admin](http://localhost:3000/admin) pour la supervision et l’ajout de ressources de programme. La documentation interactive FastAPI est disponible sur [http://localhost:8000/docs](http://localhost:8000/docs).

Le compose local lance Next.js, FastAPI, PostgreSQL avec pgvector, Redis et un worker Celery. Le parcours de démonstration crée un profil pseudonymisé, enregistre le consentement parent, ouvre une séance élève et fait avancer la progression par la machine à états serveur. L’espace parent consulte la progression et peut retirer son consentement ; l’espace admin consulte les indicateurs agrégés et enregistre des contenus pédagogiques.

## Parcours et sécurité du tutorat

Les rôles API sont `student`, `parent`, `admin` et `super_admin`. Le middleware vérifie les jetons signés et applique une limite de débit Redis. En développement local, `ALLOW_DEMO_AUTH=true` active des jetons de démonstration éphémères ; ce mode doit rester désactivé en production.

Chaque réponse suit une séquence imposée :

1. Filtre d’entrée et contrôle anti-divulgation de données personnelles.
2. OCR/Vision uniquement si une photo est soumise et Mathpix est explicitement configuré ; sinon le mode texte reste disponible.
3. Calcul exact par SymPy sur des expressions fractionnaires limitées.
4. Recherche de leçon dans pgvector quand des embeddings et une clé de fournisseur sont configurés, avec contenu pédagogique local de secours.
5. Explication optionnelle via LiteLLM ; le résultat proposé est vérifié contre le moteur exact et remplacé en cas d’écart.
6. Filtre de sortie. Seul l’orchestrateur déterministe peut valider une réponse ou faire avancer une étape.

Les étapes, les tentatives et le niveau d’aide sont persistés dans PostgreSQL. Le score de maîtrise utilise une mise à jour de type Bayesian Knowledge Tracing et une décroissance temporelle. Redis applique une limite par adresse et un quota par élève (80 générations quotidiennes par défaut) pour le fournisseur LLM. Les rapports parent peuvent être générés en tâche de fond par Celery/Redis. Les consentements et actions éditoriales laissent une trace d’audit. Langfuse et Sentry sont désactivés sans clés de projet ; les traces ne contiennent pas les réponses libres des élèves.

## Configuration des fournisseurs

Copie `.env.example` vers `.env` pour activer des fournisseurs. Sans secret, le MVP utilise le tuteur déterministe local, désactive l’OCR externe et garde les écrans de paiement et notification en démonstration. Les clés restent côté serveur.

Pour l’authentification gérée, configure l’émetteur de jetons OIDC (`JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_JWKS_URL`) et désactive `ALLOW_DEMO_AUTH`. Le fournisseur d’authentification doit inclure le rôle dans la revendication `role` ou dans `public_metadata.role`.

## Structure

```text
frontend/                 Next.js App Router, PWA, TypeScript, Tailwind, KaTeX
frontend/legacy/src/       Interface MVP originale, montée dans Next.js pendant la migration
backend/app/api/           Routes versionnées pour élève, parent, admin et OCR
backend/app/core/          Configuration, JWT/RBAC, limitation de débit
backend/app/db/            Modèles PostgreSQL et persistance SQLAlchemy
backend/app/domain/        Machine à états, BKT et calcul exact
backend/app/services/      Pipeline séquentiel, RAG, LLM, OCR et observabilité
backend/app/workers/       Tâches Celery/Redis de génération des rapports parent
docker-compose.yml         Services locaux du monolithe
docs/DECISIONS.md          Architecture cible, limites et feuille de route
```

## Périmètre et limites

Le stockage, les contrôles de rôle et les trois parcours API sont implémentés pour la démonstration. L’interface d’administration et le suivi parent utilisent les routes FastAPI ; l’authentification de toutes les interfaces reste en mode démo local. Les identifiants du fournisseur OIDC, les clés LLM, Mathpix, Langfuse et Sentry ne sont pas fournis avec le dépôt. La recette juridique du consentement, la politique de conservation, les notifications, le paiement Wave/Orange Money/carte, la voix, la migration complète de l’ancienne interface et le déploiement haute disponibilité restent des étapes de pilote/production.

N’utilise pas de données réelles de mineurs dans cette configuration locale. La démo conserve une interface locale historique et ne constitue pas un service de production.
