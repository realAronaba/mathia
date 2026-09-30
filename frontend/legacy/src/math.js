/** Exact arithmetic helpers for the validated fraction exercises. */
export function gcd(a, b) {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

export function reduceFraction(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  let n = Math.trunc(numerator);
  let d = Math.trunc(denominator);
  if (d < 0) { n *= -1; d *= -1; }
  const factor = gcd(n, d);
  return { n: n / factor, d: d / factor };
}

export function fractionText(numerator, denominator) {
  const value = reduceFraction(numerator, denominator);
  if (!value) return "";
  return value.d === 1 ? String(value.n) : `${value.n}/${value.d}`;
}

export function parseRational(raw) {
  const value = String(raw ?? "").trim().replace(/\s+/g, "").replace("−", "-");
  if (!value || value.length > 24) return null;
  if (/^-?\d+\/-?\d+$/.test(value)) {
    const [n, d] = value.split("/").map(Number);
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) return null;
    return reduceFraction(n, d);
  }
  if (/^-?\d+$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) ? { n, d: 1 } : null;
  }
  if (/^-?\d+[.,]\d{1,6}$/.test(value)) {
    const normalized = value.replace(",", ".");
    const decimals = normalized.split(".")[1].length;
    const d = 10 ** decimals;
    return reduceFraction(Math.round(Number(normalized) * d), d);
  }
  return null;
}

export function isEquivalent(answer, expected) {
  const actual = parseRational(answer);
  const wanted = parseRational(expected);
  return Boolean(actual && wanted && actual.n * wanted.d === wanted.n * actual.d);
}

export function addFractions(a, b) {
  return reduceFraction(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function compareFractions(a, b) {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return Math.sign(left - right);
}
