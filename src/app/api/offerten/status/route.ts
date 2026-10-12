import { requireOffertenUser } from "@/lib/offerten/access";
import { claudeConfigured } from "@/lib/offerten/claude";
import { checkConnection as checkFireflies } from "@/lib/offerten/fireflies";
import { checkConnection as checkGhl } from "@/lib/offerten/ghl";
import { mailProvider } from "@/lib/offerten/mailer";

export const dynamic = "force-dynamic";

/** Prüft die Verbindungen der Offerten-App (für die Einstellungsseite). */
export async function GET() {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  const [ghl, fireflies] = await Promise.all([checkGhl(), checkFireflies()]);
  const provider = mailProvider();
  return Response.json({
    ghl,
    fireflies,
    claude: { ok: claudeConfigured(), detail: claudeConfigured() ? "API-Key gesetzt" : "ANTHROPIC_API_KEY fehlt" },
    mail: {
      ok: Boolean(provider),
      detail: provider === "graph" ? "Microsoft 365 (eigenes Postfach)" : provider === "resend" ? "Resend" : "nicht eingerichtet"
    },
    webhook: { ok: Boolean(process.env.FIREFLIES_WEBHOOK_SECRET), detail: process.env.FIREFLIES_WEBHOOK_SECRET ? "Secret gesetzt" : "FIREFLIES_WEBHOOK_SECRET fehlt" }
  });
}
