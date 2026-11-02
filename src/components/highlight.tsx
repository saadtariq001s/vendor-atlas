import { Fragment } from "react";

/** Mark every word in `text` that starts with one of the searched terms. */
export function highlight(text: string, terms: string[]) {
  if (terms.length === 0) return text;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b((?:${escaped.join("|")})[\\p{L}\\p{N}]*)`, "giu");
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function matchesTerms(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu").test(lower));
}
