'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './catalog.css';

type Locale = 'de' | 'en';

export type CatalogRow = { retailer_id: string; property_key: string; price: number | null; currency: string | null; availability: string | null; free_nights: number | null; status: string | null; error: string | null; synced_at: string | null };
type Base = { amount: number; currency: string; rate: number; date: string | null; source: string | null; stale: boolean };
type Item = { retailerId: string; villa: string; title: string; price: string; amount: number; currency: string; base: Base | null; availability: string; freeNights: number; priceSource: string; link: string; mainImage: string; images: number; description: string; warnings: string[] };
type RunResult = { dryRun?: boolean; at?: string; sent?: number; status?: string; batchErrors?: number; items: Item[]; errors: { villa: string; error: string }[]; notes?: string[]; batch?: { errors: string[] } };
export type CatalogData = {
  configured: { token: boolean; businessId: boolean; wabaId: boolean; phoneId: boolean; pricelabsVillas: string[] };
  catalogId: string | null;
  villas: string[];
  auto: boolean;
  lastSync: { at: string; sent: number; status: string; batchErrors: number; villaErrors: number } | null;
  run: { running?: boolean; since?: string; finishedAt?: string; error?: string } | null;
  lastResult: RunResult | null;
  items: CatalogRow[];
};

export function catalogTabLabel(locale: Locale): string {
  return locale === 'en' ? 'Catalog' : 'Katalog';
}

