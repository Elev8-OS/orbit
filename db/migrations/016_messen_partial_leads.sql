-- Messen: Leads werden nach dem ersten Schritt (Kontakt) angelegt und danach ergänzt.
-- edit_token: zufälliger Schlüssel des Browsers, nur damit darf derselbe Lead ergänzt werden.
-- completed: alle Schritte durchlaufen.
ALTER TABLE messe_leads ADD COLUMN IF NOT EXISTS edit_token TEXT NOT NULL DEFAULT '';
ALTER TABLE messe_leads ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE messe_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE messe_leads ALTER COLUMN completed SET DEFAULT false;
