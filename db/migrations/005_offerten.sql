-- Offerten-App: Offerten, Verlauf, verarbeitete Calls und Einstellungen (Preise, Absender, Texte)

CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

CREATE TABLE IF NOT EXISTS quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number          TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'discarded')),
  language        TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),
  currency        TEXT NOT NULL DEFAULT 'USD',
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('fireflies', 'manual')),
  meeting_id      TEXT,
  meeting_title   TEXT,
  meeting_date    TIMESTAMPTZ,
  -- Ergebnis der Call-Analyse (Wunsch erkannt, Begründung, extrahierte Eckdaten)
  analysis        JSONB,
  ghl_contact_id      TEXT,
  ghl_opportunity_id  TEXT,
  ghl_pipeline_id     TEXT,
  -- Empfänger: Name, E-Mail, Firma, Adresse
  recipient       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Konfigurator (Modell, Units, Zahlungsrhythmus, Paket, Channel Manager, Coins)
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Positionen in Anzeigereihenfolge
  lines           JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Einleitung, Schluss, Hinweise
  texts           JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_until     DATE NOT NULL,
  owner_id        TEXT,
  owner_name      TEXT,
  owner_email     TEXT,
  sent_at         TIMESTAMPTZ,
  sent_by_name    TEXT,
  sent_by_email   TEXT,
  sent_formats    TEXT[],
  sent_to         TEXT[],
  -- Ablage in GHL: Ergebnis pro Schritt
  ghl_sync        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes (status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS quotes_meeting_idx ON quotes (meeting_id) WHERE meeting_id IS NOT NULL AND status <> 'discarded';

CREATE TABLE IF NOT EXISTS quote_events (
  id          BIGSERIAL PRIMARY KEY,
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT,
  type        TEXT NOT NULL,
  detail      JSONB
);
CREATE INDEX IF NOT EXISTS quote_events_quote_idx ON quote_events (quote_id, at DESC);

-- Jeder von Fireflies gemeldete Call genau einmal; auch Calls ohne Offertwunsch für die Übersicht
CREATE TABLE IF NOT EXISTS quote_meetings (
  meeting_id    TEXT PRIMARY KEY,
  title         TEXT,
  meeting_date  TIMESTAMPTZ,
  organizer     TEXT,
  status        TEXT NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing', 'no_offer', 'uncertain', 'quote_created', 'internal', 'error')),
  reason        TEXT,
  analysis      JSONB,
  quote_id      UUID REFERENCES quotes(id) ON DELETE SET NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS quote_meetings_received_idx ON quote_meetings (received_at DESC);

CREATE TABLE IF NOT EXISTS quote_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT
);
