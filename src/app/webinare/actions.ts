"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWebinarUser } from "@/lib/webinare/access";
import {
  addDeliverables,
  createPoll,
  createWebinar,
  deleteDeliverable,
  deleteWebinar,
  getDeliverable,
  getWebinar,
  listDeliverables,
  listRegistrations,
  markLiveEver,
  setOptionStatus,
  setPollStatus,
  setDeliverableFile,
  setRegistrationStatus,
  updateDeliverable,
  updateQuestion,
  updateWebinar,
  upsertRegistrations,
  type Chapter
} from "@/lib/webinare/store";
import { addTag, applyStatusTags, tagFor } from "@/lib/webinare/ghl";
import { teamsAttendance, teamsConfigured, teamsWebinar } from "@/lib/webinare/teams";
import { decodeReport, parseTeamsReport, plausibility } from "@/lib/webinare/attendance";
import { findPromises, generateContent, loadFireflies, translateToEnglish, translateTranscript } from "@/lib/webinare/content";
import { deleteObject, putObject, storageConfigured } from "@/lib/venues/s3";
import { parseTranscriptFile } from "@/lib/webinare/transcript-file";
import { bunnyConfigured, bunnyVideo, findMp4 } from "@/lib/webinare/bunny";
import { dubbingStatus, elevenConfigured, startDubbing, transferDubbing } from "@/lib/webinare/dubbing";
import { localInputToDate } from "@/lib/messen/time";

export type FormState = { ok?: string; error?: string } | null;

const ZONE = "Europe/Zurich";
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const long = (f: FormData, k: string) => String(f.get(k) ?? "").trim().slice(0, 20_000);
const lines = (f: FormData, k: string) =>
  long(f, k)
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

/** "12:34", "1:02:03" oder Sekunden → Sekunden */
function toSeconds(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function fail(err: unknown): FormState {
  return { error: err instanceof Error ? err.message : String(err) };
}

/**
 * Deutsch wird gepflegt, Englisch entsteht automatisch. Übersetzt nur, was sich geändert hat oder noch fehlt.
 * Klappt die Übersetzung nicht, wird trotzdem gespeichert; das Portal zeigt dann Deutsch.
 */
type Pair = { de: string; oldDe?: string; oldEn?: string };
async function autoEnglish(pairs: Pair[]): Promise<{ en: string[]; failed: boolean }> {
  const need = pairs.map((p) => Boolean(p.de.trim()) && (p.de !== p.oldDe || !p.oldEn));
  const en = pairs.map((p, i) => (need[i] ? "" : p.de.trim() ? p.oldEn ?? "" : ""));
  if (!need.some(Boolean)) return { en, failed: false };
  try {
    const done = await translateToEnglish(pairs.map((p, i) => (need[i] ? p.de : "")));
    done.forEach((t, i) => {
      if (need[i]) en[i] = t;
    });
    return { en, failed: false };
  } catch (err) {
    console.error("Übersetzung:", err instanceof Error ? err.message : err);
    pairs.forEach((p, i) => {
      if (need[i]) en[i] = p.oldEn ?? "";
    });
    return { en, failed: true };
  }
}
const TRANSLATE_FAILED = " Die englische Fassung konnte gerade nicht erstellt werden; beim nächsten Speichern wird es erneut versucht.";

function refresh(id?: string) {
  revalidatePath("/webinare");
  if (id) revalidatePath(`/webinare/${id}`);
}

/* ── Webinare ────────────────────────────────────────────── */

export async function createWebinarAction(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    await requireWebinarUser("edit");
    const titleDe = str(form, "titleDe", 200);
    const startsAt = localInputToDate(str(form, "startsAt"), ZONE);
    if (!titleDe) return { error: "Titel fehlt." };
    if (!startsAt) return { error: "Datum und Uhrzeit fehlen." };
    id = await createWebinar({ titleDe, startsAt, tagTopic: str(form, "tagTopic", 40) });
    const { en } = await autoEnglish([{ de: titleDe }]);
    if (en[0]) await updateWebinar(id, { titleEn: en[0] });
  } catch (err) {
    return fail(err);
  }
  redirect(`/webinare/${id}`);
}

