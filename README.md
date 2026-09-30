# MathIA

MVP de démonstration d’une plateforme d’apprentissage des mathématiques pour des élèves de 12 à 15 ans. L’interface est en français, sous le nom **MathIA**, avec une palette **bleu intense et cyan électrique**.

## Démarrer

Le projet ne demande ni dépendance ni compilation. Les modules JavaScript doivent être servis par HTTP plutôt qu’ouverts directement en `file://`.

Depuis ce dossier, lance un serveur statique :

```powershell
python -m http.server 4173
```

Puis ouvre [http://localhost:4173](http://localhost:4173). Si `python` n’est pas dans le PATH, utilise `py -m http.server 4173`.

## Parcours de bout en bout

1. Depuis l’écran d’accueil, crée un profil avec un pseudonyme, choisis la classe et coche l’accord de démonstration.
2. Passe les six questions du diagnostic pour remplir la carte de compétences.
3. Dans **Mes parcours**, consulte les six leçons sur les fractions et ouvre la séance guidée.
4. Suis les huit étapes de la séance, demande des indices gradués et essaie des réponses équivalentes comme `3/4`, `6/8` ou `0,75`.
5. Passe en vue parent pour consulter la progression du profil, les séances, les alertes, puis exporter ou mettre le profil en pause.
6. Passe en vue admin pour faire avancer les leçons **Brouillon → Validé → Publié** et traiter les alertes. La publication rend aussitôt la leçon accessible dans le parcours élève du même navigateur.

## Fonctions incluses

- Création locale de plusieurs profils pseudonymisés, avec niveau scolaire, date d’accord, mise en pause et choix d’une limite quotidienne indicative.
- Diagnostic de six compétences, sans note globale, avec états **Maîtrisé**, **En cours**, **À renforcer** et **Non évalué**.
- Parcours fractions comprenant six leçons, trois exemples et les erreurs fréquentes de chaque compétence.
- 90 exercices gradués (15 par compétence), avec réponses et solutions pas à pas produites par des règles déterministes.
- Séance guidée suivant les huit étapes du cahier des charges et tuteur de démonstration avec indices progressifs.
- Comparaison exacte des fractions, simplification des réponses et acceptation d’écritures équivalentes.
- Cahier numérique, tableau de suivi parent, export JSON et suppression des données locales.
- Signalement permanent dans la séance, alertes soumises à une revue humaine simulée et cycle de validation des contenus.
- Les trois vues partagent les mêmes données de démonstration afin de parcourir la chaîne parent → élève → parent → admin sans changer d’environnement.
- Page d’offres sans paiement.

## Limites connues

Cette version est un prototype front-end autonome pour essayer les parcours et l’interface. Les données sont conservées dans le stockage local du navigateur ; elles ne sont ni chiffrées ni synchronisées. L’accord parental est une étape de démonstration et ne constitue pas un consentement vérifié.

Il n’y a pas encore de compte parent, de vérification d’e-mail, d’API, de base de données, de contrôle d’accès serveur, de fournisseur IA, de service de modération, de paiement, de rappel de limite de temps ou de journal serveur. Le tuteur visible utilise des réponses guidées écrites à l’avance ; aucune conversation libre n’est envoyée à un modèle. Les exercices de démonstration sont construits par des règles arithmétiques et doivent encore passer une validation pédagogique humaine avant toute publication réelle.

Ne saisis aucune vraie donnée personnelle dans cette démo. Une version de production doit ajouter le back-end sécurisé, l’authentification et les contrôles parentaux avant d’accueillir des élèves.

## Structure

```text
index.html
src/
  app.js          interface, vues et interactions
  catalog.js      compétences, diagnostic, leçons et exercices
  math.js         calcul exact et comparaison de fractions
  storage.js      persistance locale de démonstration
  tutor.js        fournisseur pédagogique local remplaçable
  styles.css      styles responsive et accessibles
docs/
  DECISIONS.md    architecture, traçabilité et suite du backlog
```
