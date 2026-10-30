"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { Addon, BookingPackage, OnboardingTemplateItem, QuoteSettings, UnitTier } from "@/lib/offerten/settings-shared";
import { DEFAULT_ONBOARDING } from "@/lib/offerten/settings-shared";
import { ConnectionStatus } from "./ConnectionStatus";
import { NumberField } from "./NumberField";

type Props = { initial: QuoteSettings; defaults: QuoteSettings; canEdit: boolean };

const TEXT_KEYS = ["intro", "closing", "terms", "emailSubject", "emailBody"] as const;
const PLACEHOLDERS: Record<(typeof TEXT_KEYS)[number], string> = {
  intro: "",
  closing: "",
  terms: "{currency} {contractMonths} {validUntil}",
  emailSubject: "{number} {company}",
  emailBody: "{firstName} {number} {validUntil} {company} {senderName}"
};

export function SettingsEditor({ initial, defaults, canEdit }: Props) {
  const t = useTranslations("offerten.settings");
  const tInterval = useTranslations("offerten.interval");
  const [s, setS] = useState<QuoteSettings>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<QuoteSettings>) => {
    setS((cur) => ({ ...cur, ...patch }));
    setState("idle");
  };
  const setTier = (i: number, patch: Partial<UnitTier>) =>
    set({ perUnit: { ...s.perUnit, tiers: s.perUnit.tiers.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
  const setPkg = (i: number, patch: Partial<BookingPackage>) =>
    set({ perBooking: { packages: s.perBooking.packages.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
  const setAddon = (i: number, patch: Partial<Addon>) => set({ addons: s.addons.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const ob = s.onboarding ?? DEFAULT_ONBOARDING;
  const setOb = (patch: Partial<typeof ob>) => set({ onboarding: { ...ob, ...patch } });
  const setObItem = (i: number, patch: Partial<OnboardingTemplateItem>) =>
    setOb({ items: ob.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const moveObItem = (i: number, dir: -1 | 1) => {
    const items = [...ob.items];
    const target = i + dir;
    if (target < 0 || target >= items.length) return;
    [items[i], items[target]] = [items[target], items[i]];
    setOb({ items });
  };

  const save = async () => {
    setState("saving");
    setError(null);
    const res = await fetch("/api/offerten/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s)
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { issues?: string[]; error?: string } | null;
    if (res?.ok) setState("saved");
    else {
      setState("idle");
      setError(t("error", { detail: data?.issues?.join("; ") ?? data?.error ?? "—" }));
    }
  };

  return (
    <div className="of-page of-settings">
      <div className="of-page-head">
        <div>
          <h1 className="of-h1">{t("title")}</h1>
          <p className="of-lead">{t("lead")}</p>
          {!canEdit && <p className="of-warn">{t("readOnly")}</p>}
        </div>
        {canEdit && (
          <div className="of-editor-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => window.confirm(t("resetConfirm")) && set(structuredClone(defaults))}
            >
              <RotateCcw size={16} aria-hidden="true" /> {t("reset")}
            </button>
            <button type="button" className="button-yellow" onClick={save} disabled={state === "saving"}>
              <Save size={16} aria-hidden="true" />
              {state === "saving" ? t("saving") : state === "saved" ? t("saved") : t("save")}
            </button>
          </div>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="of-form">
        <ConnectionStatus />
      </div>

      <fieldset className="of-form" disabled={!canEdit}>
        <section className="of-card">
          <h2 className="of-h2">{t("general")}</h2>
          <div className="of-grid-4">
            <label className="of-field">
              <span className="field-label">{t("currency")}</span>
              <input value={s.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
            </label>
            <label className="of-field">
              <span className="field-label">{t("validity")}</span>
              <NumberField value={s.validityDays} min={1} step={1} onChange={(n) => set({ validityDays: Math.round(n) })} />
            </label>
            <label className="of-field">
              <span className="field-label">{t("prefix")}</span>
              <input value={s.numberPrefix} onChange={(e) => set({ numberPrefix: e.target.value.toUpperCase() })} />
            </label>
            <label className="of-field">
              <span className="field-label">{t("tax")}</span>
              <NumberField value={s.taxPercent} min={0} max={50} onChange={(n) => set({ taxPercent: n })} />
            </label>
            <label className="of-field">
              <span className="field-label">{t("reverseCharge")}</span>
              <CountryList value={s.reverseChargeCountries ?? []} onChange={(reverseChargeCountries) => set({ reverseChargeCountries })} />
              <span className="of-hint">{t("reverseChargeHint")}</span>
            </label>
            <label className="of-field">
              <span className="field-label">{t("followUpDays")}</span>
              <NumberField value={s.followUpDays ?? 4} min={1} max={60} step={1} onChange={(n) => set({ followUpDays: Math.round(n) })} />
            </label>
          </div>
        </section>

        <section className="of-card">
          <div className="of-card-head">
            <h2 className="of-h2">{t("perUnit")}</h2>
            <label className="of-field of-inline">
              <span className="field-label">{t("contractMonths")}</span>
              <NumberField
                className="of-narrow"
                value={s.perUnit.contractMonths}
                min={1}
                step={1}
                onChange={(n) => set({ perUnit: { ...s.perUnit, contractMonths: Math.round(n) } })}
              />
            </label>
          </div>
          <div className="of-table-wrap">
            <table className="of-table">
              <thead>
                <tr>
                  <th>{t("tier")}</th>
                  <th>{t("minUnits")}</th>
                  <th>{t("maxUnits")}</th>
                  <th>{t("monthly")}</th>
                  <th>{t("yearly")}</th>
                  <th>{t("floor")}</th>
                </tr>
              </thead>
              <tbody>
                {s.perUnit.tiers.map((tier, i) => (
                  <tr key={i}>
                    <td><input aria-label={t("tier")} value={tier.name} onChange={(e) => setTier(i, { name: e.target.value })} /></td>
                    <td><NumberField ariaLabel={t("minUnits")} value={tier.minUnits} min={1} step={1} onChange={(n) => setTier(i, { minUnits: Math.round(n) })} /></td>
                    <td>
                      <input
                        aria-label={t("maxUnits")}
                        inputMode="numeric"
                        placeholder={t("none")}
                        value={tier.maxUnits ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          setTier(i, { maxUnits: v ? Number(v) : null });
                        }}
                      />
                    </td>
                    <td><NumberField ariaLabel={t("monthly")} value={tier.monthly} min={0} onChange={(n) => setTier(i, { monthly: n })} /></td>
                    <td><NumberField ariaLabel={t("yearly")} value={tier.yearly} min={0} onChange={(n) => setTier(i, { yearly: n })} /></td>
                    <td><NumberField ariaLabel={t("floor")} value={tier.floor} min={1} step={1} onChange={(n) => setTier(i, { floor: Math.round(n) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="of-card">
          <h2 className="of-h2">{t("perBooking")}</h2>
          <div className="of-table-wrap">
            <table className="of-table">
              <thead>
                <tr>
                  <th>{t("tier")}</th>
                  <th>{t("quota")}</th>
                  <th>{t("price")}</th>
                  <th>{t("priceCm")}</th>
                </tr>
              </thead>
              <tbody>
                {s.perBooking.packages.map((p, i) => (
                  <tr key={i}>
                    <td><input aria-label={t("tier")} value={p.name} onChange={(e) => setPkg(i, { name: e.target.value })} /></td>
                    <td><NumberField ariaLabel={t("quota")} value={p.quota} min={1} step={1} onChange={(n) => setPkg(i, { quota: Math.round(n) })} /></td>
                    <td><NumberField ariaLabel={t("price")} value={p.price} min={0} onChange={(n) => setPkg(i, { price: n })} /></td>
                    <td><NumberField ariaLabel={t("priceCm")} value={p.priceWithCm} min={0} onChange={(n) => setPkg(i, { priceWithCm: n })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="of-card">
          <div className="of-card-head">
            <h2 className="of-h2">{t("addons")}</h2>
            <button
              type="button"
              className="button-ghost"
              onClick={() =>
                set({
                  addons: [
                    ...s.addons,
                    {
                      id: `addon${Date.now().toString(36)}`,
                      name: { de: "", en: "" },
                      description: { de: "", en: "" },
                      unit: { de: "Stück", en: "item" },
                      price: 0,
                      defaultQty: 1,
                      interval: "once"
                    }
                  ]
                })
              }
            >
              <Plus size={16} aria-hidden="true" /> {t("add")}
            </button>
          </div>
          {s.addons.map((a, i) => (
            <div key={a.id} className="of-addon-edit">
              <div className="of-grid-2">
                {(["de", "en"] as const).map((l) => (
                  <div key={l} className="of-lang-block">
                    <span className="of-lang-tag">{l === "de" ? t("german") : t("english")}</span>
                    <label className="of-field">
                      <span className="field-label">{t("addonName")}</span>
                      <input value={a.name[l]} onChange={(e) => setAddon(i, { name: { ...a.name, [l]: e.target.value } })} />
                    </label>
                    <label className="of-field">
                      <span className="field-label">{t("addonDescription")}</span>
                      <textarea rows={2} value={a.description[l]} onChange={(e) => setAddon(i, { description: { ...a.description, [l]: e.target.value } })} />
                    </label>
                    <label className="of-field">
                      <span className="field-label">{t("addonUnit")}</span>
                      <input value={a.unit[l]} onChange={(e) => setAddon(i, { unit: { ...a.unit, [l]: e.target.value } })} />
                    </label>
                  </div>
                ))}
              </div>
              <div className="of-grid-4">
                <label className="of-field">
                  <span className="field-label">{t("addonPrice")}</span>
                  <NumberField value={a.price} min={0} onChange={(n) => setAddon(i, { price: n })} />
                </label>
                <label className="of-field">
                  <span className="field-label">{t("addonQty")}</span>
                  <NumberField value={a.defaultQty} min={1} step={1} onChange={(n) => setAddon(i, { defaultQty: Math.round(n) })} />
                </label>
                <label className="of-field">
                  <span className="field-label">{t("addonInterval")}</span>
                  <select value={a.interval} onChange={(e) => setAddon(i, { interval: e.target.value as Addon["interval"] })}>
                    {(["once", "monthly", "yearly"] as const).map((x) => (
                      <option key={x} value={x}>{tInterval(x)}</option>
                    ))}
                  </select>
                </label>
                <div className="of-field of-field-end">
                  <button type="button" className="button-ghost of-danger" onClick={() => set({ addons: s.addons.filter((_, j) => j !== i) })}>
                    <Trash2 size={16} aria-hidden="true" /> {t("remove")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="of-card">
          <h2 className="of-h2">{t("assistant")}</h2>
          <p className="of-hint">{t("assistantHint")}</p>
          <div className="of-grid-2">
            <label className="of-field">
              <span className="field-label">{t("assistantName")}</span>
              <input
                value={s.assistant?.name ?? ""}
                onChange={(e) => set({ assistant: { name: e.target.value, whatsapp: s.assistant?.whatsapp ?? "" } })}
              />
            </label>
            <label className="of-field">
              <span className="field-label">{t("assistantWhatsapp")}</span>
              <input
                inputMode="tel"
                value={s.assistant?.whatsapp ?? ""}
                placeholder="+41585909971"
                onChange={(e) => set({ assistant: { name: s.assistant?.name ?? "Noah", whatsapp: e.target.value } })}
              />
            </label>
          </div>
        </section>

        <section className="of-card">
          <div className="of-card-head">
            <h2 className="of-h2">{t("onboarding.title")}</h2>
            <button
              type="button"
              className="button-ghost"
              onClick={() =>
                setOb({
                  items: [
                    ...ob.items,
                    {
                      id: `item${Date.now().toString(36)}`,
                      phase: "setup",
                      owner: "customer",
                      condition: "always",
                      link: "none",
                      title: { de: "", en: "" },
                      detail: { de: "", en: "" }
                    }
                  ]
                })
              }
            >
              <Plus size={16} aria-hidden="true" /> {t("onboarding.add")}
            </button>
          </div>
          <p className="of-hint">{t("onboarding.hint")}</p>
          <label className="of-field">
            <span className="field-label">{t("onboarding.bookingUrl")}</span>
            <input value={ob.bookingUrl} placeholder="https://calendly.com/…" onChange={(e) => setOb({ bookingUrl: e.target.value })} />
            <span className="of-hint">{t("onboarding.bookingHint")}</span>
          </label>
          {ob.items.map((item, i) => (
            <div key={item.id} className="of-addon-edit">
              <div className="of-grid-4">
                <label className="of-field">
                  <span className="field-label">{t("onboarding.phase")}</span>
                  <select value={item.phase} onChange={(e) => setObItem(i, { phase: e.target.value as OnboardingTemplateItem["phase"] })}>
                    {(["start", "setup", "golive"] as const).map((x) => (
                      <option key={x} value={x}>{t(`onboarding.phases.${x}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="of-field">
                  <span className="field-label">{t("onboarding.owner")}</span>
                  <select value={item.owner} onChange={(e) => setObItem(i, { owner: e.target.value as OnboardingTemplateItem["owner"] })}>
                    {(["customer", "elev8", "both"] as const).map((x) => (
                      <option key={x} value={x}>{t(`onboarding.owners.${x}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="of-field">
                  <span className="field-label">{t("onboarding.condition")}</span>
                  <select value={item.condition} onChange={(e) => setObItem(i, { condition: e.target.value as OnboardingTemplateItem["condition"] })}>
                    {(["always", "smart_lock", "channel_manager", "migration"] as const).map((x) => (
                      <option key={x} value={x}>{t(`onboarding.conditions.${x}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="of-check">
                  <input type="checkbox" checked={item.link === "booking"} onChange={(e) => setObItem(i, { link: e.target.checked ? "booking" : "none" })} />
                  {t("onboarding.link")}
                </label>
              </div>
              <div className="of-grid-2">
                {(["de", "en"] as const).map((l) => (
                  <div key={l} className="of-lang-block">
                    <span className="of-lang-tag">{l === "de" ? t("german") : t("english")}</span>
                    <label className="of-field">
                      <span className="field-label">{t("onboarding.itemTitle")}</span>
                      <input value={item.title[l]} onChange={(e) => setObItem(i, { title: { ...item.title, [l]: e.target.value } })} />
                    </label>
                    <label className="of-field">
                      <span className="field-label">{t("onboarding.itemDetail")}</span>
                      <textarea rows={2} value={item.detail[l]} onChange={(e) => setObItem(i, { detail: { ...item.detail, [l]: e.target.value } })} />
                    </label>
                  </div>
                ))}
              </div>
              <div className="of-editor-actions">
                <button type="button" className="icon-button" aria-label={t("onboarding.moveUp")} disabled={i === 0} onClick={() => moveObItem(i, -1)}>
                  <ArrowUp size={16} />
                </button>
                <button type="button" className="icon-button" aria-label={t("onboarding.moveDown")} disabled={i === ob.items.length - 1} onClick={() => moveObItem(i, 1)}>
                  <ArrowDown size={16} />
                </button>
                <button type="button" className="button-ghost of-danger" onClick={() => setOb({ items: ob.items.filter((_, j) => j !== i) })}>
                  <Trash2 size={16} aria-hidden="true" /> {t("remove")}
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="of-card">
          <h2 className="of-h2">{t("issuer")}</h2>
          <div className="of-grid-2">
            <label className="of-field">
              <span className="field-label">{t("company")}</span>
              <input value={s.issuer.company} onChange={(e) => set({ issuer: { ...s.issuer, company: e.target.value } })} />
            </label>
            <label className="of-field">
              <span className="field-label">{t("email")}</span>
              <input type="email" value={s.issuer.email} onChange={(e) => set({ issuer: { ...s.issuer, email: e.target.value } })} />
            </label>
            <label className="of-field of-wide">
              <span className="field-label">{t("address")}</span>
              <textarea
                rows={3}
                value={s.issuer.addressLines.join("\n")}
                onChange={(e) => set({ issuer: { ...s.issuer, addressLines: e.target.value.split("\n").slice(0, 5) } })}
              />
            </label>
            <label className="of-field">
              <span className="field-label">{t("website")}</span>
              <input value={s.issuer.website} onChange={(e) => set({ issuer: { ...s.issuer, website: e.target.value } })} />
            </label>
            <label className="of-field">
              <span className="field-label">{t("phone")}</span>
              <input value={s.issuer.phone} onChange={(e) => set({ issuer: { ...s.issuer, phone: e.target.value } })} />
            </label>
            <label className="of-field">
              <span className="field-label">{t("taxId")}</span>
              <input value={s.issuer.taxId} onChange={(e) => set({ issuer: { ...s.issuer, taxId: e.target.value } })} />
            </label>
          </div>
        </section>

        <section className="of-card">
          <h2 className="of-h2">{t("texts")}</h2>
          {TEXT_KEYS.map((key) => (
            <div key={key} className="of-text-pair">
              <h3 className="of-h3">{t(key)}</h3>
              {PLACEHOLDERS[key] && <p className="of-hint">{t("placeholders", { list: PLACEHOLDERS[key] })}</p>}
              <div className="of-grid-2">
                {(["de", "en"] as const).map((l) => (
                  <label key={l} className="of-field">
                    <span className="field-label">{l === "de" ? t("german") : t("english")}</span>
                    {key === "emailSubject" ? (
                      <input value={s.texts[key][l]} onChange={(e) => set({ texts: { ...s.texts, [key]: { ...s.texts[key], [l]: e.target.value } } })} />
                    ) : (
                      <textarea
                        rows={key === "emailBody" ? 8 : 3}
                        value={s.texts[key][l]}
                        onChange={(e) => set({ texts: { ...s.texts, [key]: { ...s.texts[key], [l]: e.target.value } } })}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>
      </fieldset>
    </div>
  );
}

/** Kommagetrennte Länderliste; wird erst beim Verlassen des Feldes übernommen, damit man frei tippen kann. */
function CountryList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <input
      value={text}
      placeholder="DE, AT"
      onChange={(e) => setText(e.target.value.toUpperCase())}
      onBlur={() => {
        const list = [...new Set(text.split(/[^A-Z]+/).filter((c) => c.length === 2))];
        setText(list.join(", "));
        onChange(list);
      }}
    />
  );
}
