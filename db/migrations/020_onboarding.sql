-- Onboarding-App: Entwürfe aus Calls (oder von Hand), Verlauf und verarbeitete Calls
-- Der Entwurf legt nichts an. Erst "Senden" legt in Orbit 4 das Kundenkonto an und schickt die Einladung.

CREATE TABLE IF NOT EXISTS onboarding_drafts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'discarded')),
  source              TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('fireflies', 'manual')),
  meeting_id          TEXT,
  meeting_title       TEXT,
  meeting_date        TIMESTAMPTZ,
  -- Ergebnis der Call-Analyse (Wunsch erkannt, Begründung, Eckdaten)
  analysis            JSONB,
  ghl_contact_id      TEXT,
  ghl_opportunity_id  TEXT,
  -- Empfänger: Name, E-Mail, Firma, Telefon
  recipient           JSONB NOT NULL DEFAULT '{}'::jsonb,
  language            TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),
  -- Kunde möchte den Vertrag vor dem ersten Call
  contract_first      BOOLEAN NOT NULL DEFAULT false,
  -- Zuständig in Orbit 4: Owner des GHL-Kontakts; die E-Mail ordnet den Partner zu
  partner_name        TEXT,
  partner_email       TEXT,
  note                TEXT,
  -- Organisator des Calls bzw. wer den Entwurf angelegt hat
  owner_name          TEXT,
  owner_email         TEXT,
  sent_at             TIMESTAMPTZ,
  sent_by_name        TEXT,
  sent_by_email       TEXT,
  -- Antwort von Orbit 4 (Konto-ID, ob die Einladung rausging) und Ablage in GHL
  orbit_result        JSONB,
  ghl_sync            JSONB,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_drafts_status_idx ON onboarding_drafts (status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_drafts_meeting_idx ON onboarding_drafts (meeting_id) WHERE meeting_id IS NOT NULL AND status <> 'discarded';

CREATE TABLE IF NOT EXISTS onboarding_events (
  id          BIGSERIAL PRIMARY KEY,
  draft_id    UUID NOT NULL REFERENCES onboarding_drafts(id) ON DELETE CASCADE,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT,
  type        TEXT NOT NULL,
  detail      JSONB
);
CREATE INDEX IF NOT EXISTS onboarding_events_draft_idx ON onboarding_events (draft_id, at DESC);

-- Jeder von Fireflies gemeldete Call genau einmal prüfen; auch Calls ohne Onboarding-Wunsch für die Übersicht
CREATE TABLE IF NOT EXISTS onboarding_meetings (
  meeting_id    TEXT PRIMARY KEY,
  title         TEXT,
  meeting_date  TIMESTAMPTZ,
  organizer     TEXT,
  status        TEXT NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing', 'no_onboarding', 'uncertain', 'draft_created', 'internal', 'error')),
  reason        TEXT,
  analysis      JSONB,
  draft_id      UUID REFERENCES onboarding_drafts(id) ON DELETE SET NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS onboarding_meetings_received_idx ON onboarding_meetings (received_at DESC);