export async function saveDetailsAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const startsAt = localInputToDate(str(form, "startsAt"), ZONE);
    if (!startsAt) return { error: "Datum und Uhrzeit fehlen." };
    const tag = str(form, "ghlTagBase", 80).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const old = await getWebinar(id);
    const titleDe = str(form, "titleDe", 200);
    const descriptionDe = long(form, "descriptionDe");
    const tr = await autoEnglish([
      { de: titleDe, oldDe: old?.titleDe, oldEn: old?.titleEn },
      { de: descriptionDe, oldDe: old?.descriptionDe, oldEn: old?.descriptionEn }
    ]);
    await updateWebinar(id, {
      titleDe,
      titleEn: tr.en[0],
      descriptionDe,
      descriptionEn: tr.en[1],
      speaker: str(form, "speaker", 200),
      startsAt,
      durationMin: Math.max(15, Math.min(480, Number(str(form, "durationMin")) || 60)),
      published: form.get("published") === "on",
      slug: str(form, "slug", 80).toLowerCase().replace(/[^a-z0-9-]+/g, "-") || undefined,
      ghlTagBase: tag || undefined,
      teamsWebinarId: str(form, "teamsWebinarId", 200) || null,
      teamsJoinUrl: str(form, "teamsJoinUrl", 1000) || null
    });
    refresh(id);
    return { ok: tr.failed ? `Gespeichert.${TRANSLATE_FAILED}` : "Gespeichert, Englisch ist aktuell." };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteWebinarAction(form: FormData): Promise<void> {
  await requireWebinarUser("edit");
  const id = str(form, "id");
  // Hochgeladene Unterlagen im Bucket mitlöschen; die Einträge selbst entfernt die Datenbank
  for (const d of await listDeliverables(id).catch(() => [])) {
    if (d.fileKey) await deleteObject(d.fileKey).catch((e) => console.error("Datei nicht gelöscht:", e));
  }
  await deleteWebinar(id);
  revalidatePath("/webinare");
  redirect("/webinare");
}

/* ── Teams ───────────────────────────────────────────────── */

export async function loadTeamsAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w?.teamsWebinarId) return { error: "Zuerst die Teams-Webinar-ID eintragen und speichern." };
    if (!teamsConfigured()) return { error: "Microsoft-Zugang ist in Orbit nicht eingerichtet." };
    const t = await teamsWebinar(w.teamsWebinarId);
    const join = t.sessions.find((s) => s.joinWebUrl)?.joinWebUrl ?? null;
    await updateWebinar(id, { teamsJoinUrl: join ?? w.teamsJoinUrl });
    refresh(id);
    return { ok: `Verbunden mit „${t.displayName}“, ${t.sessions.length} Sitzung(en). Referenten treten über diesen Link bei.` };
  } catch (err) {
    return fail(err);
  }
}

export async function teamsAttendanceAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w?.teamsWebinarId) return { error: "Keine Teams-Webinar-ID hinterlegt." };
    const { records, sessions } = await teamsAttendance(w.teamsWebinarId);
    const regs = await listRegistrations(id);
    const seen = new Map(records.map((r) => [r.email, r]));
    await upsertRegistrations(
      id,
      regs.map((r) => ({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        attendedSeconds: seen.get(r.email)?.seconds ?? null,
        status: (seen.get(r.email)?.seconds ?? 0) > 0 ? "attended" : "missed"
      })),
      "teams"
    );
    const extra = records.filter((r) => !regs.some((x) => x.email === r.email));
    if (extra.length) {
      await upsertRegistrations(
        id,
        extra.map((r) => ({ email: r.email, firstName: r.name.split(" ")[0] ?? "", lastName: r.name.split(" ").slice(1).join(" "), attendedSeconds: r.seconds, status: "attended" })),
        "teams"
      );
    }
    const meetingSeconds = sessions.reduce((s, x) => s + (x.start && x.end ? (x.end.getTime() - x.start.getTime()) / 1000 : 0), 0) || null;
    const attended = records.filter((r) => r.seconds > 0).length;
    const warnings = plausibility({ meetingSeconds, registered: Math.max(regs.length, records.length), attended, plannedMin: w.durationMin });
    await updateWebinar(id, { attendanceNote: warnings.join(" ") || null });
    refresh(id);
    return warnings.length ? { error: `Geladen, aber bitte prüfen: ${warnings.join(" ")}` } : { ok: `${attended} Anwesende übernommen. Bitte prüfen und dann abschliessen.` };
  } catch (err) {
    return fail(err);
  }
}

