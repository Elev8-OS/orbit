"use client";

import { useState } from "react";

/** Entwurf von Hand anlegen: E-Mail genügt, Orbit füllt den Rest aus GHL vor, wenn es den Kontakt gibt. */
export function NewDraft() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || undefined, company: company || undefined, language })
    }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { id?: string }) : {};
    if (!res?.ok || !json.id) {
      setBusy(false);
      setError("Das hat nicht geklappt. Bitte E-Mail prüfen.");
      return;
    }
    window.location.href = `/onboarding/${json.id}`;
  };

  return (
    <form className="ob-fields ob-form" onSubmit={submit}>
      <label className="ob-field ob-wide"><span>E-Mail</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></label>
      <label className="ob-field"><span>Name (optional)</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
      <label className="ob-field"><span>Firma (optional)</span><input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={160} /></label>
      <label className="ob-field">
        <span>Sprache</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "de")}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </label>
      <div className="ob-actions ob-wide">
        <button className="ob-btn ob-btn-primary" type="submit" disabled={busy}>Entwurf anlegen</button>
        {error && <span className="ob-err">{error}</span>}
      </div>
    </form>
  );
}
