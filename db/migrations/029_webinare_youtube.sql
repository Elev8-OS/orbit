-- YouTube-Kanal für die Erklärvideos (eine Verbindung für alle) und der Upload-Stand pro Video
CREATE TABLE IF NOT EXISTS youtube_connection (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  channel_id text NOT NULL,
  channel_title text NOT NULL,
  refresh_token text NOT NULL, -- verschlüsselt (src/lib/platform/crypto.ts)
  connected_by text,
  connected_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE webinar_videos ADD COLUMN IF NOT EXISTS youtube jsonb;
