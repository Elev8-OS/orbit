import { randomUUID } from "node:crypto";
import { putObject, storageConfigured } from "@/lib/venues/s3";
import { notifyPhotosReceived } from "@/lib/venues/ghl";
import { saveProfile } from "@/lib/venues/profile";
import { MAX_PHOTOS, addPhoto, cleanEmail, cleanInstagram, cleanPhone, countPhotos, getVenueByToken, markUploaded, updateVenue } from "@/lib/venues/store";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

/** Dateityp an den ersten Bytes erkennen, nicht am Namen oder am Header des Absenders. */
function sniff(b: Buffer): { ext: string; mime: string } | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

// Öffentlich (ohne Login): ein Foto pro Aufruf. Zugang ist der geheime Token im Pfad.
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const venue = await getVenueByToken(token);
  if (!venue) return Response.json({ error: "This link is not valid any more." }, { status: 404 });
  if (!storageConfigured()) return Response.json({ error: "Uploads are not available right now. Please try again later." }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "The upload could not be read." }, { status: 400 });
  }
  if (String(form.get("rights")) !== "true") return Response.json({ error: "Please confirm that you may share these photos." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "There is no file." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "This photo is larger than 15 MB." }, { status: 400 });

  if ((await countPhotos(venue.id)) >= MAX_PHOTOS) return Response.json({ error: `You have reached the limit of ${MAX_PHOTOS} photos.` }, { status: 409 });

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) return Response.json({ error: "Please use JPG, PNG or WebP photos." }, { status: 400 });

  const key = `venues/${venue.id}/${randomUUID()}.${kind.ext}`;
  try {
    await putObject(key, buf, kind.mime);
  } catch (e) {
    console.error("Venue photo upload failed:", e);
    return Response.json({ error: "The photo could not be saved. Please try again." }, { status: 502 });
  }

  const caption = String(form.get("caption") ?? "").trim().slice(0, 300);
  const id = await addPhoto({ venueId: venue.id, storageKey: key, filename: file.name.slice(0, 120), contentType: kind.mime, bytes: file.size, caption, rightsOk: true });

  // Der Betrieb trägt seine Daten selbst ein: das hat Vorrang vor allem, was wir vorbelegt haben.
  // Die Einwilligung wird beim ersten Upload mit Datum festgehalten. Fassung 2 (6. Nov. 2026) umfasst auch die Zustimmung der abgebildeten Personen und die Einladung als Mit-Autor.
  const instagram = cleanInstagram(String(form.get("instagram") ?? ""));
  const contactName = String(form.get("contact_name") ?? "").trim().slice(0, 80);
  const phone = cleanPhone(String(form.get("phone") ?? ""));
  const email = cleanEmail(String(form.get("email") ?? ""));
  await updateVenue(venue.id, {
    ...(venue.consentAt ? {} : { consent_ref: "Confirmed by the venue on the upload page (v2: people shown, collaborator invitation)", consent_at: new Date() }),
    ...(instagram ? { instagram } : {}),
    ...(contactName ? { contact_name: contactName } : {}),
    ...(phone ? { phone, phone_source: "entered" } : {}),
    ...(email ? { email } : {})
  });
  // Die zwei freien Angaben gehören zum Betrieb, nicht zum Foto. Ein Fehler hier darf den Upload nicht scheitern lassen.
  try {
    await saveProfile(venue.id, { about: String(form.get("about") ?? ""), tip: String(form.get("tip") ?? "") });
  } catch (e) {
    console.error("Venue profile could not be saved:", e);
  }
  await markUploaded(venue.id);
  // Beim ersten Foto GHL Bescheid geben, damit die Erinnerung nach zwei Tagen entfällt. Der Upload wartet nicht darauf.
  if (venue.status !== "uploaded") void notifyPhotosReceived(venue.id);
  return Response.json({ id }, { status: 201 });
}
