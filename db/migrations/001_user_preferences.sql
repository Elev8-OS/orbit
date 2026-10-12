-- Persönliche Einstellungen pro Entra-User (Object ID)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id     TEXT PRIMARY KEY,
  tile_order  TEXT[]      NOT NULL DEFAULT '{}',
  locale      TEXT        CHECK (locale IN ('de', 'en')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
