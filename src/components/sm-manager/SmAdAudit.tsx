'use client';

import { useState } from 'react';
import './ads.css';

type Locale = 'de' | 'en';
type Level = 'block' | 'warn' | 'info' | 'ok';
type Check = { level: Level; area: string; key: string; text: string; fix: string; params: Record<string, unknown> };
type Summary = { spend: number; currency: string; impressions: number | null; reach: number | null; linkClicks: number; landingPageViews: number; checkouts: number; purchases: number; costPerLandingPageView: number | null; costPerCheckout: number | null };
type AuditResult = { adId: number; name: string; readAt: string; counts: { block: number; warn: number }; summary: Summary | null; checks: Check[]; unread: Record<string, string> };
export type AuditAd = { id: number; name: string; status: string };

const str = (v: unknown) => (v == null ? '' : String(v));
const nr = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

const EVENT_DE: Record<string, string> = { INITIATED_CHECKOUT: 'Checkout gestartet (InitiateCheckout)', CONTENT_VIEW: 'Inhalte ansehen (ViewContent)', PURCHASE: 'Kauf (Purchase)', ADD_TO_CART: 'In den Warenkorb', LEAD: 'Lead' };
const STATUS_DE: Record<string, string> = { PAUSED: 'pausiert', ACTIVE: 'aktiv', PENDING_REVIEW: 'in Prüfung', WITH_ISSUES: 'mit Problemen', DISAPPROVED: 'abgelehnt', CAMPAIGN_PAUSED: 'Kampagne pausiert', ADSET_PAUSED: 'Anzeigensatz pausiert' };

