-- Signierschlüssel für den Orbit-Pass (ES256). Wird beim ersten Bedarf automatisch erzeugt.
-- Der private Schlüssel verlässt Orbit nie; die Tools prüfen mit dem öffentlichen Schlüssel (JWKS).
CREATE TABLE IF NOT EXISTS signing_keys (
  kid          TEXT        PRIMARY KEY,
  private_pkcs8 TEXT       NOT NULL,
  public_jwk   JSONB       NOT NULL,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
