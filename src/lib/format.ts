// Formatting with a fixed locale and time zone, so server and browser render
// identical text and hydration never mismatches.

const LOCALE = "en-GB";
const TIME_ZONE = "Asia/Dubai";

export const fmt = (n: number) => n.toLocaleString("en-US");

export const pct = (part: number, whole: number) =>
  whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;

export function fmtDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

export function fmtDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

/** "Construction" from "construction", leaving acronyms alone. */
export function headlineCase(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${fmt(n)} ${n === 1 ? one : many}`;
