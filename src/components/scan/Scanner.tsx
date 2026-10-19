"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, CloudOff, ExternalLink, Image as ImageIcon, Loader2, RefreshCw, RotateCcw, X } from "lucide-react";
import type { DuplicateHit, ScanContact, ScanContext, ScanHistoryEntry, SendResult } from "@/lib/scan/types";

/**
 * Visitenkarten-Scanner: Foto (Kamera oder Datei) → Claude liest die Karte → prüfen → nach GHL.
 * Läuft offline weiter: Scans ohne Netz landen in einer Warteschlange im Browser (IndexedDB)
 * und werden gesendet, sobald die Verbindung zurück ist.
 * /scan?kamera=1 öffnet die Kamera sofort (Home-Bildschirm-Icon und App-Verknüpfung für Messen).
 */

type Mode = "idle" | "camera" | "preview" | "review" | "success";

type QueuedScan = {
  id: string;
  createdAt: string;
  front: string;
  back: string | null;
  contact: ScanContact | null;
  tags: string[];
  eventId: string | null;
  attempts: number;
  lastError: string | null;
};

const EMPTY: ScanContact = {
  firstName: null, lastName: null, email: null, phone: null, mobile: null, company: null, title: null, website: null,
  street: null, city: null, state: null, postalCode: null, country: null, timezone: null, linkedin: null, industry: null,
  language: null, roleTags: [], notes: null, sourceType: "business_card", handwritten: false, uncertain: []
};

const FIELDS: { key: keyof ScanContact; label: string; type?: string; inputMode?: "url"; wide?: boolean }[] = [
  { key: "firstName", label: "Vorname" },
  { key: "lastName", label: "Nachname" },
  { key: "company", label: "Firma" },
  { key: "title", label: "Position" },
  { key: "email", label: "E-Mail", type: "email" },
  { key: "phone", label: "Telefon", type: "tel" },
  { key: "mobile", label: "Mobil", type: "tel" },
  // Kein type="url": Der Browser würde "www.firma.com" ohne https:// als ungültig ablehnen und das Speichern blockieren
  { key: "website", label: "Website", inputMode: "url" },
  { key: "linkedin", label: "LinkedIn", inputMode: "url", wide: true },
  { key: "street", label: "Strasse", wide: true },
  { key: "postalCode", label: "PLZ" },
  { key: "city", label: "Ort" },
  { key: "state", label: "Kanton / Region" },
  { key: "country", label: "Land" },
  { key: "industry", label: "Branche" },
  { key: "language", label: "Sprache (ISO, z. B. de)" }
];

// ── IndexedDB-Warteschlange ──────────────────────────────────

const DB_NAME = "orbit-scan";
const STORE = "queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAll(): Promise<QueuedScan[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedScan[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(rec: QueuedScan): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Bilder ──────────────────────────────────────────────────

/** Verkleinert auf max. 1600 px und speichert als JPEG – Pflicht für Handyfotos (sonst 5–10 MB). */
async function toJpeg(src: Blob | HTMLVideoElement, max = 1600): Promise<string> {
  const canvas = document.createElement("canvas");
  let w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void;
  if (src instanceof Blob) {
    const bmp = await createImageBitmap(src);
    w = bmp.width;
    h = bmp.height;
    draw = (ctx) => ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  } else {
    w = src.videoWidth;
    h = src.videoHeight;
    draw = (ctx) => ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  }
  const scale = Math.min(1, max / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  draw(ctx);
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; duplicate?: DuplicateHit };
  if (res.status === 401) {
    window.location.href = "/signin";
    throw new Error("Nicht angemeldet");
  }
  if (!res.ok) {
    const err = new Error(json.message || json.error || `HTTP ${res.status}`) as Error & { status: number; duplicate?: DuplicateHit };
    err.status = res.status;
    err.duplicate = json.duplicate;
    throw err;
  }
  return json;
}

const isNetworkError = (err: unknown) =>
  !navigator.onLine || (err instanceof Error && (/Failed to fetch|NetworkError|Load failed/i.test(err.message) || (err as { status?: number }).status === 502));

// ── Komponente ──────────────────────────────────────────────

