"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { VideoFormState } from "@/app/webinare/video-actions";

/**
 * Schnittliste des Erklärvideos bearbeiten: Titel, Bildausschnitt, Kapitel mit Clips und Kernaussage, YouTube-Texte.
 * Zeiten werden als m:ss eingegeben; unter jedem Clip steht der Transkripttext zur Kontrolle.
 */

type Clip = { start: number; end: number };
type Chapter = { title: string; key: string; clips: Clip[] };
export type EditorPlan = {
  title: string;
  subtitle: string;
  meta: string;
  layout: "teams-share" | "full";
  allowGallery: boolean;
  pip: { enabled: boolean; name: string };
  outro: { title: string; url: string };
  chapters: Chapter[];
  youtube: { title: string; description: string; tags: string[] };
};
export type Line = { start: number; end: number; text: string };

type ClipRow = { id: number; start: string; end: string };
type ChapterRow = { id: number; title: string; key: string; clips: ClipRow[] };

let seq = 0;
const nextId = () => ++seq;

const fmt = (sec: number) => {
  const t = Math.max(0, sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = (Number.isInteger(s) ? String(s) : s.toFixed(1)).padStart(Number.isInteger(s) ? 2 : 4, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
const parse = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  return Math.round(parts.reduce((a, p) => a * 60 + p, 0) * 10) / 10;
};
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

function Save({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="me-btn me-btn-primary" disabled={pending || disabled}>
      {pending ? "Speichert …" : "Schnittliste speichern"}
    </button>
  );
}

export function VideoPlanEditor({
  webinarId,
  initial,
  lines,
  readOnly,
  action,
  target
}: {
  webinarId: string;
  initial: EditorPlan;
  lines: Line[];
  readOnly: boolean;
  action: (state: VideoFormState, form: FormData) => Promise<VideoFormState>;
  target: { min: number; max: number };
}) {
  const [state, formAction] = useActionState(action, null);
  const toRows = (src: EditorPlan): ChapterRow[] =>
    src.chapters.map((c) => ({ id: nextId(), title: c.title, key: c.key, clips: c.clips.map((k) => ({ id: nextId(), start: fmt(k.start), end: fmt(k.end) })) }));
  const [p, setP] = useState(() => ({ ...initial }));
  const [chapters, setChapters] = useState<ChapterRow[]>(() => toRows(initial));
  const [tags, setTags] = useState(initial.youtube.tags.join(", "));

  const clipOf = (k: ClipRow) => {
    const start = parse(k.start);
    const end = parse(k.end);
    return start !== null && end !== null ? { start, end } : null;
  };
  const textOf = (c: Clip) =>
    lines
      .filter((l) => l.start < c.end && l.end > c.start)
      .map((l) => l.text)
      .join(" ");

  const total = useMemo(
    () => chapters.reduce((s, ch) => s + ch.clips.reduce((a, k) => { const c = clipOf(k); return a + (c && c.end > c.start ? c.end - c.start : 0); }, 0), 0),
    [chapters]
  );
  const problems = chapters.flatMap((ch, ci) =>
    ch.clips.flatMap((k, ki) => {
      const c = clipOf(k);
      if (!c) return [`Kapitel ${ci + 1}, Clip ${ki + 1}: Zeit nicht lesbar (Format m:ss)`];
      if (c.end <= c.start) return [`Kapitel ${ci + 1}, Clip ${ki + 1}: Ende liegt vor dem Anfang`];
      return [];
    })
  );

  const plan: EditorPlan = {
    ...p,
    chapters: chapters.map((ch) => ({
      title: ch.title,
      key: ch.key,
      clips: ch.clips.map(clipOf).filter((c): c is Clip => Boolean(c && c.end > c.start))
    })),
    youtube: { ...p.youtube, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }
  };

  // Neue Daten vom Server (z. B. Vorschlag von Claude) übernehmen, aber nicht nach dem eigenen Speichern:
  // dann stimmen sie mit dem überein, was der Editor schon zeigt, und die Rückmeldung bleibt stehen.
  const initialJson = JSON.stringify(initial);
  const seen = useRef(initialJson);
  const planJson = JSON.stringify(plan);
  useEffect(() => {
    if (initialJson === seen.current) return;
    const before = JSON.parse(seen.current) as EditorPlan;
    seen.current = initialJson;
    if (initialJson === planJson) return;
    // Nur die YouTube-Texte neu (eigener Claude-Knopf): übrige Eingaben im Editor nicht überschreiben
    if (JSON.stringify({ ...before, youtube: null }) === JSON.stringify({ ...initial, youtube: null })) {
      setP((cur) => ({ ...cur, youtube: initial.youtube }));
      setTags(initial.youtube.tags.join(", "));
      return;
    }
    setP({ ...initial });
    setChapters(toRows(initial));
    setTags(initial.youtube.tags.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJson]);

  const setCh = (id: number, patch: Partial<ChapterRow>) => setChapters((all) => all.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const setClip = (cid: number, kid: number, patch: Partial<ClipRow>) =>
    setChapters((all) => all.map((c) => (c.id === cid ? { ...c, clips: c.clips.map((k) => (k.id === kid ? { ...k, ...patch } : k)) } : c)));
  const move = (i: number, d: -1 | 1) =>
    setChapters((all) => {
      const next = [...all];
      const j = i + d;
      if (j < 0 || j >= next.length) return all;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const tone = total === 0 ? "" : total < target.min ? "wb-vid-short" : total > target.max ? "wb-vid-long" : "wb-vid-ok";

  return (
    <form action={formAction} className="me-form">
      <input type="hidden" name="id" value={webinarId} />
      <input type="hidden" name="plan" value={JSON.stringify(plan)} />
      <fieldset disabled={readOnly} className="wb-vid-fs">
        <div className="me-row">
          <label className="me-field">
            <span>Titel im Video</span>
            <input value={p.title} maxLength={90} onChange={(e) => setP({ ...p, title: e.target.value })} />
          </label>
          <label className="me-field">
            <span>Zeile unter dem Titel</span>
            <input value={p.meta} maxLength={90} onChange={(e) => setP({ ...p, meta: e.target.value })} />
          </label>
        </div>
        <label className="me-field">
          <span>Untertitel <em>(ein Satz Nutzen)</em></span>
          <input value={p.subtitle} maxLength={180} onChange={(e) => setP({ ...p, subtitle: e.target.value })} />
        </label>

        <div className="me-row">
          <label className="me-field">
            <span>Bildausschnitt</span>
            <select value={p.layout} onChange={(e) => setP({ ...p, layout: e.target.value === "full" ? "full" : "teams-share" })}>
              <option value="teams-share">Bildschirmfreigabe aus Teams (App bildfüllend)</option>
              <option value="full">Ganzes Bild der Aufnahme</option>
            </select>
            <small>
              {p.layout === "teams-share"
                ? "Der Render-Dienst prüft jeden Clip. Zeigt einer die Ansicht mit Teilnehmenden, bricht er mit einem Hinweis ab."
                : "Teilnehmende und ihre Namen sind dann im Video sichtbar."}
            </small>
          </label>
          <div className="me-field">
            <label className="wb-vid-label">
              <span>Sprecher im Kreis unten rechts</span>
              <input value={p.pip.name} maxLength={40} placeholder="Name, z. B. Reto Wyss" onChange={(e) => setP({ ...p, pip: { ...p.pip, name: e.target.value } })} />
            </label>
            <div className="wb-vid-checks">
              <label>
                <input className="wb-check" type="checkbox" checked={p.pip.enabled} onChange={(e) => setP({ ...p, pip: { ...p.pip, enabled: e.target.checked } })} />
                <span>Kamerabild des Sprechers zeigen</span>
              </label>
              {p.layout === "teams-share" && (
                <label>
                  <input className="wb-check" type="checkbox" checked={p.allowGallery} onChange={(e) => setP({ ...p, allowGallery: e.target.checked })} />
                  <span>Ansicht mit Teilnehmenden zulassen</span>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="wb-vid-head">
          <h3>Kapitel</h3>
          <span className={`wb-vid-total ${tone}`}>
            Clips zusammen {mmss(total)} {total > 0 && <em>(Ziel {mmss(target.min)}–{mmss(target.max)}, dazu Eröffnung und Abschluss)</em>}
          </span>
        </div>

        {chapters.map((ch, ci) => (
          <div key={ch.id} className="wb-vid-ch">
            <div className="wb-vid-ch-head">
              <span className="wb-vid-n">{ci + 1}</span>
              <input className="wb-vid-title" value={ch.title} maxLength={70} placeholder="Kapiteltitel: was man lernt" onChange={(e) => setCh(ch.id, { title: e.target.value })} aria-label={`Titel Kapitel ${ci + 1}`} />
              <div className="wb-vid-tools">
                <button type="button" className="me-btn me-btn-secondary wb-icon" onClick={() => move(ci, -1)} disabled={ci === 0} aria-label="Nach oben">
                  <ArrowUp size={16} />
                </button>
                <button type="button" className="me-btn me-btn-secondary wb-icon" onClick={() => move(ci, 1)} disabled={ci === chapters.length - 1} aria-label="Nach unten">
                  <ArrowDown size={16} />
                </button>
                <button type="button" className="me-btn me-btn-secondary wb-icon" onClick={() => setChapters((all) => all.filter((c) => c.id !== ch.id))} aria-label="Kapitel entfernen">
                  <X size={16} />
                </button>
              </div>
            </div>
            {ch.clips.map((k, ki) => {
              const c = clipOf(k);
              const bad = !c || c.end <= c.start;
              return (
                <div key={k.id} className="wb-vid-clip">
                  <div className="wb-vid-times">
                    <label>
                      <span>Von</span>
                      <input value={k.start} inputMode="decimal" onChange={(e) => setClip(ch.id, k.id, { start: e.target.value })} aria-invalid={bad} />
                    </label>
                    <label>
                      <span>Bis</span>
                      <input value={k.end} inputMode="decimal" onChange={(e) => setClip(ch.id, k.id, { end: e.target.value })} aria-invalid={bad} />
                    </label>
                    <span className="wb-vid-dur">{c && !bad ? `${Math.round(c.end - c.start)} s` : "–"}</span>
                    <button
                      type="button"
                      className="me-btn me-btn-secondary wb-icon"
                      onClick={() => setCh(ch.id, { clips: ch.clips.filter((x) => x.id !== k.id) })}
                      aria-label={`Clip ${ki + 1} entfernen`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="wb-vid-text">{c && !bad ? textOf(c) || "Kein Transkript an dieser Stelle." : "Zeiten im Format m:ss eingeben, z. B. 7:02."}</p>
                </div>
              );
            })}
            <button
              type="button"
              className="me-btn me-btn-secondary wb-vid-add"
              onClick={() => {
                const last = ch.clips[ch.clips.length - 1];
                const from = last ? parse(last.end) ?? 0 : 0;
                setCh(ch.id, { clips: [...ch.clips, { id: nextId(), start: fmt(from), end: fmt(from + 20) }] });
              }}
            >
              <Plus size={16} /> Clip
            </button>
            <label className="me-field wb-field" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              <span>Kernaussage <em>(ein Satz, erscheint am Ende des Kapitels; leer lassen für keine)</em></span>
              <textarea rows={2} maxLength={160} value={ch.key} onChange={(e) => setCh(ch.id, { key: e.target.value })} />
            </label>
          </div>
        ))}
        <button type="button" className="me-btn me-btn-secondary" onClick={() => setChapters((all) => [...all, { id: nextId(), title: "", key: "", clips: [] }])}>
          <Plus size={16} /> Kapitel
        </button>

        <div className="me-row" style={{ marginTop: "1.25rem" }}>
          <label className="me-field">
            <span>Abschluss: Titel</span>
            <input value={p.outro.title} maxLength={60} onChange={(e) => setP({ ...p, outro: { ...p.outro, title: e.target.value } })} />
          </label>
          <label className="me-field">
            <span>Abschluss: Adresse</span>
            <input value={p.outro.url} maxLength={60} onChange={(e) => setP({ ...p, outro: { ...p.outro, url: e.target.value } })} />
          </label>
        </div>

        <h3 className="wb-vid-h3">YouTube</h3>
        <label className="me-field">
          <span>Titel</span>
          <input value={p.youtube.title} maxLength={100} onChange={(e) => setP({ ...p, youtube: { ...p.youtube, title: e.target.value } })} />
        </label>
        <label className="me-field wb-field">
          <span>Beschreibung <em>(Kapitelmarken werden automatisch angehängt)</em></span>
          <textarea rows={4} maxLength={4000} value={p.youtube.description} onChange={(e) => setP({ ...p, youtube: { ...p.youtube, description: e.target.value } })} />
        </label>
        <label className="me-field">
          <span>Tags <em>(mit Komma getrennt)</em></span>
          <input value={tags} maxLength={600} onChange={(e) => setTags(e.target.value)} />
        </label>
      </fieldset>

      {problems.length > 0 && (
        <ul className="wb-warn wb-vid-problems">
          {problems.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="me-form-foot">
          <Save disabled={problems.length > 0} />
          {state && (
            <p className={state.error ? "me-msg me-msg-error" : "me-msg me-msg-ok"} role={state.error ? "alert" : "status"}>
              {state.error ?? state.ok}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
