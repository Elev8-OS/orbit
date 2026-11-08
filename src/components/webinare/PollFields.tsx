"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

/**
 * Art der Abstimmung und ihre Optionen. Termine werden per Datum und Uhrzeit ausgewählt,
 * Themen als einzelne Felder auf Deutsch (Englisch übersetzt der Server beim Speichern).
 */
type DateRow = { id: number; date: string; time: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const weekday = (day: string) =>
  day ? new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00`)) : "";

let seq = 0;
const nextId = () => ++seq;

export function PollFields() {
  const [kind, setKind] = useState<"date" | "topic">("date");
  const today = iso(new Date());
  const firstDay = addDays(today, 14);
  const [dates, setDates] = useState<DateRow[]>([
    { id: nextId(), date: firstDay, time: "16:00" },
    { id: nextId(), date: addDays(firstDay, 7), time: "16:00" }
  ]);
  const [topics, setTopics] = useState<{ id: number; text: string }[]>([
    { id: nextId(), text: "" },
    { id: nextId(), text: "" }
  ]);

  function addDate() {
    setDates((rows) => {
      const last = rows[rows.length - 1];
      return [...rows, { id: nextId(), date: last ? addDays(last.date || today, 7) : firstDay, time: last?.time || "16:00" }];
    });
  }

  return (
    <>
      <label className="me-field" style={{ maxWidth: "26rem" }}>
        <span>Art</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value === "topic" ? "topic" : "date")}>
          <option value="date">Terminwahl (mehrere Termine ankreuzen)</option>
          <option value="topic">Themenwahl (Upvotes, eigene Vorschläge)</option>
        </select>
      </label>

      <label className="me-field">
        <span>Frage</span>
        <input name="titleDe" required maxLength={200} placeholder={kind === "date" ? "Wann passt dir das nächste Webinar?" : "Worüber sollen wir als Nächstes sprechen?"} />
      </label>
      <label className="me-field wb-field">
        <span>
          Beschreibung <em>optional</em>
        </span>
        <textarea name="descriptionDe" rows={2} />
      </label>

      {kind === "date" ? (
        <div className="me-field">
          <span>Termine zur Auswahl (Schweizer Zeit)</span>
          <div className="wb-opts">
            {dates.map((r, i) => (
              <div className="wb-opt" key={r.id}>
                <input
                  type="date"
                  name="optDate"
                  value={r.date}
                  min={today}
                  required
                  aria-label={`Termin ${i + 1}: Datum`}
                  onChange={(e) => setDates((rows) => rows.map((x) => (x.id === r.id ? { ...x, date: e.target.value } : x)))}
                />
                <input
                  type="time"
                  name="optTime"
                  value={r.time}
                  step={900}
                  required
                  aria-label={`Termin ${i + 1}: Uhrzeit`}
                  onChange={(e) => setDates((rows) => rows.map((x) => (x.id === r.id ? { ...x, time: e.target.value } : x)))}
                />
                <span className="wb-opt-day">{weekday(r.date)}</span>
                {dates.length > 1 && (
                  <button type="button" className="wb-opt-remove" onClick={() => setDates((rows) => rows.filter((x) => x.id !== r.id))} aria-label={`Termin ${i + 1} entfernen`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="me-btn me-btn-secondary wb-opt-add" onClick={addDate}>
              <Plus size={16} aria-hidden="true" /> Termin hinzufügen
            </button>
          </div>
        </div>
      ) : (
        <div className="me-field">
          <span>Themen zur Auswahl</span>
          <div className="wb-opts">
            {topics.map((r, i) => (
              <div className="wb-opt" key={r.id}>
                <input
                  type="text"
                  name="optTopic"
                  value={r.text}
                  maxLength={200}
                  placeholder={i === 0 ? "z. B. Preise optimieren mit PriceLabs" : "Weiteres Thema"}
                  aria-label={`Thema ${i + 1}`}
                  onChange={(e) => setTopics((rows) => rows.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))}
                />
                {topics.length > 1 && (
                  <button type="button" className="wb-opt-remove" onClick={() => setTopics((rows) => rows.filter((x) => x.id !== r.id))} aria-label={`Thema ${i + 1} entfernen`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="me-btn me-btn-secondary wb-opt-add" onClick={() => setTopics((rows) => [...rows, { id: nextId(), text: "" }])}>
              <Plus size={16} aria-hidden="true" /> Thema hinzufügen
            </button>
          </div>
          <label className="me-switch">
            <input type="checkbox" name="allowSuggestions" defaultChecked /> Eigene Themen vorschlagen erlauben (erscheinen erst nach deiner Freigabe)
          </label>
        </div>
      )}
    </>
  );
}
