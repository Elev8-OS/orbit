-- Scan: Visitenkarten-Scanner (Modul /scan). Team-weite Historie der Scans, pro Person und optional pro Messe.
CREATE TABLE IF NOT EXISTS scan_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  user_name       TEXT NOT NULL DEFAULT '',
  user_email      TEXT NOT NULL DEFAULT '',
  event_id        UUID REFERENCES messe_events(id) ON DELETE SET NULL,
  contact_id      TEXT,
  is_new          BOOLEAN NOT NULL DEFAULT true,
  name            TEXT NOT NULL DEFAULT '',
  company         TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  tags            TEXT[] NOT NULL DEFAULT '{}',
  source_type     TEXT NOT NULL DEFAULT 'business_card',
  photos          INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_history_created_idx ON scan_history (created_at DESC);
CREATE INDEX IF NOT EXISTS scan_history_user_idx ON scan_history (user_id, created_at DESC);
