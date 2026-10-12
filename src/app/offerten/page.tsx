import { getLocale } from "next-intl/server";
import { currentOffertenUser } from "@/lib/offerten/access";
import { ghlConfigured } from "@/lib/offerten/ghl";
import { computeTotals } from "@/lib/offerten/quote";
import { getSettings } from "@/lib/offerten/settings";
import { listQuotes } from "@/lib/offerten/store";
import { OffertenOverview, type QuoteRow } from "@/components/offerten/OffertenOverview";

export const dynamic = "force-dynamic";

export default async function OffertenPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await currentOffertenUser();
  if (!user) return null; // Layout zeigt den Hinweis
  const [quotes, settings, locale] = await Promise.all([listQuotes("all"), getSettings(), getLocale()]);
  const rows: QuoteRow[] = quotes.map((q) => ({
    id: q.id,
    number: q.number,
    status: q.status,
    recipient: q.recipient.company || q.recipient.name || q.recipient.email || "",
    recipientSub: q.recipient.company ? q.recipient.name : "",
    source: q.source,
    meetingTitle: q.meetingTitle,
    owner: q.ownerName,
    firstYear: computeTotals(q.lines, settings.taxPercent).firstYear,
    currency: q.currency,
    updatedAt: q.updatedAt,
    sentAt: q.sentAt,
    ghlIncomplete:
      q.status === "sent" && (!q.ghlSync || q.ghlSync.note?.ok === false || q.ghlSync.file?.ok === false || q.ghlSync.opportunity?.ok === false),
    followUpAt: q.followUpAt,
    followUpCount: q.followUpCount,
    lastFollowUpAt: q.lastFollowUpAt,
    outcome: q.outcome,
    validUntil: q.validUntil
  }));
  const tab = (await searchParams).tab;
  return (
    <OffertenOverview
      quotes={rows}
      initialTab={tab === "sent" || tab === "calls" || tab === "follow" ? tab : "drafts"}
      ghlEnabled={ghlConfigured()}
      locale={locale === "en" ? "en" : "de"}
    />
  );
}
