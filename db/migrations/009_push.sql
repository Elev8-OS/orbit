-- Push-Mitteilungen: Geräte, Einstellungen pro Person, Versandprotokoll gegen Doppelte und Mitteilungen der Administration.

-- Schlüsselpaar für Web Push (VAPID). Wird beim ersten Gebrauch erzeugt, nie geändert (sonst müssen sich alle Geräte neu anmelden).
CREATE TABLE IF NOT EXISTS push_keys (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_jwk JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ein Eintrag pro Gerät und Browser, auf dem jemand Mitteilungen erlaubt hat.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  fail_count      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Was jemand bekommen möchte. Fehlende Kategorien gelten als eingeschaltet.
CREATE TABLE IF NOT EXISTS push_prefs (
  user_id       TEXT PRIMARY KEY,
  categories    JSONB NOT NULL DEFAULT '{}'::jsonb,
  myday_hour    INTEGER NOT NULL DEFAULT 8 CHECK (myday_hour BETWEEN 0 AND 23),
  myday_weekend BOOLEAN NOT NULL DEFAULT false,
  tz            TEXT NOT NULL DEFAULT 'Europe/Zurich',
  locale        TEXT NOT NULL DEFAULT 'de',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Schon gesendet (oder bewusst übersprungen): verhindert Doppelte, z.B. dasselbe Ticket oder zweimal Mein Tag.
CREATE TABLE IF NOT EXISTS push_log (
  user_id TEXT NOT NULL,
  key     TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Mitteilungen der Administration an alle, an Rollen oder an einzelne Personen.
CREATE TABLE IF NOT EXISTS push_broadcasts (
  id           BIGSERIAL PRIMARY KEY,
  created_by   TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  url          TEXT,
  audience     JSONB NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ,
  recipients   INTEGER,
  devices      INTEGER,
  delivered    INTEGER,
  failed       INTEGER,
  cancelled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_broadcasts_due_idx ON push_broadcasts (scheduled_at) WHERE sent_at IS NULL AND cancelled_at IS NULL;
