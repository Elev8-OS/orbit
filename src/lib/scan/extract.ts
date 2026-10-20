import type { ExtractedContact } from "./types";
import { normalizeUrl } from "./url";
import { MULTI_TYPES, OPTION_TYPES, deriveCrm, parseUnits, type CrmField } from "./crm";

/**
 * Liest eine Visitenkarte (Vorder- und optional Rückseite) oder ein LinkedIn-Profil-Foto mit Claude aus.
 * Prompt, Modell und Grössenlimits liegen hier auf dem Server; der Browser schickt nur die Bilder.
 * Benötigt ANTHROPIC_API_KEY (wie Offerten). Modell über SCAN_MODEL oder ANTHROPIC_MODEL überschreibbar.
 */

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Maximale Bildgrösse pro Seite (Base64), der Browser verkleinert auf 1600 px → typischerweise 200–500 KB */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Felder, die als unsicher markiert werden können */
export const UNCERTAIN_FIELDS = [
  "firstName", "lastName", "email", "phone", "mobile", "company", "title", "website", "street", "city", "postalCode", "linkedin",
  "units", "pms"
];

const TOOL_NAME = "contact_extracted";

/** Schema für die GHL-Auswahlfelder, die Claude direkt wählt (Art "ai") */
function crmSchema(fields: CrmField[]) {
  const properties: Record<string, unknown> = {};
  for (const f of fields.filter((x) => x.kind === "ai")) {
    const description = [f.name, f.hint].filter(Boolean).join(" – ");
    if (OPTION_TYPES.includes(f.type) && f.options.length) {
      properties[f.key] = MULTI_TYPES.includes(f.type)
        ? { type: "array", items: { type: "string", enum: f.options }, description }
        : { type: ["string", "null"], enum: [...f.options, null], description };
    } else {
      properties[f.key] = { type: ["string", "null"], description };
    }
  }
  return properties;
}

function buildTool(fields: CrmField[]) {
  const crm = crmSchema(fields);
  return {
    ...TOOL,
    input_schema: {
      ...TOOL.input_schema,
      properties: {
        ...TOOL.input_schema.properties,
        ...(Object.keys(crm).length
          ? { crm: { type: "object", properties: crm, description: "CRM fields; omit or leave empty what the card does not show" } }
          : {})
      }
    }
  };
}

const TOOL = {
  name: TOOL_NAME,
  description: "Die aus dem Bild gelesenen Kontaktdaten.",
  input_schema: {
    type: "object",
    properties: {
      firstName: { type: ["string", "null"] },
      lastName: { type: ["string", "null"] },
      email: { type: ["string", "null"] },
      phone: { type: ["string", "null"], description: "Festnetz, E.164" },
      mobile: { type: ["string", "null"], description: "Mobil, E.164" },
      company: { type: ["string", "null"] },
      title: { type: ["string", "null"], description: "Position / Funktion" },
      website: { type: ["string", "null"] },
      street: { type: ["string", "null"] },
      city: { type: ["string", "null"] },
      state: { type: ["string", "null"] },
      postalCode: { type: ["string", "null"] },
      country: { type: ["string", "null"], description: "Ausgeschriebener Ländername auf Englisch" },
      timezone: { type: ["string", "null"], description: "IANA, z. B. Europe/Zurich" },
      linkedin: { type: ["string", "null"], description: "Vollständige LinkedIn-URL, nur wenn sichtbar" },
      industry: { type: ["string", "null"] },
      language: { type: ["string", "null"], description: "ISO 639-1, z. B. de" },
      roleTags: { type: "array", items: { type: "string" } },
      notes: { type: ["string", "null"] },
      sourceType: { type: "string", enum: ["business_card", "linkedin_profile", "other"] },
      handwritten: { type: "boolean", description: "true, wenn Kontaktdaten ganz oder teilweise von Hand geschrieben sind" },
      units: {
        type: ["integer", "null"],
        description: "Number of rental units / properties / villas / rooms the person or company manages, only when stated (\"25 villas\", \"120+ units\" → 120)"
      },
      pms: {
        type: ["string", "null"],
        description: "Property management system / channel manager they use, product name as seen (e.g. Guesty, Hostaway, Smoobu); \"none\" if they use none or only Excel"
      },
      uncertain: {
        type: "array",
        items: { type: "string", enum: UNCERTAIN_FIELDS },
        description: "Felder, deren Lesung unsicher ist"
      }
    },
    required: ["firstName", "lastName", "sourceType"]
  }
};

const ROLE_VOCAB = [
  "c-level", "founder", "co-founder", "owner", "executive", "vp", "director", "manager", "lead", "senior", "junior",
  "sales", "marketing", "engineering", "product", "operations", "finance", "hr", "legal", "design", "consulting",
  "assistant", "intern"
];