async function call<T = Record<string, unknown>>(method: string, body?: unknown): Promise<{ ok: boolean; error?: string; json?: T }> {
  try {
    const res = await fetch('/api/sm-manager/catalog', { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, json } : { ok: false, error: json.error };
  } catch {
    return { ok: false };
  }
}

export function SmCatalog({ locale, data }: { locale: Locale; data: CatalogData | null }) {
  const router = useRouter();
  const l = (de: string, en: string) => (locale === 'de' ? de : en);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<CatalogData | null>(data);
  const [preview, setPreview] = useState<RunResult | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  async function reload(): Promise<CatalogData | null> {
    const r = await call<CatalogData>('GET');
    if (r.ok && r.json) {
      setState(r.json);
      return r.json;
    }
    return null;
  }

  // Läuft der Abgleich noch (auch nach einem Neuladen der Seite), wird der Stand regelmässig abgefragt.
  useEffect(() => {
    if (state?.run?.running && !timer.current) {
      let n = 0;
      timer.current = setInterval(async () => {
        n++;
        const d = await reload();
        if ((d && !d.run?.running) || n > 90) {
          stop();
          setBusy('');
          if (d?.run?.error) setMsg(`${l('Abgleich fehlgeschlagen', 'Sync failed')}: ${d.run.error}`);
          else setMsg(l('Abgleich beendet.', 'Sync finished.'));
          router.refresh();
        }
      }, 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.run?.running]);

  if (!state) return <p className="sm-empty">{l('Der Katalog konnte nicht geladen werden. Läuft die Engine mit dem neuen Stand?', 'The catalog could not be loaded. Is the engine running the new version?')}</p>;

  const c = state.configured;
  const nf = new Intl.NumberFormat(locale === 'de' ? 'de-CH' : 'en-GB');
  const date = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'de-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '–');
  const running = Boolean(state.run?.running);
  const money = (amount: number | null | undefined, cur: string | null | undefined) => (amount == null ? '–' : `${cur ?? ''} ${nf.format(amount)}`.trim());

  async function act(action: 'create' | 'connect' | 'preview' | 'sync', ok: string) {
    if (action === 'sync' && !confirm(l('Die Villen jetzt an den Katalog bei Meta senden?', 'Send the villas to the catalog at Meta now?'))) return;
    setBusy(action);
    setMsg(action === 'preview' ? l('Vorschau wird gebaut … das dauert bis zu einer halben Minute.', 'Building the preview ... this takes up to half a minute.') : l('Läuft …', 'Working ...'));
    const r = await call<Record<string, unknown>>('POST', { action });
    if (!r.ok) {
      setBusy('');
      setMsg(`${l('Fehlgeschlagen', 'Failed')}${r.error ? `: ${r.error}` : ''}`);
      return;
    }
    if (action === 'preview') setPreview(r.json as unknown as RunResult);
    if (action === 'connect') {
      const j = r.json as { linked: boolean | null; visible: boolean | null; errors: Record<string, string> };
      const parts = [j.linked ? l('Katalog mit WhatsApp verbunden.', 'Catalog linked to WhatsApp.') : j.errors.link ? `${l('Verbinden', 'Link')}: ${j.errors.link}` : '', j.visible ? l('Im Chat sichtbar.', 'Visible in the chat.') : j.errors.visible ? `${l('Sichtbarkeit', 'Visibility')}: ${j.errors.visible}` : ''].filter(Boolean);
      setMsg(parts.join(' '));
      setBusy('');
      await reload();
      return;
    }
    if (action === 'sync') {
      setMsg(l('Der Abgleich läuft im Hintergrund. Der Stand erscheint hier, sobald er fertig ist.', 'The sync runs in the background. The result appears here when it is done.'));
      await reload();
      return;
    }
    setMsg(ok);
    setBusy('');
    await reload();
  }

  const result: RunResult | null = preview ?? state.lastResult;
  const statusDe: Record<string, string> = { ok: 'ok', error: 'Fehler', finished: 'ok', in_progress: 'läuft bei Meta', no_handle: 'unklar' };
  const statusOf = (s: string | null) => (s ? (locale === 'de' ? statusDe[s] ?? s : s) : '–');

  return (
    <section className="cat">
      <p className="sm-muted">
        {l(
          'Ein Produkt pro Villa im WhatsApp-Katalog bei Meta. Titel und Text kommen aus den geprüften Fakten, die Fotos aus der Elev8-Galerie, der Preis ist der günstigste freie Nachtpreis der nächsten 90 Tage, umgerechnet in IDR (Kurs des Tages, auf 10’000 gerundet). Zuerst die Vorschau prüfen, dann senden. Es wird nichts geraten: Fehlt für eine Villa der Preis oder der Kurs, wird sie nicht gesendet.',
          'One product per villa in the WhatsApp catalog at Meta. Title and text come from the verified facts, the photos from the Elev8 gallery, the price is the lowest free nightly price over the next 90 days, converted to IDR (rate of the day, rounded to 10,000). Check the preview first, then send. Nothing is guessed: if a villa has no price or no rate, it is not sent.'
        )}
      </p>

      <div className="cat-box">
        <strong>{l('Einrichtung', 'Setup')}</strong>
        <ul className="cat-list">
          <li>
            <span className={`sm-badge ${c.token ? 'sm-badge-ok' : 've-bad'}`}>{c.token ? '✓' : '✗'}</span> {l('Meta-Zugang (Token)', 'Meta access (token)')}
          </li>
          <li>
            <span className={`sm-badge ${c.businessId ? 'sm-badge-ok' : 've-bad'}`}>{c.businessId ? '✓' : '✗'}</span> {l('Business-ID', 'Business ID')}
            {c.businessId ? '' : <span className="sm-muted sm-small"> · {l('fehlt: Variable META_BUSINESS_ID in Railway setzen (Meta Business Settings, Unternehmensinformationen)', 'missing: set META_BUSINESS_ID in Railway (Meta Business Settings, business info)')}</span>}
          </li>
          <li>
            <span className={`sm-badge ${state.catalogId ? 'sm-badge-ok' : ''}`}>{state.catalogId ? '✓' : '–'}</span> {l('Katalog', 'Catalog')}
            {state.catalogId ? <span className="sm-muted sm-small"> · ID {state.catalogId}</span> : <span className="sm-muted sm-small"> · {l('noch nicht angelegt', 'not created yet')}</span>}
          </li>
          <li>
            <span className={`sm-badge ${c.wabaId && c.phoneId ? 'sm-badge-ok' : ''}`}>{c.wabaId && c.phoneId ? '✓' : '–'}</span> {l('WhatsApp-Verbindung', 'WhatsApp link')}
            <span className="sm-muted sm-small"> · {c.wabaId && c.phoneId ? l('IDs sind gesetzt', 'IDs are set') : l('optional: META_WABA_ID und META_WA_PHONE_ID setzen, sonst den Katalog einmal von Hand in Meta Commerce Manager mit dem WhatsApp-Konto verbinden', 'optional: set META_WABA_ID and META_WA_PHONE_ID, otherwise link the catalog once by hand in Meta Commerce Manager')}</span>
          </li>
          <li>
            <span className={`sm-badge ${state.auto ? 'sm-badge-ok' : ''}`}>{state.auto ? l('an', 'on') : l('aus', 'off')}</span> {l('Nachtlauf (alle 22 Stunden)', 'Nightly sync (every 22 hours)')}
            {state.auto ? '' : <span className="sm-muted sm-small"> · {l('einschalten mit WA_CATALOG_AUTO=on, sobald der erste Abgleich stimmt', 'switch on with WA_CATALOG_AUTO=on once the first sync is right')}</span>}
          </li>
          <li>
            <span className="sm-badge">{state.villas.length}</span> {l('Villen', 'Villas')}: {state.villas.join(', ')}
          </li>
          <li>
            <span className="sm-badge">{state.lastSync ? '✓' : '–'}</span> {l('Letzter Abgleich', 'Last sync')}: {state.lastSync ? `${date(state.lastSync.at)} · ${state.lastSync.sent} ${l('gesendet', 'sent')}${state.lastSync.batchErrors || state.lastSync.villaErrors ? ` · ${state.lastSync.batchErrors + state.lastSync.villaErrors} ${l('Probleme', 'problems')}` : ''}` : l('noch keiner', 'none yet')}
          </li>
        </ul>
        <div className="cat-actions">
          {!state.catalogId ? (
            <button type="button" className="sm-btn sm-btn-primary" onClick={() => act('create', l('Katalog angelegt.', 'Catalog created.'))} disabled={Boolean(busy) || !c.businessId || !c.token}>
              {l('Katalog bei Meta anlegen', 'Create the catalog at Meta')}
            </button>
          ) : (
            <button type="button" className="sm-btn" onClick={() => act('connect', '')} disabled={Boolean(busy)} title={l('Verbindet den Katalog mit dem WhatsApp-Business-Konto und zeigt ihn im Chat', 'Links the catalog to the WhatsApp Business account and shows it in the chat')}>
              {l('Mit WhatsApp verbinden', 'Link to WhatsApp')}
            </button>
          )}
          <button type="button" className="sm-btn" onClick={() => act('preview', l('Vorschau fertig. Nichts wurde gesendet.', 'Preview ready. Nothing was sent.'))} disabled={Boolean(busy) || running}>
            {l('Vorschau', 'Preview')}
          </button>
          <button type="button" className="sm-btn sm-btn-primary" onClick={() => act('sync', '')} disabled={Boolean(busy) || running || !state.catalogId}>
            {running ? l('Abgleich läuft …', 'Sync running ...') : l('An Meta senden', 'Send to Meta')}
          </button>
        </div>
        {msg ? <p className="sm-muted sm-small" role="status">{msg}</p> : null}
        {state.run?.error && !running ? <p className="sm-warn">{l('Letzter Abgleich fehlgeschlagen', 'Last sync failed')}: {state.run.error}</p> : null}
      </div>

      {result ? (
        <>
          <h3>{preview ? l('Vorschau (nichts gesendet)', 'Preview (nothing sent)') : `${l('Ergebnis des letzten Abgleichs', 'Result of the last sync')} · ${date(result.at)}`}</h3>
          {result.errors.length > 0 ? (
            <div className="sm-warn">
              {l('Nicht gesendet:', 'Not sent:')}
              <ul>
                {result.errors.map((e) => (
                  <li key={e.villa}>
                    <strong>{e.villa}</strong>: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.batch?.errors?.length ? (
            <div className="sm-warn">
              {l('Meldungen von Meta:', 'Messages from Meta:')}
              <ul>
                {result.batch.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.notes?.length ? (
            <ul className="sm-muted sm-small">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <ul className="cat-cards">
            {result.items.map((i) => (
              <li key={i.retailerId} className="cat-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.mainImage} alt={i.title} loading="lazy" />
                <div className="cat-card-body">
                  <strong>{i.title}</strong>
                  <div className="cat-price">
                    {l('ab', 'from')} {money(i.amount, i.currency)} {l('pro Nacht', 'per night')}
                  </div>
                  {i.base ? (
                    <div className="sm-muted sm-small">
                      {l('Aus', 'From')} {money(i.base.amount, i.base.currency)} · 1 {i.base.currency} = {nf.format(i.base.rate)} {i.currency} ({i.base.date ?? '?'}, {i.base.source ?? '?'})
                    </div>
                  ) : null}
                  <div className="sm-muted sm-small">
                    <span className={`sm-badge ${i.availability === 'in stock' ? 'sm-badge-ok' : 've-bad'}`}>{i.availability === 'in stock' ? l('verfügbar', 'available') : l('nicht verfügbar', 'unavailable')}</span> {i.freeNights} {l('freie Nächte in 90 Tagen', 'free nights in 90 days')} · {i.images} {l('Fotos', 'photos')}
                  </div>
                  {i.warnings.map((w) => (
                    <p key={w} className="sm-warn">{w}</p>
                  ))}
                  <details>
                    <summary>{l('Text und Link', 'Text and link')}</summary>
                    <p className="sm-small">{i.description}</p>
                    <p className="sm-small sm-muted">{i.link}</p>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>{l('Stand im Katalog', 'State in the catalog')}</h3>
      {state.items.length === 0 ? (
        <p className="sm-empty">{l('Noch nichts gesendet.', 'Nothing sent yet.')}</p>
      ) : (
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>{l('Villa', 'Villa')}</th>
                <th>{l('Preis ab', 'Price from')}</th>
                <th>{l('Verfügbarkeit', 'Availability')}</th>
                <th>{l('Status', 'Status')}</th>
                <th>{l('Zuletzt', 'Last')}</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((r) => (
                <tr key={r.retailer_id}>
                  <td className="sm-cell-title">{r.property_key}</td>
                  <td data-label={l('Preis ab', 'Price from')}>{money(r.price, r.currency)}</td>
                  <td data-label={l('Verfügbarkeit', 'Availability')}>{r.availability === 'in stock' ? l('verfügbar', 'available') : r.availability === 'out of stock' ? l('nicht verfügbar', 'unavailable') : '–'}</td>
                  <td data-label={l('Status', 'Status')}>
                    {statusOf(r.status)}
                    {r.error ? <div className="sm-warn sm-small">{r.error}</div> : null}
                  </td>
                  <td data-label={l('Zuletzt', 'Last')}>{date(r.synced_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
