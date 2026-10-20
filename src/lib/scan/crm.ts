/**
 * GHL-Kontaktfelder, die der Scanner aus einer Karte füllt (Anzahl Units, PMS, Objektart, Interessen …).
 * Reine Logik ohne Server-Abhängigkeiten: läuft im Browser (sofortige Neuberechnung beim Bearbeiten)
 * und auf dem Server (Auslesen, Prüfung vor dem Schreiben nach GHL).
 *
 * Arten:
 * - units:   aus der erkannten Anzahl Units. Auswahlfelder bekommen den passenden Bereich ("6 - 20"),
 *            Zahlenfelder die Zahl, Textfelder die Zahl als Text.
 * - pms:     aus dem erkannten PMS. Auswahlfelder bekommen die passende Option (sonst "Other"/"Anderes System",
 *            bei "keins/Excel" die Option "None / Manual"), Textfelder den Namen wie gelesen.
 * - usesPms: Ja/Nein-Felder "Nutzen Sie ein PMS?", abgeleitet aus dem PMS.
 * - ai:      Claude wählt direkt aus den Optionen des Felds, nur wenn die Karte es klar hergibt.
 */

export type CrmKind = "units" | "pms" | "usesPms" | "ai";
export type CrmField = {
  id: string;
  /** GHL-Feldschlüssel ohne "contact.", z. B. number_of_properties */
  key: string;
  name: string;
  /** GHL-Datentyp, z. B. SINGLE_OPTIONS, CHECKBOX, TEXT, NUMERICAL */
  type: string;
  options: string[];
  kind: CrmKind;
  hint?: string;
};
export type CrmValue = string | string[] | number;
/** Werte nach GHL-Feld-ID */
export type CrmValues = Record<string, CrmValue>;

export const OPTION_TYPES = ["SINGLE_OPTIONS", "MULTIPLE_OPTIONS", "RADIO", "CHECKBOX"];
export const MULTI_TYPES = ["MULTIPLE_OPTIONS", "CHECKBOX"];
export const NUMBER_TYPES = ["NUMERICAL", "MONETORY"];

/**
 * Standard-Felder (GHL-Schlüssel ohne "contact."). Überschreibbar mit SCAN_CRM_FIELDS,
 * z. B. "number_of_properties:units,current_pms__software:pms,property_type" (ohne Art = ai).
 */
export const DEFAULT_CRM_FIELDS: Record<string, { kind: CrmKind; hint?: string }> = {
  number_of_properties: { kind: "units" },
  vrm26_units_managed: { kind: "units" },
  lead_einheiten: { kind: "units" },
  current_pms__software: { kind: "pms" },
  current_pms__software_de: { kind: "pms" },
  vrm26_current_pms: { kind: "pms" },
  lead_aktuelle_tools: { kind: "pms" },
  are_you_currently_using_a_channel_manager_or_pms: { kind: "usesPms" },
  nutzen_sie_aktuell_einen_channel_manager_oder_ein_pms: { kind: "usesPms" },
  property_type: { kind: "ai", hint: "Type of rental portfolio, from company name, slogan or note (e.g. 'Bali Villas' → Villas)" },
  role: { kind: "ai", hint: "Owner = owns the properties; Property Manager = manages rentals for owners" },
  interested_in: { kind: "ai", hint: "Only from a handwritten note or explicit remark about what they want" },
  listing__website_url: { kind: "ai", hint: "Airbnb/Booking/Vrbo listing link or the website of the rental business, as a full URL" }
};

const KINDS: CrmKind[] = ["units", "pms", "usesPms", "ai"];

