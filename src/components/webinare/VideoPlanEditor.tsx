"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { VideoFormState } from "@/app/webinare/video-actions";
import { cutSeconds, linesFromWords, wordsValid, type Word } from "@/lib/webinare/words";

/**
 * Schnittliste des Erklärvideos bearbeiten: Titel, Bildausschnitt, Kapitel mit Clips und Kernaussage, YouTube-Texte.
 * Zeiten werden als m:ss eingegeben; unter jedem Clip steht der Transkripttext zur Kontrolle.
 */

type Line = { start: number; end: number; text: string; en?: string };
type Clip = { start: number; end: number; lines?: Line[]; words?: Word[]; wordsFor?: [number, number] };
type Chapter = { title: string; key: string; clips: Clip[] };
export type EditorPlan = {
  title: string;
  subtitle: string;
  meta: string;
  layout: "teams-share" | "full";
  allowGallery: boolean;
  browserBar: boolean;
  voice: "pro" | "script" | "original";
  pip: { enabled: boolean; name: string };
  outro: { title: string; url: string };
  chapters: Chapter[];
  youtube: { title: string; description: string; tags: string[] };
};
export type { Line };

type ClipRow = { id: number; start: string; end: string; script: string; lines?: Line[]; words?: Word[]; wordsFor?: [number, number] };
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
/**
 * Sprechertext als Zeilen "m:ss | Text", darunter die englische Fassung als "EN: ..." (Untertitel).
 * Die Zeit sagt, wann die Profistimme die Zeile beginnt.
 */
