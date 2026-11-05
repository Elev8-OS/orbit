'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adsStrings, type AdsStrings } from '@/lib/sm-manager/ads-i18n';
import './ads.css';

export type AdCheck = { key: string; ok: boolean; level: 'ok' | 'block' | 'warn'; phase: 'approve' | 'activate'; params: Record<string, unknown> };
/** A USD amount and the same amount in the account currency and in the villa currency (null when no rate is available). */
export type Conv = { usd: number; account: number | null; property: number | null };
export type AdInsights = {
  at: string;
  currency?: string;
  propertyCurrency?: string;
  spend: number;
  spendUsd?: number | null;
  spendProperty?: number | null;
  impressions: number;
  clicks: number;
  checkouts: number;
  purchases: number;
  cpa: number | null;
  cpaUsd?: number | null;
  cpaProperty?: number | null;
  purchaseValue?: number;
  purchaseValueProperty?: number | null;
  roas?: number | null;
};
export type Ad = {
  id: number;
  status: string;
  propertyKey: string;
  postId: number | null;
  post: { id: number; format: string | null; pillar: string | null; status: string; plan_date: string | null } | null;
  name: string;
  optimizeFor: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  startDate: string;
  endDate: string | null;
  maxCpaUsd: number;
  stopNoCheckoutUsd: number;
  audience: { countries: string[]; ageMin: number; ageMax: number; placements: string };
  creative: { primaryText: string; headline: string; description?: string; cta: string; url: string; mediaType: string; mediaUrls: string[] };
  estimate: { days: number; spendUsd: number; bookingsAtMaxCpa: number };
  money?: { accountCurrency: string | null; propertyCurrency: string; daily: Conv; maxCpa: Conv; stopNoCheckout: Conv; estimateSpend: Conv };
  checks: AdCheck[];
  approvedAt: string | null;
  feedback: string | null;
  error: string | null;
  meta: { pushing?: boolean; campaignId?: string; insights?: AdInsights; budgetCurrency?: string; dailyBudgetAccount?: number; fxRate?: number; fxDate?: string | null } | null;
};
export type AdsData = {
  settings: { monthlyBudgetUsd: number; countries: string[]; villas: string[]; days: number };
  budget: { monthlyUsd: number; committedUsd: number; freeUsd: number; monthly?: Conv; committed?: Conv };
  fx?: { plan: string; account: string | null; property: string; usdToAccount: number | null; usdToProperty: number | null; date: string | null; source: string | null; stale: boolean; error: string | null };
  meta: {
    version: string;
    configured: { token: boolean; account: boolean; page: boolean; instagram: boolean; pixel: boolean };
    account: { id: string; name: string; currency: string; status: number; spendCap: number | null; amountSpent: number; offset?: number; offsetSource?: string } | null;
    pixel: { name: string; lastFired: string | null; events: Record<string, number>; statsOk: boolean } | null;
    errors: Record<string, string>;
  };
  campaigns: Ad[];
};

export const adsTabLabel = (locale: 'de' | 'en') => adsStrings(locale).tabAds;

type Result<T> = { ok: boolean; error?: string; json?: T };
async function call<T = Record<string, unknown>>(method: string, url: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, json } : { ok: false, error: typeof json.error === 'string' ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

// Currencies without small units are shown without decimals.
const NO_DECIMALS = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'HUF', 'COP']);

