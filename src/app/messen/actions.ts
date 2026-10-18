"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentMessenUser } from "@/lib/messen/access";
import { syncLeadToGhl } from "@/lib/messen/ghl";
import {
  createEvent,
  deleteEvent,
  deleteLead,
  drawWinner,
  getEvent,
  getLead,
  leadsWithGhlErrors,
  slugTaken,
  updateEvent
} from "@/lib/messen/store";
import { isTimeZone, localInputToDate } from "@/lib/messen/time";

export type FormState = { ok?: string; error?: string } | null;

const str = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const urlOk = (u: string) => u === "" || /^https:\/\/[^\s]+$/i.test(u);

async function guard() {
  const user = await currentMessenUser();
  if (!user) throw new Error("Kein Zugriff auf Messen");
  return user;
}

export async function createEventAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await guard();
  const name = str(form, "name", 120);
  if (!name) return { error: "Gib der Messe einen Namen." };
  let slug = toSlug(str(form, "slug", 60) || name);
  if (slug.length < 2) return { error: "Die Kurzadresse braucht mindestens zwei Buchstaben oder Zahlen." };
  for (let i = 2; await slugTaken(slug); i++) slug = `${toSlug(name).slice(0, 56)}-${i}`;
  const id = await createEvent({ name, slug, createdBy: user.email || user.name });
  redirect(`/messen/${id}`);
}

export async function saveEventAction(_: FormState, form: FormData): Promise<FormState> {
  await guard();
  const id = str(form, "id", 40);
  const current = await getEvent(id);
  if (!current) return { error: "Diese Messe gibt es nicht mehr." };

  const name = str(form, "name", 120);
  const slug = toSlug(str(form, "slug", 60));
  const timeZone = str(form, "timeZone", 60);
  const drawRaw = str(form, "drawAt", 20);
  const drawAt = drawRaw ? localInputToDate(drawRaw, isTimeZone(timeZone) ? timeZone : current.timeZone) : null;
  const demoUrl = str(form, "demoUrl");
  const termsUrl = str(form, "termsUrl");
  const privacyUrl = str(form, "privacyUrl");
  const websiteUrl = str(form, "websiteUrl");
  const active = form.get("active") === "on";

  if (!name) return { error: "Gib der Messe einen Namen." };
  if (slug.length < 2) return { error: "Die Kurzadresse braucht mindestens zwei Buchstaben oder Zahlen." };
  if (await slugTaken(slug, id)) return { error: `Die Kurzadresse „${slug}“ ist schon vergeben.` };
  if (!isTimeZone(timeZone)) return { error: "Wähle eine Zeitzone." };
  if (drawRaw && !drawAt) return { error: "Das Datum der Ziehung stimmt nicht." };
  if (![demoUrl, termsUrl, privacyUrl, websiteUrl].every(urlOk)) return { error: "Links müssen mit https:// beginnen." };
  if (active) {
    const missing = [
      !str(form, "prizeTitle") && !str(form, "prizeTitleEn") && "Gewinn",
      !drawAt && "Ziehung",
      !termsUrl && "Teilnahmebedingungen",
      !privacyUrl && "Datenschutz"
    ].filter(Boolean);
    if (missing.length) return { error: `Zum Veröffentlichen fehlt noch: ${missing.join(", ")}.` };
  }

  await updateEvent(id, {
    slug,
    name,
    lang: form.get("lang") === "en" ? "en" : "de",
    datesLabel: str(form, "datesLabel", 80),
    booth: str(form, "booth", 80),
    timeZone,
    prizeTitle: str(form, "prizeTitle", 80),
    prizeDetail: str(form, "prizeDetail", 200),
    prizeTitleEn: str(form, "prizeTitleEn", 80),
    prizeDetailEn: str(form, "prizeDetailEn", 200),
    drawAt,
    demoUrl,
    termsUrl,
    privacyUrl,
    websiteUrl,
    metaPixelId: str(form, "metaPixelId", 30).replace(/\D/g, ""),
    googleTagId: str(form, "googleTagId", 30).replace(/[^A-Za-z0-9-]/g, ""),
    linkedinPartnerId: str(form, "linkedinPartnerId", 20).replace(/\D/g, ""),
    ghlTags: str(form, "ghlTags", 300)
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10),
    active
  });
  revalidatePath(`/messen/${id}`);
  revalidatePath("/messen");
  return { ok: active ? "Gespeichert. Die Seite ist online." : "Gespeichert. Die Seite ist noch nicht online." };
}

export async function drawWinnerAction(_: FormState, form: FormData): Promise<FormState> {
  await guard();
  const id = str(form, "id", 40);
  const winner = await drawWinner(id);
  revalidatePath(`/messen/${id}`);
  if (!winner) return { error: "Es gibt keine Teilnehmenden mehr, die noch nicht gezogen wurden." };
  return { ok: `Gezogen: ${winner.name} (${winner.ticket})` };
}

export async function retryGhlAction(_: FormState, form: FormData): Promise<FormState> {
  await guard();
  const id = str(form, "id", 40);
  const ids = await leadsWithGhlErrors(id);
  for (const leadId of ids) await syncLeadToGhl(leadId);
  revalidatePath(`/messen/${id}`);
  return { ok: ids.length ? `${ids.length} Leads erneut an GHL gesendet.` : "Alle Leads sind schon in GHL." };
}

export async function deleteLeadAction(form: FormData): Promise<void> {
  await guard();
  const leadId = str(form, "leadId", 40);
  const lead = await getLead(leadId);
  if (!lead) return;
  await deleteLead(leadId);
  revalidatePath(`/messen/${lead.eventId}`);
}

export async function deleteEventAction(form: FormData): Promise<void> {
  await guard();
  await deleteEvent(str(form, "id", 40));
  revalidatePath("/messen");
  redirect("/messen");
}
