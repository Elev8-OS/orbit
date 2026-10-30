import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPhone, whatsappLink } from "@/lib/offerten/settings-shared";
import { getOnboardingByToken } from "@/lib/offerten/onboarding";
import { publicTexts } from "@/lib/offerten/public-texts";
import { DOC_LABELS } from "@/lib/offerten/quote";
import { getSettings } from "@/lib/offerten/settings";
import { OnboardingChecklist } from "@/components/offerten/public/OnboardingChecklist";
import { NoahBox, PublicShell } from "@/components/offerten/public/PublicShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Elev8 – Onboarding", robots: { index: false, follow: false } };

/** Öffentlich (ohne Login): Onboarding-Checkliste des Kunden. Zugang ist der Token im Link. */
export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const onboarding = await getOnboardingByToken(token);
  if (!onboarding) notFound();
  const settings = await getSettings();
  const tx = publicTexts(onboarding.language, onboarding.addressForm);
  const footer = [settings.issuer.company, ...settings.issuer.addressLines, settings.issuer.taxId].filter(Boolean).join(" · ");
  const assistantName = settings.assistant?.name || "Noah";

  return (
    <PublicShell label="Onboarding" meta={onboarding.company || onboarding.contactName} footer={footer}>
      <div className="pub-hero">
        {onboarding.company && <p className="pub-kicker">{onboarding.company}</p>}
        <h1>{tx.onboardingTitle}</h1>
        <p className="pub-muted">{tx.onboardingLead}</p>
      </div>
      {onboarding.status === "live" && <p className="pub-live">{tx.live}</p>}
      <OnboardingChecklist items={onboarding.items} endpoint={`/api/offerten/public/onboarding/${token}`} mode="customer" tx={tx} lang={onboarding.language} />
      {onboarding.ownerName && (
        <section className="pub-card">
          <p className="pub-muted">{tx.contact}</p>
          <p>
            <strong>{onboarding.ownerName}</strong>
            {onboarding.ownerEmail && (
              <>
                {" · "}
                <a className="pub-link" href={`mailto:${onboarding.ownerEmail}`}>
                  {onboarding.ownerEmail}
                </a>
              </>
            )}
          </p>
        </section>
      )}
      {settings.assistant?.whatsapp && (
        <NoahBox
          title={tx.questions}
          text={tx.noah.replace("{name}", assistantName)}
          phone={formatPhone(settings.assistant.whatsapp)}
          link={whatsappLink(settings.assistant.whatsapp)}
          cta={DOC_LABELS[onboarding.language].whatsappCta.replace("{name}", assistantName)}
        />
      )}
    </PublicShell>
  );
}
