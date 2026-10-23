import { renderEmail } from "@/lib/mail/layout";
import { mailConfigured, sendMail } from "@/lib/mail/send";
import { getTranscript, internalDomains, isInternalEmail, type Transcript } from "@/lib/offerten/fireflies";
import * as ghl from "@/lib/offerten/ghl";
import { analyzeIntent, decide, intentConfigured, type OnboardingIntent } from "./analysis";
import {
  EMPTY_RECIPIENT,
  claimMeeting,
  claimSend,
  createDraft,
  finishMeeting,
  getDraft,
  logEvent,
  markSent,
  normalizeRecipient,
  openDraftForMeeting,
  releaseSend,
  saveGhlSync,
  type OnboardingDraft,
  type OrbitResult,
  type Recipient
} from "./store";

const orbitUrl = () => process.env.AUTH_URL || "https://myorbit.elev8-suite.com";
export const draftUrl = (id: string) => `${orbitUrl()}/onboarding/${id}`;

/** Orbit 4, wo das Kundenkonto entsteht (Partnerportal). */
const portalUrl = () => (process.env.ONBOARDING_ORBIT_URL || "https://orbit.elev8-suite.com").replace(/\/+$/, "");
export const portalConfigured = () => Boolean(process.env.ONBOARDING_SERVICE_SECRET);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");

// ── Aus GHL vorbefüllen ─────────────────────────────────────────────────────

type Prefill = {
  recipient: Recipient;
  ghlContactId: string;
  ghlOpportunityId: string | null;
  partnerName: string | null;
  partnerEmail: string | null;
};

/** Kontakt, Opportunity und Owner (der Owner wird in Orbit 4 der zuständige Partner, falls er dort ein Partner-Konto hat). */
async function prefillFromContact(contact: ghl.GhlContact): Promise<Prefill> {
  const [opportunities, owner] = await Promise.all([
    ghl.opportunitiesForContact(contact.id).catch(() => []),
    contact.assignedTo ? ghl.getUser(contact.assignedTo) : Promise.resolve(null)
  ]);
  return {
    recipient: normalizeRecipient({ name: contact.name, email: contact.email, company: contact.company, phone: contact.phone }),
    ghlContactId: contact.id,
    ghlOpportunityId: ghl.pickOpportunity(opportunities)?.id ?? null,
    partnerName: owner?.name || null,
    partnerEmail: owner?.email || null
  };
}

async function findProspect(t: Transcript, intent: OnboardingIntent | null): Promise<ghl.GhlContact | null> {
  if (!ghl.ghlConfigured()) return null;
  const candidates = [intent?.contactEmail?.toLowerCase(), ...t.attendees.map((a) => a.email), ...t.participants].filter((e): e is string =>
    Boolean(e && e.includes("@") && !isInternalEmail(e))
  );
  for (const email of [...new Set(candidates)]) {
    const contact = await ghl.findContactByEmail(email).catch((err) => {
      console.error(`Onboarding: GHL-Kontaktsuche für ${email}:`, err);
      return null;
    });
    if (contact) return contact;
  }
  return null;
}

// ── Webhook: Call nach Abschluss prüfen ───────────────────────────────────────────

/**
 * Wird nach jedem Fireflies-Call aufgerufen (neben den Offerten, unabhängig davon). Legt einen Entwurf an, wenn der
 * Interessent mit dem Onboarding starten will, und benachrichtigt den Organisator. Sendet nie automatisch und wirft nie.
 */
