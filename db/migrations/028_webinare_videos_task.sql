-- Auftragsart für den Render-Dienst: render (Video) oder prepare / prepare-all (Ton wortgenau transkribieren, Füllwörter markieren)
ALTER TABLE webinar_videos ADD COLUMN IF NOT EXISTS task text NOT NULL DEFAULT 'render';
