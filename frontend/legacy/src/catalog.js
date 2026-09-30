import { addFractions, compareFractions, fractionText, gcd, reduceFraction } from "./math.js";

export const SKILLS = [
  {
    id: "recognize", title: "Reconnaître une fraction", short: "Lire les parts d’un tout", category: "Les bases",
    lesson: "Une fraction décrit des parts égales d’un tout. Le nombre du haut, le numérateur, indique les parts choisies. Celui du bas, le dénominateur, indique le nombre total de parts égales.",
    examples: ["3/8 signifie 3 parts choisies sur 8 parts égales.", "1/2 partage le tout en deux parts égales.", "Dans 5/6, 5 est le numérateur et 6 le dénominateur."],
    errors: ["Inverser numérateur et dénominateur.", "Compter les parts choisies sans compter les parts du tout.", "Oublier que toutes les parts doivent être égales."], type: "recognize"
  },
  {
    id: "compare", title: "Comparer des fractions", short: "Voir laquelle est la plus grande", category: "Les bases",
    lesson: "Pour comparer deux fractions, tu peux les représenter avec la même taille de tout ou les écrire avec un même dénominateur. Compare ensuite le nombre de parts prises.",
    examples: ["1/3 est plus grand que 1/5 : les tiers sont plus grands que les cinquièmes.", "2/6 = 1/3 après simplification.", "Pour 2/3 et 3/4, les produits croisés sont 8 et 9, donc 3/4 est plus grand."],
    errors: ["Penser que la fraction avec le plus grand dénominateur est la plus grande.", "Comparer seulement les numérateurs.", "Comparer les fractions sans garder la même taille de tout."], type: "compare"
  },
  {
    id: "simplify", title: "Simplifier une fraction", short: "Écrire la même valeur plus simplement", category: "Équivalences",
    lesson: "Divise le numérateur et le dénominateur par un même nombre. La quantité représentée ne change pas. Continue jusqu’à ce qu’aucun diviseur commun supérieur à 1 ne reste.",
    examples: ["6/8 = 3/4 en divisant les deux nombres par 2.", "9/12 = 3/4 en divisant par 3.", "5/10 = 1/2 en divisant par 5."],
    errors: ["Diviser seulement le numérateur ou seulement le dénominateur.", "Soustraire un même nombre en haut et en bas.", "S’arrêter alors qu’un diviseur commun reste."], type: "simplify"
  },
  {
    id: "equivalent", title: "Fractions équivalentes", short: "Garder la même valeur", category: "Équivalences",
    lesson: "Multiplie ou divise le numérateur et le dénominateur par un même nombre non nul. Tu changes l’écriture, pas la valeur de la fraction.",
    examples: ["1/2 = 2/4 en multipliant par 2.", "3/5 = 9/15 en multipliant par 3.", "4/6 = 2/3 en divisant par 2."],
    errors: ["Ajouter le même nombre en haut et en bas.", "Multiplier un seul des deux nombres.", "Oublier que le même facteur s’applique aux deux."], type: "equivalent"
  },
  {
    id: "add-like", title: "Additionner avec le même dénominateur", short: "Additionner les parts de même taille", category: "Additionner",
    lesson: "Quand les dénominateurs sont identiques, les parts ont la même taille. Additionne les numérateurs et garde le dénominateur. Simplifie le résultat si possible.",
    examples: ["2/7 + 3/7 = 5/7.", "1/6 + 2/6 = 3/6 = 1/2.", "3/8 + 4/8 = 7/8."],
    errors: ["Additionner aussi les dénominateurs.", "Changer la taille des parts alors qu’elles sont déjà pareilles.", "Oublier de simplifier le résultat quand c’est possible."], type: "add-like"
  },
  {
    id: "add-unlike", title: "Additionner avec des dénominateurs différents", short: "Créer des parts de même taille", category: "Additionner",
    lesson: "Les parts doivent avoir la même taille avant de les additionner. Cherche un dénominateur commun, transforme les fractions en fractions équivalentes, puis additionne les numérateurs.",
    examples: ["1/2 + 1/4 = 2/4 + 1/4 = 3/4.", "1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2.", "1/2 + 1/3 = 3/6 + 2/6 = 5/6."],
    errors: ["Additionner les numérateurs et les dénominateurs directement.", "Mettre les dénominateurs au même nombre sans ajuster les numérateurs.", "Oublier de simplifier la fraction obtenue."], type: "add-unlike"
  }
];

