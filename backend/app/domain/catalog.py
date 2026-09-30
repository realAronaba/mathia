from dataclasses import dataclass


@dataclass(frozen=True)
class DemoExercise:
    id: str
    expression: str
    skill_id: str
    school_level: str
    prompt: str


DEMO_EXERCISES = {
    "fraction-add-unlike-01": DemoExercise(
        id="fraction-add-unlike-01",
        expression="1/2 + 1/3",
        skill_id="add-unlike",
        school_level="4e",
        prompt="Additionne les deux fractions en créant des parts de même taille.",
    ),
    "fraction-add-like-01": DemoExercise(
        id="fraction-add-like-01",
        expression="2/7 + 3/7",
        skill_id="add-like",
        school_level="5e",
        prompt="Additionne les numérateurs et garde le dénominateur commun.",
    ),
    "fraction-equivalent-01": DemoExercise(
        id="fraction-equivalent-01",
        expression="1/2 + 1/2",
        skill_id="equivalent",
        school_level="5e",
        prompt="Trouve la valeur obtenue en réunissant deux moitiés.",
    ),
}

LESSON_CONTEXT = {
    "add-unlike": "Pour additionner des fractions de dénominateurs différents, crée d’abord des fractions équivalentes avec un dénominateur commun. Additionne ensuite les numérateurs.",
    "add-like": "Quand les dénominateurs sont identiques, les parts ont la même taille. Additionne les numérateurs et conserve le dénominateur.",
    "equivalent": "Une fraction équivalente garde la même valeur. Multiplie ou divise le numérateur et le dénominateur par un même nombre non nul.",
}
