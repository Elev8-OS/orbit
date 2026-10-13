/** Texte der Push-Mitteilungen (laufen im Hintergrund, ohne Seitenaufruf, deshalb nicht über next-intl). */
type L = "de" | "en";
const T = {
  de: {
    mydayTitle: (date: string) => `Mein Tag · ${date}`,
    meetings: (n: number, first?: string) => (n === 1 ? `1 Termin` : `${n} Termine`) + (first ? ` (ab ${first})` : ""),
    tasks: (n: number) => (n === 1 ? "1 fällige Aufgabe" : `${n} fällige Aufgaben`),
    followUps: (n: number) => (n === 1 ? "1 Offerte nachfassen" : `${n} Offerten nachfassen`),
    drafts: (n: number, high: number) => (n === 1 ? "1 Antwortentwurf" : `${n} Antwortentwürfe`) + (high ? ` (${high} dringend)` : ""),
    appCount: (app: string, n: number) => `${app}: ${n}`,
    requests: (n: number) => (n === 1 ? "1 Zugriffsanfrage" : `${n} Zugriffsanfragen`),
    incidents: (n: number) => (n === 1 ? "1 Störung" : `${n} Störungen`),
    newDrafts: (n: number, high: number) => (n === 1 ? "Neuer Antwortentwurf" : `${n} neue Antwortentwürfe`) + (high ? ` · ${high} dringend` : ""),
    draftsBody: "Noah hat Entwürfe in Outlook angelegt. Prüfen und senden.",
    moreItems: (app: string, n: number) => `${app}: ${n} neue Meldungen`,
    moreBody: "Tippen, um sie in Orbit zu sehen.",
    accessApproved: (app: string) => `Zugriff auf ${app} bewilligt`,
    accessApprovedBody: "Nach der nächsten Anmeldung in Orbit siehst du die Kachel.",
    accessRejected: (app: string) => `Zugriff auf ${app} abgelehnt`,
    accessRequest: (who: string, app: string) => `${who} möchte Zugriff auf ${app}`,
    accessRequestBody: "Tippen, um die Anfrage zu entscheiden.",
    down: (name: string) => `Störung: ${name}`,
    up: (name: string) => `Wieder in Ordnung: ${name}`,
    test: "Mitteilungen funktionieren",
    testBody: "So sehen Mitteilungen von Orbit auf diesem Gerät aus."
  },
  en: {
    mydayTitle: (date: string) => `My day · ${date}`,
    meetings: (n: number, first?: string) => (n === 1 ? "1 meeting" : `${n} meetings`) + (first ? ` (from ${first})` : ""),
    tasks: (n: number) => (n === 1 ? "1 task due" : `${n} tasks due`),
    followUps: (n: number) => (n === 1 ? "1 offer to follow up" : `${n} offers to follow up`),
    drafts: (n: number, high: number) => (n === 1 ? "1 reply draft" : `${n} reply drafts`) + (high ? ` (${high} urgent)` : ""),
    appCount: (app: string, n: number) => `${app}: ${n}`,
    requests: (n: number) => (n === 1 ? "1 access request" : `${n} access requests`),
    incidents: (n: number) => (n === 1 ? "1 incident" : `${n} incidents`),
    newDrafts: (n: number, high: number) => (n === 1 ? "New reply draft" : `${n} new reply drafts`) + (high ? ` · ${high} urgent` : ""),
    draftsBody: "Noah created drafts in Outlook. Review and send.",
    moreItems: (app: string, n: number) => `${app}: ${n} new items`,
    moreBody: "Tap to see them in Orbit.",
    accessApproved: (app: string) => `Access to ${app} approved`,
    accessApprovedBody: "You will see the tile after your next sign-in to Orbit.",
    accessRejected: (app: string) => `Access to ${app} declined`,
    accessRequest: (who: string, app: string) => `${who} requests access to ${app}`,
    accessRequestBody: "Tap to decide.",
    down: (name: string) => `Outage: ${name}`,
    up: (name: string) => `Resolved: ${name}`,
    test: "Notifications work",
    testBody: "This is how Orbit notifications look on this device."
  }
};
export const pushText = (locale: string) => T[(locale === "en" ? "en" : "de") as L];