export function Scanner() {
  const [ctx, setCtx] = useState<ScanContext | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [capturingBack, setCapturingBack] = useState(false);
  const [contact, setContact] = useState<ScanContact>(EMPTY);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [eventId, setEventId] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [online, setOnline] = useState(true);
  const [continuous, setContinuous] = useState(false);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshQueue = useCallback(() => dbAll().then(setQueue).catch(() => setQueue([])), []);

  useEffect(() => {
    api<ScanContext>("/api/scan/context")
      .then((c) => {
        setCtx(c);
        setHistory(c.history);
        const savedEvent = localStorage.getItem("orbit-scan-event") ?? "";
        if (c.events.some((e) => e.id === savedEvent)) setEventId(savedEvent);
        setContinuous(localStorage.getItem("orbit-scan-continuous") === "1");
        // /scan?kamera=1 (Home-Bildschirm-Icon, App-Verknüpfung): Kamera sofort öffnen
        if (new URLSearchParams(window.location.search).get("kamera") === "1") void startCamera(false);
      })
      .catch((err) => setCtxError(err instanceof Error ? err.message : String(err)));
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void refreshQueue();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshQueue]);

  useEffect(() => {
    localStorage.setItem("orbit-scan-event", eventId);
  }, [eventId]);

  useEffect(() => {
    localStorage.setItem("orbit-scan-continuous", continuous ? "1" : "0");
  }, [continuous]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Warteschlange abarbeiten, sobald online
  const sendQueued = useCallback(
    async (rec: QueuedScan): Promise<boolean> => {
      try {
        let c = rec.contact;
        if (!c) c = (await api<{ contact: ScanContact }>("/api/scan/extract", { method: "POST", body: JSON.stringify({ front: rec.front, back: rec.back }) })).contact;
        await api<SendResult>("/api/scan/send", {
          method: "POST",
          body: JSON.stringify({ contact: c, tags: rec.tags, eventId: rec.eventId, photos: { front: rec.front, back: rec.back }, confirmUpdate: true })
        });
        await dbDelete(rec.id);
        return true;
      } catch (err) {
        await dbPut({ ...rec, attempts: rec.attempts + 1, lastError: err instanceof Error ? err.message : String(err) });
        return false;
      }
    },
    []
  );

  useEffect(() => {
    if (!online || !queue.length || busy) return;
    let cancelled = false;
    (async () => {
      for (const rec of queue) {
        if (cancelled) return;
        if (rec.attempts >= 10) continue;
        await sendQueued(rec);
      }
      if (!cancelled) {
        await refreshQueue();
        api<{ history: ScanHistoryEntry[] }>("/api/scan/history").then((r) => setHistory(r.history)).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, queue.length]);

  // ── Kamera ──
  async function startCamera(forBack = false) {
    setError(null);
    setCapturingBack(forBack);
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setMode(forBack ? "preview" : "idle");
      setError(`Kamera nicht verfügbar (${err instanceof Error ? err.message : "Zugriff verweigert"}). Nimm „Foto wählen“.`);
    }
  }

  async function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const jpeg = await toJpeg(v);
    stopCamera();
    if (capturingBack) setBack(jpeg);
    else {
      setFront(jpeg);
      setBack(null);
    }
    setMode("preview");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const jpeg = await toJpeg(file);
      if (mode === "preview" && front) setBack(jpeg);
      else {
        setFront(jpeg);
        setBack(null);
      }
      setMode("preview");
    } catch {
      setError("Bild konnte nicht gelesen werden. HEIC-Fotos vom iPhone bitte als JPEG aufnehmen (Einstellungen → Kamera → Formate → Maximale Kompatibilität).");
    }
  }

  // ── Auslesen ──
  async function extract() {
    if (!front) return;
    setBusy("Claude liest die Karte …");
    setError(null);
    try {
      const r = await api<{ contact: ScanContact }>("/api/scan/extract", { method: "POST", body: JSON.stringify({ front, back }) });
      setContact({ ...EMPTY, ...r.contact });
      setTags([]);
      setMode("review");
    } catch (err) {
      if (isNetworkError(err)) {
        await queueScan(null);
        return;
      }
      setError(`Auslesen fehlgeschlagen: ${err instanceof Error ? err.message : err}. Du kannst die Daten von Hand eintragen.`);
      setContact(EMPTY);
      setTags([]);
      setMode("review");
    } finally {
      setBusy(null);
    }
  }

  async function queueScan(c: ScanContact | null) {
    if (!front) return;
    await dbPut({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      front,
      back,
      contact: c,
      tags,
      eventId: eventId || null,
      attempts: 0,
      lastError: null
    });
    await refreshQueue();
    setResult(null);
    setMode("success");
    setBusy(null);
  }

  // ── Senden ──
  async function send(confirmUpdate = false) {
    setBusy(confirmUpdate ? "Kontakt wird aktualisiert …" : "Wird an GHL gesendet …");
    setError(null);
    try {
      const r = await api<SendResult>("/api/scan/send", {
        method: "POST",
        body: JSON.stringify({ contact, tags, eventId: eventId || null, photos: { front, back }, confirmUpdate })
      });
      setResult(r);
      setMode("success");
      api<{ history: ScanHistoryEntry[] }>("/api/scan/history").then((h) => setHistory(h.history)).catch(() => {});
      if (continuous) setTimeout(() => startCamera(false), 1800);
    } catch (err) {
      const e = err as Error & { status?: number; duplicate?: DuplicateHit };
      if (e.status === 409 && e.duplicate?.contact) {
        const d = e.duplicate.contact;
        if (confirm(`In GHL gibt es schon „${d.name || d.email || d.phone}“${d.company ? ` (${d.company})` : ""}.\n\nOK = diesen Kontakt aktualisieren, Abbrechen = nichts ändern.`)) {
          setBusy(null);
          return send(true);
        }
        setError("Nicht gesendet – der bestehende Kontakt bleibt unverändert.");
      } else if (isNetworkError(err)) {
        await queueScan(contact);
        return;
      } else {
        setError(`Senden fehlgeschlagen: ${e.message}`);
      }
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    stopCamera();
    setFront(null);
    setBack(null);
    setContact(EMPTY);
    setTags([]);
    setResult(null);
    setError(null);
    setMode("idle");
  }

  // ── Tags ──
  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    const all = ctx?.tags ?? [];
    const chosen = new Set(tags.map((t) => t.toLowerCase()));
    return (q ? all.filter((t) => t.toLowerCase().includes(q)) : all).filter((t) => !chosen.has(t.toLowerCase())).slice(0, 8);
  }, [tagInput, ctx, tags]);

  function addTag(t: string) {
    const clean = t.trim();
    if (!clean || tags.some((x) => x.toLowerCase() === clean.toLowerCase())) return;
    setTags([...tags, clean]);
    setTagInput("");
  }

  async function createTag() {
    const name = tagInput.trim();
    if (!name) return;
    try {
      const r = await api<{ tag: string }>("/api/scan/tags", { method: "POST", body: JSON.stringify({ name }) });
      setCtx((c) => (c ? { ...c, tags: [...c.tags, r.tag].sort((a, b) => a.localeCompare(b)) } : c));
      addTag(r.tag);
    } catch (err) {
      setError(`Tag nicht angelegt: ${err instanceof Error ? err.message : err}`);
    }
  }

  async function enrich() {
    setBusy("Suche LinkedIn-Profil …");
    try {
      const r = await api<{ found: boolean; linkedin?: string | null; title?: string | null; industry?: string | null }>("/api/scan/enrich", {
        method: "POST",
        body: JSON.stringify({ firstName: contact.firstName, lastName: contact.lastName, company: contact.company, email: contact.email, linkedin: contact.linkedin, title: contact.title })
      });
      if (!r.found) setError("Kein passendes Profil gefunden.");
      else
        setContact((c) => ({
          ...c,
          linkedin: c.linkedin || r.linkedin || null,
          title: c.title || r.title || null,
          industry: c.industry || r.industry || null
        }));
    } catch (err) {
      setError(`Anreicherung fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
    }
  }

  // Wer ein unsicheres Feld anfasst, hat es geprüft: Markierung entfernen
  const set = (key: keyof ScanContact, value: string) =>
    setContact((c) => ({ ...c, [key]: value.trim() ? value : null, uncertain: (c.uncertain ?? []).filter((f) => f !== key) }));
  const isUncertain = (key: keyof ScanContact) => (contact.uncertain ?? []).includes(key as string);
  const uncertainLabels = FIELDS.filter((f) => isUncertain(f.key)).map((f) => f.label);
  const currentEvent = ctx?.events.find((e) => e.id === eventId) ?? null;

  if (ctxError) return <div className="sc-page"><p className="sc-msg sc-msg-error">{ctxError}</p></div>;

  return (
    <div className="sc-page">
      <header className="sc-head">
        <div>
          <h1>Visitenkarten scannen</h1>
          <p className="sc-sub">Karte fotografieren, Daten prüfen, Kontakt landet in GHL – zugewiesen an dich.</p>
        </div>
        <div className="sc-head-right">
          {!online && (
            <span className="sc-badge sc-badge-off">
              <CloudOff size={14} aria-hidden="true" /> offline
            </span>
          )}
          {queue.length > 0 && <span className="sc-badge">{queue.length} in Warteschlange</span>}
        </div>
      </header>

      {ctx && !ctx.ghlConfigured && <p className="sc-msg sc-msg-error">GHL ist in Orbit nicht konfiguriert (GHL_API_TOKEN, GHL_LOCATION_ID).</p>}
      {ctx && !ctx.claudeConfigured && <p className="sc-msg sc-msg-error">ANTHROPIC_API_KEY fehlt – Karten können nicht ausgelesen werden.</p>}
      {ctx && ctx.ghlConfigured && !ctx.user.ghlUserId && (
        <p className="sc-msg sc-msg-warn">Zu deiner E-Mail ({ctx.user.email}) gibt es keinen GHL-User. Kontakte werden ohne Zuweisung angelegt.</p>
      )}
      {error && <p className="sc-msg sc-msg-error">{error}</p>}

      <div className="sc-grid">
        <section className="sc-card sc-stage">
          {mode === "idle" && (
            <div className="sc-idle">
              <button className="sc-btn sc-btn-primary sc-big" onClick={() => startCamera(false)} disabled={!ctx}>
                <Camera size={20} aria-hidden="true" /> Kamera öffnen
              </button>
              <button className="sc-btn sc-btn-secondary sc-big" onClick={() => fileRef.current?.click()} disabled={!ctx}>
                <ImageIcon size={20} aria-hidden="true" /> Foto wählen
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <p className="sc-hint">Funktioniert auch mit handgeschriebenen Karten und mit Fotos oder Screenshots eines LinkedIn-Profils.</p>
            </div>
          )}

          {mode === "camera" && (
            <div className="sc-cam">
              <video ref={videoRef} playsInline muted autoPlay className="sc-video" />
              <div className="sc-guide" aria-hidden="true" />
              <div className="sc-cam-label">{capturingBack ? "Rückseite" : "Vorderseite"}</div>
              <div className="sc-actions">
                <button className="sc-btn sc-btn-secondary" onClick={() => { stopCamera(); setMode(front ? "preview" : "idle"); }}>
                  <X size={16} aria-hidden="true" /> Abbrechen
                </button>
                <button className="sc-btn sc-btn-primary" onClick={capture}>
                  <Camera size={16} aria-hidden="true" /> Aufnehmen
                </button>
              </div>
            </div>
          )}

          {mode === "preview" && front && (
            <div className="sc-preview">
              <div className="sc-thumbs">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={front} alt="Vorderseite" />
                  <figcaption>Vorderseite</figcaption>
                </figure>
                <figure>
                  {back ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={back} alt="Rückseite" />
                  ) : (
                    <button className="sc-add-back" onClick={() => startCamera(true)}>
                      <Camera size={18} aria-hidden="true" />
                      Rückseite hinzufügen
                    </button>
                  )}
                  <figcaption>{back ? "Rückseite" : "optional"}</figcaption>
                </figure>
              </div>
              <div className="sc-actions">
                <button className="sc-btn sc-btn-secondary" onClick={reset}>
                  <RotateCcw size={16} aria-hidden="true" /> Neu
                </button>
                <button className="sc-btn sc-btn-secondary" onClick={() => fileRef.current?.click()}>
                  <ImageIcon size={16} aria-hidden="true" /> {back ? "Rückseite ersetzen" : "Rückseite aus Datei"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
                <button className="sc-btn sc-btn-primary" onClick={extract} disabled={Boolean(busy) || !ctx?.claudeConfigured}>
                  {busy ? <Loader2 size={16} className="sc-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Auslesen
                </button>
              </div>
            </div>
          )}

          {mode === "review" && (
            <form
              className="sc-review"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void send(false);
              }}
            >
              <div className="sc-review-head">
                <h2>Prüfen und senden</h2>
                <div className="sc-head-right">
                  {contact.handwritten && <span className="sc-badge">Handschrift</span>}
                  {contact.sourceType === "linkedin_profile" && <span className="sc-badge">LinkedIn-Profil erkannt</span>}
                </div>
              </div>
              {uncertainLabels.length > 0 && (
                <p className="sc-msg sc-msg-warn">
                  Bitte mit dem Foto vergleichen, Claude war sich hier nicht sicher: {uncertainLabels.join(", ")}.
                </p>
              )}
              {front && (
                <div className="sc-ref">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={front} alt="Vorderseite zum Vergleich" />
                  {back && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={back} alt="Rückseite zum Vergleich" />
                  )}
                </div>
              )}
              <div className="sc-fields">
                {FIELDS.map((f) => (
                  <label key={f.key} className={`sc-field${f.wide ? " sc-wide" : ""}${isUncertain(f.key) ? " sc-uncertain" : ""}`}>
                    <span>
                      {f.label}
                      {isUncertain(f.key) && <em> · prüfen</em>}
                    </span>
                    <input
                      type={f.type ?? "text"}
                      inputMode={f.inputMode}
                      autoCapitalize={f.inputMode ? "off" : undefined}
                      autoCorrect={f.inputMode ? "off" : undefined}
                      spellCheck={f.inputMode ? false : undefined}
                      value={(contact[f.key] as string | null) ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  </label>
                ))}
                <label className="sc-field sc-wide">
                  <span>Notizen</span>
                  <textarea rows={3} value={contact.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </label>
              </div>

              <div className="sc-field sc-wide">
                <span>Tags</span>
                <div className="sc-chips">
                  {tags.map((t) => (
                    <button type="button" key={t} className="sc-chip sc-chip-x" onClick={() => setTags(tags.filter((x) => x !== t))} title="Entfernen">
                      {t} <X size={12} aria-hidden="true" />
                    </button>
                  ))}
                  {(contact.roleTags ?? []).map((r) => (
                    <span key={r} className="sc-chip sc-chip-auto" title="Automatisch aus der Position">
                      rolle-{r}
                    </span>
                  ))}
                  {currentEvent && (
                    <span className="sc-chip sc-chip-auto" title="Automatisch aus der Messe">
                      messe-{currentEvent.slug}
                    </span>
                  )}
                </div>
                <div className="sc-tag-input">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const q = tagInput.trim();
                      if (!q) return;
                      const exact = ctx?.tags.find((t) => t.toLowerCase() === q.toLowerCase());
                      if (exact) addTag(exact);
                      else if (tagSuggestions[0]) addTag(tagSuggestions[0]);
                      else void createTag();
                    }}
                    placeholder="Tag suchen oder neu anlegen (Enter)"
                  />
                  {tagSuggestions.length > 0 && tagInput && (
                    <div className="sc-suggest">
                      {tagSuggestions.map((t) => (
                        <button type="button" key={t} onClick={() => addTag(t)}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="sc-actions">
                <button type="button" className="sc-btn sc-btn-secondary" onClick={() => setMode("preview")}>
                  <RotateCcw size={16} aria-hidden="true" /> Zurück
                </button>
                {ctx?.enrichConfigured && !contact.linkedin && (
                  <button type="button" className="sc-btn sc-btn-secondary" onClick={enrich} disabled={Boolean(busy)}>
                    LinkedIn suchen
                  </button>
                )}
                <button type="submit" className="sc-btn sc-btn-primary" disabled={Boolean(busy) || !ctx?.ghlConfigured}>
                  {busy ? <Loader2 size={16} className="sc-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} An GHL senden
                </button>
              </div>
              {busy && <p className="sc-hint">{busy}</p>}
            </form>
          )}

          {mode === "success" && (
            <div className="sc-success">
              <div className="sc-success-icon">{result ? <Check size={28} aria-hidden="true" /> : <CloudOff size={28} aria-hidden="true" />}</div>
              {result ? (
                <>
                  <h2>{result.isNew ? "Kontakt angelegt" : "Kontakt aktualisiert"}</h2>
                  <p className="sc-sub">
                    {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email}
                    {result.photos ? ` · ${result.photos} Foto${result.photos > 1 ? "s" : ""} angehängt` : ""}
                  </p>
                  {result.warnings.map((w) => (
                    <p key={w} className="sc-msg sc-msg-warn">
                      {w}
                    </p>
                  ))}
                  <a className="sc-btn sc-btn-secondary" href={result.contactUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden="true" /> In GHL öffnen
                  </a>
                </>
              ) : (
                <>
                  <h2>Gespeichert, wird später gesendet</h2>
                  <p className="sc-sub">Keine Verbindung. Der Scan liegt in der Warteschlange und geht automatisch raus, sobald du wieder online bist.</p>
                </>
              )}
              <div className="sc-actions">
                <button className="sc-btn sc-btn-primary sc-big" onClick={() => { reset(); void startCamera(false); }}>
                  <Camera size={18} aria-hidden="true" /> Nächste Karte
                </button>
                <button className="sc-btn sc-btn-secondary" onClick={reset}>
                  Fertig
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="sc-side">
          <section className="sc-card">
            <h2>Einstellungen</h2>
            <label className="sc-field">
              <span>Messe</span>
              <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">Keine – normaler Scan</option>
                {(ctx?.events ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <small>Mit Messe bekommt jeder Kontakt Quelle „Messe: …“ und die Tags der Messe aus /messen.</small>
            </label>
            <label className="sc-switch">
              <input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} />
              Serienmodus: nach dem Senden direkt die nächste Karte
            </label>
          </section>

          {queue.length > 0 && (
            <section className="sc-card">
              <div className="sc-card-head">
                <h2>Warteschlange</h2>
                <button className="sc-btn sc-btn-link" onClick={() => refreshQueue()}>
                  <RefreshCw size={12} aria-hidden="true" /> aktualisieren
                </button>
              </div>
              <ul className="sc-list">
                {queue.map((q) => (
                  <li key={q.id}>
                    <b>{q.contact ? [q.contact.firstName, q.contact.lastName].filter(Boolean).join(" ") || q.contact.email || "Kontakt" : "Noch nicht ausgelesen"}</b>
                    <span className="sc-muted">
                      {new Date(q.createdAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                      {q.lastError ? ` · ${q.attempts}× fehlgeschlagen` : ""}
                    </span>
                    {q.lastError && <span className="sc-muted sc-err">{q.lastError}</span>}
                    <span className="sc-row-actions">
                      <button className="sc-btn sc-btn-link" onClick={() => sendQueued(q).then(refreshQueue)} disabled={!online}>
                        erneut
                      </button>
                      <button className="sc-btn sc-btn-link" onClick={() => dbDelete(q.id).then(refreshQueue)}>
                        löschen
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="sc-card">
            <div className="sc-card-head">
              <h2>Zuletzt im Team</h2>
              <a className="sc-btn sc-btn-link" href="/scan/verlauf">
                alle
              </a>
            </div>
            {history.length === 0 ? (
              <p className="sc-muted">Noch keine Scans.</p>
            ) : (
              <ul className="sc-list">
                {history.slice(0, 8).map((h) => (
                  <li key={h.id}>
                    <b>{h.name}</b>
                    <span className="sc-muted">
                      {h.company ? `${h.company} · ` : ""}
                      {h.userName} · {new Date(h.createdAt).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
