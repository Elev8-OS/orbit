import { sql } from "@/lib/db";

/**
 * Hintergrundaufgaben von Orbit, gestartet in instrumentation.ts:
 * - Statusprüfung aller Dienste (ORBIT_STATUS_INTERVAL_MIN, Standard 5 Minuten)
 * - E-Mail-Assistent für alle verbundenen Postfächer (ASSISTENT_INTERVAL_MIN, Standard 15 Minuten)
 * Bei mehreren Orbit-Instanzen läuft jede Aufgabe dank Postgres-Sperre nur einmal.
 * Ausschalten mit ORBIT_BACKGROUND=false. Der E-Mail-Assistent läuft nur mit ASSISTENT_ENABLED=true.
 */
const g = globalThis as unknown as { orbitScheduler?: boolean };

/** Führt eine Aufgabe nur aus, wenn keine andere Instanz sie gerade ausführt (Postgres-Sperre auf einer festen Verbindung). */
export async function exclusive(name: string, task: () => Promise<unknown>): Promise<boolean> {
  const key = `orbit:${name}`;
  const conn = await sql.reserve();
  try {
    const [{ locked }] = await conn<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(hashtext(${key})) AS locked`;
    if (!locked) return false;
    try {
      await task();
    } catch (err) {
      console.error(`Hintergrundaufgabe ${name} fehlgeschlagen:`, err);
    } finally {
      await conn`SELECT pg_advisory_unlock(hashtext(${key}))`.catch(() => {});
    }
    return true;
  } finally {
    conn.release();
  }
}

function every(minutes: number, name: string, task: () => Promise<unknown>, firstDelayMs: number) {
  const run = () => exclusive(name, task).catch((err) => console.error(`Hintergrundaufgabe ${name}:`, err));
  setTimeout(() => {
    void run();
    setInterval(run, minutes * 60_000).unref?.();
  }, firstDelayMs).unref?.();
}

export function startScheduler() {
  if (g.orbitScheduler || process.env.ORBIT_BACKGROUND === "false" || !process.env.DATABASE_URL) return;
  g.orbitScheduler = true;

  const statusMin = Math.max(1, Number(process.env.ORBIT_STATUS_INTERVAL_MIN) || 5);
  every(statusMin, "status", async () => (await import("./status")).runStatusChecks(), Number(process.env.ORBIT_STATUS_FIRST_DELAY_MS) || 30_000);

  if (process.env.ASSISTENT_ENABLED === "true") {
    const assistMin = Math.max(5, Number(process.env.ASSISTENT_INTERVAL_MIN) || 15);
    every(assistMin, "assistant", async () => (await import("@/lib/assistant/worker")).runAll(), 90_000);
  }
  console.log(`Orbit-Hintergrundaufgaben gestartet (Status alle ${statusMin} Min.)`);
}
