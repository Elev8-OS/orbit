"use client";

import { useState } from "react";
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
  file: "MP3-Datei (bis 15 MB)",
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
  uploading: "Wird hochgeladen und geprüft …",
  chooseFile: "Bitte wähle eine MP3-Datei.",
  needProof: "Für die Freigabe brauchen wir Anbieter und Lizenz-Nachweis.",
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
  addTitle: "Add a track",
  file: "MP3 file (up to 15 MB)",
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
  uploading: "Uploading and checking ...",
  chooseFile: "Please choose an MP3 file.",
  needProof: "Approval needs the provider and the license proof.",
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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [mood, setMood] = useState<Mood>("any");
  const [licenseRef, setLicenseRef] = useState("");
  const [licenseOk, setLicenseOk] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  if (!data) {
    return (
      <section className="mus">
        <h2>{s.title}</h2>
        <p className="sm-warn">{s.unavailable}</p>
      </section>
    );
  }

  async function upload() {
    if (!file) return setMsg(s.chooseFile);
    if (licenseOk && (!provider.trim() || !licenseRef.trim())) return setMsg(s.needProof);
    setBusy(true);
    setMsg(s.uploading);
    const form = new FormData();
    form.set("file", file);
    form.set("title", title.trim() || file.name.replace(/\.mp3$/i, ""));
    form.set("provider", provider);
    form.set("mood", mood);
    form.set("license_ref", licenseRef);
    form.set("license_ok", String(licenseOk));
    form.set("note", note);
    let ok = false;
    let error: string | undefined;
    try {
      const res = await fetch("/api/sm-manager/music", { method: "POST", body: form });
      ok = res.ok;
      if (!ok) error = ((await res.json().catch(() => ({}))) as { error?: string }).error;
    } catch {
      ok = false;
    }
    setBusy(false);
    if (ok) {
      setMsg(s.saved);
      setFile(null);
      setFileKey((k) => k + 1);
      setTitle("");
      setProvider("");
      setMood("any");
      setLicenseRef("");
      setLicenseOk(false);
      setNote("");
      router.refresh();
    } else {
      setMsg(`${s.failed}${error ? `: ${error}` : ""}`);
    }
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
          <input key={fileKey} type="file" accept=".mp3,audio/mpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <div className="mus-grid">
          <label>
            {s.name}
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </label>
          <label>
            <span>
              {s.provider}
              <Tip text={s.providerHelp} label={tp.label} />
            </span>
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
            <span>
              {s.licenseRef}
              <Tip text={s.licenseRefHelp} label={tp.label} />
            </span>
            <input type="text" value={licenseRef} onChange={(e) => setLicenseRef(e.target.value)} maxLength={300} />
          </label>
        </div>
        <label>
          {s.note}
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>
        <label className="mus-check">
          <input type="checkbox" checked={licenseOk} onChange={(e) => setLicenseOk(e.target.checked)} />
          <span>{s.licenseOk}</span>
        </label>
        <div className="sm-actions">
          <button type="button" className="sm-btn sm-btn-primary" onClick={upload} disabled={busy || !data.storage}>
            {s.upload}
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
