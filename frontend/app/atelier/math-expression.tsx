"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

export default function MathExpression({ expression }: { expression: string }) {
  const latex = expression.replace(/(\d+)\s*\/\s*(\d+)/g, "\\frac{$1}{$2}").replace(/\+/g, "\\,+\\,");
  const html = katex.renderToString(latex, { throwOnError: false, output: "htmlAndMathml" });
  return <div className="atelier-katex" aria-label={expression} dangerouslySetInnerHTML={{ __html: html }} />;
}
