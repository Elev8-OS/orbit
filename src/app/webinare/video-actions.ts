"use server";

import { revalidatePath } from "next/cache";
import { requireWebinarUser } from "@/lib/webinare/access";
import { getWebinar } from "@/lib/webinare/store";
import { storageConfigured } from "@/lib/venues/s3";
import { cancelQueued, cleanNarration, clipsWithoutWords, getVideoJob, normalizePlan, plannedSeconds, queueRender, savePlan, saveYoutube, suggestPlan, suggestYoutube, translateNarration, withTranscriptLines, withWordLines, type VideoPlan } from "@/lib/webinare/video";

export type VideoFormState = { ok?: string; error?: string } | null;

const MAX_SEC = 600;
const refresh = (id: string) => revalidatePath(`/webinare/${id}/video`);
const fail = (err: unknown): VideoFormState => ({ error: err instanceof Error ? err.message : String(err) });

async function load(form: FormData) {
  const id = String(form.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Webinar nicht gefunden.");
  const w = await getWebinar(id);
  if (!w) throw new Error("Webinar nicht gefunden.");
  return w;
}

export async function saveVideoPlanAction(_: VideoFormState, form: FormData): Promise<VideoFormState> {
  try {
    const user = await requireWebinarUser("edit");
    const w = await load(form);
    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get("plan") ?? "{}"));
    } catch {
      return { error: "Die Schnittliste konnte nicht gelesen werden." };
    }
    const job = await getVideoJob(w);
    if (job?.status === "rendering") return { error: "Das Video wird gerade gerendert. Bitte warten, bis es fertig ist." };
    const plan = normalizePlan(raw, w);
    await savePlan(w.id, plan, user.email);
    refresh(w.id);
    return { ok: "Gespeichert." };
  } catch (err) {
    return fail(err);
  }
}

export async function suggestVideoPlanAction(_: VideoFormState, form: FormData): Promise<VideoFormState> {
  try {
    const user = await requireWebinarUser("edit");
    const w = await load(form);
    const job = await getVideoJob(w);
    if (job?.status === "rendering" || job?.status === "queued") return { error: "Während ein Auftrag läuft, kann die Schnittliste nicht ersetzt werden." };
    const plan = await suggestPlan(w);
    // Eigene Einstellungen behalten (Sprecher, Ausschnitt, Abschluss)
    if (job) {
      plan.pip = job.plan.pip;
      plan.layout = job.plan.layout;
      plan.allowGallery = job.plan.allowGallery;
      plan.voice = job.plan.voice;
      plan.browserBar = job.plan.browserBar;
      plan.outro = job.plan.outro;
      plan.meta = job.plan.meta;
    }
    await savePlan(w.id, plan, user.email);
    refresh(w.id);
    const sec = Math.round(plannedSeconds(plan));
    return { ok: `Vorschlag mit ${plan.chapters.length} Kapiteln und ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} Minuten. Bitte prüfen und anpassen.` };
  } catch (err) {
    return fail(err);
  }
}

