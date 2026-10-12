import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, CheckSquare, ExternalLink, FilePen, Mail, MessageSquare, NotebookPen, Phone, PhoneCall, Target } from "lucide-react";
import { currentUser, hasKundenAccess } from "@/lib/platform/access";
import { ensureEmbedded } from "@/lib/platform/embedded";
import { getBriefing, loadCustomer, type TimelineEntry } from "@/lib/kunden/service";
import { hasSalesAccess } from "@/lib/sales/access";
import { ghlConfigured } from "@/lib/sales/ghl";
import { validTimeZone } from "@/lib/sales/service";
import { OpenButton } from "@/components/platform/OpenButton";
import { BriefingPanel } from "@/components/kunden/BriefingPanel";
import { RememberCustomer } from "@/components/kunden/RememberCustomer";

export const dynamic = "force-dynamic";

const KIND_ICON = { note: NotebookPen, message: MessageSquare, call: PhoneCall, quote: FilePen, meeting: CalendarDays, task: CheckSquare } as const;

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureEmbedded("kunden", `/kunden/${id}`);
  const user = await currentUser();
  if (!user || !hasKundenAccess(user.roles) || !ghlConfigured()) return null;
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const t = await getTranslations("platform.kunden");
  const tz = validTimeZone((await cookies()).get("SALES_TZ")?.value);
  const customer = await loadCustomer(id, user, locale).catch((err) => {
    console.error("Kunden-360:", err);
    return undefined;
  });
  if (customer === null) notFound();
  if (!customer) {
    return (
      <div className="p-page">
        <p className="p-error">{t("loadError")}</p>
      </div>
    );
  }
  const briefing = await getBriefing(id, locale).catch(() => null);
  const c = customer.contact;
  const fmt = (iso: string | null, withTime = false) =>
    iso
      ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", {
          timeZone: tz,
          day: "numeric",
          month: "short",
          year: "numeric",
          ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
        }).format(new Date(iso))
      : "–";
  const money = (v: number | null) =>
    v == null ? "–" : new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-CH", { style: "currency", currency: process.env.SALES_CURRENCY || "USD", maximumFractionDigits: 0 }).format(v);
  const openTasks = customer.tasks.filter((x) => !x.completed);
  const upcoming = customer.events.filter((e) => Date.parse(e.start) >= Date.now()).sort((a, b) => a.start.localeCompare(b.start));
  const kindLabel = (k: TimelineEntry["kind"]) => t(`kinds.${k}`);

  return (
    <div className="p-page p-customer">
      <RememberCustomer id={c.id} name={c.name} company={c.company} />
      <header className="p-card p-customer-head">
        <div className="p-customer-id">
          <h1>{c.company || c.name || c.email}</h1>
          {c.company && c.name && <p className="p-customer-person">{c.name}</p>}
          <p className="p-customer-contact">
            {c.email && (
              <a href={`mailto:${c.email}`}>
                <Mail size={14} aria-hidden="true" />
                {c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`}>
                <Phone size={14} aria-hidden="true" />
                {c.phone}
              </a>
            )}
          </p>
          <div className="p-tags">
            {customer.owner && <span className="p-tag is-owner">{t("owner", { name: customer.owner })}</span>}
            {c.tags.slice(0, 8).map((tag) => (
              <span key={tag} className="p-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="p-customer-actions">
          <a className="button-secondary" href={customer.url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} aria-hidden="true" />
            {t("openGhl")}
          </a>
          {hasSalesAccess(user.roles) && <OpenButton label={t("openSales")} target={{ app: "sales", path: `/sales/kontakt/${c.id}` }} />}
        </div>
      </header>

      <BriefingPanel
        contactId={c.id}
        initial={briefing}
        labels={{
          title: t("briefing.title"),
          create: t("briefing.create"),
          refresh: t("briefing.refresh"),
          working: t("briefing.working"),
          error: t("briefing.error"),
          notConfigured: t("briefing.notConfigured"),
          openPoints: t("briefing.openPoints"),
          risks: t("briefing.risks"),
          nextStep: t("briefing.nextStep"),
          created: t("briefing.created"),
          intro: t("briefing.intro"),
          moods: { positive: t("briefing.moods.positive"), neutral: t("briefing.moods.neutral"), critical: t("briefing.moods.critical"), unknown: t("briefing.moods.unknown") }
        }}
      />

      <div className="p-customer-grid">
        <section className="p-card" aria-labelledby="tl">
          <h2 id="tl" className="p-card-title">
            {t("timeline")}
          </h2>
          {customer.timeline.length === 0 ? (
            <p className="p-muted">{t("timelineEmpty")}</p>
          ) : (
            <ol className="p-timeline">
              {customer.timeline.map((e) => {
                const Icon = KIND_ICON[e.kind];
                return (
                  <li key={e.id} className={`p-timeline-item kind-${e.kind}${e.direction ? ` dir-${e.direction}` : ""}`}>
                    <span className="p-timeline-icon" aria-hidden="true">
                      <Icon size={14} />
                    </span>
                    <div className="p-timeline-body">
                      <p className="p-timeline-head">
                        <span className="p-timeline-kind">
                          {kindLabel(e.kind)}
                          {e.kind === "message" && e.title ? ` · ${e.title}` : ""}
                          {e.direction ? ` · ${t(`direction.${e.direction}`)}` : ""}
                        </span>
                        <time dateTime={e.at}>{fmt(e.at, true)}</time>
                      </p>
                      {e.kind !== "note" && e.kind !== "message" && e.title && <p className="p-timeline-title">{e.title}</p>}
                      {e.meta && <p className="p-muted">{e.meta}</p>}
                      {e.text &&
                        (e.text.length > 280 ? (
                          <details className="p-timeline-text">
                            <summary>{e.text.slice(0, 260)}…</summary>
                            <p>{e.text}</p>
                          </details>
                        ) : (
                          <p className="p-timeline-text">{e.text}</p>
                        ))}
                      {e.target && <OpenButton label={t("open")} target={e.target} variant="link" />}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="p-stack">
          <section className="p-card" aria-labelledby="opp">
            <h2 id="opp" className="p-card-title">
              <Target size={16} aria-hidden="true" />
              {t("opportunities")}
            </h2>
            {customer.opportunities.length === 0 ? (
              <p className="p-muted">{t("none")}</p>
            ) : (
              <ul className="p-rows">
                {customer.opportunities.map((o) => (
                  <li key={o.id}>
                    <span className="p-row-main">
                      <span className="p-row-title">{o.name}</span>
                      <span className="p-muted">
                        {[o.pipelineName, o.stageName].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="p-row-side">
                      <span className={`p-status is-${o.status}`}>{t(`oppStatus.${["won", "lost", "abandoned"].includes(o.status) ? o.status : "open"}`)}</span>
                      <span className="p-num">{money(o.value)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="p-card" aria-labelledby="tasks">
            <h2 id="tasks" className="p-card-title">
              <CheckSquare size={16} aria-hidden="true" />
              {t("openTasks")}
            </h2>
            {openTasks.length === 0 ? (
              <p className="p-muted">{t("none")}</p>
            ) : (
              <ul className="p-rows">
                {openTasks.map((x) => (
                  <li key={x.id}>
                    <span className="p-row-main">
                      <span className="p-row-title">{x.title}</span>
                      {x.body && <span className="p-muted p-clamp">{x.body}</span>}
                    </span>
                    <span className={`p-row-side p-num${x.dueDate && Date.parse(x.dueDate) < Date.now() ? " is-overdue" : ""}`}>{fmt(x.dueDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {upcoming.length > 0 && (
            <section className="p-card" aria-labelledby="ev">
              <h2 id="ev" className="p-card-title">
                <CalendarDays size={16} aria-hidden="true" />
                {t("upcoming")}
              </h2>
              <ul className="p-rows">
                {upcoming.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <span className="p-row-main">
                      <span className="p-row-title">{e.title}</span>
                    </span>
                    <span className="p-row-side p-num">{fmt(e.start, true)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="p-card" aria-labelledby="quotes">
            <h2 id="quotes" className="p-card-title">
              <FilePen size={16} aria-hidden="true" />
              {t("quotes")}
            </h2>
            {customer.quotes.length === 0 ? (
              <p className="p-muted">{t("none")}</p>
            ) : (
              <ul className="p-rows">
                {customer.quotes.map((q) => (
                  <li key={q.id}>
                    <span className="p-row-main">
                      <OpenButton label={q.number} target={{ app: "offerten", path: `/offerten/${q.id}` }} variant="link" />
                    </span>
                    <span className="p-row-side">
                      <span className={`p-status is-${q.status}`}>{t(`quoteStatus.${q.status === "sent" ? "sent" : "draft"}`)}</span>
                      <span className="p-num">{fmt(q.sentAt ?? q.updatedAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {customer.sections.map((s) => (
            <section key={s.appId} className="p-card" aria-label={s.title}>
              <h2 className="p-card-title">
                {s.title}
                {typeof s.count === "number" && <span className="p-count">{s.count}</span>}
              </h2>
              <ul className="p-rows">
                {s.items.map((it, i) => (
                  <li key={it.id ?? i}>
                    <span className="p-row-main">
                      {it.path ? <OpenButton label={it.title} target={{ app: s.appId, path: it.path }} variant="link" /> : <span className="p-row-title">{it.title}</span>}
                      {it.meta && <span className="p-muted">{it.meta}</span>}
                    </span>
                    {it.at && <span className="p-row-side p-num">{fmt(it.at)}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