export async function importReportAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w) return { error: "Webinar nicht gefunden." };
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Bitte die CSV-Datei aus Teams auswählen." };
    const report = parseTeamsReport(decodeReport(await file.arrayBuffer()));
    const allAttended = form.get("allAttended") === "on";
    const rows = allAttended ? report.rows.map((r) => ({ ...r, status: "attended" as const })) : report.rows;
    const n = await upsertRegistrations(id, rows, "teams-csv");
    const warnings = allAttended ? [] : plausibility({ ...report, plannedMin: w.durationMin });
    await updateWebinar(id, {
      attendanceNote: allAttended ? "Ausnahme: alle Angemeldeten als anwesend übernommen." : warnings.join(" ") || null
    });
    refresh(id);
    return warnings.length
      ? { error: `${n} Personen importiert, aber bitte prüfen: ${warnings.join(" ")}` }
      : { ok: `${n} Personen importiert (${rows.filter((r) => r.status === "attended").length} anwesend).` };
  } catch (err) {
    return fail(err);
  }
}

export async function setStatusAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const status = str(form, "status") as "attended" | "missed" | "registered";
    if (!["attended", "missed", "registered"].includes(status)) return { error: "Unbekannter Status." };
    const ids = form.getAll("reg").map(String);
    if (!ids.length) return { error: "Keine Personen ausgewählt." };
    await setRegistrationStatus(id, ids, status);
    refresh(id);
    return { ok: `${ids.length} Person(en) geändert.` };
  } catch (err) {
    return fail(err);
  }
}

export async function finalizeAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w) return { error: "Webinar nicht gefunden." };
    let regs = await listRegistrations(id);
    const open = regs.filter((r) => r.status === "registered").map((r) => r.id);
    if (open.length) {
      await setRegistrationStatus(id, open, "missed");
      regs = await listRegistrations(id);
    }
    if (w.attendanceNote && !w.attendanceNote.startsWith("Ausnahme") && form.get("confirm") !== "on") {
      return { error: "Der Bericht hat Warnungen. Bitte prüfen und „Trotzdem abschliessen“ ankreuzen." };
    }
    await markLiveEver(regs.filter((r) => r.status === "attended").map((r) => r.email));
    const result = await applyStatusTags(w, regs);
    await updateWebinar(id, { attendanceFinalizedAt: new Date() });
    refresh(id);
    if (result.skipped) return { ok: "Abgeschlossen. GHL ist nicht eingerichtet, Tags wurden nicht gesetzt." };
    return result.failed
      ? { error: `Abgeschlossen. ${result.ok} Tags gesetzt, ${result.failed} fehlgeschlagen (siehe Liste). Erneut abschliessen versucht es nochmals.` }
      : { ok: `Abgeschlossen. ${result.ok} Tags in GHL gesetzt, die Follow-up-Workflows laufen.` };
  } catch (err) {
    return fail(err);
  }
}

/* ── Aufzeichnung und Inhalte ──────────────────────────── */

export async function saveMediaAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const de = str(form, "bunnyVideoDe", 80) || null;
    const en = str(form, "bunnyVideoEn", 80) || null;
    if (de && bunnyConfigured()) await bunnyVideo(de);
    await updateWebinar(id, {
      bunnyVideoDe: de,
      bunnyVideoEn: en,
      transcriptOffsetSec: Number(str(form, "offset").replace(",", ".")) || 0,
      teaserStartSec: toSeconds(str(form, "teaserStart")),
      teaserEndSec: toSeconds(str(form, "teaserEnd"))
    });
    refresh(id);
    return { ok: "Gespeichert." };
  } catch (err) {
    return fail(err);
  }
}

export async function loadTranscriptAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const ffId = str(form, "firefliesId", 100);
    if (!ffId) return { error: "Bitte eine Fireflies-Aufnahme wählen." };
    const { segments } = await loadFireflies(ffId);
    if (!segments.length) return { error: "Die Aufnahme hat (noch) kein Transkript." };
    await updateWebinar(id, { firefliesId: ffId, transcript: segments });
    refresh(id);
    return { ok: `${segments.length} Abschnitte übernommen.` };
  } catch (err) {
    return fail(err);
  }
}

