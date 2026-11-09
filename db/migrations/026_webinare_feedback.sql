-- Feedback zur Aufzeichnung (Bewertung 1–5, Kommentar, Themenwunsch) und Zeitpunkt der Unterlagen-Benachrichtigung.

CREATE TABLE IF NOT EXISTS webinar_feedback (
  webinar_id UUID NOT NULL REFERENCES webinar_webinars(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  wish TEXT NOT NULL DEFAULT '',                 -- Thema fürs nächste Webinar
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (webinar_id, email)
);

ALTER TABLE webinar_webinars ADD COLUMN IF NOT EXISTS materials_notified_at TIMESTAMPTZ;