export async function renderVideoAction(_: VideoFormState, form: FormData): Promise<VideoFormState> {
  try {
    const user = await requireWebinarUser("edit");
    const w = await load(form);
    if (!w.bunnyVideoDe) return { error: "Zuerst die Bunny-Video-ID im Abschnitt Aufzeichnung eintragen." };
    if (!storageConfigured()) return { error: "Der Datei-Speicher ist in Orbit nicht eingerichtet." };
    const job = await getVideoJob(w);
    if (!job) return { error: "Zuerst eine Schnittliste anlegen und speichern." };
    const chapters = job.plan.chapters.filter((c) => c.clips.length);
    if (!chapters.length) return { error: "Die Schnittliste hat noch keine Clips." };
    const untitled = chapters.findIndex((c) => !c.title);
    if (untitled >= 0) return { error: `Kapitel ${untitled + 1} braucht einen Titel.` };
    const sec = plannedSeconds(job.plan);
    if (sec > MAX_SEC) return { error: `Die Clips dauern zusammen ${Math.round(sec)} Sekunden. Höchstens ${MAX_SEC} sind möglich.` };
    // Vor dem Rendern: Untertitelzeilen (synchron aus den behaltenen Wörtern, neu gesprochen aus dem von Claude
    // bereinigten Sprechertext, sonst aus dem Transkript) und die englische Fassung ergänzen, wo sie fehlen
    let plan: VideoPlan;
    if (job.plan.voice === "pro") {
      const missing = clipsWithoutWords(job.plan);
      if (missing)
        return { error: `${missing === 1 ? "Ein Clip ist" : `${missing} Clips sind`} noch nicht bereinigt (oder die Zeiten haben sich geändert). Zuerst oben „Ton bereinigen“ wählen.` };
      plan = withWordLines(job.plan);
    } else plan = job.plan.voice === "script" ? (await cleanNarration(w, job.plan, true)).plan : withTranscriptLines(w, job.plan);
    plan = (await translateNarration(plan)).plan;
    if (JSON.stringify(plan) !== JSON.stringify(job.plan)) await savePlan(w.id, plan, user.email);
    const started = await queueRender(w.id, user.email);
    refresh(w.id);
    return started ? { ok: "Eingereiht. Der Render-Dienst beginnt in wenigen Sekunden." } : { error: "Es läuft bereits ein Auftrag." };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelVideoAction(_: VideoFormState, form: FormData): Promise<VideoFormState> {
  try {
    await requireWebinarUser("edit");
    const w = await load(form);
    const done = await cancelQueued(w.id);
    refresh(w.id);
    return done ? { ok: "Auftrag zurückgenommen." } : { error: "Der Auftrag läuft schon und wird zu Ende gerendert." };
  } catch (err) {
    return fail(err);
  }
}

export async function suggestYoutubeAction(_: VideoFormState, form: FormData): Promise<VideoFormState> {
  try {
    const user = await requireWebinarUser("edit");
    const w = await load(form);
    const job = await getVideoJob(w);
    if (!job || !job.plan.chapters.some((c) => c.clips.length)) return { error: "Zuerst eine Schnittliste mit Clips speichern." };
    const youtube = await suggestYoutube(w, job.plan);
    await saveYoutube(w.id, youtube, user.email);
    refresh(w.id);
    return { ok: "YouTube-Texte zum gespeicherten Schnitt erstellt. Anpassen lassen sie sich in der Schnittliste unter YouTube." };
  } catch (err) {
    return fail(err);
  }
}

export async function cleanNarrationAction(_: VideoFormState, form: FormData): Promise<VideoFormState> {
  try {
    const user = await requireWebinarUser("edit");
    const w = await load(form);
    const job = await getVideoJob(w);
    if (!job || !job.plan.chapters.some((c) => c.clips.length)) return { error: "Zuerst eine Schnittliste mit Clips speichern." };
    if (job.status === "rendering") return { error: "Das Video wird gerade gerendert. Bitte warten, bis es fertig ist." };
    const { plan, count } = await cleanNarration(w, job.plan, false);
    if (!count) return { error: "An den Stellen der Clips gibt es kein Transkript." };
    const translated = await translateNarration(plan);
    await savePlan(w.id, translated.plan, user.email);
    refresh(w.id);
    return { ok: `Sprechertext für ${count} Clips bereinigt${translated.count ? " und ins Englische übersetzt" : ""}. Bitte in der Schnittliste prüfen.` };
  } catch (err) {
    return fail(err);
  }
}

export async function prepareAudioAction(_: VideoFormState, form: FormData): Promise<VideoFormState> {
  try {
    const user = await requireWebinarUser("edit");
    const w = await load(form);
    if (!w.bunnyVideoDe) return { error: "Zuerst die Bunny-Video-ID im Abschnitt Aufzeichnung eintragen." };
    const job = await getVideoJob(w);
    if (!job || !job.plan.chapters.some((c) => c.clips.length)) return { error: "Zuerst eine Schnittliste mit Clips speichern." };
    const all = form.get("all") === "1";
    if (!all && !clipsWithoutWords(job.plan)) return { ok: "Alle Clips sind bereits bereinigt." };
    const started = await queueRender(w.id, user.email, all ? "prepare-all" : "prepare");
    refresh(w.id);
    return started
      ? { ok: "Eingereiht. Der Render-Dienst transkribiert die Clips wortgenau und markiert Füllwörter, das dauert etwa eine Minute." }
      : { error: "Es läuft bereits ein Auftrag." };
  } catch (err) {
    return fail(err);
  }
}
