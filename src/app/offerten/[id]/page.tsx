import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { currentOffertenUser } from "@/lib/offerten/access";
import { contactUrl, ghlConfigured } from "@/lib/offerten/ghl";
import { mailProvider } from "@/lib/offerten/mailer";
import { getSettings } from "@/lib/offerten/settings";
import { getQuote, listEvents } from "@/lib/offerten/store";
import { QuoteEditor } from "@/components/offerten/QuoteEditor";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentOffertenUser();
  if (!user) return null;
  const quote = await getQuote((await params).id);
  if (!quote || quote.status === "discarded") notFound();
  const [settings, events, locale] = await Promise.all([getSettings(), listEvents(quote.id), getLocale()]);
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
    />
  );
}
