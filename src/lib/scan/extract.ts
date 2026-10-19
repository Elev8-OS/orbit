import type { ExtractedContact } from "./types";
import { normalizeUrl } from "./url";

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
  "firstName", "lastName", "email", "phone", "mobile", "company", "title", "website", "street", "city", "postalCode", "linkedin"
];

const TOOL = {
  name: "contact_extracted",
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

function prompt(hasBack: boolean): string {
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
- Handwritten remarks on a printed card (e.g. "demo in March", "12 units", "call back Tuesday") are NOT contact data: put them into notes,
  prefixed with "Handnotiz: ". Only treat handwritten text as contact data when it clearly is (an added mobile number, a corrected email).
Answer by calling the tool contact_extracted exactly once.`;
}

type Block = { type: string; name?: string; input?: unknown; text?: string };

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

function normalise(raw: unknown): ExtractedContact {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const roleTags = Array.isArray(o.roleTags)
    ? o.roleTags.map((t) => String(t).toLowerCase().trim()).filter((t) => ROLE_VOCAB.includes(t))
    : [];
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
      : []
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

export async function extractContact(front: string, back: string | null): Promise<ExtractedContact> {
  if (!claudeConfigured()) throw new Error("ANTHROPIC_API_KEY fehlt");
  const model = process.env.SCAN_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const images = [parseImage(front, "Vorderseite")];
  if (back) images.push(parseImage(back, "Rückseite"));

  const content: unknown[] = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data }
  }));
  content.push({ type: "text", text: prompt(Boolean(back)) });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      tools: [TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }]
    }),
    signal: AbortSignal.timeout(60_000)
  });
  const json = (await res.json().catch(() => null)) as { content?: Block[]; error?: { message?: string } } | null;
  if (!res.ok || !json?.content) throw new Error(`Claude-API: ${json?.error?.message ?? res.status}`);

  const block = json.content.find((c) => c.type === "tool_use" && c.name === TOOL.name);
  if (block?.input) return normalise(block.input);
  const fromText = jsonFromText(json.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"));
  if (fromText) return normalise(fromText);
  throw new Error("Claude-API: keine strukturierte Antwort");
}
