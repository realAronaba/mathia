# MathIA — décisions et périmètre du MVP

## Architecture retenue

Le dépôt ne contenait pas de code initial. Pour rendre le parcours immédiatement testable sans compte fournisseur ni installation, le MVP est une application web statique en JavaScript natif, structurée en modules. Le navigateur peut l’exécuter avec un serveur de fichiers local.

- `src/app.js` gère les vues, rôles de démonstration, progression, formulaires et interactions.
- `src/catalog.js` contient les compétences, questions de diagnostic, leçons, erreurs fréquentes et recettes d’exercices.
- `src/math.js` vérifie les valeurs par arithmétique exacte sur des fractions entières ; il ne dépend pas du tuteur.
- `src/tutor.js` expose un fournisseur de démonstration distinct qui peut être remplacé par un adaptateur de service IA.
- `src/storage.js` conserve les données par profil dans `localStorage` pour rendre la progression visible après rechargement.

L’orchestrateur dans l’application choisit la prochaine étape. Le tuteur de cette version propose seulement des indices et explications prédéfinis. Il n’a ni accès à la base de données ni accès à une conversation libre. La vue admin fait avancer le cycle de publication ; seules les leçons publiées sont ouvertes dans la vue élève. Un signalement apparaît dans les vues parent et admin, et sa résolution par l’admin est répercutée dans le suivi parent.

## Données de démonstration

Les profils utilisent un pseudonyme et une classe. Le diagnostic ne produit pas de note globale. Le parcours fractions contient six compétences, chacune avec trois exemples, erreurs habituelles et quinze exercices de difficulté graduée. Les exercices sont construits à partir de recettes déterministes ; leur résultat est vérifié par le moteur mathématique au moment de la réponse.

L’accord, la pause de profil, les alertes, le cycle des contenus, l’abonnement et l’export sont exécutés dans le navigateur. Ces écrans illustrent le flux d’utilisation, mais ne garantissent pas des contrôles d’accès, un consentement juridique ou une suppression de données sur serveur.

## Traçabilité fonctionnelle

| Exigences du cahier des charges | Couverture de démonstration |
| --- | --- |
| EF-CPT-02 à 05, EF-CPT-07 | Plusieurs profils pseudonymisés, accord simulé, pause, export local et limite indicative ; gestion serveur non incluse |
| EF-DIA-01 à 04 | Six questions statiques et carte par compétence sans note globale ; pas d’adaptation de difficulté |
| EF-ELV-01, 02, 04 | Tableau élève, leçons, progression, cahier et absence de classement ; badges et missions non inclus |
| EF-SES-01 à 04, EF-SES-06 à 07 | Formules en texte, quatre actions d’aide, saisie mathématique et QCM, signalement, huit étapes et reprise locale ; pas de conversation libre ni de tableau blanc |
| EF-PED-02, 04, 05 | Étapes et indices pilotés par des règles, alerte locale après essais répétés ; le parcours de compétences reste fixe |
| EF-MAT-01, 02, 04 | Calcul fractionnaire déterministe, écritures équivalentes et banque statique ; pas de modèle IA ni de conflit modèle-moteur à arbitrer |
| EF-PAR-01, 03 | Bilan parent local et liste d’alertes de démonstration ; pas de courriel ni d’historique de conversation |
| EF-ADM-01 à 03 | Bibliothèque illustrative, cycle de statut local et traitement de démonstration des alertes |
| EF-ABO-01 à 02 | Offres de démonstration et sélection sans transaction |
| ENF-01, 04, 05, 07 | Mise en page responsive, commandes clavier, interface française et fonctionnement sans service IA |
| ENF-06 | Fournisseur pédagogique local isolé ; l’adaptateur ne se connecte pas encore à un fournisseur IA |

## Travaux requis avant un pilote réel

1. Ajouter une API et une base de données relationnelle avec migrations, séparation stricte des rôles, journalisation et suppression effective.
2. Ajouter une authentification parent vérifiée, gestion de mots de passe, consentement parental daté et mécanismes d’export serveur.
3. Remplacer le stockage local par le service sécurisé ; chiffrer les données, limiter la collecte et définir une durée de conservation.
4. Brancher un fournisseur IA derrière l’adaptateur de tuteur. Appliquer les règles de sécurité, la minimisation du contexte, la modération, les limites de débit et l’escalade humaine côté serveur.
5. Faire valider les leçons et les 90 exercices par un responsable pédagogique ; remplacer le cycle éditorial simulé par des permissions serveur et un historique versionné.
6. Ajouter les contrôles de temps effectifs, les notifications parent, le paiement et la documentation OpenAPI si ces éléments entrent dans le pilote.
7. Écrire les tests unitaires, d’intégration, de rôles, d’injection et de parcours bout en bout avant la recette de déploiement.
