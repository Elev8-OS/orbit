-- Offerten v2: Calls als erledigt markieren, Nachverfolgung, Kontaktperson aus GHL,
-- neue Absenderadresse und Coins (noch nicht produktiv) aus der Preisliste entfernen.

-- Calls: neuer Status "dismissed" (von Hand als "kein Angebot nötig" markiert)
ALTER TABLE quote_meetings DROP CONSTRAINT IF EXISTS quote_meetings_status_check;
ALTER TABLE quote_meetings ADD CONSTRAINT quote_meetings_status_check
  CHECK (status IN ('processing', 'no_offer', 'uncertain', 'quote_created', 'internal', 'error', 'dismissed'));
ALTER TABLE quote_meetings ADD COLUMN IF NOT EXISTS dismissed_by TEXT;
ALTER TABLE quote_meetings ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
ALTER TABLE quote_meetings ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- Nachverfolgung versendeter Offerten
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS follow_up_at DATE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'open';
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_outcome_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_outcome_check CHECK (outcome IN ('open', 'won', 'lost'));
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS outcome_note TEXT;

-- Bereits versendete Offerten: erstes Nachfassen 4 Tage nach Versand
UPDATE quotes SET follow_up_at = (sent_at + interval '4 days')::date
  WHERE status = 'sent' AND follow_up_at IS NULL AND sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS quotes_follow_up_idx ON quotes (follow_up_at) WHERE status = 'sent' AND outcome = 'open';

-- Ansprechperson auf dem Dokument (Owner des Kontakts in GHL: Name, E-Mail, Telefon)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contact_person JSONB;

-- Gespeicherte Einstellungen anpassen: Absender Elev8 Software AG, Coins entfernen
UPDATE quote_settings
SET value = jsonb_set(
      jsonb_set(value, '{issuer}', value->'issuer' || jsonb_build_object(
        'company', 'Elev8 Software AG',
        'addressLines', jsonb_build_array('Hauptgasse 33', 'CH-4600 Olten'),
        'taxId', 'UID CHE-398.140.212'
      )),
      '{addons}',
      COALESCE((SELECT jsonb_agg(a) FROM jsonb_array_elements(value->'addons') a WHERE a->>'id' <> 'coins'), '[]'::jsonb)
    ),
    updated_at = now(),
    updated_by = 'migration 006'
WHERE key = 'config';
