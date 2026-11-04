"use client";

import { useRef, useState } from "react";
import "./upload.css";

type Item = { key: string; file: File; preview: string; caption: string; state: "ready" | "uploading" | "done" | "error"; error?: string };

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export function UploadForm({ token, venueName, remaining, prefill }: { token: string; venueName: string; remaining: number; prefill: { contactName: string; instagram: string } }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [contactName, setContactName] = useState(prefill.contactName);
  const [instagram, setInstagram] = useState(prefill.instagram);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);

  const room = remaining - items.filter((i) => i.state !== "done").length;

  function pick(files: FileList | null) {
    if (!files) return;
    const added: Item[] = [];
    const skipped: string[] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED.includes(f.type)) skipped.push(`${f.name}: please use JPG, PNG or WebP`);
      else if (f.size > MAX_BYTES) skipped.push(`${f.name}: larger than 15 MB`);
      else if (added.length >= room) skipped.push(`${f.name}: photo limit reached`);
      else added.push({ key: `${f.name}-${f.size}-${Math.random()}`, file: f, preview: URL.createObjectURL(f), caption: "", state: "ready" });
    }
    setItems((cur) => [...cur, ...added]);
    setMessage(skipped.join(" · "));
    if (input.current) input.current.value = "";
  }

  function patch(key: string, change: Partial<Item>) {
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...change } : i)));
  }

  async function submit() {
    if (!rights) return setMessage("Please tick the box to confirm that you may share these photos.");
    if (items.length === 0) return setMessage("Please choose at least one photo.");
    setBusy(true);
    setMessage("");
    let failed = 0;
    for (const it of items) {
      if (it.state === "done") continue;
      patch(it.key, { state: "uploading", error: undefined });
      const form = new FormData();
      form.set("file", it.file);
      form.set("caption", it.caption);
      form.set("rights", "true");
      form.set("instagram", instagram);
      form.set("contact_name", contactName);
      try {
        const res = await fetch(`/api/venues/public/${encodeURIComponent(token)}/photos`, { method: "POST", body: form });
        if (res.ok) patch(it.key, { state: "done" });
        else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          patch(it.key, { state: "error", error: data.error ?? "Upload failed" });
          failed++;
        }
      } catch {
        patch(it.key, { state: "error", error: "No connection. Please try again." });
        failed++;
      }
    }
    setBusy(false);
    if (failed === 0) setFinished(true);
    else setMessage(`${failed} photo(s) could not be uploaded. Please press the button again to retry.`);
  }

  if (finished) {
    return (
      <section className="pub-card up-done">
        <h2>Thank you!</h2>
        <p className="pub-muted">Your photos for {venueName} have arrived. We will review them and tag you when we post. If you want to add more, simply open this link again.</p>
      </section>
    );
  }

  if (remaining <= 0) {
    return (
      <section className="pub-card">
        <h2>Photo limit reached</h2>
        <p className="pub-muted">We already have the maximum number of photos for {venueName}. Thank you!</p>
      </section>
    );
  }

  return (
    <section className="pub-card up-card">
      <h2>Your photos</h2>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
      <button type="button" className="pub-button up-pick" onClick={() => input.current?.click()} disabled={busy || room <= 0}>
        Choose photos
      </button>
      <p className="pub-muted up-hint">JPG, PNG or WebP, up to 15 MB each. The original files from your camera or phone are best.</p>

      {items.length > 0 && (
        <ul className="up-list">
          {items.map((it) => (
            <li key={it.key} className={`up-item up-${it.state}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.preview} alt="" className="up-thumb" />
              <div className="up-body">
                <input
                  type="text"
                  className="up-text"
                  placeholder="What is in this photo? (for example: sunset on the rooftop)"
                  maxLength={300}
                  value={it.caption}
                  disabled={busy || it.state === "done"}
                  onChange={(e) => patch(it.key, { caption: e.target.value })}
                />
                <small>{it.state === "done" ? "Uploaded ✓" : it.state === "uploading" ? "Uploading…" : it.state === "error" ? it.error : it.file.name}</small>
              </div>
              {!busy && it.state !== "done" && (
                <button type="button" className="up-remove" aria-label="Remove photo" onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="up-fields">
        <label>
          Your name (optional)
          <input type="text" className="up-text" maxLength={80} value={contactName} disabled={busy} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label>
          Instagram name to tag (optional)
          <input type="text" className="up-text" placeholder="@yourname" maxLength={40} value={instagram} disabled={busy} onChange={(e) => setInstagram(e.target.value)} />
        </label>
      </div>

      <label className="up-rights">
        <input type="checkbox" checked={rights} disabled={busy} onChange={(e) => setRights(e.target.checked)} />
        <span>
          I confirm that {venueName} owns these photos or has the right to share them, and allows The R Villas Bali to use them in posts and reels on its Instagram and Facebook accounts, with a tag to {venueName}.
        </span>
      </label>

      {message && <p className="up-message">{message}</p>}

      <button type="button" className="pub-button" onClick={submit} disabled={busy || items.length === 0}>
        {busy ? "Uploading…" : "Send photos"}
      </button>
    </section>
  );
}
