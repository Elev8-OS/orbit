"use client";

import type { QuoteDocument } from "@/lib/offerten/document";

/** Tabellenansicht, die dem erzeugten Excel entspricht (gleiche Spalten, Werte und Totale). */
export function XlsxPreview({ doc }: { doc: QuoteDocument }) {
  const L = doc.labels;
  return (
    <div className="of-sheet-wrap">
      <table className="of-sheet">
        <thead>
          <tr className="of-sheet-cols">
            <th aria-hidden="true" />
            {["A", "B", "C", "D", "E", "F", "G", "H"].map((c) => (
              <th key={c} aria-hidden="true">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="of-sheet-rn">1</td>
            <td colSpan={4} className="of-sheet-strong of-sheet-big">
              {doc.issuer.company || "Elev8 Suite"}
            </td>
            <td colSpan={4} className="of-sheet-strong of-sheet-right">
              {L.document} {doc.number}
            </td>
          </tr>
          {(
            [
              [L.for, [doc.recipient.company, doc.recipient.name].filter(Boolean).join(", ")],
              [L.date, doc.dateText],
              [L.validUntil, doc.validUntilText]
            ] as [string, string][]
          ).map(([k, v], i) => (
            <tr key={k}>
              <td className="of-sheet-rn">{i + 2}</td>
              <td className="of-sheet-muted">{k}</td>
              <td colSpan={7} className="of-sheet-strong">
                {v}
              </td>
            </tr>
          ))}
          <tr className="of-sheet-head">
            <td className="of-sheet-rn">5</td>
            <td>{L.position}</td>
            <td />
            <td className="of-sheet-right">{L.qty}</td>
            <td />
            <td className="of-sheet-right">{L.unitPrice}</td>
            <td className="of-sheet-right">{L.discount} %</td>
            <td>{L.interval}</td>
            <td className="of-sheet-right">{L.total}</td>
          </tr>
          {doc.lines.map((l, i) => (
            <tr key={l.id}>
              <td className="of-sheet-rn">{i + 6}</td>
              <td className="of-sheet-strong">{l.title}</td>
              <td className="of-sheet-muted of-sheet-wrapcell">{l.detail}</td>
              <td className="of-sheet-right of-sheet-input">{l.qtyText}</td>
              <td>{l.unit}</td>
              <td className="of-sheet-right">{l.unitPriceText}</td>
              <td className="of-sheet-right of-sheet-input">{l.discountPercent || 0}</td>
              <td>{l.intervalText}</td>
              <td className="of-sheet-right of-sheet-strong of-sheet-formula" title="=C*E*(1-F/100)">
                {l.totalText}
              </td>
            </tr>
          ))}
          {doc.totals
            .filter((row) => row.strong)
            .map((row, i) => (
              <tr key={row.label}>
                <td className="of-sheet-rn">{doc.lines.length + 7 + i}</td>
                <td colSpan={6} />
                <td className="of-sheet-strong of-sheet-right">{row.label}</td>
                <td className="of-sheet-right of-sheet-strong of-sheet-input of-sheet-formula">{row.text}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
