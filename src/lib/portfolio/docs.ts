import { sql } from "@/lib/db";

/** Gemeinsam gepflegte Dokumente des Portfolio-Moduls (ersetzt die Datenbank des früheren Claude-Dashboards). */
export const DOC_COLLECTIONS = ["objektkosten", "gemeinkosten", "ziele", "einstellungen"] as const;
export type DocCollection = (typeof DOC_COLLECTIONS)[number];
export const isCollection = (c: string): c is DocCollection => (DOC_COLLECTIONS as readonly string[]).includes(c);
export const validId = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);

export async function listDocs(collection: DocCollection) {
  const rows = await sql<{ doc_id: string; data: Record<string, unknown>; version: number }[]>`
    SELECT doc_id, data, version FROM portfolio_docs WHERE collection = ${collection} ORDER BY doc_id`;
  return rows.map((r) => ({ id: r.doc_id, data: r.data, version: r.version }));
}

export async function setDoc(collection: string, id: string, data: Record<string, unknown>, by: string) {
  await sql`INSERT INTO portfolio_docs (collection, doc_id, data, updated_by) VALUES (${collection}, ${id}, ${sql.json(data as never)}, ${by})
    ON CONFLICT (collection, doc_id) DO UPDATE SET data = EXCLUDED.data, version = portfolio_docs.version + 1, updated_by = EXCLUDED.updated_by, updated_at = now()`;
}

export async function deleteDoc(collection: string, id: string) {
  await sql`DELETE FROM portfolio_docs WHERE collection = ${collection} AND doc_id = ${id}`;
}