const levelFor = (index) => index < 5 ? "Départ" : index < 10 ? "En progrès" : "Défi";

function exercise(id, skillId, index, prompt, answer, solution, frequentError) {
  return { id, skillId, index: index + 1, level: levelFor(index), prompt, answer: String(answer), solution, frequentError, validated: true };
}

function generateExercises(skill) {
  const out = [];
  for (let i = 0; i < 15; i++) {
    const id = `${skill.id}-${String(i + 1).padStart(2, "0")}`;
    if (skill.type === "recognize") {
      const d = 4 + (i % 9), n = 1 + ((i * 3) % (d - 1));
      out.push(exercise(id, skill.id, i, `Une barre est partagée en ${d} parts égales. ${n} parts sont coloriées. Quelle fraction est coloriée ?`, `${n}/${d}`,
        [`Le tout est partagé en ${d} parts : c’est le dénominateur.`, `${n} parts sont coloriées : c’est le numérateur.`, `La fraction coloriée est ${n}/${d}.`], "Ne pas inverser le nombre de parts coloriées et le nombre total de parts."));
    } else if (skill.type === "compare") {
      const pairs = [[1,3,1,5],[2,3,3,5],[3,4,2,3],[1,6,1,4],[4,5,5,7],[2,7,1,3],[3,8,2,5],[5,6,7,9],[2,9,1,4],[3,7,4,9],[5,8,2,3],[4,7,5,9],[3,10,2,7],[5,12,3,8],[7,10,5,7]];
      const [a,b,c,d] = pairs[i];
      const winner = compareFractions({n:a,d:b},{n:c,d}) > 0 ? `${a}/${b}` : `${c}/${d}`;
      out.push(exercise(id, skill.id, i, `Quelle fraction est la plus grande : ${a}/${b} ou ${c}/${d} ? Écris-la.`, winner,
        [`Compare les produits croisés : ${a} × ${d} et ${c} × ${b}.`, `Le plus grand produit indique la fraction la plus grande.`, `La fraction la plus grande est ${winner}.`], "Ne compare pas les dénominateurs isolément."));
    } else if (skill.type === "simplify") {
      const bases = [[1,2],[2,3],[1,4],[3,5],[2,5],[1,6],[3,7],[4,9],[2,7],[3,8],[1,8],[5,12],[2,9],[3,10],[4,11]];
      const [n,d] = bases[i], factor = 2 + Math.floor(i / 5), top = n * factor, bottom = d * factor;
      out.push(exercise(id, skill.id, i, `Simplifie ${top}/${bottom} au maximum.`, `${n}/${d}`,
        [`${top} et ${bottom} ont ${factor} comme diviseur commun.`, `Divise le numérateur et le dénominateur par ${factor}.`, `${top}/${bottom} = ${n}/${d}.`], "Diviser seulement un des deux nombres ne conserve pas la valeur."));
    } else if (skill.type === "equivalent") {
      const bases = [[1,2],[2,3],[1,4],[3,5],[2,5],[1,6],[3,7],[4,9],[2,7],[3,8],[1,8],[5,12],[2,9],[3,10],[4,11]];
      const [n,d] = bases[i], factor = 2 + Math.floor(i / 5), targetD = d * factor;
      out.push(exercise(id, skill.id, i, `Écris une fraction équivalente à ${n}/${d} avec ${targetD} comme dénominateur.`, `${n * factor}/${targetD}`,
        [`Le dénominateur ${d} devient ${targetD} : il est multiplié par ${factor}.`, `Multiplie aussi le numérateur ${n} par ${factor}.`, `Le numérateur manquant est ${n * factor}.`], "Le numérateur doit être multiplié par le même facteur que le dénominateur."));
    } else if (skill.type === "add-like") {
      const d = 5 + (i % 8), a = 1 + (i % 3), b = 1 + ((i * 2 + 1) % 3), result = reduceFraction(a + b, d);
      out.push(exercise(id, skill.id, i, `Calcule ${a}/${d} + ${b}/${d}. Donne le résultat simplifié.`, fractionText(result.n, result.d),
        [`Les deux fractions ont le même dénominateur : ${d}.`, `Additionne les numérateurs : ${a} + ${b} = ${a + b}.`, `${a + b}/${d} se simplifie en ${fractionText(result.n, result.d)} si nécessaire.`], "Garde le dénominateur commun au lieu de l’additionner."));
    } else {
      const pairs = [[1,2,1,4],[1,3,1,6],[1,2,1,3],[1,4,1,3],[2,3,1,6],[1,5,1,2],[1,3,1,4],[2,5,1,10],[3,4,1,8],[1,6,1,2],[2,7,1,14],[1,8,3,4],[2,9,1,3],[3,10,1,5],[4,7,1,14]];
      const [a,b,c,d] = pairs[i], result = addFractions({n:a,d:b},{n:c,d});
      const common = b / gcd(b,d) * d, aTop = a * (common / b), cTop = c * (common / d);
      out.push(exercise(id, skill.id, i, `Calcule ${a}/${b} + ${c}/${d}. Donne le résultat simplifié.`, fractionText(result.n,result.d),
        [`Un dénominateur commun est ${common}.`, `${a}/${b} = ${aTop}/${common} et ${c}/${d} = ${cTop}/${common}.`, `Additionne : ${aTop}/${common} + ${cTop}/${common} = ${aTop+cTop}/${common} = ${fractionText(result.n,result.d)}.`], "Additionner directement les deux dénominateurs donne des parts qui n’ont pas la même taille."));
    }
  }
  return out;
}

