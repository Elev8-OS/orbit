-- Webinar-Portal (webinar.elev8-suite.com) und Admin-Modul /webinare.
-- Orbit legt die Tabellen an; das Portal (eigener Railway-Service) nutzt dieselbe Datenbank.

CREATE TABLE IF NOT EXISTS webinar_webinars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  description_de TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  speaker TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  published BOOLEAN NOT NULL DEFAULT FALSE,            -- im Kalender sichtbar, Anmeldung offen
  ghl_tag_base TEXT NOT NULL,                          -- z. B. webinar-2026-11-02-journey
  teams_webinar_id TEXT,                               -- Graph virtualEvents/webinars/{id}
  teams_join_url TEXT,                                 -- Rückfall, falls keine persönliche Teams-Anmeldung möglich
  attendance_finalized_at TIMESTAMPTZ,
  attendance_note TEXT,
  bunny_video_de TEXT,
  bunny_video_en TEXT,
  fireflies_id TEXT,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{start,end,speaker,de,en}]
  transcript_offset_sec NUMERIC NOT NULL DEFAULT 0,
  chapters JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{start,de,en}]
  summary_de TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  takeaways JSONB NOT NULL DEFAULT '{"de":[],"en":[]}'::jsonb,
  checklist JSONB NOT NULL DEFAULT '{"de":[],"en":[]}'::jsonb,
  teaser_start_sec INT,
  teaser_end_sec INT,
  recording_published_at TIMESTAMPTZ,
  dubbing_id TEXT,
  dubbing_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webinar_people (
  email TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'de',
  live_ever BOOLEAN NOT NULL DEFAULT FALSE,           -- Archiv-Schlüssel
  is_customer BOOLEAN NOT NULL DEFAULT FALSE,
  customer_checked_at TIMESTAMPTZ,
  ghl_contact_id TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webinar_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id UUID NOT NULL REFERENCES webinar_webinars(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  pms TEXT NOT NULL DEFAULT '',
  units TEXT NOT NULL DEFAULT '',
  newsletter BOOLEAN NOT NULL DEFAULT FALSE,
  lang TEXT NOT NULL DEFAULT 'de',
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'missed')),
  attended_seconds INT,
  join_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  join_clicked_at TIMESTAMPTZ,
  teams_registration_id TEXT,
  teams_join_url TEXT,
  ghl_contact_id TEXT,
  ghl_status TEXT,
  ghl_error TEXT,
  source TEXT NOT NULL DEFAULT 'portal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (webinar_id, email)
);
CREATE INDEX IF NOT EXISTS webinar_registrations_email ON webinar_registrations (email);

CREATE TABLE IF NOT EXISTS webinar_otp (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webinar_otp_email ON webinar_otp (email, created_at DESC);

CREATE TABLE IF NOT EXISTS webinar_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id UUID NOT NULL REFERENCES webinar_webinars(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'faq', 'rejected')),
  answer_at_sec INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webinar_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('topic', 'date')),
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  description_de TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed')),
  allow_suggestions BOOLEAN NOT NULL DEFAULT TRUE,
  show_results BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS webinar_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES webinar_polls(id) ON DELETE CASCADE,
  label_de TEXT NOT NULL DEFAULT '',
  label_en TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected')),
  suggested_by TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webinar_poll_votes (
  option_id UUID NOT NULL REFERENCES webinar_poll_options(id) ON DELETE CASCADE,
  poll_id UUID NOT NULL REFERENCES webinar_polls(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (option_id, device_id)
);

CREATE TABLE IF NOT EXISTS webinar_poll_contacts (
  poll_id UUID NOT NULL REFERENCES webinar_polls(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'de',
  consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, email)
);

CREATE TABLE IF NOT EXISTS webinar_progress (
  email TEXT NOT NULL,
  webinar_id UUID NOT NULL REFERENCES webinar_webinars(id) ON DELETE CASCADE,
  position_sec INT NOT NULL DEFAULT 0,
  max_sec INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, webinar_id)
);
