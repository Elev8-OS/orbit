-- Nachlieferungen zu einem Webinar: im Webinar versprochene Unterlagen (aus dem Transkript gelesen oder von Hand),
-- je mit Datei (Railway-Bucket) oder Link. Erledigte erscheinen im Portal auf der Aufzeichnungsseite.

CREATE TABLE IF NOT EXISTS webinar_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id UUID NOT NULL REFERENCES webinar_webinars(id) ON DELETE CASCADE,
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',                -- was im Webinar gesagt wurde
  at_sec NUMERIC,                                -- Stelle im Transkript
  source TEXT NOT NULL DEFAULT 'manual',         -- transcript | manual
  status TEXT NOT NULL DEFAULT 'open',           -- open | done | dismissed
  file_key TEXT,                                 -- Schlüssel im Bucket
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  link_url TEXT,
  delivered_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_deliverables_webinar_idx ON webinar_deliverables (webinar_id, sort_order, created_at);
