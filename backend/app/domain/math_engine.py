import re
from fractions import Fraction

from sympy import Rational


_EXPRESSION = re.compile(r"^\s*(\d{1,5})\s*/\s*(\d{1,5})\s*([+\-])\s*(\d{1,5})\s*/\s*(\d{1,5})\s*$")
_VALUE = re.compile(r"^\s*([+-]?\d{1,8})(?:\s*/\s*(\d{1,8})|([.,]\d{1,6}))?\s*$")


def solve_fraction_expression(expression: str) -> Fraction:
    match = _EXPRESSION.fullmatch(expression)
    if not match:
        raise ValueError("Cette version démo accepte les additions ou soustractions de deux fractions.")
    n1, d1, operator, n2, d2 = match.groups()
    if d1 == "0" or d2 == "0":
        raise ValueError("Le dénominateur doit être différent de zéro.")
    left = Rational(int(n1), int(d1))
    right = Rational(int(n2), int(d2))
    result = left + right if operator == "+" else left - right
    return Fraction(int(result.p), int(result.q))


def parse_answer(answer: str) -> Fraction:
    normalized = answer.strip().replace("−", "-").replace(",", ".")
    match = _VALUE.fullmatch(normalized)
    if not match:
        raise ValueError("Écris une fraction ou un nombre décimal, par exemple 5/6 ou 0,75.")
    whole, denominator, decimal = match.groups()
    if denominator:
        if int(denominator) == 0:
            raise ValueError("Le dénominateur doit être différent de zéro.")
        return Fraction(int(whole), int(denominator))
    if decimal:
        return Fraction(whole + decimal)
    return Fraction(int(whole), 1)


def equivalent_answers(answer: str, expected: Fraction) -> bool:
    try:
        return parse_answer(answer) == expected
    except ValueError:
        return False


def format_fraction(value: Fraction) -> str:
    return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"
