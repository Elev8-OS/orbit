-- GRO Service (Modul /gro): mandantenfähiges Arbeitswerkzeug für Guest Relations Officer.
-- Jeder Mandant hat eigenen Elev8-Zugang, eigene Prozesse, Regeln, Vorlagen, Objekt-Ergänzungen und Entscheide.
-- Der Mandant mit is_template = true ist die Vorlagen-Bibliothek, aus der neue Mandanten übernehmen.

CREATE TABLE IF NOT EXISTS gro_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name text NOT NULL,
  is_template boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  elev8_url text,                                  -- leer = https://mcp.elev8-suite.com
  elev8_token text,                                -- verschlüsselt (src/lib/platform/crypto.ts)
  listing_tags text[] NOT NULL DEFAULT '{}',       -- nur Listings mit einem dieser Elev8-Tags (leer = alle)
  base_guests integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_members (
  tenant_id uuid NOT NULL REFERENCES gro_tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  can_see_codes boolean NOT NULL DEFAULT false,
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS gro_constants (
  tenant_id uuid NOT NULL REFERENCES gro_tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  num numeric,
  unit text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS gro_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES gro_tenants(id) ON DELETE CASCADE,
  key text NOT NULL,                               -- z. B. P-1.0
  grp text NOT NULL DEFAULT 'allgemein',
  title text NOT NULL,
  region text NOT NULL DEFAULT 'alle',             -- CH | Bali | alle
  role text NOT NULL DEFAULT 'GRO',
  trigger_text text NOT NULL DEFAULT '',
  goal text NOT NULL DEFAULT '',
  steps jsonb NOT NULL DEFAULT '[]',
  rules jsonb NOT NULL DEFAULT '[]',
  escalation text NOT NULL DEFAULT '',
  open_points jsonb NOT NULL DEFAULT '[]',
  origin text NOT NULL DEFAULT 'handbuch',         -- handbuch | entwurf
  status text NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'freigegeben')),
  version integer NOT NULL DEFAULT 1,
  owner text NOT NULL DEFAULT '',
  reviewed_at date,
  sort integer NOT NULL DEFAULT 0,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS gro_process_versions (
  process_id uuid NOT NULL REFERENCES gro_processes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (process_id, version)
);

CREATE TABLE IF NOT EXISTS gro_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES gro_tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  title text NOT NULL,
  lang text NOT NULL DEFAULT 'de',
  when_text text NOT NULL DEFAULT '',
  body text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS gro_shortcuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES gro_tenants(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  process_key text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, phrase)
);

CREATE TABLE IF NOT EXISTS gro_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES gro_tenants(id) ON DELETE CASCADE,
  topic text NOT NULL,
  target text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, topic)
);

-- Ergänzungen zu Elev8-Listings (Stammdaten kommen live aus Elev8, hier nur was Elev8 nicht kennt)
CREATE TABLE IF NOT EXISTS gro_objects (
  tenant_id uuid NOT NULL REFERENCES gro_tenants(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  citytax_portal text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  codes_enc text,                                  -- verschlüsselt: Notfall- und Boxcodes
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, listing_id)
);

CREATE TABLE IF NOT EXISTS gro_open_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES gro_tenants(id) ON DELETE CASCADE,
  key text NOT NULL,                               -- z. B. E1
  title text NOT NULL,
  question text NOT NULL DEFAULT '',
  proposal text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'entschieden')),
  decision text NOT NULL DEFAULT '',
  decided_by text,
  decided_at timestamptz,
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, key)
);

-- Vorlagen-Bibliothek und der erste Mandant. Zugang zu Elev8 hinterlegt man unter /gro/admin
-- (für den Mandanten "elevate" gilt ersatzweise ELEV8_MCP_URL / ELEV8_MCP_TOKEN aus Railway).
INSERT INTO gro_tenants (slug, name, is_template) VALUES ('vorlage', 'Vorlagen-Bibliothek', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO gro_tenants (slug, name, listing_tags) VALUES ('elevate', 'Elevate', ARRAY['Swiss']) ON CONFLICT (slug) DO NOTHING;