export async function uploadTranscriptAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Bitte die Transkript-Datei aus Teams wählen (.docx oder .vtt)." };
    if (file.size > 25_000_000) return { error: "Die Datei ist grösser als 25 MB." };
    const segments = parseTranscriptFile(file.name, Buffer.from(await file.arrayBuffer()));
    if (!segments.length) return { error: "In der Datei wurde kein Text gefunden." };
    await updateWebinar(id, { transcript: segments, firefliesId: null });
    refresh(id);
    const speakers = [...new Set(segments.map((s) => s.speaker).filter(Boolean))];
    return { ok: `${segments.length} Abschnitte übernommen (${speakers.join(", ")}).` };
  } catch (err) {
    return fail(err);
  }
}

export async function generateAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w) return { error: "Webinar nicht gefunden." };
    const c = await generateContent(w);
    await updateWebinar(id, {
      titleEn: w.titleEn || c.titleEn,
      descriptionDe: w.descriptionDe || c.descriptionDe,
      descriptionEn: w.descriptionEn || c.descriptionEn,
      chapters: c.chapters,
      summaryDe: c.summaryDe,
      summaryEn: c.summaryEn,
      takeaways: c.takeaways,
      checklist: c.checklist,
      teaserStartSec: w.teaserStartSec ?? c.teaser?.start ?? null,
      teaserEndSec: w.teaserEndSec ?? c.teaser?.end ?? null
    });
    refresh(id);
    return { ok: "Kapitel, Zusammenfassung, Kernaussagen und Checkliste erzeugt. Bitte prüfen." };
  } catch (err) {
    return fail(err);
  }
}

export async function translateAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w?.transcript.length) return { error: "Kein Transkript vorhanden." };
    const segments = await translateTranscript(w.transcript, async () => undefined);
    await updateWebinar(id, { transcript: segments });
    refresh(id);
    return { ok: "Transkript übersetzt." };
  } catch (err) {
    return fail(err);
  }
}

function parseChapters(text: string): Chapter[] {
  return text
    .split("\n")
    .map((l) => l.split("|").map((p) => p.trim()))
    .filter((p) => p.length >= 2 && p[1])
    .map((p) => ({ start: toSeconds(p[0]) ?? 0, de: p[1], en: "" }))
    .sort((a, b) => a.start - b.start);
}

export async function saveContentAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const old = await getWebinar(id);
    const chapters = parseChapters(long(form, "chapters"));
    const summaryDe = long(form, "summaryDe");
    const takeaways = lines(form, "takeawaysDe");
    const checklist = lines(form, "checklistDe");
    // Bisherige Übersetzungen nach deutschem Text wiederverwenden, damit nur Neues übersetzt wird
    const known = new Map<string, string>();
    const remember = (de: string[], en: string[]) => de.forEach((d, i) => en[i] && known.set(d, en[i]));
    if (old) {
      remember(old.chapters.map((c) => c.de), old.chapters.map((c) => c.en));
      remember(old.takeaways.de, old.takeaways.en);
      remember(old.checklist.de, old.checklist.en);
    }
    const items = [...chapters.map((c) => c.de), ...takeaways, ...checklist];
    const tr = await autoEnglish([
      { de: summaryDe, oldDe: old?.summaryDe, oldEn: old?.summaryEn },
      ...items.map((de) => ({ de, oldDe: known.has(de) ? de : undefined, oldEn: known.get(de) }))
    ]);
    const [summaryEn, ...rest] = tr.en;
    const chEn = rest.slice(0, chapters.length);
    const tkEn = rest.slice(chapters.length, chapters.length + takeaways.length);
    const clEn = rest.slice(chapters.length + takeaways.length);
    await updateWebinar(id, {
      chapters: chapters.map((c, i) => ({ ...c, en: chEn[i] ?? "" })),
      summaryDe,
      summaryEn,
      takeaways: { de: takeaways, en: tkEn },
      checklist: { de: checklist, en: clEn }
    });
    refresh(id);
    return { ok: tr.failed ? `Inhalte gespeichert.${TRANSLATE_FAILED}` : "Inhalte gespeichert, Englisch ist aktuell." };
  } catch (err) {
    return fail(err);
  }
}

