-- Zugriffsanfragen (Grundlage für die spätere Admin-Oberfläche)
CREATE TABLE IF NOT EXISTS access_requests (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  user_name   TEXT,
  user_email  TEXT,
  app_id      TEXT        NOT NULL,
  message     TEXT,
  status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_requests_user_created ON access_requests (user_id, created_at DESC);

-- Erster Besuch und Willkommensmail
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS welcomed_at TIMESTAMPTZ;