export async function processOnboardingMeeting(meetingId: string): Promise<void> {
  try {
    if (!(await claimMeeting(meetingId))) return;
    if (!intentConfigured()) {
      await finishMeeting(meetingId, { status: "error", reason: "ANTHROPIC_API_KEY fehlt" });
      return;
    }
    const transcript = await getTranscript(meetingId);
    if (!transcript) {
      await finishMeeting(meetingId, { status: "error", reason: "Transkript nicht gefunden" });
      return;
    }
    const base = { title: transcript.title, meetingDate: transcript.dateString, organizer: transcript.organizerEmail };
    const everyone = [...transcript.participants, ...transcript.attendees.map((a) => a.email ?? "")].filter(Boolean);
    if (!everyone.some((e) => !isInternalEmail(e))) {
      await finishMeeting(meetingId, { ...base, status: "internal", reason: "Nur interne Teilnehmer" });
      return;
    }

    const intent = await analyzeIntent(transcript, internalDomains());
    const verdict = decide(intent);
    if (verdict === "none") {
      await finishMeeting(meetingId, { ...base, status: "no_onboarding", reason: intent.evidence, analysis: intent });
      return;
    }
    if (verdict === "uncertain") {
      await finishMeeting(meetingId, { ...base, status: "uncertain", reason: intent.evidence, analysis: intent });
      return;
    }
    if (await openDraftForMeeting(meetingId)) {
      await finishMeeting(meetingId, { ...base, status: "draft_created" });
      return;
    }

    const contact = await findProspect(transcript, intent);
    const prefill = contact ? await prefillFromContact(contact) : null;
    const external = transcript.attendees.find((a) => a.email && !isInternalEmail(a.email));
    const recipient: Recipient = prefill?.recipient ?? normalizeRecipient({
      name: intent.contactName ?? external?.name ?? "",
      email: intent.contactEmail ?? external?.email ?? "",
      company: intent.company ?? ""
    });
    if (!recipient.company && intent.company) recipient.company = intent.company;
    const ownerEmail = transcript.organizerEmail ?? "";

    const draft = await createDraft(
      {
        source: "fireflies",
        meetingId,
        meetingTitle: transcript.title,
        meetingDate: transcript.dateString,
        analysis: intent,
        ghlContactId: prefill?.ghlContactId ?? null,
        ghlOpportunityId: prefill?.ghlOpportunityId ?? null,
        recipient,
        language: intent.language,
        contractFirst: intent.contractFirst === true,
        partnerName: prefill?.partnerName ?? null,
        partnerEmail: prefill?.partnerEmail ?? null,
        ownerName: ownerEmail ? nameFromEmail(ownerEmail) : null,
        ownerEmail: ownerEmail || null
      },
      "Fireflies"
    );
    await finishMeeting(meetingId, { ...base, status: "draft_created", reason: intent.evidence, analysis: intent, draftId: draft.id });
    await notifyOwner(draft, intent, Boolean(contact));
  } catch (err) {
    console.error(`Onboarding: Call ${meetingId} nicht verarbeitet:`, err);
    await finishMeeting(meetingId, { status: "error", reason: err instanceof Error ? err.message.slice(0, 500) : "Unbekannter Fehler" }).catch(() => {});
  }
}

async function notifyOwner(draft: OnboardingDraft, intent: OnboardingIntent, ghlFound: boolean) {
  const to = draft.ownerEmail;
  if (!to || !mailConfigured() || !isInternalEmail(to)) return;
  const who = draft.recipient.company || draft.recipient.name || draft.recipient.email || "Interessent";
  const { html, text } = renderEmail({
    lang: "de",
    preheader: `Onboarding für ${who} liegt in Orbit bereit.`,
    heading: `Onboarding für ${who} bereit`,
    blocks: [
      { type: "paragraph", text: `Nach dem Call „${draft.meetingTitle ?? "Call"}“ hat Orbit einen Startwunsch erkannt und einen Entwurf angelegt. Es wurde noch nichts gesendet. Bitte prüfen und mit „Senden“ freigeben.` },
      { type: "quote", text: intent.evidence },
      {
        type: "details",
        rows: [
          ["Empfänger", [draft.recipient.name, draft.recipient.email].filter(Boolean).join(", ") || "noch offen"],
          ["GHL-Kontakt", ghlFound ? "gefunden und verknüpft" : "nicht gefunden, wird beim Senden in Orbit 4 neu angelegt"],
          ["Vertrag vorab", draft.contractFirst ? "gewünscht" : "nicht besprochen"]
        ]
      }
    ],
    cta: { label: "Entwurf öffnen", url: draftUrl(draft.id) },
    footer: "Diese E-Mail wurde von der Onboarding-App in Orbit gesendet."
  });
  await sendMail({ to, subject: `Onboarding bereit: ${who}`, html, text, tags: [{ name: "type", value: "onboarding_draft" }] });
}

// ── Von Hand anlegen ──────────────────────────────────────────────────────────

export type Starter = { id: string; name: string; email: string };
export type ManualInput = { name?: string; email?: string; company?: string; phone?: string; language?: "de" | "en"; contractFirst?: boolean };

/** Entwurf ohne Call. Gibt es zur E-Mail schon einen GHL-Kontakt, wird er vorbefüllt und verknüpft. */
export async function createManual(user: Starter, input: ManualInput): Promise<OnboardingDraft> {
  const email = input.email?.trim().toLowerCase() ?? "";
  const contact = email && ghl.ghlConfigured() ? await ghl.findContactByEmail(email).catch(() => null) : null;
  const prefill = contact ? await prefillFromContact(contact) : null;
  const recipient = normalizeRecipient({
    ...EMPTY_RECIPIENT,
    ...(prefill?.recipient ?? {}),
    ...(input.name ? { name: input.name } : {}),
    ...(email ? { email } : {}),
    ...(input.company ? { company: input.company } : {}),
    ...(input.phone ? { phone: input.phone } : {})
  });
  return createDraft(
    {
      source: "manual",
      ghlContactId: prefill?.ghlContactId ?? null,
      ghlOpportunityId: prefill?.ghlOpportunityId ?? null,
      recipient,
      language: input.language ?? "de",
      contractFirst: input.contractFirst === true,
      partnerName: prefill?.partnerName ?? null,
      partnerEmail: prefill?.partnerEmail ?? null,
      ownerName: user.name,
      ownerEmail: user.email
    },
    user.name
  );
}

// ── Senden: Konto und Einladung in Orbit 4 ─────────────────────────────────────────