export async function dubbingAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w) return { error: "Webinar nicht gefunden." };
    if (!elevenConfigured()) return { error: "ELEVENLABS_API_KEY fehlt." };
    if (!w.dubbingId) {
      if (!w.bunnyVideoDe || !bunnyConfigured()) return { error: "Zuerst das deutsche Video in Bunny hinterlegen." };
      const mp4 = await findMp4(w.bunnyVideoDe);
      if ("error" in mp4) return { error: mp4.error };
      const dubId = await startDubbing(mp4.url, w.titleDe);
      await updateWebinar(id, { dubbingId: dubId, dubbingStatus: "dubbing" });
      refresh(id);
      return { ok: "Englische Tonspur wird erstellt. Das dauert etwa so lange wie das Video. Später erneut prüfen." };
    }
    const s = await dubbingStatus(w.dubbingId);
    if (s.status === "dubbed") {
      const guid = await transferDubbing(w.dubbingId, w.titleDe);
      await updateWebinar(id, { bunnyVideoEn: guid, dubbingStatus: "fertig" });
      refresh(id);
      return { ok: "Englische Fassung liegt in Bunny und ist hinterlegt. Bunny wandelt sie jetzt noch um." };
    }
    if (s.status === "failed") {
      await updateWebinar(id, { dubbingId: null, dubbingStatus: `Fehler: ${s.error ?? ""}` });
      refresh(id);
      return { error: `ElevenLabs meldet einen Fehler: ${s.error ?? "unbekannt"}. Erneut klicken startet neu.` };
    }
    await updateWebinar(id, { dubbingStatus: s.status });
    refresh(id);
    return { ok: `Noch in Arbeit (${s.status}).` };
  } catch (err) {
    return fail(err);
  }
}

export async function publishAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w) return { error: "Webinar nicht gefunden." };
    const on = str(form, "on") === "1";
    if (on && !w.bunnyVideoDe) return { error: "Ohne Video kann die Aufzeichnung nicht veröffentlicht werden." };
    await updateWebinar(id, { recordingPublishedAt: on ? new Date() : null });
    refresh(id);
    return { ok: on ? "Aufzeichnung ist im Portal sichtbar." : "Aufzeichnung ist wieder versteckt." };
  } catch (err) {
    return fail(err);
  }
}

/* ── Fragen ──────────────────────────────────────────────── */

export async function questionAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("moderate");
    const status = str(form, "status");
    if (!["open", "answered", "faq", "rejected"].includes(status)) return { error: "Unbekannter Status." };
    await updateQuestion(str(form, "qid"), status, toSeconds(str(form, "at")));
    refresh(str(form, "id"));
    return { ok: "Gespeichert." };
  } catch (err) {
    return fail(err);
  }
}

/* ── Abstimmungen ────────────────────────────────────────── */

export async function createPollAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await requireWebinarUser("edit");
    const kind = str(form, "kind") === "date" ? "date" : "topic";
    const titleDe = str(form, "titleDe", 200);
    if (!titleDe) return { error: "Titel fehlt." };
    const descriptionDe = long(form, "descriptionDe");
    let options: { labelDe: string; labelEn: string; startsAt: Date | null }[];
    if (kind === "date") {
      const days = form.getAll("optDate").map((v) => String(v).trim());
      const times = form.getAll("optTime").map((v) => String(v).trim());
      const picked = days.map((d, i) => (d ? localInputToDate(`${d}T${times[i] || "16:00"}`, ZONE) : null));
      if (days.some((d, i) => d && !picked[i])) return { error: "Ein Termin ist ungültig. Bitte Datum und Uhrzeit prüfen." };
      const unique = [...new Map(picked.filter((d): d is Date => Boolean(d)).map((d) => [d.getTime(), d])).values()].sort((a, b) => a.getTime() - b.getTime());
      options = unique.map((d) => ({ labelDe: "", labelEn: "", startsAt: d }));
    } else {
      const topics = form.getAll("optTopic").map((v) => String(v).trim().slice(0, 200)).filter(Boolean);
      options = topics.map((t) => ({ labelDe: t, labelEn: "", startsAt: null }));
    }
    if (options.length < 2 && !(kind === "topic" && form.get("allowSuggestions") === "on")) return { error: kind === "date" ? "Mindestens zwei Termine wählen." : "Mindestens zwei Themen." };
    const tr = await autoEnglish([{ de: titleDe }, { de: descriptionDe }, ...options.map((o) => ({ de: o.labelDe }))]);
    options.forEach((o, i) => (o.labelEn = tr.en[i + 2] ?? ""));
    await createPoll({
      kind,
      titleDe,
      titleEn: tr.en[0],
      descriptionDe,
      descriptionEn: tr.en[1],
      allowSuggestions: form.get("allowSuggestions") === "on",
      showResults: form.get("showResults") === "on",
      createdBy: user.email,
      options
    });
    revalidatePath("/webinare/umfragen");
    return { ok: tr.failed ? `Abstimmung ist online.${TRANSLATE_FAILED}` : "Abstimmung ist online, auch auf Englisch." };
  } catch (err) {
    return fail(err);
  }
}

