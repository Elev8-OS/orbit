-- Login-Protokoll des Webinar-Portals: ein Eintrag pro erfolgreichem Login (E-Mail-Code).
-- Gerät nur grob (z. B. „iPhone · Safari“), keine IP-Adresse. Einträge älter als 12 Monate löscht Orbit beim Anzeigen.

CREATE TABLE IF NOT EXISTS webinar_logins (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'portal'          -- portal | nachgetragen
);

CREATE INDEX IF NOT EXISTS webinar_logins_at_idx ON webinar_logins (at DESC);
CREATE INDEX IF NOT EXISTS webinar_logins_email_idx ON webinar_logins (email, at DESC);

-- Bisherige Logins aus den benutzten Login-Codes nachtragen (Zeitpunkt der Code-Anfrage, wenige Minuten vor dem Login)
INSERT INTO webinar_logins (email, at, source)
SELECT email, created_at, 'nachgetragen' FROM webinar_otp WHERE used;