export const SEND_MESSAGES: Record<string, string> = {
  not_found: "Entwurf nicht gefunden.",
  not_editable: "Dieser Entwurf wurde schon gesendet oder verworfen.",
  invalid_recipient: "Bitte Name und eine gültige E-Mail-Adresse eintragen.",
  not_configured: "Die Verbindung zu Orbit 4 ist nicht eingerichtet (ONBOARDING_SERVICE_SECRET fehlt).",
  unauthorized: "Orbit 4 hat die Verbindung abgelehnt. Das gemeinsame Geheimnis stimmt nicht.",
  exists: "Diese E-Mail hat in Orbit 4 schon ein Konto. Bitte den Kunden im Partnerportal prüfen.",
  ghl_linked: "Der GHL-Kontakt ist in Orbit 4 schon mit einem Kunden verknüpft.",
  ghl_missing: "Den GHL-Kontakt gibt es nicht mehr. Bitte die Verknüpfung prüfen.",
  no_partner: "Der Partner wurde in Orbit 4 nicht gefunden.",
  invalid: "Orbit 4 hat die Angaben abgelehnt. Bitte Name und E-Mail prüfen.",
  unreachable: "Orbit 4 ist gerade nicht erreichbar. Es wurde nichts angelegt, bitte später nochmals versuchen.",
  failed: "Orbit 4 hat einen Fehler gemeldet. Bitte prüfen, ob das Konto schon existiert, bevor du es nochmals versuchst."
};

export type SendResult = { ok: true; draft: OnboardingDraft } | { ok: false; code: string; message: string };

const fail = (code: string): SendResult => ({ ok: false, code, message: SEND_MESSAGES[code] ?? SEND_MESSAGES.failed });

/**
 * Legt den Kunden in Orbit 4 an (Konto, GHL-Abgleich, Einladung per E-Mail). Nur einmal pro Entwurf: Bei einem Fehler
 * kehrt der Entwurf mit der Meldung zurück, bei Erfolg ist er gesendet.
 */
export async function sendDraft(id: string, user: { name: string; email: string }): Promise<SendResult> {
  const draft = await getDraft(id);
  if (!draft) return fail("not_found");
  if (draft.status !== "draft") return fail("not_editable");
  const r = draft.recipient;
  if (r.name.length < 2 || !EMAIL.test(r.email)) return fail("invalid_recipient");
  if (!portalConfigured()) return fail("not_configured");
  if (!(await claimSend(id))) return fail("not_editable");

  const release = async (code: string, detail?: unknown): Promise<SendResult> => {
    const result = fail(code);
    await releaseSend(id, result.ok ? "" : result.message).catch(() => {});
    await logEvent(id, user.name, "send_failed", { code, detail }).catch(() => {});
    return result;
  };

  let res: Response;
  try {
    res = await fetch(`${portalUrl()}/api/integrations/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ONBOARDING_SERVICE_SECRET}` },
      body: JSON.stringify({
        draftId: draft.id,
        name: r.name,
        email: r.email,
        company: r.company || undefined,
        phone: r.phone || undefined,
        lang: draft.language,
        ghlContactId: draft.ghlContactId ?? undefined,
        partnerEmail: draft.partnerEmail ?? undefined,
        contractFirst: draft.contractFirst,
        requestedBy: user.email
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store"
    });
  } catch (err) {
    return release("unreachable", err instanceof Error ? err.message : String(err));
  }

  const json = (await res.json().catch(() => ({}))) as { error?: string; id?: string; mailed?: boolean; partner?: string };
  if (res.status === 401 || res.status === 403) return release("unauthorized");
  if (!res.ok) return release(json.error && SEND_MESSAGES[json.error] ? json.error : res.status >= 500 ? "failed" : "invalid", { status: res.status, error: json.error });
  if (!json.id) return release("failed", { status: res.status });

  const result: OrbitResult = { personId: json.id, mailed: json.mailed === true, partner: json.partner === "assigned" ? "assigned" : "none", at: new Date().toISOString() };
  await markSent(id, user, result);
  await logEvent(id, user.name, "sent", { ...result, to: r.email, contractFirst: draft.contractFirst });

  // Notiz im GHL-Kontakt (best effort; das Konto in Orbit 4 ist zu diesem Zeitpunkt schon angelegt)
  if (draft.ghlContactId && ghl.ghlConfigured()) {
    const sync: { at: string; note?: { ok: boolean; error?: string } } = { at: new Date().toISOString() };
    try {
      await ghl.addNote(
        draft.ghlContactId,
        [
          `Onboarding-Einladung an ${r.email} gesendet von ${user.name}.`,
          result.mailed ? "Die Einladung per E-Mail ist raus." : "Konto angelegt, die Einladungs-E-Mail ging NICHT raus. Bitte im Partnerportal erneut senden.",
          `Vertrag vorab: ${draft.contractFirst ? "ja" : "nein"}.`,
          `In Orbit: ${draftUrl(id)}`
        ].join("\n")
      );
      sync.note = { ok: true };
    } catch (err) {
      sync.note = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    await saveGhlSync(id, sync).catch(() => {});
  }
  return { ok: true, draft: (await getDraft(id)) ?? draft };
}