export function SmAds({ locale, data }: { locale: 'de' | 'en'; data: AdsData | null }) {
  const s = adsStrings(locale);
  const router = useRouter();
  const loc = locale === 'en' ? 'en-GB' : 'de-CH';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sending = Boolean(data?.campaigns.some((a) => a.meta?.pushing));

  // While an ad is being sent to Meta (a video can take a few minutes), reload the numbers every few seconds.
  useEffect(() => {
    if (!sending) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [sending, router]);

  if (!data) {
    return (
      <section className="ads">
        <h2>{s.unavailableTitle}</h2>
        <p className="sm-warn">{s.unavailable}</p>
      </section>
    );
  }

  const fmt = (n: number, cur: string) => new Intl.NumberFormat(loc, { style: 'currency', currency: cur, maximumFractionDigits: NO_DECIMALS.has(cur) ? 0 : 2 }).format(n);
  const money = (n: number) => fmt(n, 'USD');
  const rate = (n: number) => new Intl.NumberFormat(loc, { maximumFractionDigits: n >= 100 ? 0 : 4 }).format(n);
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', hour: iso.length > 10 ? '2-digit' : undefined, minute: iso.length > 10 ? '2-digit' : undefined }).format(new Date(iso)) : s.never);
  const m = data.meta;
  const accCur = m.account?.currency ?? null;
  const propCur = data.fx?.property ?? 'CHF';
  /** The same amount in the other currencies, without repeating USD (which is shown next to it anyway). */
  const others = (c?: Conv | null) =>
    c
      ? [c.account != null && accCur && accCur !== 'USD' ? fmt(c.account, accCur) : null, c.property != null && propCur !== 'USD' && propCur !== accCur ? fmt(c.property, propCur) : null].filter(Boolean).join(' · ')
      : '';
  const missing = [!m.configured.token && 'META_ADS_TOKEN', !m.configured.account && 'META_AD_ACCOUNT_ID', !m.configured.page && 'META_PAGE_ID', !m.configured.pixel && 'META_PIXEL_ID'].filter(Boolean) as string[];
  const pct = Math.min(100, Math.round((data.budget.committedUsd / Math.max(1, data.budget.monthlyUsd)) * 100));
  const events = ['PageView', 'ViewContent', 'InitiateCheckout', 'Purchase'];
  const fx = data.fx;
  const rateParts = fx
    ? [fx.usdToAccount != null && fx.account && fx.account !== 'USD' ? `${rate(fx.usdToAccount)} ${fx.account}` : null, fx.usdToProperty != null && fx.property !== 'USD' && fx.property !== fx.account ? `${rate(fx.usdToProperty)} ${fx.property}` : null].filter(Boolean)
    : [];

  async function createDrafts() {
    setBusy(true);
    setMsg(s.creating);
    const r = await call<{ created: number[]; skipped: { villa: string; reason: string }[] }>('POST', '/api/sm-manager/ads', { action: 'draft-all' });
    setBusy(false);
    if (!r.ok || !r.json) {
      setMsg(`${s.failed}${r.error ? `: ${r.error}` : ''}`);
      return;
    }
    const skipped = r.json.skipped.map((x) => `${x.villa}: ${x.reason}`).join(' | ');
    setMsg([s.draftsCreated(r.json.created.length), skipped ? `${s.skipped}: ${skipped}` : ''].filter(Boolean).join(' '));
    router.refresh();
  }

  return (
    <section className="ads">
      <div>
        <h2>{s.title}</h2>
        <p className="sm-muted sm-small">{s.intro}</p>
      </div>

      <div className="ads-panel">
        <h3>{s.setupTitle}</h3>
        <div className="ads-setup">
          <div>
            <strong>{s.account}</strong>
            {m.account ? (
              <>
                <div className="ads-kv"><span>{m.account.name}</span><span className={m.account.status === 1 ? 'ads-ok' : 'ads-block'}>{m.account.status === 1 ? s.accountActive : s.accountInactive}</span></div>
                <div className="ads-kv"><span>{s.currency}</span><span>{m.account.currency}</span></div>
              </>
            ) : (
              <span className="sm-muted sm-small">{s.noData}</span>
            )}
            {m.errors.account ? <span className="sm-warn">{s.metaError}: {m.errors.account}</span> : null}
          </div>
          <div>
            <strong>{s.fxTitle}</strong>
            {fx ? (
              fx.error ? (
                <span className="sm-warn">{s.fxMissing}: {fx.error}</span>
              ) : (
                <>
                  <div className="ads-kv"><span>{s.currencies(fx.plan, fx.account ?? '–', fx.property)}</span></div>
                  {rateParts.length ? <div className="ads-kv"><span>{s.rateLine(`1 USD = ${rateParts.join(' · ')}`, fx.date ?? '–', fx.stale)}</span></div> : null}
                </>
              )
            ) : (
              <span className="sm-muted sm-small">{s.noData}</span>
            )}
          </div>
          <div>
            <strong>{s.pixel}</strong>
            {m.pixel ? (
              <>
                <div className="ads-kv"><span>{m.pixel.name}</span></div>
                <div className="ads-kv"><span>{s.lastFired}</span><span>{day(m.pixel.lastFired)}</span></div>
              </>
            ) : (
              <span className="sm-muted sm-small">{s.noData}</span>
            )}
            {m.errors.pixel ? <span className="sm-warn">{s.metaError}: {m.errors.pixel}</span> : null}
          </div>
          <div>
            <strong>{s.eventsTitle}</strong>
            {events.map((e) => {
              const n = m.pixel?.events[e] ?? 0;
              return (
                <div className="ads-kv" key={e}><span>{s.events[e]}</span><span className={n > 0 ? 'ads-ok' : e === 'InitiateCheckout' ? 'ads-block' : 'ads-warn'}>{n}</span></div>
              );
            })}
          </div>
          <div>
            <strong>{s.budgetTitle}</strong>
            <div className="ads-bar"><span style={{ width: `${pct}%` }} /></div>
            <span className="sm-small">{s.budgetLine(money(data.budget.committedUsd), money(data.budget.monthlyUsd))}</span>
            {others(data.budget.monthly) ? <span className="sm-muted sm-small">≈ {others(data.budget.monthly)}</span> : null}
          </div>
        </div>
        {missing.length ? <p className="sm-warn">{s.missing(missing.join(', '))}</p> : null}
      </div>

      <div className="ads-toolbar">
        <button type="button" className="sm-btn sm-btn-primary" onClick={createDrafts} disabled={busy}>
          {s.createDrafts}
        </button>
        {msg ? <span className="sm-muted sm-small" role="status">{msg}</span> : null}
      </div>

      {data.campaigns.length === 0 ? (
        <p className="sm-empty">{s.empty}</p>
      ) : (
        data.campaigns.map((a) => <AdCard key={a.id} ad={a} s={s} money={money} fmt={fmt} rate={rate} others={others} day={day} accountId={m.account?.id ?? null} />)
      )}
    </section>
  );
}

type Form = { name: string; daily: string; start: string; end: string; countries: string; ageMin: string; ageMax: string; placements: string; goal: string; maxCpa: string; stop: string; text: string; headline: string; description: string; cta: string };

const formFrom = (a: Ad): Form => ({
  name: a.name,
  daily: String(a.dailyBudgetUsd),
  start: a.startDate,
  end: a.endDate ?? '',
  countries: a.audience.countries.join(', '),
  ageMin: String(a.audience.ageMin),
  ageMax: String(a.audience.ageMax),
  placements: a.audience.placements,
  goal: a.optimizeFor,
  maxCpa: String(a.maxCpaUsd),
  stop: String(a.stopNoCheckoutUsd),
  text: a.creative.primaryText,
  headline: a.creative.headline,
  description: a.creative.description ?? '',
  cta: a.creative.cta
});

const toNum = (v: string) => Number(v.replace(',', '.'));

function toBody(f: Form) {
  return {
    name: f.name.trim(),
    dailyBudgetUsd: toNum(f.daily),
    startDate: f.start,
    endDate: f.end,
    maxCpaUsd: toNum(f.maxCpa),
    stopNoCheckoutUsd: toNum(f.stop),
    optimizeFor: f.goal,
    audience: { countries: f.countries.split(/[,\s]+/).filter(Boolean), ageMin: toNum(f.ageMin), ageMax: toNum(f.ageMax), placements: f.placements },
    creative: { primaryText: f.text, headline: f.headline, description: f.description, cta: f.cta }
  };
}

type CardProps = {
  ad: Ad;
  s: AdsStrings;
  money: (n: number) => string;
  fmt: (n: number, cur: string) => string;
  rate: (n: number) => string;
  others: (c?: Conv | null) => string;
  day: (iso: string | null) => string;
  accountId: string | null;
};

function AdCard({ ad, s, money, fmt, rate, others, day, accountId }: CardProps) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() => formFrom(ad));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [why, setWhy] = useState('');

  useEffect(() => {
    setF(formFrom(ad));
  }, [ad]);

  const editable = ad.status === 'draft';
  const sending = Boolean(ad.meta?.pushing);
  const dirty = JSON.stringify(f) !== JSON.stringify(formFrom(ad));
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const approveBlocked = ad.checks.some((c) => c.phase === 'approve' && !c.ok && c.level === 'block');
  const activateBlocked = ad.checks.some((c) => !c.ok && c.level === 'block');
  const label = sending ? s.sending : (s.statuses[ad.status] ?? ad.status);
  const urls = ad.creative.mediaUrls ?? [];
  const ins = ad.meta?.insights;
  const adsManager = accountId ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId.replace(/^act_/, '')}` : null;
  const mo = ad.money;
  const convRows = mo
    ? ([
        [s.convBudget, others(mo.daily)],
        [s.convMaxCpa, others(mo.maxCpa)],
        [s.convStop, others(mo.stopNoCheckout)],
        [s.convEstimate, others(mo.estimateSpend)]
      ] as [string, string][]).filter(([, text]) => text)
    : [];
  const atMeta = ad.meta?.dailyBudgetAccount && ad.meta.budgetCurrency && ['pushed', 'paused', 'active'].includes(ad.status) ? s.atMeta(fmt(ad.meta.dailyBudgetAccount, ad.meta.budgetCurrency), ad.meta.fxRate ? rate(ad.meta.fxRate) : '–', ad.meta.fxDate ?? '–') : null;

  async function run(working: string, fn: () => Promise<Result<unknown>>) {
    setBusy(true);
    setMsg(working);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? null : `${s.failed}${r.error ? `: ${r.error}` : ''}`);
    if (r.ok) router.refresh();
  }
  const save = () => run(s.saving, () => call('PUT', `/api/sm-manager/ads/${ad.id}`, toBody(f)));
  const act = (action: string, extra?: Record<string, unknown>) => run(s.working, () => call('POST', `/api/sm-manager/ads/${ad.id}`, { action, ...extra }));
  const activate = () => {
    const extra = others(mo?.daily);
    if (window.confirm(s.confirmActivate(`${money(ad.dailyBudgetUsd)}${extra ? ` (${extra})` : ''}`))) act('activate');
  };

  const checks = (phase: 'approve' | 'activate') => ad.checks.filter((c) => c.phase === phase);
  const renderChecks = (phase: 'approve' | 'activate', title: string) => (
    <div className="ads-section">
      <h4>{title}</h4>
      <ul className="ads-checks">
        {checks(phase).map((c) => (
          <li key={c.key}>
            <span className={c.ok ? 'ads-ok' : c.level === 'block' ? 'ads-block' : 'ads-warn'} aria-hidden="true">{c.ok ? '✓' : c.level === 'block' ? '✗' : '!'}</span>
            <span>
              <strong>{s.checkTitles[c.key] ?? c.key}</strong>: {s.checkDetail(c.key, c.ok, c.params)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const icur = ins?.currency ?? 'USD';
  const insExtra = (usd: number | null | undefined, prop: number | null | undefined) =>
    [icur !== 'USD' && usd != null ? money(usd) : null, prop != null && ins?.propertyCurrency && ins.propertyCurrency !== icur ? fmt(prop, ins.propertyCurrency) : null].filter(Boolean).join(' · ');

  return (
    <article className="ads-card">
      <div className="ads-media">
        {urls.length === 0 ? null : ad.creative.mediaType === 'video' ? (
          <video src={`${urls[0]}#t=0.5`} controls playsInline preload="metadata" />
        ) : (
          <div className="ads-strip">
            {urls.slice(0, 6).map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt={`${i + 1}`} loading="lazy" />
            ))}
          </div>
        )}
      </div>

      <div className="ads-body">
        <div className="ads-top">
          <span className="sm-badge">{label}</span>
          {ad.post ? <span className="sm-badge">{s.formats[ad.post.format ?? ''] ?? ad.post.format}</span> : null}
          <span className="sm-muted sm-small">{ad.postId ? s.fromPost(ad.postId) : ''}</span>
        </div>

        <div className="ads-fields">
          <label className="ads-wide">
            {s.fName}
            <input value={f.name} onChange={set('name')} disabled={!editable} maxLength={150} />
          </label>
        </div>

        <div className="ads-section">
          <h4>{s.budgetSection}</h4>
          <div className="ads-fields">
            <label>{s.fBudget}<input inputMode="decimal" value={f.daily} onChange={set('daily')} disabled={!editable} /></label>
            <label>{s.fStart}<input type="date" value={f.start} onChange={set('start')} disabled={!editable} /></label>
            <label>{s.fEnd}<input type="date" value={f.end} onChange={set('end')} disabled={!editable} /></label>
          </div>
          <p className="sm-small">{s.estimate(ad.estimate.days, money(ad.estimate.spendUsd), ad.estimate.bookingsAtMaxCpa)}</p>
          {convRows.length ? (
            <div className="ads-conv">
              {convRows.map(([label2, text]) => (
                <div className="ads-kv" key={label2}><span>{label2}</span><span>{text}</span></div>
              ))}
              <span className="ads-help">{s.convHelp(mo?.accountCurrency ?? '–', mo?.propertyCurrency ?? '–')}</span>
            </div>
          ) : null}
          {atMeta ? <p className="sm-small">{atMeta}</p> : null}
        </div>

        <div className="ads-section">
          <h4>{s.audienceSection}</h4>
          <div className="ads-fields">
            <label>{s.fCountries}<input value={f.countries} onChange={set('countries')} disabled={!editable} /><span className="ads-help">{s.countriesHelp}</span></label>
            <label>{s.fAgeMin}<input inputMode="numeric" value={f.ageMin} onChange={set('ageMin')} disabled={!editable} /></label>
            <label>{s.fAgeMax}<input inputMode="numeric" value={f.ageMax} onChange={set('ageMax')} disabled={!editable} /></label>
            <label>
              {s.fPlacements}
              <select value={f.placements} onChange={set('placements')} disabled={!editable}>
                {Object.entries(s.placements).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <span className="ads-help">{s.ageHelp}</span>
        </div>

        <div className="ads-section">
          <h4>{s.rulesSection}</h4>
          <div className="ads-fields">
            <label>
              {s.fGoal}
              <select value={f.goal} onChange={set('goal')} disabled={!editable}>
                {Object.entries(s.goals).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>{s.fMaxCpa}<input inputMode="decimal" value={f.maxCpa} onChange={set('maxCpa')} disabled={!editable} /></label>
            <label>{s.fStop}<input inputMode="decimal" value={f.stop} onChange={set('stop')} disabled={!editable} /></label>
          </div>
          <span className="ads-help">{s.goalHelp} {s.stopHelp}</span>
        </div>

        <div className="ads-section">
          <h4>{s.creativeSection}</h4>
          <div className="ads-fields">
            <label className="ads-wide">{s.fText}<textarea value={f.text} onChange={set('text')} disabled={!editable} maxLength={2000} /></label>
            <label>{s.fHeadline}<input value={f.headline} onChange={set('headline')} disabled={!editable} maxLength={80} /></label>
            <label>{s.fDescription}<input value={f.description} onChange={set('description')} disabled={!editable} maxLength={100} /></label>
            <label>
              {s.fCta}
              <select value={f.cta} onChange={set('cta')} disabled={!editable}>
                {Object.entries(s.ctas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <span className="ads-link">{s.fLink}: {ad.creative.url}</span>
        </div>

        {renderChecks('approve', `${s.checksTitle}: ${s.phaseApprove}`)}
        {renderChecks('activate', `${s.checksTitle}: ${s.phaseActivate}`)}

        {ins ? (
          <div className="ads-section">
            <h4>{s.insightsTitle}</h4>
            <div className="ads-insights">
              <span>{s.iSpend}<strong>{fmt(ins.spend, icur)}</strong>{insExtra(ins.spendUsd, ins.spendProperty) ? <em className="sm-muted sm-small">{insExtra(ins.spendUsd, ins.spendProperty)}</em> : null}</span>
              <span>{s.iClicks}<strong>{ins.clicks}</strong></span>
              <span>{s.iCheckouts}<strong>{ins.checkouts}</strong></span>
              <span>{s.iPurchases}<strong>{ins.purchases}</strong></span>
              <span>{s.iCpa}<strong>{ins.cpa == null ? '–' : fmt(ins.cpa, icur)}</strong>{ins.cpa != null && insExtra(ins.cpaUsd, ins.cpaProperty) ? <em className="sm-muted sm-small">{insExtra(ins.cpaUsd, ins.cpaProperty)}</em> : null}</span>
              {ins.purchaseValue ? (
                <span>{s.iValue}<strong>{fmt(ins.purchaseValue, icur)}</strong>{ins.purchaseValueProperty != null && ins.propertyCurrency && ins.propertyCurrency !== icur ? <em className="sm-muted sm-small">{fmt(ins.purchaseValueProperty, ins.propertyCurrency)}</em> : null}</span>
              ) : null}
              {ins.roas != null ? <span>{s.iRoas}<strong>{ins.roas.toFixed(2)}×</strong></span> : null}
            </div>
            <span className="sm-muted sm-small">{s.asOf}: {day(ins.at)}</span>
          </div>
        ) : null}

        {ad.error ? <p className="sm-warn"><strong>{s.note}:</strong> {ad.error}</p> : null}
        {ad.feedback ? <p className="sm-muted sm-small">“{ad.feedback}”</p> : null}

        <div className="ads-actions">
          {ad.status === 'draft' ? (
            <>
              {dirty ? (
                <button type="button" className="sm-btn sm-btn-primary" onClick={save} disabled={busy}>{s.save}</button>
              ) : null}
              <button type="button" className="sm-btn sm-btn-primary" onClick={() => act('approve')} disabled={busy || dirty || approveBlocked}>{s.approve}</button>
              {dirty ? <span className="sm-muted sm-small">{s.saveFirst}</span> : null}
            </>
          ) : null}
          {ad.status === 'approved' ? (
            <>
              <button type="button" className="sm-btn sm-btn-primary" onClick={() => act('push')} disabled={busy || sending || approveBlocked}>{sending ? s.sending : s.push}</button>
              {!sending ? <span className="sm-muted sm-small">{s.pushHint}</span> : null}
              {!sending ? <button type="button" className="sm-btn" onClick={() => act('reopen')} disabled={busy}>{s.reopen}</button> : null}
            </>
          ) : null}
          {ad.status === 'pushed' || ad.status === 'paused' ? (
            <button type="button" className="sm-btn sm-btn-primary" onClick={activate} disabled={busy || activateBlocked}>{s.activate}</button>
          ) : null}
          {ad.status === 'active' ? <button type="button" className="sm-btn" onClick={() => act('pause')} disabled={busy}>{s.pause}</button> : null}
          {['draft', 'approved'].includes(ad.status) && !sending ? (
            <button type="button" className="sm-btn" onClick={() => setRejecting((v) => !v)} disabled={busy}>{s.reject}</button>
          ) : null}
          {['pushed', 'active', 'paused', 'ended'].includes(ad.status) && adsManager ? (
            <a className="sm-btn" href={adsManager} target="_blank" rel="noreferrer">{s.openAdsManager}</a>
          ) : null}
        </div>
        {rejecting ? (
          <div className="sm-reject">
            <textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder={s.rejectPrompt} rows={2} maxLength={500} />
            <button type="button" className="sm-btn" onClick={() => act('reject', { feedback: why.trim() || undefined })} disabled={busy}>{s.reject}</button>
          </div>
        ) : null}
        {msg ? <p className="sm-muted sm-small" role="status">{msg}</p> : null}
      </div>
    </article>
  );
}
