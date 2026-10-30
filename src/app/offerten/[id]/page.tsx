import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { currentOffertenUser } from "@/lib/offerten/access";
import { contactUrl, ghlConfigured } from "@/lib/offerten/ghl";
import { mailProvider } from "@/lib/offerten/mailer";
import { getSettings } from "@/lib/offerten/settings";
import { refreshLines } from "@/lib/offerten/service";
import { getQuote, listEvents, updateDraft } from "@/lib/offerten/store";
import { getOnboardingByQuote, progress } from "@/lib/offerten/onboarding";
import { personalizeConfigured } from "@/lib/offerten/personalize";
import { QuoteEditor } from "@/components/offerten/QuoteEditor";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentOffertenUser();
  if (!user) return null;
  let quote = await getQuote((await params).id);
  if (!quote || quote.status === "discarded") notFound();
  const [settings, events, locale, onboarding] = await Promise.all([
    getSettings(),
    listEvents(quote.id),
    getLocale(),
    quote.acceptedAt ? getOnboardingByQuote(quote.id) : Promise.resolve(null)
  ]);
  // Entwürfe beim Öffnen auf die aktuelle Preisliste bringen
  if (quote.status === "draft") {
    const lines = refreshLines(quote, settings);
    if (JSON.stringify(lines) !== JSON.stringify(quote.lines)) quote = (await updateDraft(quote.id, { lines })) ?? quote;
  }
  return (
    <QuoteEditor
      initial={quote}
      events={events}
      settings={settings}
      user={{ name: user.name, email: user.email }}
      mailProvider={mailProvider()}
      ghlEnabled={ghlConfigured()}
      ghlContactBase={ghlConfigured() ? contactUrl("__ID__") : null}
      uiLocale={locale === "en" ? "en" : "de"}
      aiEnabled={personalizeConfigured()}
      onboarding={onboarding ? { id: onboarding.id, status: onboarding.status, ...progress(onboarding.items) } : null}
    />
  );
}
