import { sql } from "@/lib/db";
import { ensureVenueTables } from "@/lib/venues/store";

export type VenueProfile = { about: string; tip: string };

let ready: Promise<void> | null = null;

/** Die zwei freien Angaben des Betriebs (ein Satz über sich, was Gäste nicht verpassen sollen). Eigene Tabelle, damit die Betriebsliste unverändert bleibt. */
function ensureProfileTable(): Promise<void> {
  ready ??= (async () => {
    await ensureVenueTables();
    await sql`create table if not exists venue_profile (
      venue_id integer primary key references venue_contacts(id) on delete cascade,
      about text,
      tip text,
      updated_at timestamptz not null default now()
    )`;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export async function getProfile(venueId: number): Promise<VenueProfile> {
  await ensureProfileTable();
  const rows = await sql<{ about: string | null; tip: string | null }[]>`select about, tip from venue_profile where venue_id = ${venueId}`;
  return { about: rows[0]?.about ?? "", tip: rows[0]?.tip ?? "" };
}

/** Nur was der Betrieb ausgefüllt hat, wird gesetzt; ein leeres Feld lässt den bisherigen Text stehen. */
export async function saveProfile(venueId: number, p: { about?: string; tip?: string }): Promise<void> {
  const about = p.about?.trim() ? p.about.trim().slice(0, 300) : null;
  const tip = p.tip?.trim() ? p.tip.trim().slice(0, 200) : null;
  if (!about && !tip) return;
  await ensureProfileTable();
  await sql`insert into venue_profile (venue_id, about, tip) values (${venueId}, ${about}, ${tip})
    on conflict (venue_id) do update set about = coalesce(excluded.about, venue_profile.about), tip = coalesce(excluded.tip, venue_profile.tip), updated_at = now()`;
}
