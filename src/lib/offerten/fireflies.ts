import crypto from "node:crypto";

/**
 * Fireflies GraphQL-API. Doku: https://docs.fireflies.ai
 * Benötigt FIREFLIES_API_KEY (Fireflies → Settings → Developer settings → API key).
 */

const ENDPOINT = "https://api.fireflies.ai/graphql";

export function firefliesConfigured(): boolean {
  return Boolean(process.env.FIREFLIES_API_KEY);
}

async function query<T>(gql: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}` },
    body: JSON.stringify({ query: gql, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000)
  });
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
  if (!res.ok || !json?.data || json.errors?.length) {
    throw new Error(`Fireflies-API: ${json?.errors?.map((e) => e.message).join("; ") || res.status}`);
  }
  return json.data;
}

export type Transcript = {
  id: string;
  title: string;
  dateString: string | null;
  duration: number | null;
  organizerEmail: string | null;
  participants: string[];
  attendees: { name: string | null; email: string | null }[];
  summary: { shortSummary: string; overview: string; actionItems: string; keywords: string[] };
  sentences: { speaker: string; text: string }[];
  url: string;
};

type RawTranscript = {
  id: string;
  title: string | null;
  dateString: string | null;
  duration: number | null;
  organizer_email: string | null;
  participants: string[] | null;
  meeting_attendees: { displayName: string | null; name: string | null; email: string | null }[] | null;
  summary: { short_summary: string | null; overview: string | null; action_items: string | null; keywords: string[] | null } | null;
  sentences: { speaker_name: string | null; text: string | null }[] | null;
  transcript_url: string | null;
};

export async function getTranscript(id: string): Promise<Transcript | null> {
  const data = await query<{ transcript: RawTranscript | null }>(
    `query Transcript($id: String!) {
      transcript(id: $id) {
        id title dateString duration organizer_email participants transcript_url
        meeting_attendees { displayName name email }
        summary { short_summary overview action_items keywords }
        sentences { speaker_name text }
      }
    }`,
    { id }
  );
  const t = data.transcript;
  if (!t) return null;
  return {
    id: t.id,
    title: t.title ?? "",
    dateString: t.dateString,
    duration: t.duration,
    organizerEmail: t.organizer_email?.toLowerCase() ?? null,
    participants: (t.participants ?? []).flatMap((p) => p.split(",")).map((p) => p.trim().toLowerCase()).filter(Boolean),
    attendees: (t.meeting_attendees ?? []).map((a) => ({ name: a.displayName ?? a.name ?? null, email: a.email?.toLowerCase() ?? null })),
    summary: {
      shortSummary: t.summary?.short_summary ?? "",
      overview: t.summary?.overview ?? "",
      actionItems: t.summary?.action_items ?? "",
      keywords: t.summary?.keywords ?? []
    },
    sentences: (t.sentences ?? []).map((s) => ({ speaker: s.speaker_name ?? "?", text: s.text ?? "" })),
    url: t.transcript_url ?? `https://app.fireflies.ai/view/${t.id}`
  };
}

export type TranscriptListItem = {
  id: string;
  title: string;
  dateString: string | null;
  organizerEmail: string | null;
  participants: string[];
};

export async function listRecentTranscripts(limit = 25): Promise<TranscriptListItem[]> {
  const data = await query<{
    transcripts: { id: string; title: string | null; dateString: string | null; organizer_email: string | null; participants: string[] | null }[];
  }>(
    `query Recent($limit: Int) {
      transcripts(limit: $limit) { id title dateString organizer_email participants }
    }`,
    { limit }
  );
  return data.transcripts.map((t) => ({
    id: t.id,
    title: t.title ?? "",
    dateString: t.dateString,
    organizerEmail: t.organizer_email?.toLowerCase() ?? null,
    participants: (t.participants ?? []).flatMap((p) => p.split(",")).map((p) => p.trim().toLowerCase()).filter(Boolean)
  }));
}

/**
 * Prüft die Webhook-Signatur. Fireflies signiert den Body mit HMAC-SHA256;
 * Webhooks V2 senden "sha256=<hex>", die alte Version nur "<hex>". Beides wird akzeptiert.
 */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const received = header.trim().replace(/^sha256=/i, "").toLowerCase();
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

/** Interne Domains (kommagetrennt in OFFERTEN_INTERNAL_DOMAINS). Teilnehmer daraus gelten nicht als Interessenten. */
export function internalDomains(): string[] {
  return (process.env.OFFERTEN_INTERNAL_DOMAINS ?? "elev8-suite.com,elevater.ch")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isInternalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return internalDomains().some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Transkript als kompakter Text für die Analyse, begrenzt auf ca. 120'000 Zeichen. */
export function transcriptText(t: Transcript, maxChars = 120_000): string {
  const lines: string[] = [];
  let last = "";
  for (const s of t.sentences) {
    if (s.speaker === last) lines[lines.length - 1] += ` ${s.text}`;
    else lines.push(`${s.speaker}: ${s.text}`);
    last = s.speaker;
  }
  const full = lines.join("\n");
  if (full.length <= maxChars) return full;
  // Anfang und Ende behalten: Offertwünsche fallen meist gegen Schluss
  const head = Math.floor(maxChars * 0.35);
  return `${full.slice(0, head)}\n[… gekürzt …]\n${full.slice(-(maxChars - head))}`;
}
