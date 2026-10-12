import postgres from "postgres";

const globalForDb = globalThis as unknown as { orbitSql?: postgres.Sql };

/** Gemeinsamer Postgres-Pool. Die Verbindung wird erst beim ersten Query aufgebaut. */
export const sql =
  globalForDb.orbitSql ??
  postgres(process.env.DATABASE_URL ?? "", {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {}
  });

if (process.env.NODE_ENV !== "production") globalForDb.orbitSql = sql;
