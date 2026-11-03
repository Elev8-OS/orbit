type Locale = "de" | "en";

export type LearningLike = {
  dimension: string;
  value: string;
  direction: "more" | "less";
  stats: { n: number; nRest: number; median: number; medianRest: number };
  action: { type: string; key?: string; hour?: number };
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const de = {
  tabLearnings: "Learnings",
  title: "Learnings aus den Beiträgen",
  intro: "Das System vergleicht deine Beiträge und schlägt vor, was du öfter oder seltener machen solltest. Nichts davon wird angewendet, bevor du zustimmst.",
  runNow: "Jetzt auswerten",
  running: "Wird ausgewertet …",
  failed: "Das hat nicht geklappt",
  lastRun: (date: string, eligible: number, tested: number) => `Zuletzt ausgewertet: ${date}. ${eligible} Beiträge verglichen, ${tested} Vergleiche.`,
  noRun: "Noch nicht ausgewertet. Die erste Auswertung läuft nach dem nächsten Abruf der Zahlen, oder du startest sie von Hand.",
  notEnough: (need: number, minAge: number) => `Noch zu wenig Daten: Für einen fairen Vergleich braucht es mindestens 12 Beiträge, die älter als ${minAge} Tage sind. Es fehlen noch ${need}. Vorher macht das System keine Vorschläge, sie wären sonst Zufall.`,
  noFinding: "Bisher ist kein Unterschied deutlich genug, um etwas vorzuschlagen. Das ist bei wenigen Beiträgen normal.",
  scoreTitle: "Wie wird gemessen?",
  score: "Jeder Beitrag bekommt einen Erfolgswert. Es zählen, von wichtig nach weniger wichtig: Klicks, neue Follower, Profilbesuche, Gespeichert und Geteilt, Kommentare, Reichweite und zuletzt Likes. Verglichen wird der Stand nach 7 Tagen (bei älteren Beiträgen der heutige), damit junge und alte Beiträge fair sind. Beiträge unter 7 Tagen zählen noch nicht.",
  clicksOff: "Klicks fließen noch nicht ein. Das passiert, sobald der Bio-Link mindestens 20 Klicks gezählt hat.",
  clicksOn: "Klicks fließen ein. Verglichen werden dann nur Beiträge aus der Engine, nur sie haben einen getrackten Link.",
  proposedTitle: "Vorschläge",
  acceptedTitle: "Von dir übernommen",
  dismissedTitle: "Abgelehnt (letzte 30 Tage)",
  none: "Keine",
  solid: "belastbar",
  tentative: "vorsichtig",
  solidHelp: "Der Unterschied ist auch nach Korrektur für die vielen Vergleiche deutlich.",
  tentativeHelp: "Schwächer belegt und kann Zufall sein. Eher ausprobieren als fest übernehmen.",
  accept: "Übernehmen",
  dismiss: "Ablehnen",
  revoke: "Rückgängig machen",
  reconsider: "Doch übernehmen",
  auto: "Wirkt automatisch, sobald du übernimmst.",
  info: "Nur eine Erkenntnis, sie verändert nichts automatisch.",
  dimensions: {} as Record<string, string>,
  describe(l: LearningLike): string {
    const v = l.value;
    const labels: Record<string, Record<string, string>> = {
      format: { reel: "Reels", carousel: "Karussells", single: "Einzelbilder" },
      captionLength: { short: "Kurze Texte (unter 300 Zeichen)", medium: "Mittellange Texte (300 bis 600 Zeichen)", long: "Lange Texte (über 600 Zeichen)" },
      question: { yes: "Texte, die mit einer Frage beginnen" },
      emoji: { yes: "Texte mit Emoji in der ersten Zeile" },
      hour: { morning: "Beiträge am Morgen (vor 11 Uhr Bali-Zeit)", midday: "Beiträge zur Mittagszeit (11 bis 15 Uhr Bali-Zeit)", afternoon: "Beiträge am Nachmittag (15 bis 19 Uhr Bali-Zeit)", evening: "Beiträge am Abend (ab 19 Uhr Bali-Zeit)" },
      weekend: { yes: "Beiträge am Wochenende" },
      hashtags: { few: "Beiträge mit wenigen Hashtags (bis 5)", normal: "Beiträge mit 6 bis 10 Hashtags", many: "Beiträge mit vielen Hashtags (über 10)" },
      source: { engine: "Beiträge aus der Engine (gegenüber von Hand gepostet)" },
      pillar: { villa_spotlight: "Beiträge „Villa im Fokus“", which_villa_for: "Beiträge „Welche Villa für wen“", design_details: "Beiträge „Design-Details“", neighbourhood: "Beiträge über die Umgebung", workation: "Beiträge zu Workation", book_direct: "Beiträge „Direkt buchen“" },
      villa: {}
    };
    const subject = l.dimension === "villa" ? `Beiträge zu ${cap(v)}` : labels[l.dimension]?.[v] ?? `${l.dimension}: ${v}`;
    const verdict = l.direction === "more" ? "schneiden besser ab" : "schneiden schwächer ab";
    return `${subject} ${verdict}: Ø Erfolgswert ${l.stats.median} gegenüber ${l.stats.medianRest} bei den übrigen (${l.stats.n} gegen ${l.stats.nRest} Beiträge).`;
  },
  effect(a: LearningLike["action"]): string {
    if (a.type === "copy_rule") {
      const t: Record<string, string> = {
        question_open: "Der Textauftrag an Claude verlangt dann, Texte öfter mit einer Frage zu beginnen.",
        no_question_open: "Der Textauftrag an Claude verlangt dann, Texte nicht mit einer Frage zu beginnen.",
        short_caption: "Der Textauftrag an Claude verlangt dann kürzere Texte.",
        long_caption: "Der Textauftrag an Claude verlangt dann längere Texte."
      };
      return t[a.key ?? ""] ?? "";
    }
    if (a.type === "post_hour") return `Beim Freigeben ist dann ${a.hour} Uhr Bali-Zeit als Zeit vorausgewählt.`;
    return "";
  }
};

const en: typeof de = {
  tabLearnings: "Learnings",
  title: "Learnings from your posts",
  intro: "The system compares your posts and suggests what to do more or less. Nothing is applied before you agree.",
  runNow: "Analyse now",
  running: "Analysing …",
  failed: "That did not work",
  lastRun: (date, eligible, tested) => `Last analysed: ${date}. ${eligible} posts compared, ${tested} comparisons.`,
  noRun: "Not analysed yet. The first analysis runs after the next refresh of the numbers, or you can start it by hand.",
  notEnough: (need, minAge) => `Not enough data yet: a fair comparison needs at least 12 posts older than ${minAge} days. ${need} more are needed. Until then the system makes no suggestions, they would be chance.`,
  noFinding: "So far no difference is clear enough to suggest anything. That is normal with few posts.",
  scoreTitle: "How is it measured?",
  score: "Each post gets a success score. What counts, from more to less important: clicks, new followers, profile visits, saves and shares, comments, reach and finally likes. The state after 7 days is compared (today's state for older posts), so young and old posts are fair. Posts under 7 days do not count yet.",
  clicksOff: "Clicks are not included yet. They will be once the bio link has counted at least 20 clicks.",
  clicksOn: "Clicks are included. Only posts from the engine are compared then, because only they have a tracked link.",
  proposedTitle: "Suggestions",
  acceptedTitle: "Accepted by you",
  dismissedTitle: "Dismissed (last 30 days)",
  none: "None",
  solid: "solid",
  tentative: "tentative",
  solidHelp: "The difference is clear even after correcting for the many comparisons.",
  tentativeHelp: "Weaker evidence and may be chance. Try it rather than adopt it for good.",
  accept: "Accept",
  dismiss: "Dismiss",
  revoke: "Undo",
  reconsider: "Accept after all",
  auto: "Takes effect automatically once you accept.",
  info: "Just an insight, it changes nothing automatically.",
  dimensions: {},
  describe(l) {
    const v = l.value;
    const labels: Record<string, Record<string, string>> = {
      format: { reel: "Reels", carousel: "Carousels", single: "Single images" },
      captionLength: { short: "Short captions (under 300 characters)", medium: "Medium captions (300 to 600 characters)", long: "Long captions (over 600 characters)" },
      question: { yes: "Captions that open with a question" },
      emoji: { yes: "Captions with an emoji in the first line" },
      hour: { morning: "Posts in the morning (before 11 Bali time)", midday: "Posts around midday (11 to 15 Bali time)", afternoon: "Posts in the afternoon (15 to 19 Bali time)", evening: "Posts in the evening (from 19 Bali time)" },
      weekend: { yes: "Posts at the weekend" },
      hashtags: { few: "Posts with few hashtags (up to 5)", normal: "Posts with 6 to 10 hashtags", many: "Posts with many hashtags (over 10)" },
      source: { engine: "Posts from the engine (compared with posted by hand)" },
      pillar: { villa_spotlight: "\"Villa spotlight\" posts", which_villa_for: "\"Which villa for whom\" posts", design_details: "\"Design details\" posts", neighbourhood: "Posts about the area", workation: "Workation posts", book_direct: "\"Book direct\" posts" },
      villa: {}
    };
    const subject = l.dimension === "villa" ? `Posts about ${cap(v)}` : labels[l.dimension]?.[v] ?? `${l.dimension}: ${v}`;
    const verdict = l.direction === "more" ? "do better" : "do worse";
    return `${subject} ${verdict}: avg. success score ${l.stats.median} against ${l.stats.medianRest} for the rest (${l.stats.n} against ${l.stats.nRest} posts).`;
  },
  effect(a) {
    if (a.type === "copy_rule") {
      const t: Record<string, string> = {
        question_open: "The writing brief to Claude will then ask for captions that open with a question more often.",
        no_question_open: "The writing brief to Claude will then ask for captions that do not open with a question.",
        short_caption: "The writing brief to Claude will then ask for shorter captions.",
        long_caption: "The writing brief to Claude will then ask for longer captions."
      };
      return t[a.key ?? ""] ?? "";
    }
    if (a.type === "post_hour") return `When approving, ${a.hour}:00 Bali time will then be preselected.`;
    return "";
  }
};

export const learningStrings = (locale: Locale) => (locale === "en" ? en : de);
export type LearningStrings = ReturnType<typeof learningStrings>;
