"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tipStrings } from "@/lib/sm-manager/tips-i18n";
import { Tip } from "./Tip";
import "./music.css";

type Mood = "calm" | "upbeat" | "any";
export type Track = {
  id: number;
  title: string;
  provider: string;
  mood: Mood;
  license_ref: string;
  license_ok: boolean;
  active: boolean;
  note: string;
  size_bytes: number | null;
  used_count: number;
  last_used_at: string | null;
  previewUrl: string | null;
};
export type MusicData = { storage: boolean; usable: number; tracks: Track[] };

const de = {
  tab: "Musik",
  title: "Musik für Reels",
  intro: "Jedes neue Reel bekommt automatisch einen Titel aus dieser Bibliothek, passend zur Stimmung des Posts: ruhig für Villen und Details, lebendig für die Umgebung und für Villen nach Zielgruppe.",
  gate: "Es werden nur Titel verwendet, deren Lizenz hier bestätigt ist. Ohne so einen Titel bleibt ein Reel stumm.",
  unavailable: "Die Musikbibliothek konnte gerade nicht geladen werden.",
  noStorage: "Der Dateispeicher ist in der Engine nicht eingerichtet, Uploads sind deshalb nicht möglich.",
  usable: (n: number) => `${n} ${n === 1 ? "Titel ist" : "Titel sind"} freigegeben und wird für neue Reels verwendet.`,
  noneUsable: "Noch kein Titel freigegeben: neue Reels werden stumm gerendert.",
  addTitle: "Titel hinzufügen",
  file: "MP3-Dateien (mehrere möglich, je bis 15 MB)",
  sharedTitle: "Gilt für alle Dateien",
  filesTitle: "Dateien",
  name: "Titel",
  provider: "Anbieter",
  providerHelp: "Woher stammt der Titel, zum Beispiel Epidemic Sound, Artlist oder Uppbeat.",
  mood: "Stimmung",
  moods: { calm: "Ruhig", upbeat: "Lebendig", any: "Passt zu allem" } as Record<string, string>,
  licenseRef: "Lizenz-Nachweis",
  licenseRefHelp: "Link, Rechnungs- oder Lizenznummer. Damit lässt sich später belegen, warum der Titel verwendet werden darf.",
  licenseOk: "Lizenz geprüft: Die kommerzielle Nutzung in Social-Media-Videos (Instagram, Facebook, TikTok) ist erlaubt.",
  note: "Notiz (optional)",
  upload: "Hochladen",
  uploadN: (n: number) => `${n} ${n === 1 ? "Datei" : "Dateien"} hochladen`,
  uploading: "Wird hochgeladen und geprüft …",
  progress: (i: number, n: number) => `Datei ${i} von ${n} …`,
  chooseFile: "Bitte wähle mindestens eine MP3-Datei.",
  onlyMp3: "Nur MP3-Dateien werden angenommen. Die anderen wurden übersprungen.",
  needProof: "Für die Freigabe brauchen wir Anbieter und Lizenz-Nachweis.",
  rowStatus: { ready: "Bereit", uploading: "Läuft …", error: "Fehler" } as Record<string, string>,
  removeRow: "Entfernen",
  result: (ok: number, bad: number) => (bad ? `${ok} hochgeladen, ${bad} fehlgeschlagen. Die fehlgeschlagenen stehen noch in der Liste, du kannst es erneut versuchen.` : `${ok} hochgeladen.`),
  listTitle: "Bibliothek",
  empty: "Noch keine Titel. Lade den ersten hoch, sobald Anbieter und Lizenz geklärt sind.",
  approved: "Freigegeben",
  licenseOpen: "Lizenz offen",
  inactive: "Ausgeschaltet",
  active: "Aktiv (für neue Reels verwenden)",
  uses: (n: number) => `${n}× verwendet`,
  save: "Speichern",
  saved: "Gespeichert",
  remove: "Löschen",
  confirmRemove: "Diesen Titel löschen? Bereits gerenderte Reels bleiben unverändert.",
  failed: "Das hat nicht geklappt"
};
const en: typeof de = {
  tab: "Music",
  title: "Music for reels",
  intro: "Every new reel automatically gets a track from this library that fits the mood of the post: calm for villas and details, livelier for the area and for villas by audience.",
  gate: "Only tracks whose license is confirmed here are used. Without such a track a reel stays silent.",
  unavailable: "The music library could not be loaded right now.",
  noStorage: "File storage is not set up in the engine, so uploads are not possible.",
  usable: (n) => `${n} ${n === 1 ? "track is" : "tracks are"} approved and used for new reels.`,
  noneUsable: "No track is approved yet: new reels are rendered silent.",
  addTitle: "Add tracks",
  file: "MP3 files (several possible, up to 15 MB each)",
  sharedTitle: "Applies to all files",
  filesTitle: "Files",
  name: "Title",
  provider: "Provider",
  providerHelp: "Where the track comes from, for example Epidemic Sound, Artlist or Uppbeat.",
  mood: "Mood",
  moods: { calm: "Calm", upbeat: "Upbeat", any: "Fits everything" },
  licenseRef: "License proof",
  licenseRefHelp: "A link, invoice or license number. It lets us show later why the track may be used.",
  licenseOk: "License checked: commercial use in social media videos (Instagram, Facebook, TikTok) is allowed.",
  note: "Note (optional)",
  upload: "Upload",
  uploadN: (n) => `Upload ${n} ${n === 1 ? "file" : "files"}`,
  uploading: "Uploading and checking ...",
  progress: (i, n) => `File ${i} of ${n} ...`,
  chooseFile: "Please choose at least one MP3 file.",
  onlyMp3: "Only MP3 files are accepted. The others were skipped.",
  needProof: "Approval needs the provider and the license proof.",
  rowStatus: { ready: "Ready", uploading: "Running ...", error: "Error" },
  removeRow: "Remove",
  result: (ok, bad) => (bad ? `${ok} uploaded, ${bad} failed. The failed ones are still in the list, you can try again.` : `${ok} uploaded.`),
  listTitle: "Library",
  empty: "No tracks yet. Upload the first one once provider and license are settled.",
  approved: "Approved",
  licenseOpen: "License open",
  inactive: "Switched off",
  active: "Active (use for new reels)",
  uses: (n) => `used ${n}×`,
  save: "Save",
  saved: "Saved",
  remove: "Delete",
  confirmRemove: "Delete this track? Reels that are already rendered stay as they are.",
  failed: "That did not work"
};

