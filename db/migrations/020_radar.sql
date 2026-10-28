-- Radar: Quellen (heute Slack, später WhatsApp u.a.) täglich auswerten und in „Mein Tag“ melden.
-- Pro Person eigene Einstellungen, Verbindungen und Einträge.

CREATE TABLE IF NOT EXISTS radar_settings (
  user_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  run_hour smallint NOT NULL DEFAULT 5 CHECK (run_hour BETWEEN 0 AND 23),
  timezone text NOT NULL DEFAULT 'Europe/Zurich',
  interests text NOT NULL DEFAULT '',
  locale text NOT NULL DEFAULT 'de',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Eine Verbindung = eine Quelle einer Person (z.B. Slack-Workspace mit Channel-Auswahl).
-- secret ist verschlüsselt (platform/crypto), config enthält nur Unkritisches (Channels, Workspace-Adresse).
CREATE TABLE IF NOT EXISTS radar_connections (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  kind text NOT NULL,
  label text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS radar_connections_user ON radar_connections (user_id);

-- Eingang und Bewertung in einer Tabelle: Quellen liefern Rohnachrichten (Abruf oder Push),
-- der tägliche Lauf bewertet alles mit triaged_at IS NULL.
CREATE TABLE IF NOT EXISTS radar_messages (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  connection_id bigint NOT NULL REFERENCES radar_connections (id) ON DELETE CASCADE,
  kind text NOT NULL,
  external_id text NOT NULL,
  channel text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  posted_at timestamptz NOT NULL,
  body text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '',
  url text,
  thread_id text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  triaged_at timestamptz,
  relevant boolean,
  relevance text,
  category text,
  title text,
  summary text,
  recommendation text,
  reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'discarded')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);
CREATE INDEX IF NOT EXISTS radar_messages_open ON radar_messages (user_id, status, relevant, posted_at DESC);
CREATE INDEX IF NOT EXISTS radar_messages_pending ON radar_messages (user_id) WHERE triaged_at IS NULL;

-- Ein Lauf pro Person und Tag (lokales Datum der Person)
CREATE TABLE IF NOT EXISTS radar_runs (
  user_id text NOT NULL,
  run_date date NOT NULL,
  attempts int NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  collected int NOT NULL DEFAULT 0,
  relevant int NOT NULL DEFAULT 0,
  error text,
  PRIMARY KEY (user_id, run_date)
);