/** Der Befund auf Deutsch, aus den Zahlen, die die Engine mitliefert. Ohne Vorlage gilt der englische Text der Engine. */
function textDe(c: Check, nf: Intl.NumberFormat): string {
  const p = c.params ?? {};
  const money = (n: unknown, cur: unknown) => `${str(cur)} ${nf.format(nr(n))}`;
  switch (c.key) {
    case 'ad_issues': return `Meta meldet Probleme mit der Anzeige: ${str(p.issues)}`;
    case 'ad_status': return `Status der Anzeige bei Meta: ${STATUS_DE[str(p.status)] ?? str(p.status)}.`;
    case 'account_status': return `Das Werbekonto ist nicht aktiv (Status ${str(p.status)}, Grund ${str(p.reason) || 'unbekannt'}).`;
    case 'budget':
      return c.level === 'block'
        ? `Das Tagesbudget bei Meta ist ${money(p.seen, p.currency)}, geplant war ${money(p.planned, p.currency)}.`
        : `Tagesbudget bei Meta: ${money(p.seen, p.currency)}${p.planned ? ' (wie geplant)' : ''}. Pro Woche etwa ${money(p.week, p.currency)}.`;
    case 'optimisation': return `Optimiert auf ${EVENT_DE[str(p.goal)] ?? (str(p.goal) || str(p.optimizationGoal))} auf der Website, abgerechnet pro ${str(p.billing) === 'IMPRESSIONS' ? 'Einblendung' : str(p.billing)}.`;
    case 'event_volume':
      return c.level === 'ok'
        ? `Der Pixel hat in 7 Tagen ${nr(p.count)} ${str(p.event)}-Ereignisse gesehen.`
        : `Der Pixel hat in 7 Tagen ${nr(p.count)} ${str(p.event)}-Ereignisse auf der ganzen Website gesehen. Meta will etwa 50 pro Woche für diesen einen Anzeigensatz, um die Lernphase zu verlassen.`;
    case 'learning': return `Lernphase: ${str(p.status)}${p.conversions != null ? ` (${nr(p.conversions)} Conversions bisher)` : ''}.`;
    case 'attribution': {
      const w = Array.isArray(p.windows) ? (p.windows as { type?: unknown; days?: unknown }[]).map((x) => `${nr(x.days)} Tage nach ${str(x.type).startsWith('VIEW') ? 'Ansicht' : 'Klick'}`).join(', ') : '';
      return `Attributionsfenster: ${w}. Villenbuchungen brauchen oft länger. Das ganze Bild zeigen nur die eigenen Daten (Quelle in der Buchung).`;
    }
    case 'audience': {
      const range = Array.isArray(p.ageRange) ? ` (Vorschlag ${nr((p.ageRange as unknown[])[0])} bis ${nr((p.ageRange as unknown[])[1])})` : '';
      return `Länder: ${list(p.countries).join(', ') || 'keine genannt'}; Alter ${str(p.ageMin)} bis ${str(p.ageMax)}${range}; Advantage+ Zielgruppe ${p.advantage ? 'an' : 'aus'}; Plätze ${list(p.placements).join(', ') || 'automatisch'}.`;
    }
    case 'no_audience_signal': return 'Es ist keine eigene Zielgruppe und kein Interesse als Signal hinterlegt. Meta beginnt bei null und muss die Käufer selbst finden.';
    case 'end_time': return 'Der Anzeigensatz hat kein Enddatum.';
    case 'utm': return c.level === 'ok' ? `URL-Parameter sind gesetzt (${str(p.tags) || 'im Link'}).` : 'Die Anzeige hat keine UTM-Parameter. Besuche und Buchungen lassen sich in den eigenen Daten nicht dieser Anzeige zuordnen.';
    case 'instagram_identity': {
      const acc = list(p.accounts);
      return c.level === 'ok' ? 'Die Anzeige läuft mit dem Instagram-Konto.' : `Die Anzeige läuft nur unter der Facebook-Seite, ohne Instagram-Konto${acc.length ? ` (das Werbekonto bietet: ${acc.join(', ')})` : ' (dem Werbekonto ist kein Instagram-Konto zugewiesen)'}.`;
    }
    case 'cta': return c.level === 'ok' ? `Button auf jeder Karte: ${list(p.types).join(', ') || str(p.single)}.` : 'Es wurde kein Call-to-Action-Button gefunden.';
    case 'enhancements': return `Automatische Verbesserungen von Meta am Motiv: ${str(p.state) === 'off' ? 'aus' : 'Standard'}. Eine Variante damit zu testen kann sich lohnen.`;
    case 'format': return 'Einzelbild-Anzeige. Ein Karussell oder ein Video gibt Meta meist mehr zum Lernen.';
    case 'pixel_unavailable': return 'Der Pixel ist als nicht verfügbar markiert.';
    case 'pixel_fresh': return c.level === 'ok' ? `Der Pixel hat kürzlich gefeuert (${str(p.at).slice(0, 16).replace('T', ' ')} UTC).` : `Der Pixel hat zuletzt am ${str(p.at).slice(0, 16).replace('T', ' ')} UTC gefeuert.`;
    case 'automatic_matching': return 'Der erweiterte automatische Abgleich ist aus. Meta erhält keine E-Mail- oder Telefon-Hashes aus dem Browser.';
    case 'first_party_cookie': return `Einstellung für First-Party-Cookies: ${str(p.status)}.`;
    case 'events': return `Ereignisse der letzten 7 Tage: PageView ${nr(p.PageView)}, ViewContent ${nr(p.ViewContent)}, InitiateCheckout ${nr(p.InitiateCheckout)}, AddPaymentInfo ${nr(p.AddPaymentInfo)}, Purchase ${nr(p.Purchase)}.`;
    case 'funnel': return `Trichter (7 Tage): ${nr(p.pageView)} Seitenaufrufe, davon sehen ${p.pvToVc == null ? 0 : nr(p.pvToVc)} Prozent eine Villa (${nr(p.viewContent)}), davon starten ${p.vcToIc == null ? 0 : nr(p.vcToIc)} Prozent den Checkout (${nr(p.initiateCheckout)}).`;
    case 'no_viewcontent': return 'Kein ViewContent-Ereignis: Die Villenseiten werden nicht als Produktansicht gemeldet.';
    case 'no_paymentinfo': return 'Kein AddPaymentInfo-Ereignis. Ein weiterer Schritt im Trichter würde zeigen, wo Gäste abspringen.';
    case 'no_purchase': return 'Noch kein Purchase-Ereignis in 7 Tagen.';
    case 'server_events': return `Ereignisse nach Quelle (7 Tage): ${list(p.sources).join(', ') || 'keine'}.${c.level === 'warn' ? ' Noch kein Server-Ereignis gesehen.' : ''}`;
    case 'value_events': return `Ereignisse mit Wert-Angabe: ${Object.entries((p.events ?? {}) as Record<string, unknown>).map(([k, n]) => `${k} ${nr(n)}`).join(', ')}.`;
    case 'hosts': return `Ereignisse kamen auch von anderen Adressen: ${Object.entries((p.hosts ?? {}) as Record<string, unknown>).map(([k, n]) => `${k} ${nr(n)}`).join(', ')}. Meist Tests oder Vorschauen.`;
    case 'lpv_ratio': return `Nur ${nr(p.pct)} Prozent der Link-Klicks werden zu Seitenaufrufen. Die Seite lädt zu langsam, oder der Pixel feuert zu spät.`;
    default: return c.text;
  }
}

