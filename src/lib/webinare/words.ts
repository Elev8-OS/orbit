/**
 * Wortgenaues Transkript eines Clips (ElevenLabs Scribe) für die synchrone Profistimme.
 * Gestrichene Wörter (cut) fallen aus Ton und Bild; der Rest wird mit der Profistimme im Original-Timing gesprochen.
 * Rein, ohne Datenbank: läuft auch im Browser (Editor).
 */

/** s, e: Sekunden im Video; t: Wort wie gesprochen; k: Art (w Wort, a Geräusch); cut: wird herausgeschnitten */
export type Word = { s: number; e: number; t: string; k?: "w" | "a"; cut?: boolean };
export type SubLine = { start: number; end: number; text: string; en?: string };

/** Wörter gehören zu genau diesen Clip-Zeiten; nach geänderten Zeiten muss neu bereinigt werden. */
export function wordsValid(clip: { start: number; end: number; words?: Word[]; wordsFor?: [number, number] }): boolean {
  return Boolean(clip.words?.length && clip.wordsFor && Math.abs(clip.wordsFor[0] - clip.start) < 0.05 && Math.abs(clip.wordsFor[1] - clip.end) < 0.05);
}

/** Wie viele Sekunden das Streichen spart (grob, ohne die Pausen dazwischen). */
export function cutSeconds(words: Word[]): number {
  return words.filter((w) => w.cut).reduce((a, w) => a + Math.max(0, w.e - w.s), 0);
}

const ends = (t: string) => /[.!?…]["»“]?$/.test(t);

/**
 * Untertitelzeilen aus den behaltenen Wörtern: neue Zeile nach Satzende, nach einer Pause über 0.8 s
 * oder spätestens nach 14 Wörtern (dann möglichst an einem Komma). Englisch aus früheren Zeilen mit gleichem Text bleibt.
 */
export function linesFromWords(words: Word[], before?: SubLine[]): SubLine[] {
  // gap: ob die Pause davor echt ist (lagen nur gestrichene Wörter dazwischen, ist sie im Video herausgeschnitten)
  const kept = words
    .map((w, i) => ({ w, cutBefore: i > 0 && Boolean(words[i - 1].cut) }))
    .filter(({ w }) => !w.cut && w.k !== "a" && String(w.t).trim())
    .map(({ w, cutBefore }) => ({ ...w, cutBefore }));
  const lines: (Word & { cutBefore: boolean })[][] = [];
  let cur: (Word & { cutBefore: boolean })[] = [];
  const flush = () => {
    if (cur.length) lines.push(cur);
    cur = [];
  };
  kept.forEach((w, i) => {
    const prev = kept[i - 1];
    if (prev && cur.length && ((!w.cutBefore && w.s - prev.e > 0.8) || (ends(prev.t) && cur.length >= 3))) flush();
    cur.push(w);
    if (cur.length >= 14) {
      const comma = cur.findLastIndex((x, j) => j >= 5 && /,$/.test(x.t));
      if (comma >= 0 && comma < cur.length - 1) {
        const rest = cur.slice(comma + 1);
        cur = cur.slice(0, comma + 1);
        flush();
        cur = rest;
      } else flush();
    }
  });
  flush();
  const enOf = new Map((before ?? []).filter((l) => l.en).map((l) => [l.text, l.en as string]));
  return lines.map((ws) => {
    const joined = ws.map((w) => w.t.trim()).join(" ").replace(/\s+([,.!?;:])/g, "$1");
    // Nach gestrichenem Satzanfang ("Ähm du siehst") beginnt die Zeile trotzdem gross
    const text = joined.charAt(0).toUpperCase() + joined.slice(1);
    const line: SubLine = { start: ws[0].s, end: ws[ws.length - 1].e, text };
    const en = enOf.get(text);
    if (en) line.en = en;
    return line;
  });
}