export const EXERCISES = SKILLS.flatMap(generateExercises);
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]));
export const DIAGNOSTIC = [
  { skillId: "recognize", question: "Une tablette est divisée en 5 parts égales. 2 parts sont prises. Quelle fraction représente les parts prises ?", choices: ["2/5", "5/2", "2/3"], answer: "2/5" },
  { skillId: "compare", question: "Quelle fraction est la plus grande ?", choices: ["1/5", "1/3", "Elles sont égales"], answer: "1/3" },
  { skillId: "simplify", question: "Quelle écriture simplifie 4/8 ?", choices: ["1/2", "2/8", "4/4"], answer: "1/2" },
  { skillId: "equivalent", question: "Quelle fraction est équivalente à 1/2 ?", choices: ["3/6", "2/3", "1/3"], answer: "3/6" },
  { skillId: "add-like", question: "Calcule 2/7 + 3/7.", choices: ["5/7", "5/14", "6/7"], answer: "5/7" },
  { skillId: "add-unlike", question: "Calcule 1/2 + 1/4.", choices: ["2/6", "3/4", "2/4"], answer: "3/4" }
];

export const CONTENT_ITEMS = SKILLS.map((skill, index) => ({
  id: skill.id, title: skill.title, exercises: EXERCISES.filter((item) => item.skillId === skill.id).length,
  status: index === 3 ? "Brouillon" : index === 5 ? "Validé" : "Publié"
}));

export const SESSION_STAGES = [
  { title: "Accueil", hint: "On se prépare" }, { title: "Réactivation", hint: "On réveille ses idées" },
  { title: "Mini-leçon", hint: "On comprend la méthode" }, { title: "Pratique guidée", hint: "On avance ensemble" },
  { title: "Pratique autonome", hint: "À toi de jouer" }, { title: "Application", hint: "Dans la vraie vie" },
  { title: "Synthèse", hint: "Tu expliques avec tes mots" }, { title: "Orientation", hint: "On choisit la suite" }
];