const toScript = (lines?: Line[]) => (lines ?? []).map((l) => `${fmt(l.start)} | ${l.text}${l.en ? `\n    EN: ${l.en}` : ""}`).join("\n");
const fromScript = (script: string, clipEnd: number, before?: Line[]): Line[] | undefined => {
  const rows: { start: number; text: string; en: string }[] = [];
  for (const raw of script.split("\n")) {
    const m = raw.match(/^\s*([\d:.,]+)\s*\|\s*(.*)$/);
    const t = m ? parse(m[1]) : null;
    const en = raw.match(/^\s*EN:\s*(.*)$/i);
    const last = rows[rows.length - 1];
    if (m && t !== null) rows.push({ start: t, text: m[2].trim(), en: "" });
    else if (en && last) last.en = `${last.en} ${en[1].trim()}`.trim();
    else if (raw.trim() && last) last.text = `${last.text} ${raw.trim()}`.trim();
  }
  if (!rows.length) return undefined;
  return rows.map((r, i) => {
    const line: Line = { start: r.start, end: Math.max(r.start, rows[i + 1]?.start ?? clipEnd), text: r.text };
    // Deutsch geändert, Englisch nicht: Englisch beim Rendern neu übersetzen lassen
    const old = before?.find((b) => b.start === r.start);
    const stale = old && old.text !== r.text && old.en === r.en;
    if (r.en && !stale) line.en = r.en;
    return line;
  });
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
    src.chapters.map((c) => ({
      id: nextId(),
      title: c.title,
      key: c.key,
      clips: c.clips.map((k) => {
        // Synchron: ohne eigene Zeilen die Untertitel aus den behaltenen Wörtern zeigen
        const lines = k.lines?.length ? k.lines : src.voice === "pro" && wordsValid(k) ? linesFromWords(k.words ?? []) : k.lines;
        return { id: nextId(), start: fmt(k.start), end: fmt(k.end), script: toScript(lines), lines, words: k.words, wordsFor: k.wordsFor };
      })
    }));
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
      clips: ch.clips.flatMap((k) => {
        const c = clipOf(k);
        if (!c || c.end <= c.start) return [];
        const lines = fromScript(k.script, c.end, k.lines);
        const clip: Clip = lines ? { ...c, lines } : { ...c };
        if (k.words && k.wordsFor) Object.assign(clip, { words: k.words, wordsFor: k.wordsFor });
        return [clip];
      })
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
  // Wort streichen oder zurückholen; mit Shift den ganzen Bereich seit dem letzten Klick. Untertitel folgen.
  const lastWord = useRef(new Map<number, number>());
  const toggleWord = (cid: number, k: ClipRow, i: number, range: boolean, end: number) => {
    if (!k.words) return;
    const from = range ? lastWord.current.get(k.id) : undefined;
    const [a, b] = from === undefined ? [i, i] : [Math.min(from, i), Math.max(from, i)];
    const cut = !k.words[i].cut;
    const words = k.words.map((w, j) => (j >= a && j <= b ? { ...w, cut } : w));
    lastWord.current.set(k.id, i);
    const lines = linesFromWords(words, fromScript(k.script, end, k.lines));
    setClip(cid, k.id, { words, script: toScript(lines) });
  };
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
          <div className="me-field">
            <label className="wb-vid-label">
              <span>Bildausschnitt</span>
              <select value={p.layout} onChange={(e) => setP({ ...p, layout: e.target.value === "full" ? "full" : "teams-share" })}>
                <option value="teams-share">Bildschirmfreigabe aus Teams (App bildfüllend)</option>
                <option value="full">Ganzes Bild der Aufnahme</option>
              </select>
            </label>
            <small>
              {p.layout === "teams-share"
                ? "Der Render-Dienst prüft jeden Clip. Zeigt einer die Ansicht mit Teilnehmenden, bricht er mit einem Hinweis ab."
                : "Teilnehmende und ihre Namen sind dann im Video sichtbar."}
            </small>
            {p.layout === "teams-share" && (
              <div className="wb-vid-checks">
                <label>
                  <input className="wb-check" type="checkbox" checked={p.browserBar} onChange={(e) => setP({ ...p, browserBar: e.target.checked })} />
                  <span>Browserleiste zeigen (Tabs und Adresse)</span>
                </label>
              </div>
            )}
          </div>
          <div className="me-field">
            <label className="wb-vid-label">
              <span>Stimme</span>
              <select
                value={p.voice}
                onChange={(e) => setP({ ...p, voice: e.target.value === "original" ? "original" : e.target.value === "script" ? "script" : "pro" })}
              >
                <option value="pro">Profistimme, synchron zum Bild (empfohlen)</option>
                <option value="script">Profistimme, neu formulierter Sprechertext</option>
                <option value="original">Originalstimme aus der Aufnahme</option>
              </select>
            </label>
            {p.voice === "pro" ? (
              <small className="wb-vid-small">
                Deine Worte und dein Timing mit der Profistimme. Füllwörter und Versprecher werden aus Ton und Bild geschnitten, alles bleibt synchron.
                Kamerabild und Name des Referenten entfallen.
              </small>
            ) : p.voice === "script" ? (
              <small className="wb-vid-small">
                Liest einen von Claude geglätteten Sprechertext, jede Zeile ab ihrer Stelle im Video. Klingt flüssiger, läuft aber nicht genau mit dem
                Bild mit. Kamerabild und Name des Referenten entfallen.
              </small>
            ) : (
            <>
            <label className="wb-vid-label" style={{ marginTop: "0.75rem" }}>
              <span>Sprecher im Kreis unten rechts</span>
              <input value={p.pip.name} maxLength={40} placeholder="Name, z. B. Reto Wyss" onChange={(e) => setP({ ...p, pip: { ...p.pip, name: e.target.value } })} />
            </label>
            <div className="wb-vid-checks">
              <label>
                <input className="wb-check" type="checkbox" checked={p.pip.enabled} onChange={(e) => setP({ ...p, pip: { ...p.pip, enabled: e.target.checked } })} />
                <span>Kamerabild des Sprechers zeigen</span>
              </label>
            </div>
            </>
            )}
            <div className="wb-vid-checks">
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
                  {p.voice === "pro" && c && !bad && wordsValid({ ...c, words: k.words, wordsFor: k.wordsFor }) ? (
                    <div className="wb-vid-wordbox">
                      <div className="wb-vid-words">
                        {k.words!.map((w, i) => (
                          <button
                            type="button"
                            key={i}
                            className={w.cut ? "wb-cut" : w.k === "a" ? "wb-ev" : undefined}
                            aria-pressed={Boolean(w.cut)}
                            title={`${fmt(w.s)}: ${w.cut ? "wieder aufnehmen" : "streichen"} (Shift: ganzer Bereich)`}
                            onClick={(e) => toggleWord(ch.id, k, i, e.shiftKey, c.end)}
                          >
                            {w.k === "a" ? `(${w.t})` : w.t}
                          </button>
                        ))}
                      </div>
                      <small>
                        {k.words!.filter((w) => w.cut).length} Wörter gestrichen, etwa {cutSeconds(k.words!).toFixed(1)} s kürzer. Klick streicht ein Wort oder
                        holt es zurück, Shift-Klick den ganzen Bereich seit dem letzten Klick.
                      </small>
                    </div>
                  ) : (
                    <>
                      <p className="wb-vid-text">{c && !bad ? textOf(c) || "Kein Transkript an dieser Stelle." : "Zeiten im Format m:ss eingeben, z. B. 7:02."}</p>
                      {p.voice === "pro" && c && !bad && (
                        <small className="wb-vid-warn">
                          {k.words?.length ? "Die Zeiten haben sich geändert: Ton neu bereinigen." : "Noch nicht bereinigt: Speichern, dann oben „Ton bereinigen“."}
                        </small>
                      )}
                    </>
                  )}
                  <label className="wb-vid-script">
                    {p.voice === "script" ? (
                      <span>Sprechertext <em>(Zeit | Text, darunter „EN:“ für die englischen Untertitel; die Zeit sagt, wann die Profistimme die Zeile beginnt)</em></span>
                    ) : (
                      <span>Untertitel <em>(Zeit | Deutsch, darunter „EN:“ Englisch)</em></span>
                    )}
                    <textarea
                      rows={Math.min(10, Math.max(2, k.script.split("\n").length + 1))}
                      value={k.script}
                      placeholder={
                        p.voice === "script"
                          ? "Noch leer. Wird beim Rendern automatisch aus dem Transkript bereinigt, oder oben „Sprechertext bereinigen“."
                          : p.voice === "pro"
                            ? "Noch leer. Nach „Ton bereinigen“ stehen hier die Untertitel aus den behaltenen Wörtern."
                            : "Noch leer. Wird beim Rendern automatisch aus dem Transkript erstellt und übersetzt."
                      }
                      onChange={(e) => setClip(ch.id, k.id, { script: e.target.value })}
                    />
                    {c && !bad && fromScript(k.script, c.end)?.some((l) => l.start < c.start - 0.5 || l.start >= c.end) && (
                      <small className="wb-vid-warn">Einige Zeilen liegen ausserhalb von Von–Bis und entfallen. Nach geänderten Zeiten neu bereinigen.</small>
                    )}
                  </label>
                </div>
              );
            })}
            <button
              type="button"
              className="me-btn me-btn-secondary wb-vid-add"
              onClick={() => {
                const last = ch.clips[ch.clips.length - 1];
                const from = last ? parse(last.end) ?? 0 : 0;
                setCh(ch.id, { clips: [...ch.clips, { id: nextId(), start: fmt(from), end: fmt(from + 20), script: "" }] });
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
