-- Messen: Gewinnspiel-Landingpages und Leads (Modul /messen, öffentliche Seite /m/<slug>)
CREATE TABLE IF NOT EXISTS messe_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  lang          TEXT NOT NULL DEFAULT 'de' CHECK (lang IN ('de', 'en')),
  dates_label   TEXT NOT NULL DEFAULT '',
  booth         TEXT NOT NULL DEFAULT '',
  time_zone     TEXT NOT NULL DEFAULT 'Asia/Makassar',
  prize_title   TEXT NOT NULL DEFAULT '',
  prize_detail  TEXT NOT NULL DEFAULT '',
  draw_at       TIMESTAMPTZ,
  demo_url      TEXT NOT NULL DEFAULT 'https://elev8-suite.com',
  terms_url     TEXT NOT NULL DEFAULT '',
  privacy_url   TEXT NOT NULL DEFAULT '',
  meta_pixel_id TEXT NOT NULL DEFAULT '',
  google_tag_id TEXT NOT NULL DEFAULT '',
  linkedin_partner_id TEXT NOT NULL DEFAULT '',
  ghl_tags      TEXT[] NOT NULL DEFAULT '{}',
  active        BOOLEAN NOT NULL DEFAULT false,
  created_by    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messe_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES messe_events(id) ON DELETE CASCADE,
  ticket            TEXT NOT NULL,
  name              TEXT NOT NULL,
  preferred_channel TEXT NOT NULL CHECK (preferred_channel IN ('whatsapp', 'email')),
  whatsapp          TEXT NOT NULL DEFAULT '',
  email             TEXT NOT NULL DEFAULT '',
  units             TEXT NOT NULL DEFAULT '',
  airbnb_url        TEXT NOT NULL DEFAULT '',
  airbnb_listing_id TEXT NOT NULL DEFAULT '',
  airbnb_host_id    TEXT NOT NULL DEFAULT '',
  score             INTEGER NOT NULL DEFAULT 0,
  tier              TEXT NOT NULL DEFAULT 'cold',
  consent_marketing BOOLEAN NOT NULL DEFAULT false,
  source            TEXT NOT NULL DEFAULT '',
  utm               JSONB NOT NULL DEFAULT '{}'::jsonb,
  lang              TEXT NOT NULL DEFAULT 'de',
  submitted_at      TIMESTAMPTZ,
  ghl_status        TEXT NOT NULL DEFAULT 'pending' CHECK (ghl_status IN ('pending', 'ok', 'error', 'skipped')),
  ghl_contact_id    TEXT,
  ghl_error         TEXT,
  winner_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, ticket)
);

CREATE INDEX IF NOT EXISTS messe_leads_event_idx ON messe_leads (event_id, created_at DESC);
