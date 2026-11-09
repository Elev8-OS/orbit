-- Erklärvideos aus Webinar-Aufzeichnungen: Schnittliste (plan), Render-Auftrag und Ergebnis.
-- Der Render-Dienst (renderer/) holt Aufträge mit status = 'queued' und schreibt Fortschritt und Ergebnis zurück.

CREATE TABLE IF NOT EXISTS webinar_videos (
  webinar_id UUID PRIMARY KEY REFERENCES webinar_webinars(id) ON DELETE CASCADE,
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,           -- Titel, Kapitel mit Clips (Sekunden im Video), Kernaussagen, YouTube-Texte
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'rendering', 'done', 'failed')),
  progress INT NOT NULL DEFAULT 0,
  message TEXT,                                       -- Fortschritt oder Fehlermeldung
  attempts INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,                     -- zählt fertige Renderings, Teil des Dateinamens
  file_key TEXT,                                      -- MP4 im Bucket
  thumb_key TEXT,                                     -- YouTube-Vorschaubild im Bucket
  result JSONB,                                       -- { durationSec, size, chapters: [{ title, at }] } nach dem Schnitt
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webinar_videos_queue ON webinar_videos (status, queued_at);
