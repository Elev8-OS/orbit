-- Sales-App: Status der Calls (nächster Schritt gesetzt oder bewusst keiner) und Follow-up-Vorschläge von Claude.
-- Kontakte, Opportunities, Tasks und Termine bleiben in GHL und werden nicht gespiegelt.

CREATE TABLE IF NOT EXISTS sales_call_marks (
  meeting_id   TEXT PRIMARY KEY,
  state        TEXT NOT NULL CHECK (state IN ('followup_set', 'dismissed')),
  ghl_task_id  TEXT,
  ghl_contact_id TEXT,
  by_email     TEXT,
  at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_suggestions (
  meeting_id   TEXT PRIMARY KEY,
  suggestion   JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