const FIX_DE: Record<string, string> = {
  ad_issues: 'Die Anzeige im Ads Manager öffnen und beheben, was Meta nennt.',
  account_status: 'Das Konto in den Business Settings prüfen.',
  budget: 'Die Einheit der Währung stimmt vermutlich nicht. Nicht einschalten, META_CURRENCY_OFFSET prüfen.',
  event_volume: 'Bei kleinem Budget in den ersten Wochen auf ein Ereignis weiter oben im Trichter optimieren (Inhalte ansehen), später wechseln.',
  learning: 'Zu wenige Conversions für das Budget. Budget erhöhen oder das Ziel weiter nach oben legen.',
  no_audience_signal: 'Website-Besucher und eine Liste früherer Gäste als Signal hinzufügen, später eine Lookalike-Zielgruppe.',
  utm: 'URL-Parameter an der Anzeige setzen (utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}) und mit der Buchung speichern.',
  instagram_identity: 'Das Instagram-Konto in der Anzeige unter Identität wählen. In den Business Settings dem Werbekonto zuweisen, damit die App es beim nächsten Mal findet.',
  pixel_unavailable: 'Den Pixel im Events Manager prüfen.',
  pixel_fresh: 'Prüfen, ob der Code noch auf der Website ist.',
  automatic_matching: 'In den Einstellungen des Events Managers einschalten oder die Hashes mit den Ereignissen senden.',
  first_party_cookie: 'Im Events Manager einschalten.',
  no_viewcontent: 'ViewContent auf jeder Villenseite senden, mit content_ids (villa-patuha und so weiter) und Wert.',
  no_purchase: 'Jede Direktbuchung aus Elev8 als Purchase über die Conversions API senden (gehashte E-Mail und Telefon, Wert, Währung, event_id), auch die, die nicht über die Website kommen.',
  server_events: 'Der Kauf über die Conversions API sollte hier auftauchen, sobald es eine Buchung gibt.',
  lpv_ratio: 'Die Ladezeit der Seite auf dem Handy prüfen.'
};

const SECTIONS: { level: Level; de: string; en: string }[] = [
  { level: 'block', de: 'Zu beheben, bevor du einschaltest', en: 'Fix before switching on' },
  { level: 'warn', de: 'Verbessern', en: 'Improve' },
  { level: 'info', de: 'Zur Information', en: 'For information' },
  { level: 'ok', de: 'In Ordnung', en: 'All good' }
];

export function SmAdAudit({ locale, ads }: { locale: Locale; ads: AuditAd[] }) {
  const l = (de: string, en: string) => (locale === 'de' ? de : en);
  if (ads.length === 0) return null;
  return (
    <section className="ads">
      <div>
        <h2>{l('Audit der Anzeigen bei Meta', 'Audit of the ads at Meta')}</h2>
        <p className="sm-muted sm-small">
          {l(
            'Liest die Anzeige live aus Meta (Budget, Zielgruppe, Optimierung, Tracking, Ereignisse) und zeigt, was zu verbessern ist, um mehr zu messen und mehr zu verkaufen. Es wird nichts geändert.',
            'Reads the ad live from Meta (budget, audience, optimisation, tracking, events) and shows what to improve to measure more and sell more. Nothing is changed.'
          )}
        </p>
      </div>
      {ads.map((a) => (
        <AuditCard key={a.id} ad={a} locale={locale} />
      ))}
    </section>
  );
}

