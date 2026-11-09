"use client";

import { useState } from "react";

/** Text zum Übernehmen (z. B. nach YouTube): Feld mit Beschriftung und Kopieren-Knopf. */
export function CopyField({ label, text, rows = 1 }: { label: string; text: string; rows?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="wb-copy">
      <div className="wb-copy-head">
        <span>{label}</span>
        <button
          type="button"
          className="me-btn me-btn-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              /* Feld ist markierbar */
            }
          }}
        >
          {copied ? "Kopiert" : "Kopieren"}
        </button>
      </div>
      {rows > 1 ? (
        <textarea readOnly value={text} rows={rows} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      ) : (
        <input readOnly value={text} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  );
}