export const musicTabLabel = (locale: "de" | "en") => (locale === "en" ? en : de).tab;

type S = typeof de;

type Row = { id: number; file: File; title: string; mood: Mood; status: "ready" | "uploading" | "error"; error?: string };

// "Artist_-_Track_Name.mp3" -> "Artist - Track Name"
const cleanName = (name: string) =>
  name
    .replace(/\.mp3$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const isMp3 = (f: File) => /\.mp3$/i.test(f.name) || f.type === "audio/mpeg";

async function call(method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true } : { ok: false, error: typeof json.error === "string" ? json.error : undefined };
  } catch {
    return { ok: false };
  }
}

/** Tab Musik: Bibliothek der Reel-Titel. Nur Titel mit bestätigter Lizenz werden von der Engine verwendet. */
export function SmMusic({ locale, data }: { locale: "de" | "en"; data: MusicData | null }) {
  const s: S = locale === "en" ? en : de;
  const tp = tipStrings(locale);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [provider, setProvider] = useState("");
  const [licenseRef, setLicenseRef] = useState("");
  const [licenseOk, setLicenseOk] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const nextId = useRef(1);

  if (!data) {
    return (
      <section className="mus">
        <h2>{s.title}</h2>
        <p className="sm-warn">{s.unavailable}</p>
      </section>
    );
  }

  function pick(list: FileList | null) {
    if (!list) return;
    const all = Array.from(list);
    const mp3 = all.filter(isMp3);
    setMsg(mp3.length < all.length ? s.onlyMp3 : null);
    setRows((prev) => [...prev, ...mp3.map((f) => ({ id: nextId.current++, file: f, title: cleanName(f.name), mood: "any" as Mood, status: "ready" as const }))]);
    setFileKey((k) => k + 1); // empties the file field so the same files can be picked again
  }
  const patch = (id: number, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function uploadOne(r: Row): Promise<{ ok: boolean; error?: string }> {
    const form = new FormData();
    form.set("file", r.file);
    form.set("title", r.title.trim() || cleanName(r.file.name));
    form.set("provider", provider);
    form.set("mood", r.mood);
    form.set("license_ref", licenseRef);
    form.set("license_ok", String(licenseOk));
    form.set("note", note);
    try {
      const res = await fetch("/api/sm-manager/music", { method: "POST", body: form });
      if (res.ok) return { ok: true };
      return { ok: false, error: ((await res.json().catch(() => ({}))) as { error?: string }).error };
    } catch {
      return { ok: false };
    }
  }

  async function uploadAll() {
    const todo = rows.filter((r) => r.status !== "uploading");
    if (!todo.length) return setMsg(s.chooseFile);
    if (licenseOk && (!provider.trim() || !licenseRef.trim())) return setMsg(s.needProof);
    setBusy(true);
    let ok = 0;
    let bad = 0;
    // One after the other: each file is checked and stored before the next one starts
    for (let i = 0; i < todo.length; i++) {
      const r = todo[i];
      setMsg(s.progress(i + 1, todo.length));
      patch(r.id, { status: "uploading", error: undefined });
      const res = await uploadOne(r);
      if (res.ok) {
        ok++;
        setRows((prev) => prev.filter((x) => x.id !== r.id));
      } else {
        bad++;
        patch(r.id, { status: "error", error: res.error });
      }
    }
    setBusy(false);
    setMsg(s.result(ok, bad));
    if (ok) router.refresh();
  }

  return (
    <section className="mus">
      <div>
        <h2>{s.title}</h2>
        <p className="sm-muted">{s.intro}</p>
        <p className="sm-muted sm-small">{s.gate}</p>
      </div>
      <p className="mus-status">{data.usable > 0 ? s.usable(data.usable) : s.noneUsable}</p>
      {!data.storage ? <p className="sm-warn">{s.noStorage}</p> : null}

      <div className="mus-form">
        <h2>{s.addTitle}</h2>
        <label>
          {s.file}
          <input key={fileKey} type="file" accept=".mp3,audio/mpeg" multiple onChange={(e) => pick(e.target.files)} disabled={busy} />
        </label>

        {rows.length ? (
          <>
            <h3>{s.filesTitle}</h3>
            <ul className="mus-list">
              {rows.map((r) => (
                <li key={r.id} className="mus-row">
                  <input type="text" value={r.title} onChange={(e) => patch(r.id, { title: e.target.value })} maxLength={120} aria-label={s.name} disabled={busy} />
                  <select value={r.mood} onChange={(e) => patch(r.id, { mood: e.target.value as Mood })} aria-label={s.mood} disabled={busy}>
                    {(Object.keys(s.moods) as Mood[]).map((m) => (
                      <option key={m} value={m}>
                        {s.moods[m]}
                      </option>
                    ))}
                  </select>
                  <span className={`sm-badge ${r.status === "error" ? "mus-open" : ""}`}>{s.rowStatus[r.status]}</span>
                  <button type="button" className="sm-btn" onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))} disabled={busy}>
                    {s.removeRow}
                  </button>
                  {r.error ? <span className="sm-warn sm-small mus-rowerr">{r.error}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h3>{s.sharedTitle}</h3>
        <div className="mus-grid">
          <label>
            <span>
              {s.provider}
              <Tip text={s.providerHelp} label={tp.label} />
            </span>
            <input type="text" value={provider} onChange={(e) => setProvider(e.target.value)} maxLength={120} disabled={busy} />
          </label>
          <label>
            <span>
              {s.licenseRef}
              <Tip text={s.licenseRefHelp} label={tp.label} />
            </span>
            <input type="text" value={licenseRef} onChange={(e) => setLicenseRef(e.target.value)} maxLength={300} disabled={busy} />
          </label>
          <label>
            {s.note}
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={busy} />
          </label>
        </div>
        <label className="mus-check">
          <input type="checkbox" checked={licenseOk} onChange={(e) => setLicenseOk(e.target.checked)} disabled={busy} />
          <span>{s.licenseOk}</span>
        </label>
        <div className="sm-actions">
          <button type="button" className="sm-btn sm-btn-primary" onClick={uploadAll} disabled={busy || !data.storage || rows.length === 0}>
            {rows.length > 1 ? s.uploadN(rows.length) : s.upload}
          </button>
          {msg ? (
            <span className="sm-muted sm-small" role="status">
              {msg}
            </span>
          ) : null}
        </div>
      </div>

      <div>
        <h2>{s.listTitle}</h2>
        {data.tracks.length === 0 ? (
          <p className="sm-muted">{s.empty}</p>
        ) : (
          <ul className="mus-list">
            {data.tracks.map((t) => (
              <li key={t.id}>
                <TrackCard s={s} track={t} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TrackCard({ s, track: t }: { s: S; track: Track }) {
  const router = useRouter();
  const [title, setTitle] = useState(t.title);
  const [provider, setProvider] = useState(t.provider);
  const [mood, setMood] = useState<Mood>(t.mood);
  const [licenseRef, setLicenseRef] = useState(t.license_ref);
  const [licenseOk, setLicenseOk] = useState(t.license_ok);
  const [active, setActive] = useState(t.active);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = title !== t.title || provider !== t.provider || mood !== t.mood || licenseRef !== t.license_ref || licenseOk !== t.license_ok || active !== t.active;

  async function save() {
    if (licenseOk && (!provider.trim() || !licenseRef.trim())) return setMsg(s.needProof);
    setBusy(true);
    const r = await call("PUT", `/api/sm-manager/music/${t.id}`, { title, provider, mood, license_ref: licenseRef, license_ok: licenseOk, active });
    setBusy(false);
    setMsg(r.ok ? s.saved : `${s.failed}${r.error ? `: ${r.error}` : ""}`);
    if (r.ok) router.refresh();
  }
  async function remove() {
    if (!window.confirm(s.confirmRemove)) return;
    setBusy(true);
    const r = await call("DELETE", `/api/sm-manager/music/${t.id}`);
    setBusy(false);
    if (r.ok) router.refresh();
    else setMsg(`${s.failed}${r.error ? `: ${r.error}` : ""}`);
  }

  const usable = t.license_ok && t.active;
  return (
    <article className="mus-track">
      <div className="mus-head">
        <strong>{t.title}</strong>
        <span className={`sm-badge ${t.license_ok ? "mus-ok" : "mus-open"}`}>{t.license_ok ? s.approved : s.licenseOpen}</span>
        {!t.active ? <span className="sm-badge">{s.inactive}</span> : null}
        <span className="sm-badge">{s.moods[t.mood]}</span>
        <span className="sm-muted sm-small">{usable ? s.uses(t.used_count) : ""}</span>
      </div>
      {t.previewUrl ? <audio controls preload="none" src={t.previewUrl} /> : null}
      <div className="mus-grid">
        <label>
          {s.name}
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label>
          {s.provider}
          <input type="text" value={provider} onChange={(e) => setProvider(e.target.value)} maxLength={120} />
        </label>
        <label>
          {s.mood}
          <select value={mood} onChange={(e) => setMood(e.target.value as Mood)}>
            {(Object.keys(s.moods) as Mood[]).map((m) => (
              <option key={m} value={m}>
                {s.moods[m]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {s.licenseRef}
          <input type="text" value={licenseRef} onChange={(e) => setLicenseRef(e.target.value)} maxLength={300} />
        </label>
      </div>
      <label className="mus-check">
        <input type="checkbox" checked={licenseOk} onChange={(e) => setLicenseOk(e.target.checked)} />
        <span>{s.licenseOk}</span>
      </label>
      <label className="mus-check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>{s.active}</span>
      </label>
      <div className="sm-actions">
        <button type="button" className="sm-btn sm-btn-primary" onClick={save} disabled={busy || !dirty}>
          {s.save}
        </button>
        <button type="button" className="sm-btn" onClick={remove} disabled={busy}>
          {s.remove}
        </button>
        {msg ? (
          <span className="sm-muted sm-small" role="status">
            {msg}
          </span>
        ) : null}
      </div>
    </article>
  );
}
