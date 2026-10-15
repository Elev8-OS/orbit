-- Portfolio-Modul: eigene Anmeldung bei myDataValue (offizieller MCP-Server, OAuth mit automatischer Registrierung).
-- Inhalte sind mit ORBIT_ENCRYPTION_KEY bzw. AUTH_SECRET verschlüsselt (src/lib/platform/crypto.ts).
-- Zeilen: 'mdv_client' (registrierter Client), 'mdv_tokens' (rotierender Refresh-Token), 'mdv_pending:<state>' (laufende Anmeldung)
CREATE TABLE IF NOT EXISTS portfolio_oauth (
  id          TEXT PRIMARY KEY,
  data        TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
