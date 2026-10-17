-- Messen: Seite auf der eigenen Website (WordPress), in die das Gewinnspiel eingebettet ist.
-- Ist sie gesetzt, zeigt der QR-Code dorthin statt auf /m/<slug>.
ALTER TABLE messe_events ADD COLUMN IF NOT EXISTS website_url TEXT NOT NULL DEFAULT '';