function prompt(hasBack: boolean, fields: CrmField[]): string {
  const ai = fields.filter((f) => f.kind === "ai");
  const crmRules = ai.length
    ? `\n- crm: fill only the CRM fields the card clearly supports, choosing from the given options (${ai.map((f) => f.name).join(", ")}). Leave the rest out.`
    : "";
  return `You extract contact data from images for a CRM. The image is either
(A) a business card${hasBack ? " – image 1 is the FRONT, image 2 the BACK; merge both sides into one contact, preferring the more complete value when both sides differ" : ""}, or
(B) a photo or screenshot of a LinkedIn profile (circular photo, large name, headline below).
Cards may be partly or fully HANDWRITTEN (a blank card, a napkin, a note with name, email and phone). Read handwriting as carefully as print.

Decide which, then extract what is visible. Rules:
- A field that is not visible is null. Invent nothing factual.
- phone = landline, mobile = cellular; a single unclear number goes to phone. Normalise both to E.164 with country code (infer the prefix from country or city when it is missing; if unsure keep as printed).
- street holds only the street line; city only the city; postalCode as a string; state = state/province/canton; country = full English name.
- timezone = best IANA guess from city/country.
- linkedin only when the URL is visible (address bar, QR label, printed). Never derive it from the name.
- For LinkedIn headlines like "Head of Sales at Elev8" split into title and company; without "at" the whole headline is the title.
- industry = one short English label inferred from company, title and slogan (e.g. Hospitality, Real Estate, SaaS). null if unclear.
- language = best guess of the person's primary language (ISO 639-1) from country, script and visible hints.
- roleTags = 1–3 lowercase labels for seniority/function from this list only: ${ROLE_VOCAB.join(", ")}. Empty array if unclear.
- notes = slogans, About text, anything useful that fits nowhere else.
- Handwriting: set handwritten=true. For ambiguous characters (0/o, 1/l/I, rn/m, u/v, 5/s, 7/1) choose the most plausible reading
  in context – emails usually end in a real domain (gmail.com, outlook.com, the company website), phone numbers have the usual length for the country.
- If a reading is still doubtful, put the field name into uncertain (only these names: ${UNCERTAIN_FIELDS.join(", ")}). Do not list fields you read clearly.
- units: only when a portfolio size is stated – on the card ("Managing 40 villas", "120+ units", "12 Apartments") or in a handwritten
  note ("12 units", "30 Villen"). Use the number (\"120+\" → 120, a range \"20–30\" → the upper value). Never guess from company size.
- pms: only when visible – a software logo or "powered by …" / partner badge for the PMS they use, or a handwritten note ("Guesty",
  "uses Smoobu", "nur Excel" → none). If the card belongs to an employee of a software vendor, their own product is NOT their PMS: pms = null.${crmRules}
- Handwritten remarks on a printed card (e.g. "demo in March", "12 units", "call back Tuesday") are NOT contact data: put them into notes,
  prefixed with "Handnotiz: ". Only treat handwritten text as contact data when it clearly is (an added mobile number, a corrected email).
  Units and PMS from such a note go into units/pms as well (keep the note too).
Answer by calling the tool contact_extracted exactly once.`;
}

type Block = { type: string; name?: string; input?: unknown; text?: string };

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

function normalise(raw: unknown, fields: CrmField[] = []): ExtractedContact {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const roleTags = Array.isArray(o.roleTags)
    ? o.roleTags.map((t) => String(t).toLowerCase().trim()).filter((t) => ROLE_VOCAB.includes(t))
    : [];
  const units = parseUnits(o.units);
  const pms = str(o.pms);
  const crm = deriveCrm(fields, units, pms, o.crm && typeof o.crm === "object" ? (o.crm as Record<string, unknown>) : {});
  const sourceType = o.sourceType === "linkedin_profile" ? "linkedin_profile" : o.sourceType === "other" ? "other" : "business_card";
  return {
    firstName: str(o.firstName),
    lastName: str(o.lastName),
    email: str(o.email)?.toLowerCase() ?? null,
    phone: str(o.phone),
    mobile: str(o.mobile),
    company: str(o.company),
    title: str(o.title),
    website: normalizeUrl(str(o.website)),
    street: str(o.street),
    city: str(o.city),
    state: str(o.state),
    postalCode: str(o.postalCode),
    country: str(o.country),
    timezone: str(o.timezone),
    linkedin: normalizeUrl(str(o.linkedin)),
    industry: str(o.industry),
    language: str(o.language)?.toLowerCase().slice(0, 2) ?? null,
    roleTags: [...new Set(roleTags)].slice(0, 3),
    notes: str(o.notes),
    sourceType,
    handwritten: o.handwritten === true,
    uncertain: Array.isArray(o.uncertain)
      ? [...new Set(o.uncertain.map((f) => String(f)).filter((f) => UNCERTAIN_FIELDS.includes(f)))]
      : [],
    units,
    pms,
    crm
  };
}

function jsonFromText(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Zerlegt eine Data-URL in Medientyp und Base64. Wirft bei fremden Typen oder zu grossen Bildern. */
export function parseImage(dataUrl: string, label: string): { mediaType: string; data: string } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) throw new Error(`${label}: Bild muss als JPEG, PNG oder WebP (Data-URL) kommen`);
  if (m[2].length > MAX_IMAGE_BYTES) throw new Error(`${label}: Bild ist zu gross (max. 4 MB)`);
  return { mediaType: m[1], data: m[2] };
}

export async function extractContact(front: string, back: string | null, crmFields: CrmField[] = []): Promise<ExtractedContact> {
  if (!claudeConfigured()) throw new Error("ANTHROPIC_API_KEY fehlt");
  const model = process.env.SCAN_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const images = [parseImage(front, "Vorderseite")];
  if (back) images.push(parseImage(back, "Rückseite"));

  const content: unknown[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data }
  }));
  content.push({ type: "text", text: prompt(Boolean(back), crmFields) });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      tools: [buildTool(crmFields)],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }]
    }),
    signal: AbortSignal.timeout(60_000)
  });
  const json = (await res.json().catch(() => null)) as { content?: Block[]; error?: { message?: string } } | null;
  if (!res.ok || !json?.content) throw new Error(`Claude-API: ${json?.error?.message ?? res.status}`);

  const block = json.content.find((c) => c.type === "tool_use" && c.name === TOOL_NAME);
  if (block?.input) return normalise(block.input, crmFields);
  const fromText = jsonFromText(json.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"));
  if (fromText) return normalise(fromText, crmFields);
  throw new Error("Claude-API: keine strukturierte Antwort");
}
