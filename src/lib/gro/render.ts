import type { Constant } from "./types";

/** Ersetzt {{k:schluessel}} durch den aktuellen Wert der Regel (Wert und Einheit). Unbekannte Schlüssel bleiben sichtbar. */
export function resolve(text: string, constants: Constant[]): string {
  const map = new Map(constants.map((c) => [c.key, c]));
  return text.replace(/\{\{k:([a-z0-9_]+)\}\}/g, (m, k: string) => {
    const c = map.get(k);
    return c ? `${c.value}${c.unit ? " " + c.unit : ""}` : m;
  });
}

export const num = (constants: Constant[], key: string, fallback = 0) => constants.find((c) => c.key === key)?.num ?? fallback;
