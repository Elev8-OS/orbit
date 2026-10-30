import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { currentOffertenUser } from "@/lib/offerten/access";
import { getOnboarding } from "@/lib/offerten/onboarding";
import { publicTexts } from "@/lib/offerten/public-texts";
import { formatDate } from "@/lib/offerten/quote";
import { getQuote } from "@/lib/offerten/store";
import { OnboardingTeamActions } from "@/components/offerten/OnboardingTeamActions";
import { OnboardingChecklist } from "@/components/offerten/public/OnboardingChecklist";
import "@/components/offerten/public/public.css";

export const dynamic = "force-dynamic";

/** Onboarding eines Kunden im Team: dieselbe Checkliste wie beim Kunden, hier sind alle Punkte änderbar. */
export default async function OnboardingTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentOffertenUser();
  if (!user) return null;
  const onboarding = await getOnboarding((await params).id);
  if (!onboarding) notFound();
  const [quote, locale, t] = await Promise.all([getQuote(onboarding.quoteId), getLocale(), getTranslations("offerten.onboarding")]);
  const lang = locale === "en" ? "en" : "de";
  // Texte der Checkliste in der Orbit-Sprache; "Sie" heisst hier "Kunde"
  const tx = {
    ...publicTexts(lang, "sie"),
    owner: { customer: t("owner.customer"), elev8: t("owner.elev8"), both: t("owner.both") }
  };

  return (
    <div className="of-page">
      <div className="of-page-head">
        <div>
          <a href="/offerten?tab=onboarding" className="of-crumb">
            ← {t("back")}
          </a>
          <h1 className="of-h1">{onboarding.company || onboarding.contactName}</h1>
          <p className="of-lead">
            {[onboarding.contactName, onboarding.contactEmail].filter(Boolean).join(" · ")}
            {quote && (
              <>
                {" · "}
                <a className="of-link" href={`/offerten/${quote.id}`}>
                  {t("offer", { number: quote.number })}
                </a>
              </>
            )}
          </p>
          {quote?.acceptedAt && (
            <p className="of-muted of-small">
              {t("acceptedOn", { date: formatDate(quote.acceptedAt, lang), name: quote.acceptance?.name ?? "" })}
            </p>
          )}
        </div>
        <OnboardingTeamActions
          id={onboarding.id}
          customerPath={`/onboarding/${onboarding.token}`}
          status={onboarding.status}
          labels={{
            copyLink: t("copyLink"),
            copied: t("copied"),
            customerView: t("customerView"),
            markLive: t("markLive"),
            reopen: t("reopen"),
            failed: t("failed")
          }}
        />
      </div>
      <p className="of-muted" style={{ marginBottom: "1rem" }}>
        {t("lead")}
      </p>
      <div className="pub pub-embedded">
        <OnboardingChecklist items={onboarding.items} endpoint={`/api/offerten/onboarding/${onboarding.id}`} mode="team" tx={tx} lang={lang} />
      </div>
    </div>
  );
}
