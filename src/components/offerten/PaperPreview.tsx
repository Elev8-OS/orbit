"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { QuoteDocument } from "@/lib/offerten/document";
import { Elev8Logo } from "@/components/Elev8Logo";

/**
 * Dokumentansicht der Offerte im Browser, Aufbau wie im PDF: Seite 1 Deckblatt mit schwarzem Band, Eckdaten,
 * Anrede, Einleitung und Gesprächspunkten als Karten; Seite 2 Angebot, nächste Schritte, Noah und Konditionen. Die Blätter werden in A4-Grösse
 * gesetzt und als Ganzes auf die verfügbare Breite skaliert, damit es auf allen Geräten gleich aussieht.
 */
const PAGE_WIDTH = 794;

export function PaperPreview({ doc }: { doc: QuoteDocument }) {
  const L = doc.labels;
  const frameRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(2300);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const stack = stackRef.current;
    if (!frame || !stack) return;
    const measure = () => {
      setScale(Math.min(1, frame.clientWidth / PAGE_WIDTH));
      setHeight(stack.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    ro.observe(stack);
    return () => ro.disconnect();
  }, []);

  const notes = doc.notes
    .split("\n")
    .map((n) => n.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const paragraphs = (text: string) =>
    text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p, i) => <p key={i}>{p}</p>);
  const footer = [doc.issuer.company, ...doc.issuer.addressLines, doc.issuer.taxId].filter(Boolean).join(" · ");
  const contact = [doc.issuer.website.replace(/^https?:\/\//, ""), doc.contact.email || doc.issuer.email, doc.contact.phone || doc.issuer.phone]
    .filter(Boolean)
    .join(" · ");
  const who = doc.recipient.company || doc.recipient.name;
  const Footer = () =>
    footer || contact ? (
      <footer className="of-paper-footer">
        <div>
          {footer && <p>{footer}</p>}
          {contact && <p>{contact}</p>}
        </div>
        <p>
          {L.document} {doc.number}
        </p>
      </footer>
    ) : null;

  return (
    <div className="of-paper-scroll">
      <div ref={frameRef} className="of-paper-frame" style={{ height: height * scale }}>
        <div ref={stackRef} className="of-paper-stack" style={{ transform: `scale(${scale})` }}>
          {/* Seite 1 */}
          <article className="of-paper" lang={doc.lang}>
            <div className="of-paper-band">
              <div className="of-paper-bandtop">
                <Elev8Logo height={28} />
                <div className="of-paper-docmeta">
                  <span>{L.document}</span>
                  <strong>{doc.number}</strong>
                  <span suppressHydrationWarning>{doc.dateText}</span>
                </div>
              </div>
              {who && <p className="of-paper-kicker">{L.offerFor}</p>}
              <h2>{who || L.document}</h2>
            </div>
            {doc.facts.length > 0 && (
              <dl className="of-paper-facts">
                {doc.facts.map((f, i) => (
                  <div key={i}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                    {f.sub && <dd className="of-paper-factsub">{f.sub}</dd>}
                  </div>
                ))}
              </dl>
            )}
            <div className="of-paper-body">
              <div className="of-paper-parties">
                <div>
                  <p className="of-paper-label">{L.for}</p>
                  {doc.recipient.company && <p className="of-paper-strong">{doc.recipient.company}</p>}
                  {doc.recipient.name && <p className={doc.recipient.company ? "" : "of-paper-strong"}>{doc.recipient.name}</p>}
                  {doc.recipient.addressLines.filter(Boolean).map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                  {doc.recipient.email && <p className="of-paper-muted">{doc.recipient.email}</p>}
                  {doc.customerVatId && (
                    <p className="of-paper-muted">
                      {L.customerVatId}: {doc.customerVatId}
                    </p>
                  )}
                </div>
                <div>
                  <p className="of-paper-label">{L.contact}</p>
                  {doc.contact.name && <p className="of-paper-strong">{doc.contact.name}</p>}
                  {doc.contact.phone && <p>{doc.contact.phone}</p>}
                  {doc.contact.email && <p className="of-paper-muted">{doc.contact.email}</p>}
                </div>
              </div>
              <div className="of-paper-letter">
                <p className="of-paper-salutation">{doc.salutation}</p>
                {paragraphs(doc.intro)}
              </div>
              {notes.length > 0 && (
                <section className="of-paper-notes">
                  <h3>{L.highlights}</h3>
                  <ol>
                    {notes.map((n, i) => {
                      const m = n.match(/^([^:]{2,40}):\s+(.+)$/);
                      return (
                        <li key={i}>
                          <span className="of-paper-num">{i + 1}</span>
                          <span>
                            {m && <strong>{m[1]}: </strong>}
                            {m ? m[2] : n}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}
            </div>
            <Footer />
          </article>

          {/* Seite 2 */}
          <article className="of-paper" lang={doc.lang}>
            <div className="of-paper-body">
              <div className="of-paper-offerhead">
                <div>
                  <span className="of-paper-accent" aria-hidden="true" />
                  <h2>{doc.offerHeading}</h2>
                  <p className="of-paper-muted">
                    {doc.number} · {L.validShort} {doc.validUntilText}
                  </p>
                </div>
                <Elev8Logo height={20} />
              </div>
              <table className="of-paper-table">
                <thead>
                  <tr>
                    <th>{L.position}</th>
                    <th>{L.qty}</th>
                    <th>{L.unitPrice}</th>
                    {doc.hasDiscount && <th>{L.discount}</th>}
                    <th>{L.interval}</th>
                    <th>{L.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className="of-paper-strong">{l.title}</span>
                        {l.detail && <span className="of-paper-detail">{l.detail}</span>}
                      </td>
                      <td>
                        {l.qtyText}
                        {l.unitText && <span className="of-paper-unit">{l.unitText}</span>}
                      </td>
                      <td>{l.unitPriceText}</td>
                      {doc.hasDiscount && <td>{l.discountText}</td>}
                      <td>{l.intervalText}</td>
                      <td>
                        <span className="of-paper-strong">{l.totalText}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {doc.totals.length > 0 && (
                <dl className="of-paper-totals">
                  {doc.totals.map((row, i) => (
                    <div
                      key={i}
                      className={i === doc.totals.length - 1 && row.strong ? "is-hero" : row.strong ? "is-strong" : undefined}
                    >
                      <dt>{row.label}</dt>
                      <dd>{row.text}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {doc.accept && (
                <a
                  href={doc.accept.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: 27,
                    padding: "17px 24px",
                    background: "#0e0e0e",
                    textDecoration: "none"
                  }}
                >
                  <span style={{ display: "grid", gap: 3 }}>
                    <strong style={{ color: "#f6bb12", fontSize: 17.3 }}>{doc.accept.label}</strong>
                    <span style={{ color: "#a3a3a3", fontSize: 11.3 }}>{doc.accept.sub}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 20, background: "#f6bb12", color: "#000", fontSize: 20, fontWeight: 700 }}
                  >
                    →
                  </span>
                </a>
              )}
              <div className="of-paper-letter">{paragraphs(doc.closing)}</div>
              <section className="of-paper-steps">
                <h3>{L.nextSteps}</h3>
                <ol>
                  {doc.steps.map((step, i) => (
                    <li key={i}>
                      <span className="of-paper-stepnum">{String(i + 1).padStart(2, "0")}</span>
                      <strong>{step.title}</strong>
                      <span>{step.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
              {doc.assistant && (
                <section className="of-paper-questions">
                  <div>
                    <h3>{L.questions}</h3>
                    <p>{doc.assistant.text.replace(/:$/, ".")}</p>
                    <p style={{ marginTop: 3, color: "#ffffff", fontSize: "11.3px", lineHeight: 1.5 }}>{doc.assistant.tip}</p>
                  </div>
                  <a href={doc.assistant.link} target="_blank" rel="noreferrer" className="of-paper-wa">
                    <span>{L.whatsappCta.replace("{name}", doc.assistantName)}</span>
                    <strong>{doc.assistant.phone}</strong>
                    <span>{L.available}</span>
                  </a>
                </section>
              )}
              <section className="of-paper-terms">
                <p className="of-paper-label">{L.terms}</p>
                {doc.reverseCharge && <p className="of-paper-strong of-paper-tax">{doc.taxNote}</p>}
                <p className="of-paper-muted">{doc.terms}</p>
              </section>
            </div>
            <Footer />
          </article>
        </div>
      </div>
    </div>
  );
}
