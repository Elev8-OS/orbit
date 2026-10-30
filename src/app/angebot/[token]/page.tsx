import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { acceptState } from "@/lib/offerten/accept";
import { getOnboardingByQuote } from "@/lib/offerten/onboarding";
import { publicTexts } from "@/lib/offerten/public-texts";
import { documentFor } from "@/lib/offerten/service";
import { getSettings } from "@/lib/offerten/settings";
import { getQuoteByAcceptToken } from "@/lib/offerten/store";
import { AcceptForm } from "@/components/offerten/public/AcceptForm";
import { NoahBox, PublicShell } from "@/components/offerten/public/PublicShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Elev8 – Angebot", robots: { index: false, follow: false } };

/** Öffentlich (ohne Login): Kunde sieht sein Angebot und nimmt es an. Zugang ist der Token im Link. */
export default async function AcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getQuoteByAcceptToken(token);
  const state = acceptState(quote);
  if (!quote || state === "not_found") notFound();

  const settings = await getSettings();
  const doc = documentFor(quote, settings);
  const tx = publicTexts(quote.language, quote.texts.addressForm);
  const who = quote.recipient.company || quote.recipient.name;
  const footer = [doc.issuer.company, ...doc.issuer.addressLines, doc.issuer.taxId].filter(Boolean).join(" · ");
  const onboarding = state === "already_accepted" ? await getOnboardingByQuote(quote.id) : null;
  const askVatId = doc.reverseCharge || (settings.reverseChargeCountries ?? []).includes(quote.recipient.country);

  return (
    <PublicShell label={tx.offer} meta={quote.number} footer={footer}>
      <div className="pub-hero">
        {who && <p className="pub-kicker">{tx.offerFor}</p>}
        <h1>{who || tx.offer}</h1>
        <p className="pub-muted">
          {quote.number} · {tx.validUntil} {doc.validUntilText}
        </p>
      </div>

      {doc.facts.length > 0 && (
        <dl className="pub-facts">
          {doc.facts.map((f, i) => (
            <div key={i}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
              {f.sub && <dd className="pub-factsub">{f.sub}</dd>}
            </div>
          ))}
        </dl>
      )}

      {state === "already_accepted" && (
        <section className="pub-card pub-notice">
          <h2>{tx.alreadyTitle}</h2>
          <p className="pub-muted">{tx.alreadyBody}</p>
          {onboarding && (
            <a className="pub-button" href={`/onboarding/${onboarding.token}`}>
              {tx.toOnboarding} →
            </a>
          )}
        </section>
      )}
      {state === "expired" && (
        <section className="pub-card pub-notice">
          <h2>{tx.expiredTitle}</h2>
          <p className="pub-muted">{tx.expiredBody}</p>
        </section>
      )}
      {state === "closed" && (
        <section className="pub-card pub-notice">
          <h2>{tx.closedTitle}</h2>
          <p className="pub-muted">{tx.closedBody}</p>
        </section>
      )}

      <section className="pub-card">
        <h2>{tx.summary}</h2>
        <ul className="pub-lines">
          {doc.lines.map((l) => (
            <li key={l.id}>
              <div>
                <strong>{l.title}</strong>
                {l.detail && <small>{l.detail}</small>}
              </div>
              <span className="pub-amount">
                {l.totalText}
                <small>{l.intervalText}</small>
              </span>
            </li>
          ))}
        </ul>
        <dl className="pub-totals">
          {doc.totals
            .filter((r) => r.strong)
            .map((r, i) => (
              <div key={i}>
                <dt>{r.label}</dt>
                <dd>{r.text}</dd>
              </div>
            ))}
        </dl>
        <a className="pub-link" href={`/api/offerten/public/angebot/${token}/pdf`} target="_blank" rel="noreferrer">
          {tx.pdf} ↗
        </a>
      </section>

      {state === "open" && (
        <AcceptForm
          token={token}
          tx={tx}
          askVatId={askVatId}
          termsText={[doc.reverseCharge ? doc.taxNote : "", doc.terms].filter(Boolean).join(" ")}
          prefill={{
            name: quote.recipient.name,
            email: quote.recipient.email,
            company: quote.recipient.company,
            addressLines: quote.recipient.addressLines,
            country: quote.recipient.country,
            vatId: quote.recipient.vatId
          }}
        />
      )}

      {doc.assistant && (
        <NoahBox
          title={tx.questions}
          text={tx.noah.replace("{name}", doc.assistantName)}
          phone={doc.assistant.phone}
          link={doc.assistant.link}
          cta={doc.labels.whatsappCta.replace("{name}", doc.assistantName)}
        />
      )}
    </PublicShell>
  );
}