export function crmFieldConfig(env?: string | null): Record<string, { kind: CrmKind; hint?: string }> {
  if (!env || !env.trim()) return DEFAULT_CRM_FIELDS;
  const out: Record<string, { kind: CrmKind; hint?: string }> = {};
  for (const part of env.split(",")) {
    const [rawKey, rawKind] = part.split(":").map((s) => s.trim());
    const key = (rawKey ?? "").replace(/^contact\./, "");
    if (!key) continue;
    const kind = KINDS.includes(rawKind as CrmKind) ? (rawKind as CrmKind) : DEFAULT_CRM_FIELDS[key]?.kind ?? "ai";
    out[key] = { kind, hint: DEFAULT_CRM_FIELDS[key]?.hint };
  }
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
const base = (s: string) => norm(s.replace(/\(.*?\)/g, ""));

/** Passende Option zu einem freien Wert: exakt, ohne Klammerzusatz, oder als eindeutiger Teil. */
export function matchOption(value: string, options: string[]): string | null {
  const v = norm(value);
  if (!v) return null;
  const exact = options.find((o) => norm(o) === v || base(o) === v);
  if (exact) return exact;
  if (v.length < 4) return null;
  const partial = options.filter((o) => {
    const ob = base(o);
    const inner = (o.match(/\((.*?)\)/)?.[1] ?? "").trim();
    return (ob.length >= 4 && (v.includes(ob) || ob.includes(v))) || (inner && norm(inner) === v);
  });
  return partial.length === 1 ? partial[0] : null;
}

const NONE_RE = /^(none|nothing|no(ne)?pms|kein[es]?|manual(ly)?|manuell|excel|spreadsheet|googlesheets?|pen|paper|-)$/;
export const isNoPms = (pms: string) => NONE_RE.test(norm(pms)) || /^(none|keins?|manual|manuell)/i.test(pms.trim());

const findOpt = (options: string[], re: RegExp) => options.find((o) => re.test(o.trim())) ?? null;

function pmsOption(pms: string, options: string[]): string | null {
  if (isNoPms(pms)) return findOpt(options, /^(none|keins?|kein |manual|manuell)/i);
  return matchOption(pms, options) ?? findOpt(options, /^(other|anderes|andere|sonstige)/i);
}

/** Zahl in den passenden Bereich einer Auswahl ("1 - 5", "6 to 20", "50+") einordnen */
export function bucket(n: number, options: string[]): string | null {
  for (const o of options) {
    const range = o.match(/(\d+)\s*(?:-|–|to|bis)\s*(\d+)/i);
    if (range && n >= Number(range[1]) && n <= Number(range[2])) return o;
    const open = o.match(/(\d+)\s*\+/);
    if (open && !range && n >= Number(open[1])) return o;
  }
  return null;
}

/** Wert eines Felds auf das bringen, was GHL für den Feldtyp akzeptiert. null = verwerfen. */
export function cleanValue(f: CrmField, v: unknown): CrmValue | null {
  if (v == null || v === "") return null;
  if (OPTION_TYPES.includes(f.type)) {
    const list = (Array.isArray(v) ? v : [v]).map((x) => String(x));
    const picked = [...new Set(list.map((x) => (f.options.includes(x) ? x : matchOption(x, f.options))).filter((x): x is string => Boolean(x)))];
    if (!picked.length) return null;
    return MULTI_TYPES.includes(f.type) ? picked : picked[0];
  }
  if (NUMBER_TYPES.includes(f.type)) {
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const s = (Array.isArray(v) ? v.join(", ") : String(v)).trim().slice(0, 500);
  return s || null;
}

/** Wert eines abgeleiteten Felds (units, pms, usesPms). null = nichts erkannt. */
function derived(f: CrmField, units: number | null, pms: string | null): CrmValue | null {
  const isOption = OPTION_TYPES.includes(f.type);
  if (f.kind === "units") {
    if (units == null || !Number.isFinite(units) || units <= 0) return null;
    if (isOption) {
      const b = bucket(units, f.options);
      return b ? (MULTI_TYPES.includes(f.type) ? [b] : b) : null;
    }
    return NUMBER_TYPES.includes(f.type) ? units : String(units);
  }
  if (f.kind === "pms") {
    if (!pms?.trim()) return null;
    if (isOption) {
      const o = pmsOption(pms, f.options);
      return o ? (MULTI_TYPES.includes(f.type) ? [o] : o) : null;
    }
    return pms.trim().slice(0, 500);
  }
  if (f.kind === "usesPms") {
    if (!pms?.trim()) return null;
    const uses = !isNoPms(pms);
    const o = findOpt(f.options, uses ? /^(yes|ja|si|oui)\b/i : /^(no|nein|non)\b/i);
    if (o) return MULTI_TYPES.includes(f.type) ? [o] : o;
    return isOption ? null : uses ? "Yes" : "No";
  }
  return null;
}

/**
 * Alle Feldwerte berechnen: abgeleitete Felder aus units/pms, ai-Felder aus Claudes Vorschlag
 * (nach Feldschlüssel oder ID). Ungültige Werte fallen weg.
 */
export function deriveCrm(fields: CrmField[], units: number | null, pms: string | null, ai: Record<string, unknown> = {}): CrmValues {
  const out: CrmValues = {};
  for (const f of fields) {
    const v = f.kind === "ai" ? cleanValue(f, ai[f.key] ?? ai[f.id]) : derived(f, units, pms);
    if (v != null) out[f.id] = v;
  }
  return out;
}

/** Nach einer Korrektur von Units oder PMS die abgeleiteten Felder neu rechnen, ai-Felder unverändert lassen. */
export function rederive(fields: CrmField[], current: CrmValues, units: number | null, pms: string | null): CrmValues {
  const next: CrmValues = { ...current };
  for (const f of fields) if (f.kind !== "ai") delete next[f.id];
  return { ...next, ...deriveCrm(fields.filter((f) => f.kind !== "ai"), units, pms) };
}

/** Vom Browser gesendete Werte gegen die Felddefinitionen prüfen (Server). */
export function sanitizeCrm(fields: CrmField[], raw: unknown): CrmValues {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: CrmValues = {};
  for (const f of fields) {
    const v = cleanValue(f, o[f.id]);
    if (v != null) out[f.id] = v;
  }
  return out;
}

/** Anzahl Units aus Claude-Antwort oder Eingabe ("120+", "ca. 25") */
export function parseUnits(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const m = v.replace(/[’'.,](?=\d{3}\b)/g, "").match(/\d+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null;
}