export async function pollStatusAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    await setPollStatus(str(form, "pollId"), str(form, "status") === "closed" ? "closed" : "open");
    revalidatePath("/webinare/umfragen");
    return { ok: "Gespeichert." };
  } catch (err) {
    return fail(err);
  }
}

export async function optionAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("moderate");
    const status = str(form, "status") === "active" ? "active" : "rejected";
    let labelEn: string | undefined;
    if (status === "active") {
      const label = str(form, "label", 200);
      if (label) labelEn = (await autoEnglish([{ de: label }])).en[0] || undefined;
    }
    await setOptionStatus(str(form, "optionId"), status, labelEn);
    revalidatePath("/webinare/umfragen");
    return { ok: status === "active" ? "Freigegeben." : "Abgelehnt." };
  } catch (err) {
    return fail(err);
  }
}

export async function webinarFromOptionAction(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    await requireWebinarUser("edit");
    const title = str(form, "title", 200) || "Neues Webinar";
    const at = str(form, "startsAt");
    const startsAt = at ? new Date(at) : new Date(Date.now() + 21 * 86400_000);
    id = await createWebinar({ titleDe: title, startsAt });
    const { en } = await autoEnglish([{ de: title }]);
    if (en[0]) await updateWebinar(id, { titleEn: en[0] });
  } catch (err) {
    return fail(err);
  }
  redirect(`/webinare/${id}`);
}

/* ── Nachlieferungen ─────────────────────────────────────── */

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9äöüéèà]+/g, " ").trim();

export async function findPromisesAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w) return { error: "Webinar nicht gefunden." };
    const found = await findPromises(w);
    const existing = await listDeliverables(id);
    const fresh = found.filter(
      (f) =>
        !existing.some(
          (e) => norm(e.titleDe) === norm(f.titleDe) || (e.source === "transcript" && e.atSec != null && f.atSec != null && Math.abs(e.atSec - f.atSec) < 20)
        )
    );
    if (!fresh.length) return { ok: found.length ? "Keine neuen Zusagen gefunden, alle stehen schon in der Liste." : "Im Transkript wurde keine Zusage zum Nachliefern gefunden." };
    const tr = await autoEnglish(fresh.map((f) => ({ de: f.titleDe })));
    await addDeliverables(
      id,
      fresh.map((f, i) => ({ titleDe: f.titleDe, titleEn: tr.en[i] ?? "", quote: f.quote, atSec: f.atSec, source: "transcript" as const })),
      user.email
    );
    refresh(id);
    return { ok: `${fresh.length} Zusage${fresh.length === 1 ? "" : "n"} gefunden. Bitte prüfen, was wirklich nachgeliefert werden soll.` };
  } catch (err) {
    return fail(err);
  }
}

export async function addDeliverableAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const user = await requireWebinarUser("edit");
    const id = str(form, "id");
    const titleDe = str(form, "title", 200);
    if (!titleDe) return { error: "Bitte beschreiben, was nachgeliefert wird." };
    const tr = await autoEnglish([{ de: titleDe }]);
    await addDeliverables(id, [{ titleDe, titleEn: tr.en[0] ?? "", quote: "", atSec: null, source: "manual" }], user.email);
    refresh(id);
    return { ok: "Hinzugefügt." };
  } catch (err) {
    return fail(err);
  }
}

const safeName = (n: string) =>
  n
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(-120) || "datei";

