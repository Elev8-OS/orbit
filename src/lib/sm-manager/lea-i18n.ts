type Locale = "de" | "en";

const pad = (n: number) => String(n).padStart(2, "0");

const de = {
  title: "Antwortmodus von Lea",
  titleTip: "Legt fest, ob Lea Antworten auf Instagram-Nachrichten selbst sendet. Das gilt nur für neu eintreffende Nachrichten. „Neu entwerfen“ sendet nie automatisch.",
  modeReview: "Ich gebe jede Antwort frei",
  modeReviewHelp: "Lea schreibt nur Entwürfe. Gesendet wird erst nach deinem Klick.",
  modeAuto: "Lea antwortet immer automatisch",
  modeAutoHelp: "Lea sendet ihre Antwort sofort, Tag und Nacht.",
  modeWindow: "Automatisch in einem Zeitfenster",
  modeWindowHelp: "Im Zeitfenster antwortet Lea selbst, sonst bleibt es ein Entwurf für dich.",
  windowTip: "Beispiel: 22 bis 08 Uhr. In dieser Zeit antwortet Lea selbst (auch über Mitternacht), tagsüber gibst du frei.",
  from: "Von",
  to: "Bis",
  zone: "Zeitzone",
  nowAuto: "Gerade antwortet Lea automatisch.",
  nowReview: "Gerade brauchen die Antworten deine Freigabe.",
  windowSummary: (from: number, to: number, zone: string, now: number) => `Automatisch von ${pad(from)}:00 bis ${pad(to)}:00 (${zone}). Dort ist es gerade ${pad(now)}:00.`,
  safety: "Nachrichten, die „Bitte prüfen“ bekommen (Beschwerden, Zahlungen, Gruppen, Preisverhandlungen …), sendet Lea nie automatisch.",
  save: "Speichern",
  saving: "Wird gespeichert …",
  saved: "Gespeichert.",
  failed: "Konnte nicht gespeichert werden",
  loadFailed: "Der Antwortmodus konnte gerade nicht geladen werden.",
  sameHours: "Start und Ende dürfen nicht gleich sein.",
  confirmAuto: "Lea sendet Antworten ab jetzt ohne deine Freigabe, Tag und Nacht. Speichern?",
  confirmWindow: (from: number, to: number, zone: string) => `Lea sendet Antworten von ${pad(from)}:00 bis ${pad(to)}:00 (${zone}) ohne deine Freigabe. Speichern?`,
  autoSent: "Automatisch gesendet",
  autoSentTip: "Lea hat diese Antwort selbst gesendet, ohne Freigabe."
};

const en: typeof de = {
  title: "Lea's answer mode",
  titleTip: "Sets whether Lea sends replies to Instagram messages by herself. It only applies to messages that just arrived. \"Redraft\" never sends automatically.",
  modeReview: "I approve every reply",
  modeReviewHelp: "Lea only writes drafts. Nothing is sent until you click.",
  modeAuto: "Lea always replies automatically",
  modeAutoHelp: "Lea sends her reply right away, day and night.",
  modeWindow: "Automatic inside a time window",
  modeWindowHelp: "Inside the window Lea replies by herself, otherwise it stays a draft for you.",
  windowTip: "Example: 22:00 to 08:00. In that time Lea replies by herself (also over midnight), during the day you approve.",
  from: "From",
  to: "To",
  zone: "Time zone",
  nowAuto: "Lea is replying automatically right now.",
  nowReview: "Replies need your approval right now.",
  windowSummary: (from, to, zone, now) => `Automatic from ${pad(from)}:00 to ${pad(to)}:00 (${zone}). It is ${pad(now)}:00 there right now.`,
  safety: "Messages marked \"Please check\" (complaints, payments, groups, price negotiations ...) are never sent by Lea automatically.",
  save: "Save",
  saving: "Saving ...",
  saved: "Saved.",
  failed: "Could not be saved",
  loadFailed: "The answer mode could not be loaded right now.",
  sameHours: "Start and end must not be the same.",
  confirmAuto: "From now on Lea sends replies without your approval, day and night. Save?",
  confirmWindow: (from, to, zone) => `Lea will send replies from ${pad(from)}:00 to ${pad(to)}:00 (${zone}) without your approval. Save?`,
  autoSent: "Sent automatically",
  autoSentTip: "Lea sent this reply by herself, without approval."
};

export const leaStrings = (locale: Locale) => (locale === "en" ? en : de);
export type LeaStrings = ReturnType<typeof leaStrings>;
