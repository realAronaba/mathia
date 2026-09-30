/** Local, rule-based teacher for the demo. Replaceable behind a provider boundary. */
const HINTS = [
  "Commence par repérer les deux dénominateurs. Représentent-ils des parts de même taille ?",
  "Pour additionner, il faut des parts de même taille. Cherche un dénominateur commun.",
  "Transforme chaque fraction en une fraction équivalente qui a ce dénominateur commun.",
  "Additionne les numérateurs, garde le dénominateur commun, puis vérifie si tu peux simplifier."
];

export class DemoTeacherProvider {
  hint(level) { return HINTS[Math.min(Math.max(level - 1, 0), HINTS.length - 1)]; }
  alternate() { return "Imagine une tablette de chocolat : on ne peut compter ensemble que des morceaux de même taille. Découpe les deux portions de la même façon, puis compte-les."; }
  invite(reason) {
    const prompts = {
      confused: "Pas de souci. Reprenons doucement : quelle taille ont les parts dans chaque fraction ?",
      reasoning: "Explique d’abord ce que représente chaque dénominateur. Je t’aiderai à vérifier une étape à la fois.",
      retry: "Une étape ne correspond pas encore à la méthode. Regarde les fractions équivalentes avant de faire l’addition."
    };
    return prompts[reason] || prompts.retry;
  }
}

export const demoTeacher = new DemoTeacherProvider();