function AuditCard({ ad, locale }: { ad: AuditAd; locale: Locale }) {
  const l = (de: string, en: string) => (locale === 'de' ? de : en);
  const nf = new Intl.NumberFormat(locale === 'de' ? 'de-CH' : 'en-GB', { maximumFractionDigits: 2 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AuditResult | null>(null);

  async function run() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/sm-manager/ads/${ad.id}/audit`);
      const json = (await res.json().catch(() => ({}))) as AuditResult & { error?: string };
      if (res.ok) setResult(json);
      else setError(json.error ?? l('Der Audit ist fehlgeschlagen.', 'The audit failed.'));
    } catch {
      setError(l('Keine Verbindung.', 'No connection.'));
    }
    setBusy(false);
  }

  const when = (iso: string) => new Intl.DateTimeFormat(locale === 'de' ? 'de-CH' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const s = result?.summary;

  return (
    <article className="ads-card">
      <div className="ads-body">
        <div className="ads-top">
          <strong>{ad.name}</strong>
          <span className="sm-badge">{ad.status}</span>
        </div>
        <div className="ads-actions">
          <button type="button" className="sm-btn sm-btn-primary" onClick={run} disabled={busy}>
            {busy ? l('Liest bei Meta …', 'Reading from Meta ...') : result ? l('Erneut prüfen', 'Check again') : l('Audit starten', 'Start audit')}
          </button>
          {result ? <span className="sm-muted sm-small">{l('Stand', 'As of')}: {when(result.readAt)}</span> : null}
        </div>
        {error ? <p className="sm-warn">{error}</p> : null}

        {result ? (
          <>
            <p className="sm-small">
              <strong>{result.counts.block}</strong> {l('zu beheben', 'to fix')} · <strong>{result.counts.warn}</strong> {l('zu verbessern', 'to improve')}
            </p>
            {s ? (
              <div className="ads-insights">
                <span>{l('Ausgaben', 'Spend')}<strong>{s.currency} {nf.format(s.spend)}</strong></span>
                <span>{l('Link-Klicks', 'Link clicks')}<strong>{s.linkClicks}</strong></span>
                <span>{l('Seitenaufrufe', 'Landing page views')}<strong>{s.landingPageViews}</strong></span>
                <span>{l('Checkouts', 'Checkouts')}<strong>{s.checkouts}</strong></span>
                <span>{l('Käufe', 'Purchases')}<strong>{s.purchases}</strong></span>
                <span>{l('Kosten pro Checkout', 'Cost per checkout')}<strong>{s.costPerCheckout == null ? '–' : `${s.currency} ${nf.format(s.costPerCheckout)}`}</strong></span>
              </div>
            ) : null}
            {SECTIONS.map((sec) => {
              const rows = result.checks.filter((c) => c.level === sec.level);
              if (rows.length === 0) return null;
              const body = (
                <ul className="ads-checks">
                  {rows.map((c) => (
                    <li key={c.key}>
                      <span className={c.level === 'ok' ? 'ads-ok' : c.level === 'block' ? 'ads-block' : c.level === 'warn' ? 'ads-warn' : 'sm-muted'} aria-hidden="true">
                        {c.level === 'ok' ? '✓' : c.level === 'block' ? '✗' : c.level === 'warn' ? '!' : 'i'}
                      </span>
                      <span>
                        {locale === 'de' ? textDe(c, nf) : c.text}
                        {c.fix ? (
                          <>
                            <br />
                            <span className="ads-help">{l('Was tun', 'What to do')}: {locale === 'de' ? (FIX_DE[c.key] ?? c.fix) : c.fix}</span>
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              );
              return (
                <div className="ads-section" key={sec.level}>
                  {sec.level === 'ok' || sec.level === 'info' ? (
                    <details>
                      <summary>
                        <strong>{l(sec.de, sec.en)}</strong> ({rows.length})
                      </summary>
                      {body}
                    </details>
                  ) : (
                    <>
                      <h4>{l(sec.de, sec.en)} ({rows.length})</h4>
                      {body}
                    </>
                  )}
                </div>
              );
            })}
            {Object.keys(result.unread).length > 0 ? (
              <p className="sm-muted sm-small">
                {l('Nicht lesbar bei Meta', 'Not readable at Meta')}: {Object.entries(result.unread).map(([k, v]) => `${k} (${v.slice(0, 80)})`).join(' · ')}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}
