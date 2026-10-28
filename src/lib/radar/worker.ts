import { exclusive } from "@/lib/platform/scheduler";
import { collectors } from "./connectors";
import {
  activeConnections,
  finishRun,
  getSettings,
  insertMessages,
  markConnection,
  pendingMessages,
  purgeOld,
  runIsDue,
  saveTriage,
  startRun,
  usersWithRadar
} from "./store";
import { triageMessages } from "./triage";

/**
 * Täglicher Lauf pro Person: Quellen abrufen → neue Nachrichten speichern → bewerten → fertig.
 * „Mein Tag“ liest danach nur noch aus der Datenbank.
 * Gestartet vom Scheduler (RADAR_ENABLED=true), prüft alle 10 Minuten, ob jemand fällig ist.
 */
const FIRST_LOOKBACK_HOURS = () => Math.max(1, Number(process.env.RADAR_FIRST_LOOKBACK_HOURS) || 72);
const MAX_PER_RUN = 100;

function validTz(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/Zurich";
  }
}

/** Lokales Datum (YYYY-MM-DD) und Stunde in der Zeitzone der Person. */
export function localParts(tz: string, at = new Date()): { date: string; hour: number } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: validTz(tz), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export type RunResult = { collected: number; relevant: number; error: string | null };

export async function runForUser(userId: string): Promise<RunResult> {
  const settings = await getSettings(userId);
  const { date } = localParts(settings.timezone);
  await startRun(userId, date);
  let collected = 0;
  let relevant = 0;
  const errors: string[] = [];
  try {
    for (const conn of await activeConnections(userId)) {
      const collect = collectors[conn.kind];
      if (!collect) continue; // Push-Quellen liefern selbst
      try {
        const since = conn.lastRunAt ? new Date(Date.parse(conn.lastRunAt) - 2 * 3600_000) : new Date(Date.now() - FIRST_LOOKBACK_HOURS() * 3600_000);
        const raw = await collect(conn, since.toISOString());
        collected += await insertMessages(userId, conn.id, conn.kind, raw);
        await markConnection(conn.id, null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${conn.label}: ${msg}`);
        await markConnection(conn.id, msg);
      }
    }

    const pending = await pendingMessages(userId, MAX_PER_RUN);
    if (pending.length) {
      const results = await triageMessages(pending, settings);
      for (const [id, t] of results) {
        await saveTriage(userId, id, t);
        if (t.relevant) relevant++;
      }
    }
    await purgeOld(userId);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  const error = errors.length ? errors.join(" | ") : null;
  await finishRun(userId, date, { collected, relevant, error });
  return { collected, relevant, error };
}

/** Startet den Lauf, wenn die eingestellte Uhrzeit erreicht ist und heute noch keiner (erfolgreich) lief. */
export async function runDue() {
  for (const u of await usersWithRadar()) {
    const { date, hour } = localParts(u.timezone);
    if (hour < u.runHour) continue;
    if (!(await runIsDue(u.userId, date))) continue;
    // Pro Person gesperrt, damit ein manueller Lauf und der Zeitplan sich nicht überschneiden
    await exclusive(`radar:${u.userId}`, () => runForUser(u.userId));
  }
}

/** Manueller Lauf aus der Oberfläche. false = läuft gerade schon. */
export async function runNow(userId: string): Promise<boolean> {
  return exclusive(`radar:${userId}`, () => runForUser(userId));
}
