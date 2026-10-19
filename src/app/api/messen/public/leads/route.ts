import { after } from "next/server";
import { z } from "zod";
import { getEventBySlug, upsertLead } from "@/lib/messen/store";
import { syncLeadToGhl } from "@/lib/messen/ghl";
import { notifyMake, type MesseWebhookEvent } from "@/lib/messen/webhook";
import { enrichLeadWithAirroi } from "@/lib/messen/airroi";

export const dynamic = "force-dynamic";

/**
 * Öffentliches Lead-Formular der Messe-Landingpages (ohne Login, siehe middleware.ts).
 * Der Lead entsteht nach dem ersten Schritt (Kontakt) und wird mit derselben Losnummer und dem Token
 * aus dem Browser ergänzt (Units, Airbnb-Link). Idempotent: Offline gesammelte Stände kommen später nach.
 * Zusätzliche erlaubte Herkünfte (z. B. wenn das Formular auf elev8-suite.com eingebettet wird):
 * MESSEN_ALLOWED_ORIGINS, kommagetrennt.
 */

const lead = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  ticket: z.string().regex(/^E8-\d{3} \d{3}$/),
  edit_token: z.string().regex(/^([0-9a-f]{32})?$/).optional().default(""),
  completed: z.boolean().optional().default(true),
  website: z.string().max(200).optional(), // Honeypot
  name: z.string().trim().min(1).max(120),
  preferred_channel: z.enum(["whatsapp", "email"]),
  whatsapp: z.string().max(20).optional().default(""),
  email: z.string().max(200).optional().default(""),
  units: z.enum(["1-4", "5-19", "20-49", "50+", "none", ""]).optional().default(""),
  airbnb_url: z.string().max(300).optional().default(""),
  airbnb_listing_id: z.string().regex(/^\d{0,25}$/).optional().default(""),
  airbnb_host_id: z.string().regex(/^\d{0,25}$/).optional().default(""),
  company: z.string().trim().max(120).optional().default(""),
  pms: z.string().trim().max(60).optional().default(""),
  quiz_answer: z.enum(["cleaning", "guide", "communication", "channel", "all", ""]).optional().default(""),
  consent_terms: z.literal(true),
  consent_marketing: z.boolean().optional().default(false),
  source: z.enum(["qr_mobile", "booth_tablet"]).optional().default("qr_mobile"),
  utm_source: z.string().max(100).optional().default(""),
  utm_medium: z.string().max(100).optional().default(""),
  utm_campaign: z.string().max(100).optional().default(""),
  lang: z.enum(["de", "en"]).optional().default("de"),
  submitted_at: z.string().max(40).optional()
});

// „Was ist die Elev8-Suite?“ – richtig ist „Alles davon“
const QUIZ_CORRECT = "all";

const UNIT_SCORE: Record<string, number> = { "1-4": 1, "5-19": 2, "20-49": 3, "50+": 4 };

// Einfache Bremse pro IP (pro Prozess): 20 Einsendungen pro 10 Minuten. Ein Stand-Tablet schafft das kaum.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 20;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = (process.env.MESSEN_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return Response.json({ error: "too_many" }, { status: 429, headers });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers });
  }
  const parsed = lead.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400, headers });
  const d = parsed.data;

  // Bots füllen das unsichtbare Feld aus: freundlich bestätigen, nichts speichern
  if (d.website) return Response.json({ ok: true }, { headers });

  const whatsapp = d.whatsapp.replace(/[^\d+]/g, "");
  const email = d.email.trim().toLowerCase();
  if (d.preferred_channel === "whatsapp" && !/^\+?\d{8,15}$/.test(whatsapp)) {
    return Response.json({ error: "invalid", issues: ["whatsapp"] }, { status: 400, headers });
  }
  if (d.preferred_channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ error: "invalid", issues: ["email"] }, { status: 400, headers });
  }

  const event = await getEventBySlug(d.slug);
  if (!event) return Response.json({ error: "not_found" }, { status: 404, headers });
  // Nach der Ziehung nur noch Leads annehmen, die vorher abgeschickt und offline zwischengespeichert wurden
  const submittedAt = d.submitted_at && !Number.isNaN(Date.parse(d.submitted_at)) ? new Date(d.submitted_at) : null;
  const stamp = Math.min(submittedAt?.getTime() ?? Date.now(), Date.now());
  if (!event.active || (event.drawAt && stamp > event.drawAt.getTime())) {
    return Response.json({ error: "closed" }, { status: 410, headers });
  }

  const units = UNIT_SCORE[d.units] ?? 0;
  const airbnbUrl = /^https:\/\/([a-z0-9-]+\.)*(airbnb\.[a-z.]+|abnb\.me)\//i.test(d.airbnb_url) ? d.airbnb_url : "";
  const result = await upsertLead({
    eventId: event.id,
    ticket: d.ticket,
    name: d.name,
    preferredChannel: d.preferred_channel,
    whatsapp: d.preferred_channel === "whatsapp" ? whatsapp : "",
    email: d.preferred_channel === "email" ? email : "",
    units: d.units,
    airbnbUrl,
    airbnbListingId: airbnbUrl ? d.airbnb_listing_id : "",
    airbnbHostId: airbnbUrl ? d.airbnb_host_id : "",
    company: d.company,
    pms: d.pms,
    // Die Quizantwort wird nur gespeichert (beim Anlegen); für die Teilnahme spielt sie keine Rolle
    quizAnswer: d.quiz_answer,
    quizCorrect: d.quiz_answer ? d.quiz_answer === QUIZ_CORRECT : null,
    score: units + (airbnbUrl ? 1 : 0),
    tier: !d.units ? "open" : units >= 3 ? "hot" : units === 2 ? "warm" : "cold",
    consentMarketing: d.consent_marketing,
    source: d.source,
    utm: Object.fromEntries(
      Object.entries({ source: d.utm_source, medium: d.utm_medium, campaign: d.utm_campaign }).filter(([, v]) => v)
    ),
    lang: d.lang,
    completed: d.completed || d.units === "none",
    submittedAt,
    editToken: d.edit_token
  });

  if (result) {
    const events: MesseWebhookEvent[] = [];
    if (result.created) events.push("lead.created");
    if (result.becameComplete) events.push("lead.completed");
    // Erst GHL (damit Make und AirROI die Kontakt-ID haben), dann Make, dann einmal die AirROI-Notiz
    after(async () => {
      await syncLeadToGhl(result.id);
      await notifyMake(result.id, events);
      if (result.becameComplete) await enrichLeadWithAirroi(result.id);
    });
  }
  return Response.json({ ok: true, duplicate: !result }, { headers });
}
