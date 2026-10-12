"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { QuoteDocument } from "@/lib/offerten/document";
import { Elev8Logo } from "@/components/Elev8Logo";

/**
 * Dokumentansicht der Offerte im Browser. Entspricht Aufbau und Inhalt des PDFs (gleiches Datenmodell),
 * funktioniert aber auf allen Geräten, auch dort, wo Browser PDFs nicht eingebettet anzeigen (z.B. Chrome auf Android).
 */
const PAGE_WIDTH = 794; // A4 bei 96 dpi, gleiche Proportionen wie das PDF

export function PaperPreview({ doc }: { doc: QuoteDocument }) {
  const L = doc.labels;
  // Das Blatt wird in A4-Grösse gesetzt und als Ganzes auf die verfügbare Breite skaliert,
  // damit die Vorschau auf Handy, Tablet und Desktop identisch aussieht.
  const frameRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(1123);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const paper = paperRef.current;
    if (!frame || !paper) return;
    const measure = () => {
      setScale(Math.min(1, frame.clientWidth / PAGE_WIDTH));
      setHeight(paper.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    ro.observe(paper);
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
  const contact = [doc.issuer.website, doc.issuer.email, doc.issuer.phone].filter(Boolean).join(" · ");

  return (
    <div className="of-paper-scroll">
      <div ref={frameRef} className="of-paper-frame" style={{ height: height * scale }}>
      <article ref={paperRef} className="of-paper" lang={doc.lang} style={{ transform: `scale(${scale})` }}>
        <header className="of-paper-head">
          <Elev8Logo height={34} />
          <div className="of-paper-titleblock">
            <h2>{L.document}</h2>
            <p>{doc.number}</p>
          </div>
        </header>

        <div className="of-paper-meta">
          <div>
            <p className="of-paper-label">{L.for}</p>
            {doc.recipient.company && <p className="of-paper-strong">{doc.recipient.company}</p>}
            {doc.recipient.name && <p className={doc.recipient.company ? "" : "of-paper-strong"}>{doc.recipient.name}</p>}
            {doc.recipient.addressLines.filter(Boolean).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            {doc.recipient.email && <p className="of-paper-muted">{doc.recipient.email}</p>}
          </div>
          <dl>
            <div>
              <dt>{L.number}</dt>
              <dd>{doc.number}</dd>
            </div>
            <div>
              <dt>{L.date}</dt>
              <dd suppressHydrationWarning>{doc.dateText}</dd>
            </div>
            <div>
              <dt>{L.validUntil}</dt>
              <dd>{doc.validUntilText}</dd>
            </div>
            {(doc.contact.name || doc.contact.email) && (
              <div>
                <dt>{L.contact}</dt>
                <dd>
                  {doc.contact.name}
                  {doc.contact.email && <span className="of-paper-muted">{doc.contact.email}</span>}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <span className="of-paper-accent" aria-hidden="true" />
        <div className="of-paper-text">{paragraphs(doc.intro)}</div>

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
                <td className="of-paper-strong">{l.totalText}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {doc.totals.length > 0 && (
          <dl className="of-paper-totals">
            {doc.totals.map((row, i) => (
              <div key={i} className={row.strong ? "is-strong" : undefined}>
                <dt>{row.label}</dt>
                <dd>{row.text}</dd>
              </div>
            ))}
          </dl>
        )}

        {notes.length > 0 && (
          <section className="of-paper-section">
            <h3>{L.notes}</h3>
            <ul>
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="of-paper-section">
          <h3>{L.terms}</h3>
          <p className="of-paper-muted">{doc.terms}</p>
        </section>
        <div className="of-paper-text">{paragraphs(doc.closing)}</div>

        {(footer || contact) && (
          <footer className="of-paper-footer">
            {footer && <p>{footer}</p>}
            {contact && <p>{contact}</p>}
          </footer>
        )}
      </article>
      </div>
    </div>
  );
}
