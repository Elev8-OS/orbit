"use client";

import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { promoStrings } from "@/lib/sm-manager/promos-i18n";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";
import "./inquiries.css";
import "./promos.css";

export type Promo = {
  id: number;
  property_key: string;
  title: string;
  code: string;
  terms: string;
  stay_from: string | null;
  stay_to: string | null;
  book_until: string | null;
  min_nights: number | null;
  status: "draft" | "active" | "ended";
  source: string;
  suggestion_id: string | null;
  note: string;
  live: boolean;
};

export type Suggestion = {
  id: string;
  type: string;
  benefit: string;
  property_key: string;
  name: string;
  units: number;
  open_nights: number;
  share: number;
  first_gap_date: string | null;
  days: number;
  min_nights: number | null;
  stay_from: string;
  stay_to: string;
  book_until: string;
};

export type PromosData = { today: string; promos: Promo[] };
export type SuggestionsData = { today: string; days: number; suggestions: Suggestion[]; error?: string };
type Prop = { key: string; name: string };

async function call(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

type Form = { property_key: string; title: string; code: string; terms: string; stay_from: string; stay_to: string; book_until: string; min_nights: string; status: string };

function Field({ id, label, tip, help, children }: { id: string; label: string; tip?: ReactNode; help?: string; children: ReactNode }) {
  return (
    <div className="pr-field">
      <div className="pr-lab">
        <label htmlFor={id}>{label}</label>
        {tip}
      </div>
      {children}
      {help ? <span className="sm-muted sm-small">{help}</span> : null}
    </div>
  );
}

function PromoForm({ locale, promo, properties, onDone }: { locale: "de" | "en"; promo: Promo | null; properties: Prop[]; onDone?: () => void }) {
  const s = promoStrings(locale);
  const tp = tipStrings(locale);
  const router = useRouter();
  const uid = useId();
  const [f, setF] = useState<Form>({
    property_key: promo?.property_key ?? "all",
    title: promo?.title ?? "",
    code: promo?.code ?? "",
    terms: promo?.terms ?? "",
    stay_from: promo?.stay_from ?? "",
    stay_to: promo?.stay_to ?? "",
    book_until: promo?.book_until ?? "",
    min_nights: promo?.min_nights ? String(promo.min_nights) : "",
    status: promo?.status ?? "draft"
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const badge = !promo ? null : promo.status === "ended" ? s.badgeEnded : promo.status === "draft" ? s.badgeDraft : promo.live ? s.badgeLive : s.badgeActiveNotLive;

  async function save() {
    if (!f.title.trim()) return setMsg(s.titleRequired);
    if (f.status === "active" && (!f.code.trim() || !f.terms.trim())) return setMsg(s.activeNeeds);
    setBusy(true);
    setMsg(s.saving);
    const body = {
      property_key: f.property_key,
      title: f.title.trim(),
      code: f.code.trim(),
      terms: f.terms.trim(),
      stay_from: f.stay_from || null,
      stay_to: f.stay_to || null,
      book_until: f.book_until || null,
      min_nights: f.min_nights ? Number(f.min_nights) : null,
      status: f.status
    };
    const r = promo ? await call("PUT", `/api/sm-manager/promos/${promo.id}`, body) : await call("POST", "/api/sm-manager/promos", body);
    setBusy(false);
    setMsg(r.ok ? s.saved : `${s.failed}${r.error ? `: ${r.error}` : ""}`);
    if (r.ok) {
      router.refresh();
      onDone?.();
    }
  }

  async function remove() {
    if (!promo || !window.confirm(s.confirmDelete)) return;
    setBusy(true);
    const r = await call("DELETE", `/api/sm-manager/promos/${promo.id}`);
    setBusy(false);
    if (r.ok) router.refresh();
    else setMsg(`${s.failed}${r.error ? `: ${r.error}` : ""}`);
  }

  return (
    <article className="inq-card pr-card">
      {badge ? (
        <div className="pr-card-head">
          <span className={`sm-badge ${promo?.live ? "sm-badge-ok" : ""}`}>{badge}</span>
        </div>
      ) : null}
      <div className="pr-form">
        <div className="pr-grid">
          <Field id={`${uid}-villa`} label={s.villa}>
            <select id={`${uid}-villa`} value={f.property_key} onChange={set("property_key")}>
              <option value="all">{s.allVillas}</option>
              {properties.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${uid}-title`} label={s.fTitle}>
            <input id={`${uid}-title`} value={f.title} onChange={set("title")} maxLength={120} />
          </Field>
        </div>
        <div className="pr-grid">
          <Field id={`${uid}-code`} label={s.fCode} tip={<Tip text={s.codeTip} label={tp.label} />} help={s.codeHelp}>
            <input id={`${uid}-code`} className="pr-code" value={f.code} onChange={set("code")} maxLength={24} autoCapitalize="characters" autoComplete="off" />
          </Field>
          <Field id={`${uid}-status`} label={s.fStatus} tip={<Tip text={s.statusTip} label={tp.label} />}>
            <select id={`${uid}-status`} value={f.status} onChange={set("status")}>
              <option value="draft">{s.statusDraft}</option>
              <option value="active">{s.statusActive}</option>
              <option value="ended">{s.statusEnded}</option>
            </select>
          </Field>
        </div>
        <Field id={`${uid}-terms`} label={s.fTerms} tip={<Tip text={s.termsTip} label={tp.label} />} help={s.termsHelp}>
          <textarea id={`${uid}-terms`} rows={3} maxLength={1000} value={f.terms} onChange={set("terms")} placeholder={s.termsPlaceholder} />
        </Field>
        <div className="pr-lab">
          <span className="sm-muted sm-small">{s.fStayFrom} / {s.fStayTo} / {s.fBookUntil} / {s.fMin}</span>
          <Tip text={s.windowTip} label={tp.label} />
        </div>
        <div className="pr-grid">
          <Field id={`${uid}-from`} label={s.fStayFrom}>
            <input id={`${uid}-from`} type="date" value={f.stay_from} onChange={set("stay_from")} />
          </Field>
          <Field id={`${uid}-to`} label={s.fStayTo}>
            <input id={`${uid}-to`} type="date" value={f.stay_to} onChange={set("stay_to")} />
          </Field>
          <Field id={`${uid}-until`} label={s.fBookUntil}>
            <input id={`${uid}-until`} type="date" value={f.book_until} onChange={set("book_until")} />
          </Field>
          <Field id={`${uid}-min`} label={s.fMin}>
            <input id={`${uid}-min`} type="number" min={1} max={60} value={f.min_nights} onChange={set("min_nights")} />
          </Field>
        </div>
        <div className="pr-actions">
          <button type="button" className="sm-btn sm-btn-primary" onClick={save} disabled={busy}>
            {s.save}
          </button>
          {promo ? (
            <button type="button" className="sm-btn" onClick={remove} disabled={busy}>
              {s.del}
            </button>
          ) : onDone ? (
            <button type="button" className="sm-btn" onClick={onDone} disabled={busy}>
              {s.cancel}
            </button>
          ) : null}
          {msg ? (
            <span className="sm-muted sm-small" role="status">
              {msg}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SuggestionCard({ locale, sg }: { locale: "de" | "en"; sg: Suggestion }) {
  const s = promoStrings(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const benefit = s.benefits[sg.benefit] ?? sg.benefit;
  const value = s.values[sg.benefit];
  const total = sg.days * Math.max(sg.units, 1);

  async function adopt() {
    setBusy(true);
    setMsg(s.adopting);
    const r = await call("POST", "/api/sm-manager/promos", {
      property_key: sg.property_key,
      title: `${sg.name}: ${s.types[sg.type] ?? sg.type}`,
      terms: s.prefillTerms(benefit),
      stay_from: sg.stay_from,
      stay_to: sg.stay_to,
      book_until: sg.book_until,
      min_nights: sg.min_nights,
      suggestion_id: sg.id,
      source: "suggestion",
      status: "draft"
    });
    setBusy(false);
    setMsg(r.ok ? s.saved : `${s.failed}${r.error ? `: ${r.error}` : ""}`);
    if (r.ok) router.refresh();
  }

  return (
    <article className="inq-card pr-card">
      <div className="pr-card-head">
        <span className="sm-badge">{s.types[sg.type] ?? sg.type}</span>
        <span className="sm-muted sm-small">{s.nightsFree(sg.open_nights, total, Math.round(sg.share * 100))}</span>
      </div>
      <h3>{sg.name}</h3>
      <p>
        <strong>{benefit}</strong>
        {value ? <span className="sm-muted sm-small"> ({s.value(value)})</span> : null}
      </p>
      <p className="sm-muted sm-small">{s.window(sg.stay_from, sg.stay_to, sg.book_until, sg.min_nights)}</p>
      <div className="pr-actions">
        <button type="button" className="sm-btn sm-btn-primary" onClick={adopt} disabled={busy}>
          {s.adopt}
        </button>
        {msg ? (
          <span className="sm-muted sm-small" role="status">
            {msg}
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Tab Aktionen: Vorschläge nach freien Nächten und die Promocodes, die das Team von Hand in Elev8 angelegt hat. */
export function SmPromos({ locale, promos, suggestions, properties }: { locale: "de" | "en"; promos: PromosData | null; suggestions: SuggestionsData | null; properties: Prop[] }) {
  const s = promoStrings(locale);
  const tp = tipStrings(locale);
  const [adding, setAdding] = useState(false);
  const list = promos?.promos ?? [];
  const adopted = new Set(list.filter((p) => p.suggestion_id && p.status !== "ended").map((p) => p.suggestion_id));
  const open = (suggestions?.suggestions ?? []).filter((x) => !adopted.has(x.id)).slice(0, 8);

  return (
    <section className="pr">
      <div>
        <p className="sm-muted">{s.intro}</p>
        <h2>{s.howTitle}</h2>
        <ol className="pr-how">
          {s.steps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>

      <div>
        <h2>
          {s.sugTitle}
          <Tip text={s.sugTip} label={tp.label} />
        </h2>
        {suggestions?.error || !suggestions ? <p className="sm-warn">{s.sugError}</p> : null}
        {suggestions && !suggestions.error && open.length === 0 ? <p className="sm-muted">{s.sugEmpty}</p> : null}
        <div className="pr-cards">
          {open.map((sg) => (
            <SuggestionCard key={sg.id} locale={locale} sg={sg} />
          ))}
        </div>
      </div>

      <div>
        <h2>{s.mineTitle}</h2>
        <p>
          <button type="button" className="sm-btn" onClick={() => setAdding((v) => !v)}>
            {s.newPromo}
          </button>
        </p>
        <div className="pr-cards">
          {adding ? <PromoForm locale={locale} promo={null} properties={properties} onDone={() => setAdding(false)} /> : null}
          {list.length === 0 && !adding ? <p className="sm-muted">{s.mineEmpty}</p> : null}
          {list.map((p) => (
            <PromoForm key={p.id} locale={locale} promo={p} properties={properties} />
          ))}
        </div>
      </div>
    </section>
  );
}
