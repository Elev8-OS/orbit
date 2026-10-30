-- Offerten: Annahme durch den Kunden per Link und Onboarding-Checkliste danach.

-- Geheimer Link pro Offerte (64 Hex-Zeichen), damit der Kunde ohne Login annehmen kann.
-- Bestehende Offerten erhalten ebenfalls einen Link.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accept_token TEXT;
UPDATE quotes
SET accept_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE accept_token IS NULL;
ALTER TABLE quotes ALTER COLUMN accept_token
  SET DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
ALTER TABLE quotes ALTER COLUMN accept_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quotes_accept_token_idx ON quotes (accept_token);

-- Annahme: Zeitpunkt und Nachweis (Name, Firma, Rechnungsadresse, Zustimmung, IP, Browser)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acceptance JSONB;

-- Onboarding-Checkliste pro angenommener Offerte. Der Kunde öffnet sie über token ohne Login,
-- das Team in Orbit. items: [{ id, phase, title, detail, owner, link, done, doneAt, doneBy }]
CREATE TABLE IF NOT EXISTS onboardings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       UUID NOT NULL UNIQUE REFERENCES quotes (id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE
                 DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  language       TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),
  address_form   TEXT NOT NULL DEFAULT 'sie' CHECK (address_form IN ('du', 'sie')),
  company        TEXT,
  contact_name   TEXT,
  contact_email  TEXT,
  ghl_contact_id TEXT,
  owner_name     TEXT,
  owner_email    TEXT,
  items          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'live')),
  live_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS onboardings_status_idx ON onboardings (status, created_at DESC);