export async function deliverAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const d = await getDeliverable(str(form, "did"));
    if (!d) return { error: "Eintrag nicht gefunden." };
    const file = form.get("file");
    const link = str(form, "link", 1000);
    if (file instanceof File && file.size) {
      if (!storageConfigured()) return { error: "Der Datei-Speicher ist in Orbit nicht eingerichtet (S3_*)." };
      if (file.size > 25_000_000) return { error: "Die Datei ist grösser als 25 MB. Bitte als Link hinterlegen (z. B. SharePoint oder Google Drive)." };
      const key = `webinare/${d.webinarId}/${d.id}/${Date.now()}-${safeName(file.name)}`;
      const type = file.type || "application/octet-stream";
      await putObject(key, Buffer.from(await file.arrayBuffer()), type);
      if (d.fileKey) await deleteObject(d.fileKey).catch((e) => console.error("Alte Datei nicht gelöscht:", e));
      await setDeliverableFile(d.id, { fileKey: key, fileName: file.name.slice(0, 200), fileType: type, fileSize: file.size, linkUrl: null });
    } else if (link) {
      if (!/^https:\/\/[^\s]+$/i.test(link)) return { error: "Bitte einen vollständigen Link mit https:// angeben." };
      if (d.fileKey) await deleteObject(d.fileKey).catch((e) => console.error("Alte Datei nicht gelöscht:", e));
      await setDeliverableFile(d.id, { fileKey: null, fileName: null, fileType: null, fileSize: null, linkUrl: link });
    } else {
      return { error: "Bitte eine Datei wählen oder einen Link eintragen." };
    }
    refresh(d.webinarId);
    return { ok: "Erledigt. Im Portal sichtbar, sobald die Aufzeichnung online ist." };
  } catch (err) {
    return fail(err);
  }
}

export async function deliverableAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const d = await getDeliverable(str(form, "did"));
    if (!d) return { error: "Eintrag nicht gefunden." };
    const op = str(form, "op");
    if (op === "delete") {
      const key = await deleteDeliverable(d.id);
      if (key) await deleteObject(key).catch((e) => console.error("Datei nicht gelöscht:", e));
    } else if (op === "remove-file") {
      if (d.fileKey) await deleteObject(d.fileKey).catch((e) => console.error("Datei nicht gelöscht:", e));
      await setDeliverableFile(d.id, { fileKey: null, fileName: null, fileType: null, fileSize: null, linkUrl: null });
    } else if (op === "dismiss") {
      await updateDeliverable(d.id, { status: "dismissed" });
    } else if (op === "reopen") {
      await updateDeliverable(d.id, { status: d.fileKey || d.linkUrl ? "done" : "open" });
    } else {
      return { error: "Unbekannte Aktion." };
    }
    refresh(d.webinarId);
    return { ok: "Gespeichert." };
  } catch (err) {
    return fail(err);
  }
}

/** Teilnehmende über die nachgelieferten Unterlagen informieren: GHL-Tag `<basis>-unterlagen` startet den Workflow. */
export async function notifyMaterialsAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requireWebinarUser("edit");
    const id = str(form, "id");
    const w = await getWebinar(id);
    if (!w) return { error: "Webinar nicht gefunden." };
    if (!w.recordingPublishedAt) return { error: "Zuerst die Aufzeichnung veröffentlichen, die Unterlagen liegen auf ihrer Seite." };
    const done = (await listDeliverables(id)).filter((d) => d.status === "done");
    if (!done.length) return { error: "Es ist noch keine Unterlage nachgeliefert." };
    const regs = (await listRegistrations(id)).filter((r) => r.status === "attended" || r.status === "missed");
    if (!regs.length) return { error: "Keine Teilnehmenden. Zuerst die Teilnahme abschliessen." };
    const tag = tagFor(w, "unterlagen");
    const result = await addTag(tag, regs);
    if (result.skipped) return { error: "GHL ist in Orbit nicht eingerichtet." };
    if (result.ok) await updateWebinar(id, { materialsNotifiedAt: new Date() });
    refresh(id);
    return result.failed
      ? { error: `${result.ok} informiert, ${result.failed} fehlgeschlagen. Erneut klicken versucht es nochmals (doppelte Tags schaden nicht).` }
      : { ok: `Tag ${tag} bei ${result.ok} Personen gesetzt. Der GHL-Workflow verschickt die Mail.` };
  } catch (err) {
    return fail(err);
  }
}
