-- Plattform-Ausbau: Benutzerverzeichnis, Protokoll, Nutzung, Statusseite, Kunden-Briefings und
-- der persönliche E-Mail-Assistent (Moneypenny für alle).

-- Wer war wann in Orbit und mit welchen Rollen (für die Administration). Wird bei jedem Besuch aktualisiert.
CREATE TABLE IF NOT EXISTS user_directory (
  user_id       TEXT PRIMARY KEY,
  name          TEXT,
  email         TEXT,
  roles         TEXT[]      NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_directory_seen_idx ON user_directory (last_seen_at DESC);

-- Protokoll aller Verwaltungsaktionen
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id    TEXT,
  actor_email TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  detail      JSONB
);
CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);

-- Zugriffsanfragen: wer hat entschieden und mit welcher Rolle
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS decided_by TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS granted_role TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS decision_note TEXT;
CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests (status, created_at DESC);

-- Nutzung: höchstens ein Eintrag pro Person, App und Stunde
CREATE TABLE IF NOT EXISTS app_usage (
  user_id  TEXT        NOT NULL,
  app_id   TEXT        NOT NULL,
  bucket   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, app_id, bucket)
);
CREATE INDEX IF NOT EXISTS app_usage_bucket_idx ON app_usage (bucket DESC);

-- Statusseite: aktueller Zustand je Dienst und Störungen
CREATE TABLE IF NOT EXISTS service_status (
  service_id   TEXT PRIMARY KEY,
  state        TEXT        NOT NULL DEFAULT 'unknown' CHECK (state IN ('up', 'degraded', 'down', 'unknown')),
  fail_count   INTEGER     NOT NULL DEFAULT 0,
  http_status  INTEGER,
  latency_ms   INTEGER,
  message      TEXT,
  checked_at   TIMESTAMPTZ,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_incidents (
  id          BIGSERIAL PRIMARY KEY,
  service_id  TEXT        NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  message     TEXT
);
CREATE INDEX IF NOT EXISTS service_incidents_open_idx ON service_incidents (service_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS service_incidents_started_idx ON service_incidents (started_at DESC);

-- Messpunkte für die Verfügbarkeit der letzten 30 Tage (einer pro Dienst und Prüfung)
CREATE TABLE IF NOT EXISTS service_samples (
  service_id  TEXT        NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok          BOOLEAN     NOT NULL,
  latency_ms  INTEGER
);
CREATE INDEX IF NOT EXISTS service_samples_idx ON service_samples (service_id, at DESC);

-- Kunden-360: Briefing von Noah, pro Kontakt zwischengespeichert
CREATE TABLE IF NOT EXISTS customer_briefings (
  contact_id  TEXT PRIMARY KEY,
  locale      TEXT        NOT NULL DEFAULT 'de',
  briefing    JSONB       NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E-Mail-Assistent: verbundenes Postfach pro Person (Refresh-Token verschlüsselt)
CREATE TABLE IF NOT EXISTS assistant_accounts (
  user_id         TEXT PRIMARY KEY,
  email           TEXT        NOT NULL,
  name            TEXT,
  enabled         BOOLEAN     NOT NULL DEFAULT true,
  refresh_token   TEXT        NOT NULL,
  locale          TEXT        NOT NULL DEFAULT 'de',
  style_notes     TEXT        NOT NULL DEFAULT '',
  signature       TEXT        NOT NULL DEFAULT '',
  skip_senders    TEXT        NOT NULL DEFAULT '',
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at     TIMESTAMPTZ,
  last_error      TEXT,
  last_error_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS assistant_items (
  id               BIGSERIAL PRIMARY KEY,
  user_id          TEXT        NOT NULL REFERENCES assistant_accounts(user_id) ON DELETE CASCADE,
  message_id       TEXT        NOT NULL,
  conversation_id  TEXT,
  subject          TEXT,
  from_name        TEXT,
  from_address     TEXT,
  received_at      TIMESTAMPTZ,
  web_link         TEXT,
  decision         TEXT        NOT NULL CHECK (decision IN ('reply', 'info', 'skip')),
  priority         TEXT        NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  summary          TEXT,
  reason           TEXT,
  draft_id         TEXT,
  draft_link       TEXT,
  draft_preview    TEXT,
  status           TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'discarded', 'error')),
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS assistant_items_user_idx ON assistant_items (user_id, status, created_at DESC);
