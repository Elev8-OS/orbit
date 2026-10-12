"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Plus,
  Send,
  Sparkles,
  Trash2
} from "lucide-react";
import { buildDocument } from "@/lib/offerten/document";
import {
  buildLines,
  formatDate,
  formatMoney,
  tierForUnits,
  type ContactPerson,
  type Interval,
  type Lang,
  type QuoteConfig,
  type QuoteLine,
  type QuoteTexts,
  type Recipient
} from "@/lib/offerten/quote";
import type { QuoteSettings } from "@/lib/offerten/settings-shared";
import type { Quote, QuoteEvent } from "@/lib/offerten/store";
import { ContactPicker, type Prefill } from "./ContactPicker";
import { GhlStatus } from "./GhlStatus";
import { NumberField } from "./NumberField";
import { PaperPreview } from "./PaperPreview";
import { SendDialog } from "./SendDialog";
import { XlsxPreview } from "./XlsxPreview";
import { relativeTime } from "./useRelativeTime";

type Draft = {
  language: Lang;
  recipient: Recipient;
  config: QuoteConfig;
  lines: QuoteLine[];
  texts: QuoteTexts;
  validUntil: string;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  ghlPipelineId: string | null;
  contactPerson: ContactPerson | null;
};

type Props = {
  initial: Quote;
  events: QuoteEvent[];
  settings: QuoteSettings;
  user: { name: string; email: string };
  mailProvider: "graph" | "resend" | null;
  ghlEnabled: boolean;
  ghlContactBase: string | null;
  uiLocale: "de" | "en";
  aiEnabled: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const pick = (q: Quote): Draft => ({
  language: q.language,
  recipient: q.recipient,
  config: q.config,
  lines: q.lines,
  texts: q.texts,
  validUntil: q.validUntil,
  ghlContactId: q.ghlContactId,
  ghlOpportunityId: q.ghlOpportunityId,
  ghlPipelineId: q.ghlPipelineId,
  contactPerson: q.contactPerson
});

const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function QuoteEditor({ initial, events, settings, user, mailProvider, ghlEnabled, ghlContactBase, uiLocale, aiEnabled }: Props) {
  const t = useTranslations("offerten.editor");
  const tIntervals = useTranslations("offerten.interval");
  const tLang = useTranslations("offerten.lang");
  const [quote, setQuote] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => pick(initial));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedVersion, setSavedVersion] = useState(initial.updatedAt);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [previewFormat, setPreviewFormat] = useState<"pdf" | "xlsx">("pdf");
  const [sendOpen, setSendOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "busy" | "error">("idle");
  const [aiSources, setAiSources] = useState<string[] | null>(null);
  const readOnly = quote.status !== "draft";
  const lang = draft.language;
  const money = (n: number) => formatMoney(n, quote.currency, lang);

  // ── Automatisch speichern ────────────────────────────────
  const firstRender = useRef(true);
  const pending = useRef<Draft | null>(null);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (readOnly) return;
    pending.current = draft;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      const body = pending.current;
      try {
        const res = await fetch(`/api/offerten/${quote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { quote: Quote };
        if (pending.current === body) {
          setSaveState("saved");
          setSavedVersion(data.quote.updatedAt);
          setQuote((q) => ({ ...q, updatedAt: data.quote.updatedAt }));
        }
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, quote.id, readOnly]);

  // Vor dem Verlassen warnen, solange noch gespeichert wird
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), []);

  const setConfig = (patch: Partial<QuoteConfig>) =>
    setDraft((d) => {
      const config = { ...d.config, ...patch };
      return { ...d, config, lines: buildLines(config, settings, d.language, d.lines) };
    });

  const setLanguage = (language: Lang) =>
    setDraft((d) => {
      const swap = (current: string, key: "intro" | "closing") =>
        current === settings.texts[key][d.language] ? settings.texts[key][language] : current;
      return {
        ...d,
        language,
        lines: buildLines(d.config, settings, language, d.lines),
        texts: { ...d.texts, intro: swap(d.texts.intro, "intro"), closing: swap(d.texts.closing, "closing") }
      };
    });

  const setLine = (id: string, patch: Partial<QuoteLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const moveLine = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const lines = [...d.lines];
      const target = index + dir;
      if (target < 0 || target >= lines.length) return d;
      [lines[index], lines[target]] = [lines[target], lines[index]];
      return { ...d, lines };
    });

  const addLine = () =>
    setDraft((d) => ({
      ...d,
      lines: [
        ...d.lines,
        {
          id: newId(),
          key: null,
          title: t("lines.newTitle"),
          detail: "",
          qty: 1,
          unit: "",
          unitPrice: 0,
          discountPercent: 0,
          interval: "once"
        }
      ]
    }));

  const applyPrefill = (p: Prefill) =>
    setDraft((d) => {
      const next = {
        ...d,
        recipient: p.recipient,
        ghlContactId: p.ghlContactId,
        ghlOpportunityId: p.ghlOpportunityId,
        ghlPipelineId: p.ghlPipelineId,
        contactPerson: p.contactPerson ?? d.contactPerson
      };
      if (p.units && d.config.model === "per_unit") {
        next.config = { ...d.config, units: p.units };
        next.lines = buildLines(next.config, settings, d.language, d.lines);
      }
      return next;
    });

  // ── Abgeleitete Werte ────────────────────────────────────
  const docQuote = useMemo(
    () => ({
      ...draft,
      number: quote.number,
      currency: quote.currency,
      createdAt: quote.createdAt,
      sentAt: quote.sentAt,
      ownerName: readOnly ? quote.sentByName : user.name,
      ownerEmail: readOnly ? quote.sentByEmail : user.email,
      contactPerson:
        draft.contactPerson ??
        (readOnly
          ? { name: quote.sentByName ?? "", email: quote.sentByEmail ?? "", phone: "" }
          : { name: user.name, email: user.email, phone: "" })
    }),
    [draft, quote, readOnly, user]
  );
  const doc = useMemo(() => buildDocument(docQuote, settings), [docQuote, settings]);
  const tier = tierForUnits(settings.perUnit.tiers, draft.config.units);
  const reverseCharge = (settings.reverseChargeCountries ?? ["DE"]).includes(draft.recipient.country);

  /** Texte und Mail aus Gespräch und GHL-Verlauf neu schreiben lassen. */
  const personalize = async (addressForm?: "du" | "sie") => {
    const hasCustomText = draft.texts.emailBody || draft.texts.intro !== settings.texts.intro[draft.language];
    if (hasCustomText && !window.confirm(t("texts.regenerateConfirm"))) return;
    setAiState("busy");
    // Ausstehende Änderungen zuerst speichern, damit Claude den aktuellen Stand sieht
    await fetch(`/api/offerten/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    }).catch(() => null);
    const res = await fetch(`/api/offerten/${quote.id}/personalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addressForm ? { addressForm } : {})
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { quote?: Quote; sources?: string[] } | null;
    if (!res?.ok || !data?.quote) {
      setAiState("error");
      return;
    }
    firstRender.current = true; // kein erneutes Speichern auslösen
    setDraft((d) => ({ ...d, texts: data.quote!.texts }));
    setAiSources(data.sources ?? []);
    setAiState("idle");
  };

  const discard = async () => {
    if (!window.confirm(t("discardConfirm"))) return;
    const res = await fetch(`/api/offerten/${quote.id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/offerten";
  };

  const duplicate = async () => {
    const res = await fetch(`/api/offerten/${quote.id}/duplicate`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    if (data.id) window.location.href = `/offerten/${data.id}`;
  };

  const fileUrl = (format: "pdf" | "xlsx", download = false) =>
    `/api/offerten/${quote.id}/file?format=${format}&v=${encodeURIComponent(savedVersion)}${download ? "&download=1" : ""}`;

  const contactLink = draft.ghlContactId && ghlContactBase ? ghlContactBase.replace("__ID__", draft.ghlContactId) : null;

  return (
    <div className="of-editor">
      {/* ── Kopf ── */}
      <div className="of-editor-head">
        <div className="of-editor-title">
          <a href={readOnly ? "/offerten?tab=sent" : "/offerten"} className="of-crumb">
            ← {t(`status.${readOnly ? "sent" : "draft"}`)}
          </a>
          <h1 className="of-h1">
            {draft.recipient.company || draft.recipient.name || quote.number}
          </h1>
          <p className="of-muted">
            {quote.number}
            {!readOnly && saveState !== "idle" && (
              <span className={`of-save of-save-${saveState}`} role="status">
                {" · "}
                {t(saveState === "saving" ? "saving" : saveState === "saved" ? "saved" : "saveError")}
              </span>
            )}
          </p>
        </div>
        <div className="of-editor-actions">
          <div className="of-menu">
            <button
              type="button"
              className="button-secondary of-icon-only"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("more")}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="of-menu-panel" role="menu" onClick={() => setMenuOpen(false)}>
                <a role="menuitem" className="menu-action" href={fileUrl("pdf", true)}>
                  <Download size={16} aria-hidden="true" /> {t("downloadPdf")}
                </a>
                <a role="menuitem" className="menu-action" href={fileUrl("xlsx", true)}>
                  <Download size={16} aria-hidden="true" /> {t("downloadXlsx")}
                </a>
                <button role="menuitem" type="button" className="menu-action" onClick={duplicate}>
                  <Copy size={16} aria-hidden="true" /> {t("duplicate")}
                </button>
                {!readOnly && (
                  <button role="menuitem" type="button" className="menu-action of-danger" onClick={discard}>
                    <Trash2 size={16} aria-hidden="true" /> {t("discard")}
                  </button>
                )}
              </div>
            )}
          </div>
          {readOnly ? (
            <button type="button" className="button-secondary" onClick={duplicate}>
              <Copy size={16} aria-hidden="true" />
              {t("duplicate")}
            </button>
          ) : (
            <button
              type="button"
              className="button-yellow"
              onClick={() => setSendOpen(true)}
              disabled={saveState === "saving" || !draft.lines.length}
            >
              <Send size={16} aria-hidden="true" />
              {t("send")}
            </button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="of-banner">
          <p>
            {t("sentBanner", {
              date: quote.sentAt ? formatDate(quote.sentAt, uiLocale) : "–",
              name: quote.sentByName ?? "–",
              to: (quote.sentTo ?? []).join(", ")
            })}
          </p>
          <p className="of-muted">{t("sentHint")}</p>
          <GhlStatus quote={quote} ghlEnabled={ghlEnabled} onUpdated={(q) => setQuote(q)} />
        </div>
      )}

      <div className="of-view-switch" role="tablist">
        <button type="button" role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")}>
          {t("tabEdit")}
        </button>
        <button type="button" role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")}>
          {t("tabPreview")}
        </button>
      </div>

      <div className="of-editor-grid" data-view={view}>
        {/* ── Formular ── */}
        <fieldset className="of-form" disabled={readOnly}>
          {quote.analysis && (
            <section className="of-card of-card-soft">
              <h2 className="of-h2">
                {t("analysis.title")}
                <span className={`of-chip of-chip-conf-${quote.analysis.confidence}`}>
                  {t(`analysis.confidence.${quote.analysis.confidence}`)}
                </span>
              </h2>
              <p>{quote.analysis.summary}</p>
              {quote.analysis.offerRequested && (
                <p className="of-quote">
                  <strong>{t("analysis.evidence")}:</strong> {quote.analysis.evidence}
                </p>
              )}
              {quote.meetingId && (
                <a className="of-link" href={`https://app.fireflies.ai/view/${quote.meetingId}`} target="_blank" rel="noreferrer">
                  {t("analysis.openCall")} <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </section>
          )}

          {/* Empfänger */}
          <section className="of-card">
            <h2 className="of-h2">{t("recipient.title")}</h2>
            <div className="of-ghl-link">
              {draft.ghlContactId ? (
                <p className="of-ok">
                  <Link2 size={16} aria-hidden="true" />
                  <span>
                    {t("recipient.ghlLinked")}
                    {" · "}
                    {draft.ghlOpportunityId ? t("recipient.ghlOpportunity") : t("recipient.ghlNoOpportunity")}
                  </span>
                  {contactLink && (
                    <a className="of-link" href={contactLink} target="_blank" rel="noreferrer">
                      {t("recipient.openGhl")} <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  )}
                </p>
              ) : (
                <p className="of-warn">{t("recipient.ghlNotLinked")}</p>
              )}
              {draft.contactPerson && (
                <p className="of-muted of-small">
                  {t("recipient.contactPerson", {
                    name: [draft.contactPerson.name, draft.contactPerson.phone].filter(Boolean).join(" · ") || draft.contactPerson.email
                  })}
                </p>
              )}
              {ghlEnabled && !readOnly && (
                <ContactPicker
                  label={draft.ghlContactId ? t("recipient.change") : t("recipient.link")}
                  onPick={applyPrefill}
                />
              )}
            </div>
            <div className="of-grid-2">
              <Field label={t("recipient.company")}>
                <input value={draft.recipient.company} onChange={(e) => update({ recipient: { ...draft.recipient, company: e.target.value } })} />
              </Field>
              <Field label={t("recipient.name")}>
                <input value={draft.recipient.name} onChange={(e) => update({ recipient: { ...draft.recipient, name: e.target.value } })} />
              </Field>
              <Field label={t("recipient.email")}>
                <input
                  type="email"
                  inputMode="email"
                  value={draft.recipient.email}
                  onChange={(e) => update({ recipient: { ...draft.recipient, email: e.target.value.trim() } })}
                />
              </Field>
              <Field label={t("recipient.firstName")}>
                <input value={draft.recipient.firstName} onChange={(e) => update({ recipient: { ...draft.recipient, firstName: e.target.value } })} />
              </Field>
              <Field label={t("recipient.address")} hint={t("recipient.addressHint")} wide>
                <textarea
                  rows={3}
                  value={draft.recipient.addressLines.join("\n")}
                  onChange={(e) =>
                    update({ recipient: { ...draft.recipient, addressLines: e.target.value.split("\n").slice(0, 5) } })
                  }
                />
              </Field>
              <Field label={t("recipient.country")} hint={reverseCharge ? t("recipient.reverseChargeHint") : t("recipient.countryHint")}>
                <input
                  value={draft.recipient.country}
                  maxLength={2}
                  placeholder="CH"
                  onChange={(e) =>
                    update({ recipient: { ...draft.recipient, country: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") } })
                  }
                />
              </Field>
              {reverseCharge ? (
                <Field label={t("recipient.vatId")}>
                  <input value={draft.recipient.vatId} placeholder="DE123456789" onChange={(e) => update({ recipient: { ...draft.recipient, vatId: e.target.value } })} />
                </Field>
              ) : (
                <div />
              )}
              <Field label={t("recipient.language")}>
                <select value={draft.language} onChange={(e) => setLanguage(e.target.value as Lang)}>
                  <option value="de">{tLang("de")}</option>
                  <option value="en">{tLang("en")}</option>
                </select>
              </Field>
              <Field label={t("recipient.validUntil")}>
                <input type="date" value={draft.validUntil} onChange={(e) => e.target.value && update({ validUntil: e.target.value })} />
              </Field>
            </div>
          </section>

          {/* Paket */}
          <section className="of-card">
            <h2 className="of-h2">{t("config.title")}</h2>
            <div className="of-field">
              <span className="field-label">{t("config.model")}</span>
              <Segmented
                value={draft.config.model}
                onChange={(model) => setConfig({ model })}
                options={[
                  ["per_unit", t("config.perUnit")],
                  ["per_booking", t("config.perBooking")],
                  ["none", t("config.none")]
                ]}
              />
            </div>
            {draft.config.model === "per_unit" && (
              <div className="of-grid-2">
                <Field
                  label={t("config.units")}
                  hint={
                    t("config.tierHint", {
                      tier: tier.name,
                      price: money(draft.config.billing === "yearly" ? tier.yearly : tier.monthly)
                    }) + (draft.config.units < tier.floor ? ` · ${t("config.floorHint", { floor: tier.floor })}` : "")
                  }
                >
                  <NumberField value={draft.config.units} min={1} step={1} onChange={(units) => setConfig({ units: Math.max(1, Math.round(units)) })} />
                </Field>
                <div className="of-field">
                  <span className="field-label">{t("config.billing")}</span>
                  <Segmented
                    value={draft.config.billing}
                    onChange={(billing) => setConfig({ billing })}
                    options={[
                      ["yearly", t("config.yearly")],
                      ["monthly", t("config.monthly")]
                    ]}
                  />
                </div>
              </div>
            )}
            {draft.config.model === "per_booking" && (
              <div className="of-grid-2">
                <Field label={t("config.package")}>
                  <select value={draft.config.bookingPackageId} onChange={(e) => setConfig({ bookingPackageId: e.target.value })}>
                    {settings.perBooking.packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.quota} · {money(draft.config.channelManager ? p.priceWithCm : p.price)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("config.packageCount")}>
                  <NumberField
                    value={draft.config.bookingPackageCount}
                    min={1}
                    step={1}
                    onChange={(n) => setConfig({ bookingPackageCount: Math.max(1, Math.round(n)) })}
                  />
                </Field>
                <label className="of-check of-wide">
                  <input type="checkbox" checked={draft.config.channelManager} onChange={(e) => setConfig({ channelManager: e.target.checked })} />
                  {t("config.channelManager")}
                </label>
              </div>
            )}
            {settings.addons.length > 0 && (
              <div className="of-addons">
                <span className="field-label">{t("config.addons")}</span>
                {settings.addons.map((addon) => {
                  const selected = draft.config.addons.find((a) => a.id === addon.id);
                  return (
                    <div key={addon.id} className="of-addon">
                      <label className="of-check">
                        <input
                          type="checkbox"
                          checked={Boolean(selected)}
                          onChange={(e) =>
                            setConfig({
                              addons: e.target.checked
                                ? [...draft.config.addons, { id: addon.id, qty: addon.defaultQty }]
                                : draft.config.addons.filter((a) => a.id !== addon.id)
                            })
                          }
                        />
                        <span>
                          {addon.name[lang]}
                          <span className="of-muted"> · {money(addon.price)} / {addon.unit[lang]}</span>
                        </span>
                      </label>
                      {selected && (
                        <NumberField
                          className="of-addon-qty"
                          ariaLabel={t("config.qty")}
                          value={selected.qty}
                          min={1}
                          step={1}
                          onChange={(qty) =>
                            setConfig({
                              addons: draft.config.addons.map((a) => (a.id === addon.id ? { ...a, qty: Math.max(1, Math.round(qty)) } : a))
                            })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Positionen */}
          <section className="of-card">
            <div className="of-card-head">
              <h2 className="of-h2">{t("lines.title")}</h2>
              <button type="button" className="button-ghost" onClick={addLine}>
                <Plus size={16} aria-hidden="true" /> {t("lines.add")}
              </button>
            </div>
            {!draft.lines.length && <p className="of-muted">{t("lines.empty")}</p>}
            <ol className="of-lines">
              {draft.lines.map((line, index) => {
                const auto = Boolean(line.key);
                const docLine = doc.lines[index];
                return (
                  <li key={line.id} className="of-line">
                    <div className="of-line-head">
                      {auto ? (
                        <div>
                          <span className="of-chip">{t("lines.auto")}</span>
                          <p className="of-line-title">{line.title}</p>
                          <p className="of-muted of-small">{line.detail}</p>
                        </div>
                      ) : (
                        <div className="of-line-fields">
                          <input
                            aria-label={t("lines.itemTitle")}
                            className="of-line-title-input"
                            value={line.title}
                            onChange={(e) => setLine(line.id, { title: e.target.value })}
                          />
                          <textarea
                            aria-label={t("lines.detail")}
                            placeholder={t("lines.detail")}
                            rows={2}
                            value={line.detail}
                            onChange={(e) => setLine(line.id, { detail: e.target.value })}
                          />
                        </div>
                      )}
                      <div className="of-line-tools">
                        <button type="button" className="icon-button" aria-label={t("lines.moveUp")} onClick={() => moveLine(index, -1)} disabled={index === 0}>
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={t("lines.moveDown")}
                          onClick={() => moveLine(index, 1)}
                          disabled={index === draft.lines.length - 1}
                        >
                          <ArrowDown size={16} />
                        </button>
                        {!auto && (
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={t("lines.remove")}
                            onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== line.id) }))}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="of-line-numbers">
                      <Field label={t("lines.qty")} compact>
                        <NumberField value={line.qty} min={0} disabled={auto} onChange={(qty) => setLine(line.id, { qty })} />
                      </Field>
                      <Field label={t("lines.unit")} compact>
                        <input value={line.unit} disabled={auto} onChange={(e) => setLine(line.id, { unit: e.target.value })} />
                      </Field>
                      <Field label={t("lines.price")} compact>
                        <NumberField value={line.unitPrice} disabled={auto} onChange={(unitPrice) => setLine(line.id, { unitPrice })} />
                      </Field>
                      <Field label={t("lines.discount")} compact>
                        <NumberField
                          value={line.discountPercent}
                          min={0}
                          max={100}
                          onChange={(discountPercent) => setLine(line.id, { discountPercent: Math.min(100, Math.max(0, discountPercent)) })}
                        />
                      </Field>
                      <Field label={t("lines.interval")} compact>
                        <select value={line.interval} disabled={auto} onChange={(e) => setLine(line.id, { interval: e.target.value as Interval })}>
                          {(["once", "monthly", "yearly"] as Interval[]).map((i) => (
                            <option key={i} value={i}>
                              {tIntervals(i)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="of-line-total">{docLine?.totalText}</div>
                    </div>
                    {auto && <p className="of-muted of-small">{t("lines.autoHint")}</p>}
                  </li>
                );
              })}
            </ol>
            {doc.totals.length > 0 && (
              <dl className="of-totals">
                {doc.totals.map((row, i) => (
                  <div key={i} className={row.strong ? "of-total of-total-strong" : "of-total"}>
                    <dt>{row.label}</dt>
                    <dd>{row.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {/* Texte */}
          <section className="of-card">
            <div className="of-card-head">
              <h2 className="of-h2">{t("texts.title")}</h2>
              {aiEnabled && !readOnly && (
                <div className="of-ai-tools">
                  <select
                    aria-label={t("texts.addressForm")}
                    className="of-inline-select"
                    value={draft.texts.addressForm}
                    onChange={(e) => update({ texts: { ...draft.texts, addressForm: e.target.value as "du" | "sie" } })}
                  >
                    <option value="sie">{t("texts.formSie")}</option>
                    <option value="du">{t("texts.formDu")}</option>
                  </select>
                  <button type="button" className="button-secondary" disabled={aiState === "busy"} onClick={() => personalize(draft.texts.addressForm)}>
                    <Sparkles size={16} aria-hidden="true" />
                    {aiState === "busy" ? t("texts.regenerating") : t("texts.regenerate")}
                  </button>
                </div>
              )}
            </div>
            {aiState === "error" && <p className="form-error">{t("texts.regenerateError")}</p>}
            {aiSources && (
              <p className="of-muted of-small">
                {t("texts.sources", { list: aiSources.length ? aiSources.join(", ") : t("texts.noSources") })}
              </p>
            )}
            <Field label={t("texts.salutation")} hint={t("texts.salutationHint", { example: doc.salutation })}>
              <input
                value={draft.texts.salutation}
                placeholder={doc.salutation}
                onChange={(e) => update({ texts: { ...draft.texts, salutation: e.target.value } })}
              />
            </Field>
            <Field label={t("texts.intro")}>
              <textarea rows={4} value={draft.texts.intro} onChange={(e) => update({ texts: { ...draft.texts, intro: e.target.value } })} />
            </Field>
            <Field label={t("texts.notes")} hint={t("texts.notesHint")}>
              <textarea rows={5} value={draft.texts.notes} onChange={(e) => update({ texts: { ...draft.texts, notes: e.target.value } })} />
            </Field>
            <Field label={t("texts.closing")}>
              <textarea rows={2} value={draft.texts.closing} onChange={(e) => update({ texts: { ...draft.texts, closing: e.target.value } })} />
            </Field>
            <div className="of-mail-block">
              <h3 className="of-h3">{t("texts.mailTitle")}</h3>
              <p className="of-hint">{t("texts.mailHint")}</p>
              <Field label={t("texts.emailSubject")}>
                <input
                  value={draft.texts.emailSubject}
                  placeholder={t("texts.emailFallback")}
                  onChange={(e) => update({ texts: { ...draft.texts, emailSubject: e.target.value } })}
                />
              </Field>
              <Field label={t("texts.emailBody")}>
                <textarea
                  rows={8}
                  value={draft.texts.emailBody}
                  placeholder={t("texts.emailFallback")}
                  onChange={(e) => update({ texts: { ...draft.texts, emailBody: e.target.value } })}
                />
              </Field>
            </div>
          </section>

          {events.length > 0 && (
            <section className="of-card">
              <h2 className="of-h2">{t("history.title")}</h2>
              <ul className="of-history">
                {events.map((e) => (
                  <li key={e.id}>
                    <span>
                      {e.type === "duplicated"
                        ? t("history.duplicated", { from: String(e.detail?.from ?? "") })
                        : t.has(`history.${e.type}`)
                          ? t(`history.${e.type}` as "history.created")
                          : e.type}
                      {e.actor ? ` · ${e.actor}` : ""}
                    </span>
                    <time className="of-muted" dateTime={e.at} suppressHydrationWarning>
                      {relativeTime(e.at, uiLocale)}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </fieldset>

        {/* ── Vorschau ── */}
        <aside className="of-preview" aria-label={t("tabPreview")}>
          <div className="of-preview-bar">
            <Segmented
              value={previewFormat}
              onChange={setPreviewFormat}
              options={[
                ["pdf", t("preview.pdf")],
                ["xlsx", t("preview.xlsx")]
              ]}
            />
            {previewFormat === "pdf" && (
              <a className="of-link" href={fileUrl("pdf")} target="_blank" rel="noreferrer">
                {t("preview.openTab")} <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </div>
          {previewFormat === "pdf" ? (
            <PaperPreview doc={doc} />
          ) : (
            <>
              <p className="of-muted of-small">{t("preview.xlsxHint")}</p>
              <XlsxPreview doc={doc} />
            </>
          )}
        </aside>
      </div>

      {!readOnly && (
        <SendDialog
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          quote={{ ...quote, ...draft }}
          settings={settings}
          user={user}
          provider={mailProvider}
          onSent={() => window.location.reload()}
        />
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  wide,
  compact,
  children
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`of-field${wide ? " of-wide" : ""}${compact ? " of-field-compact" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="of-hint">{hint}</span>}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="of-segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
