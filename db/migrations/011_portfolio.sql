-- Portfolio-Modul (/portfolio): gemeinsam gepflegte Dokumente, Cache der Live-Quellen, Neubeurteilungen.

-- Kosten pro Wohnung, Gemeinkosten, Ziele, Einstellungen und Neubeurteilungen (collection + doc_id)
CREATE TABLE IF NOT EXISTS portfolio_docs (
  collection  TEXT NOT NULL,
  doc_id      TEXT NOT NULL,
  data        JSONB NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, doc_id)
);

-- Zwischenspeicher der Live-Quellen (Elev8, MyDataValue); fetched_at = 0 heisst: noch nie erfolgreich geladen
CREATE TABLE IF NOT EXISTS portfolio_cache (
  source      TEXT PRIMARY KEY,
  payload     JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  error       TEXT
);
