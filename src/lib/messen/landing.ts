import type { MesseEvent } from "./store";

/**
 * Öffentliche Landingpage eines Messe-Gewinnspiels. Eine eigenständige HTML-Seite (kein React),
 * damit sie auf jedem Handy schnell lädt und offline gesammelte Leads später nachsendet.
 * Platzhalter: __CONFIG__ (Messedaten als JSON), __TITLE__, __LANG__. Texte DE/EN stehen im Skript (const T).
 */

/** JSON sicher in ein <script> einsetzen */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function landingConfig(event: MesseEvent, opts: { preview?: boolean } = {}) {
  return {
    slug: event.slug,
    lang: event.lang,
    name: event.name,
    dates: event.datesLabel,
    booth: event.booth,
    timeZone: event.timeZone,
    prize: { title: event.prizeTitle, detail: event.prizeDetail },
    drawAt: event.drawAt ? event.drawAt.toISOString() : null,
    demoUrl: event.demoUrl || "https://elev8-suite.com",
    termsUrl: event.termsUrl,
    privacyUrl: event.privacyUrl,
    endpoint: "/api/messen/public/leads",
    // In der Vorschau ist das Formular bedienbar, der Server nimmt bei unveröffentlichten Messen aber nichts an
    open: event.active || Boolean(opts.preview),
    tracking: { meta: event.metaPixelId, google: event.googleTagId, linkedin: event.linkedinPartnerId }
  };
}

export function renderLanding(event: MesseEvent, opts: { preview?: boolean } = {}): string {
  return TEMPLATE.replace("__CONFIG__", () => scriptJson(landingConfig(event, opts)))
    .replace("__TITLE__", () => escapeHtml(`Elev8 – ${event.name}`))
    .replace("__LANG__", () => event.lang);
}

const TEMPLATE = String.raw`<!DOCTYPE html>
<html lang="__LANG__">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>__TITLE__</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script>const EV = __CONFIG__;</script>
<style>
:root {
  box-sizing: border-box;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  --yellow: #F6BB12;
  --yellow-deep: #D99E00;
  --ink: #000000;
  --paper: #FFFFFF;
  --bg: #FFFFFF;
  --surface: #F6F5F2;
  --text: #000000;
  --muted: #5A5A5A;
  --line: #E2E0DA;
  --on-yellow: #000000;
  --error: #B42318;
  --display: "Archivo", "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
  --body: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #000000; --surface: #161616; --text: #FFFFFF; --muted: #A8A8A8;
    --line: #2C2C2C; --error: #FF8A80; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #000000; --surface: #161616; --text: #FFFFFF; --muted: #A8A8A8;
  --line: #2C2C2C; --error: #FF8A80; color-scheme: dark;
}
*, *::before, *::after { box-sizing: inherit; }
html { scroll-padding-top: env(safe-area-inset-top, 0px); }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 400 1rem/1.55 var(--body); -webkit-font-smoothing: antialiased;
}
img, svg { max-width: 100%; }
button, input { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--yellow); outline-offset: 3px; }

/* Alles auf einen Bildschirm: kompakter Kopf, Formular sofort sichtbar */
.wrap { max-width: 72rem; margin: 0 auto; padding: .9rem 1.25rem .75rem; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }

header.top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 0 .9rem; }
.logo { width: 5.25rem; color: var(--text); display: block; flex: none; }
.logo svg { width: 100%; height: auto; display: block; }
.event-tag { font-size: .8125rem; color: var(--muted); text-align: right; line-height: 1.3; }
.event-tag strong { color: var(--text); font-weight: 600; display: block; }

.layout { display: grid; gap: 1rem; flex: 1; align-content: start; }
@media (min-width: 900px) {
  .layout { grid-template-columns: 1fr 26rem; gap: 4rem; align-items: center; align-content: center; }
}

/* Hero: the prize is the headline */
.hero h1 {
  font-family: var(--display); font-weight: 850; font-stretch: 78%;
  font-size: clamp(1.9rem, 8.5vw, 2.6rem); line-height: .95; letter-spacing: -.01em;
  margin: 0 0 .6rem; text-wrap: balance;
}
.prize-bar {
  display: inline-block; background: var(--yellow); color: var(--on-yellow);
  padding: .05em .18em .02em; margin-left: -.18em;
  box-decoration-break: clone; -webkit-box-decoration-break: clone;
}
.hero .lead { font-size: .9375rem; line-height: 1.45; max-width: 34rem; margin: 0 0 .7rem; color: var(--text); }
.hero .lead span { color: var(--muted); }

.draw {
  display: flex; flex-wrap: wrap; gap: .25rem 2rem; padding: .55rem 0 0; margin: 0;
  border-top: 2px solid var(--text); max-width: 36rem;
}
.draw dt { font-size: .75rem; color: var(--muted); }
.draw dd { margin: 0; font-family: var(--display); font-weight: 700; font-stretch: 90%; font-size: 1.05rem; line-height: 1.2; }
.countdown { font-variant-numeric: tabular-nums; }
@media (min-width: 900px) {
  .hero h1 { font-size: clamp(2.8rem, 5vw, 4.75rem); margin-bottom: 1rem; }
  .hero .lead { font-size: 1.125rem; margin-bottom: 1.25rem; }
  .draw { gap: 1rem 2.5rem; padding-top: 1rem; }
  .draw dt { font-size: .8125rem; }
  .draw dd { font-size: 1.375rem; }
}
/* Handy: Gewinn als eine Zeile, Ziehung und Countdown in einer Zeile, damit das Formular sofort Platz hat */
@media (max-width: 899px) {
  .hero h1 br, .hero .lead [data-t="leadSub"] { display: none; }
  .hero h1 { font-size: clamp(1.45rem, 6.4vw, 1.9rem); line-height: 1.12; margin-bottom: .35rem; }
  .hero h1 > span:first-child::after { content: " "; }
  .hero .prize-bar { display: inline; margin-left: 0; padding: .02em .2em; }
  .hero .lead { font-size: .8125rem; margin-bottom: .4rem; }
  .draw { gap: .25rem 1.25rem; padding-top: .35rem; border-top-width: 1.5px; }
  .draw > div { display: flex; align-items: baseline; gap: .35rem; }
  .draw dd { font-size: .9375rem; }
  footer .terms-link { display: none; } /* steht schon beim Häkchen im Formular */
  footer { gap: .2rem .9rem; font-size: .7rem; }
}
/* Handy: Sobald jemand angefangen hat, schrumpft der Kopf auf eine Zeile */
@media (max-width: 899px) {
  body.started .hero .lead, body.started .hero .draw, body.started .hero h1 br { display: none; }
  body.started .hero h1 { font-size: 1.15rem; margin: 0; }
  body.started .hero h1 > span:first-child::after { content: " "; }
  body.started .hero .prize-bar { display: inline; margin-left: 0; padding: .05em .25em; }
}
/* Entry card */
.entry {
  background: var(--surface); border-radius: 1.1rem; padding: 1.1rem 1.1rem 1.2rem;
  border: 1px solid var(--line);
}
@media (min-width: 900px) { .entry { padding: 1.5rem; border-radius: 1.25rem; } }
.progress { display: grid; gap: .35rem; margin-bottom: .8rem; }
.progress i { height: .3rem; border-radius: 1rem; background: var(--line); transition: background .25s; }
.progress i.on { background: var(--yellow); }
.step-meta { display: flex; justify-content: space-between; font-size: .8125rem; color: var(--muted); margin-bottom: .35rem; }
.back { background: none; border: 0; padding: 0; color: var(--muted); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.back[hidden] { display: none; }
.q { font-family: var(--display); font-weight: 800; font-stretch: 88%; font-size: 1.4rem; line-height: 1.1; margin: 0 0 .25rem; }
.hint { color: var(--muted); font-size: .875rem; margin: 0 0 .8rem; }
.q1 { margin-bottom: .7rem; }
@media (max-width: 899px) { .q1 { display: none; } }

.opts { display: grid; gap: .5rem; }
.opts.two { grid-template-columns: 1fr 1fr; }
.opts.four { grid-template-columns: repeat(4, 1fr); }
.opts.four .opt, .chips .opt { text-align: center; min-height: 2.6rem; padding: .5rem .4rem; }
.chips { display: flex; flex-wrap: wrap; gap: .35rem; }
.chips .opt { width: auto; flex: 1 0 auto; font-size: .8125rem; padding: .3rem .5rem; min-height: 2.2rem; }
.sub-q { font-size: .8125rem; font-weight: 600; margin: .75rem 0 .35rem; }
.opt.wide { display: flex; align-items: baseline; gap: .5rem; flex-wrap: wrap; min-height: 2.6rem; padding: .5rem .8rem; }
.opt.wide small { margin: 0; display: inline; }
.sub-q span { color: var(--muted); font-weight: 400; }
.quiz .opt { min-height: 2.75rem; }
.opt {
  text-align: left; width: 100%; padding: .7rem .9rem; border-radius: .75rem;
  border: 1.5px solid var(--line); background: var(--bg); cursor: pointer;
  font-weight: 500; line-height: 1.25; min-height: 3rem;
  transition: border-color .15s, background .15s;
}
.opt small { display: block; color: var(--muted); font-weight: 400; font-size: .8125rem; margin-top: .15rem; }
.opt:hover { border-color: var(--text); }
.opt[aria-pressed="true"] { border-color: var(--yellow); background: var(--yellow); color: var(--on-yellow); }
.opt[aria-pressed="true"] small { color: var(--on-yellow); opacity: .75; }

.field { margin-bottom: .65rem; }
.field label { display: block; font-size: .8125rem; font-weight: 600; margin-bottom: .25rem; }
.field label span { color: var(--muted); font-weight: 400; }
.field input {
  width: 100%; padding: .7rem .85rem; border-radius: .65rem; border: 1.5px solid var(--line);
  background: var(--bg); font-size: 1rem;
}
.field input:focus { border-color: var(--text); outline: none; }
.field[hidden] { display: none; }
.field input[aria-invalid="true"] { border-color: var(--error); }
.check { display: grid; grid-template-columns: 1.4rem 1fr; gap: .45rem; font-size: .8125rem; line-height: 1.4; margin: .45rem 0; color: var(--muted); align-items: start; }
.check input { width: 1.15rem; height: 1.15rem; margin: .15rem 0 0; accent-color: var(--yellow-deep); }
.check a { color: inherit; }
.paste { display: flex; gap: .5rem; }
.paste input { flex: 1; min-width: 0; }
.howto { list-style: none; counter-reset: h; margin: 0 0 .75rem; padding: 0; font-size: .875rem; }
.howto li { counter-increment: h; display: grid; grid-template-columns: 1.6rem 1fr; padding: .15rem 0; }
.howto li::before { content: counter(h); width: 1.25rem; height: 1.25rem; border-radius: 50%; background: var(--text); color: var(--bg); font-size: .75rem; font-weight: 600; display: grid; place-items: center; margin-top: .15rem; }
.ok-link { color: var(--text); font-size: .875rem; margin: .4rem 0 0; display: flex; gap: .4rem; align-items: center; }
.in-pot { margin: 0 0 .45rem; font-weight: 600; }
.ok-link::before { content: ""; width: .55rem; height: .55rem; background: var(--yellow); transform: rotate(45deg); flex: none; }
.skip { display: block; width: 100%; background: none; border: 0; padding: .7rem 0 0; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.err { color: var(--error); font-size: .8125rem; min-height: 0; margin: .2rem 0 0; }
.err:empty { margin: 0; }

.btn {
  display: block; width: 100%; padding: .9rem 1.25rem; border: 0; border-radius: .8rem;
  background: var(--text); color: var(--bg); font-weight: 600; font-size: 1.0625rem; cursor: pointer;
  text-align: center; text-decoration: none; margin-top: .75rem;
}
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.yellow { background: var(--yellow); color: var(--on-yellow); }
.btn.ghost { background: transparent; color: var(--text); border: 1.5px solid var(--text); }

/* Success: the entry becomes a ticket */
.ticket { text-align: left; }
.ticket .stub {
  background: var(--yellow); color: var(--on-yellow); border-radius: .9rem; padding: 1.1rem 1.25rem;
  position: relative; margin-bottom: 1rem;
}
.ticket .stub .no + p { border-top: 2px dashed rgba(0,0,0,.35); padding-top: .75rem; }
.ticket .stub .no { font-family: var(--display); font-weight: 900; font-stretch: 75%; font-size: 2.3rem; line-height: 1; letter-spacing: .02em; margin: .2rem 0 .8rem; font-variant-numeric: tabular-nums; }
.ticket .stub p { margin: 0; font-size: .9375rem; }
.ticket .stub .lbl { font-size: .8125rem; opacity: .7; }
.ticket h3 { font-family: var(--display); font-stretch: 88%; font-weight: 800; font-size: 1.6rem; margin: 0 0 .4rem; line-height: 1.1; }
.ticket .note { color: var(--muted); font-size: .9375rem; margin: 0; }
.kiosk-reset { font-size: .8125rem; color: var(--muted); text-align: center; margin-top: 1rem; }

.step { animation: in .22s ease-out; }
@keyframes in { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .step { animation: none; } .progress i { transition: none; } }

footer { margin-top: .9rem; font-size: .75rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; }
footer a { color: inherit; }
.noah-foot { font-weight: 600; }
/* Noah: AI Customer Success Manager auf WhatsApp */
.noah { margin-top: 1rem; padding: .9rem; border-radius: .9rem; background: var(--bg); border: 1.5px solid var(--text); }
.noah-head { display: flex; gap: .7rem; align-items: center; }
.noah-avatar { flex: none; width: 2.6rem; height: 2.6rem; border-radius: 50%; background: var(--yellow); color: #000; display: grid; place-items: center; font-family: var(--display); font-weight: 900; font-size: 1.25rem; position: relative; }
.noah-avatar::after { content: ""; position: absolute; right: 0; bottom: 0; width: .7rem; height: .7rem; border-radius: 50%; background: #25D366; border: 2px solid var(--bg); }
.noah-title { margin: 0; font-weight: 700; font-size: 1rem; line-height: 1.2; }
.noah p.noah-sub { margin: .1rem 0 0; font-size: .8125rem; line-height: 1.35; color: var(--muted); }
.noah .btn { margin-top: .7rem; display: flex; align-items: center; justify-content: center; gap: .5rem; }
.noah .btn svg { width: 1.2rem; height: 1.2rem; flex: none; }
.noah-meta { margin: .4rem 0 0; font-size: .75rem; color: var(--muted); text-align: center; }
.alt-demo { display: block; text-align: center; margin-top: .6rem; font-size: .8125rem; color: var(--muted); }
body.done .noah-foot { display: none; }

/* Kiosk: bigger targets, no scrolling hero on tablets */
body.kiosk .opt { min-height: 3.75rem; font-size: 1.0625rem; }
body.kiosk footer .links { display: none; }

/* Eingebettet in die Website (WordPress): deren Kopf, Fuss, Cookie-Banner und Pixel gelten */
body.embed { background: transparent; }
body.embed .wrap { padding: .5rem 0 1rem; min-height: 0; }
body.embed .logo, body.embed footer { display: none; }
body.embed header.top { justify-content: flex-start; padding-bottom: 1rem; }
body.embed .event-tag { text-align: left; }

.hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.closed h2 { font-family: var(--display); font-stretch: 88%; font-weight: 800; font-size: 1.6rem; line-height: 1.1; margin: 0 0 .5rem; }
.closed p { color: var(--muted); margin: 0; }
.consent {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--text); color: var(--bg);
  padding: 1rem 1.25rem calc(1rem + env(safe-area-inset-bottom, 0px));
}
.consent[hidden] { display: none; }
.consent-in { max-width: 72rem; margin: 0 auto; display: flex; flex-wrap: wrap; gap: .75rem 1.25rem; align-items: center; }
.consent p { margin: 0; flex: 1 1 20rem; font-size: .875rem; }
.consent a { color: inherit; }
.consent .row { display: flex; gap: .5rem; }
.consent button { border: 0; border-radius: .6rem; padding: .7rem 1rem; font-weight: 600; cursor: pointer; }
.consent .yes { background: var(--yellow); color: #000; }
.consent .no { background: transparent; color: var(--bg); border: 1.5px solid currentColor; }
/* Kleine Bildschirme (Browserleisten eingerechnet): enger setzen */
@media (max-width: 899px) and (max-height: 760px) {
  .wrap { padding-top: .6rem; }
  header.top { padding-bottom: .6rem; }
  .logo { width: 4.5rem; }
  .hero h1 { font-size: clamp(1.35rem, 6vw, 1.7rem); margin-bottom: .3rem; }
  .hero .lead { margin-bottom: .3rem; }
  .layout { gap: .75rem; }
  .entry { padding: .9rem .9rem 1rem; }
  .q { font-size: 1.25rem; }
  .hint { margin-bottom: .6rem; }
  .opt { min-height: 2.65rem; padding: .55rem .8rem; }
  .field { margin-bottom: .5rem; }
  .field input { padding: .6rem .8rem; }
  .btn { padding: .8rem 1rem; margin-top: .6rem; }
  .check { margin: .35rem 0; }
  footer { margin-top: .6rem; }
  .ticket .stub { padding: .8rem 1rem; margin-bottom: .75rem; }
  .ticket .stub .no { font-size: 2rem; margin: .1rem 0 .55rem; }
  .ticket .stub .no + p { padding-top: .5rem; }
  .ticket .stub p { font-size: .875rem; }
  .ticket h3 { font-size: 1.3rem; }
  .ticket .note { font-size: .875rem; }
  .noah { margin-top: .6rem; padding: .75rem; }
  .noah .btn { margin-top: .55rem; }
  .ticket .btn { margin-top: .5rem; }
}
/* Sehr kleine Handys (z. B. iPhone SE im Browser) */
@media (max-width: 899px) and (max-height: 600px) {
  .hero .lead { display: none; }
  .hero h1 { font-size: 1.3rem; }
  .event-tag { font-size: .75rem; }
  .howto { font-size: .8125rem; margin-bottom: .5rem; }
  .howto li { padding: 0; }
  .opt { min-height: 2.5rem; }
  .q { font-size: 1.15rem; }
  .hint { font-size: .8125rem; margin-bottom: .5rem; }
  .check { font-size: .75rem; }
  footer { font-size: .6875rem; margin-top: .4rem; }
  .noah-foot { display: none; }
}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <span class="logo" aria-label="Elev8"><svg viewBox="0 0 124 27" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true"><path d="M2.10571 14.2607H13.9104V16.2707H2.10571V14.2607ZM2.36095 24.566H15.7928V26.6079H0V4.27457H15.3143V6.31647H2.36095V24.566Z" fill="currentColor"/><path d="M21.3425 26.6079V4.27457H23.7034V24.566H36.2101V26.6079H21.3425Z" fill="currentColor"/><path d="M42.2358 14.2607H54.0406V16.2707H42.2358V14.2607ZM42.4911 24.566H55.9229V26.6079H40.1301V4.27457H55.4444V6.31647H42.4911V24.566Z" fill="currentColor"/><path d="M67.5101 26.6079L57.6196 4.27457H60.172L69.4244 25.2998H68.0206L77.3367 4.27457H79.7296L69.8391 26.6079H67.5101Z" fill="currentColor"/><path d="M89.4483 26.7993C87.6616 26.7993 86.1196 26.544 84.8221 26.0336C83.5459 25.5231 82.5569 24.7893 81.855 23.8321C81.1743 22.8537 80.834 21.7052 80.834 20.3864C80.834 19.1103 81.1637 18.0255 81.8231 17.1322C82.5037 16.2176 83.4821 15.5157 84.7583 15.0265C86.0558 14.5372 87.6191 14.2926 89.4483 14.2926C91.2562 14.2926 92.8089 14.5372 94.1064 15.0265C95.4038 15.5157 96.3929 16.2176 97.0735 17.1322C97.7754 18.0255 98.1264 19.1103 98.1264 20.3864C98.1264 21.7052 97.7754 22.8537 97.0735 23.8321C96.3716 24.7893 95.3719 25.5231 94.0745 26.0336C92.777 26.544 91.235 26.7993 89.4483 26.7993ZM89.4483 24.8531C91.4264 24.8531 92.9684 24.449 94.0745 23.6407C95.2018 22.8325 95.7654 21.7371 95.7654 20.3545C95.7654 18.972 95.2018 17.8872 94.0745 17.1003C92.9684 16.292 91.4264 15.8879 89.4483 15.8879C87.4702 15.8879 85.9282 16.292 84.8221 17.1003C83.7161 17.8872 83.1631 18.972 83.1631 20.3545C83.1631 21.7371 83.7161 22.8325 84.8221 23.6407C85.9282 24.449 87.4702 24.8531 89.4483 24.8531ZM89.4483 15.6007C87.7893 15.6007 86.3748 15.3774 85.205 14.9307C84.0564 14.4841 83.1737 13.846 82.5569 13.0165C81.9401 12.1657 81.6317 11.1554 81.6317 9.98551C81.6317 8.75186 81.9507 7.69901 82.5888 6.82695C83.2482 5.93362 84.1628 5.25298 85.3326 4.78505C86.5024 4.31711 87.8743 4.08314 89.4483 4.08314C91.0223 4.08314 92.3942 4.31711 93.564 4.78505C94.7551 5.25298 95.6804 5.93362 96.3397 6.82695C96.9991 7.69901 97.3288 8.75186 97.3288 9.98551C97.3288 11.1554 97.0204 12.1657 96.4035 13.0165C95.7867 13.846 94.8827 14.4841 93.6916 14.9307C92.5218 15.3774 91.1073 15.6007 89.4483 15.6007ZM89.4483 14.0693C91.1924 14.0693 92.5537 13.7077 93.5321 12.9846C94.5105 12.2614 94.9997 11.2936 94.9997 10.0812C94.9997 8.80504 94.4892 7.81599 93.4683 7.11409C92.4686 6.39092 91.1286 6.02933 89.4483 6.02933C87.768 6.02933 86.428 6.39092 85.4283 7.11409C84.4286 7.81599 83.9288 8.7944 83.9288 10.0493C83.9288 11.283 84.4074 12.2614 85.3645 12.9846C86.3429 13.7077 87.7042 14.0693 89.4483 14.0693Z" fill="currentColor"/><path d="M120.495 5.27865C122.163 6.90124 123.2 9.16837 123.2 11.679C123.2 18.0394 114.323 25.9852 114.27 26.0326C114.27 26.0326 105.338 18.0585 105.338 11.679C105.338 9.19779 106.35 6.9528 107.984 5.33431L109.402 12.1576C109.436 12.4557 109.497 12.7455 109.582 13.0247L109.584 13.0326C110.196 15.0188 112.047 16.4622 114.234 16.4622C116.737 16.4622 118.798 14.5709 119.067 12.139L120.495 5.27865Z" fill="currentColor"/><path d="M116.362 4.095L114.265 0L112.168 4.095L109.022 2.0475L110.464 8.92755C110.464 8.92755 111.68 6.59862 114.265 6.59862C116.85 6.59862 118.001 8.92755 118.001 8.92755L119.508 2.0475L116.362 4.095Z" fill="#F6BB11"/><path d="M114.622 14.5068C113.047 14.7014 111.613 13.5828 111.418 12.0082C111.223 10.4337 112.342 8.99939 113.917 8.80471C115.491 8.61003 116.926 9.72866 117.12 11.3032C117.315 12.8778 116.196 14.3121 114.622 14.5068Z" fill="currentColor"/></svg></span>
    <div class="event-tag"><strong id="evName"></strong><span id="evMeta"></span></div>
  </header>

  <main class="layout">
    <section class="hero" aria-labelledby="h1">
      <h1 id="h1"><span data-t="win"></span><br><span class="prize-bar" id="prizeTitle"></span></h1>
      <p class="lead"><span id="prizeDetail"></span> <span data-t="leadSub"></span></p>
      <dl class="draw">
        <div><dt data-t="drawLbl"></dt><dd id="drawWhen"></dd></div>
        <div><dt data-t="leftLbl"></dt><dd class="countdown" id="countdown" aria-live="off"></dd></div>
      </dl>
    </section>

    <section class="form-col" aria-label="Teilnahme">
      <div class="entry" id="entry"></div>
    </section>
  </main>

  <footer>
    <span>© Elev8 Software AG</span>
    <a id="noahFoot" class="noah-foot" href="#" target="_blank" rel="noopener"></a>
    <span class="links terms-link"><a id="terms" href="#" target="_blank" rel="noopener" data-t="terms"></a></span>
    <span class="links"><a id="privacy" href="#" target="_blank" rel="noopener" data-t="privacy"></a></span>
  </footer>
</div>
<div class="consent" id="consent" hidden role="region" aria-label="Cookies">
  <div class="consent-in">
    <p id="consentText"></p>
    <div class="row"><button type="button" class="no" id="consentNo"></button><button type="button" class="yes" id="consentYes"></button></div>
  </div>
</div>

<script>
(function () {
  const params = new URLSearchParams(location.search);
  const slug = EV.slug;
  const KIOSK = params.get("kiosk") === "1";
  const EMBED = params.get("embed") === "1" && window.parent !== window;
  const STORE = "elev8_leads_" + slug;
  if (KIOSK) document.body.classList.add("kiosk");
  /* Eingebettet: Höhe und Ereignisse an die Website melden (ohne Personendaten) */
  const tell = (type, data) => { if (EMBED) try { window.parent.postMessage(Object.assign({ type: "elev8-messe:" + type, slug: EV.slug }, data || {}), "*"); } catch (e) {} };
  if (EMBED) {
    document.body.classList.add("embed");
    document.documentElement.dataset.theme = params.get("theme") === "dark" ? "dark" : "light";
    const wrap = document.querySelector(".wrap");
    const sendHeight = () => tell("height", { height: Math.ceil(wrap.getBoundingClientRect().height) });
    if (window.ResizeObserver) new ResizeObserver(sendHeight).observe(wrap);
    window.addEventListener("load", sendHeight);
  }

  const T = {
    de: {
      win: "Gewinne", leadSub: "Eine Frage, ein paar Angaben, rund 30 Sekunden.",
      qQ: "Was ist die Elev8-Suite?", hQ: "Tipp eine Antwort an.",
      quiz: [["cleaning","Eine Reinigungs-App"],["guide","Ein Gästeguide"],["communication","Ein Kommunikations-Tool"],["channel","Ein Channel Manager"],["all","Alles davon"]],
      fCompany: "Firma", optional: "optional", qPms: "Welches PMS nutzt du?", pmsOther: "Welches?",
      pms: [["Guesty","Guesty"],["Hostaway","Hostaway"],["Lodgify","Lodgify"],["Smoobu","Smoobu"],["Cloudbeds","Cloudbeds"],["none","Keins"],["other","Anderes"]],
      eUnits: "Wähl aus, wie viele Units du verwaltest.",
      drawLbl: "Ziehung", leftLbl: "Noch",
      step: "Schritt {n} von {t}", back: "Zurück", next: "Weiter", finish: "Fertig",
      q1: "Wer nimmt teil?",
      inPot: "Du bist im Lostopf.",
      q2: "{n}, wie viele Units verwaltest du?", h2: "Units = Zimmer, Villen, Apartments usw.",
      units: [["1-4","1–4"],["5-19","5–19"],["20-49","20–49"],["50+","50+"],["none","Ich vermiete nicht","Investor, Agentur, Dienstleister"]],
      qL: "Zeig uns ein Inserat, {n}", hL: "Dann sprechen wir am Stand direkt über deinen Betrieb.",
      howto: ["Öffne dein Inserat in der Airbnb-App.", "Tippe auf Teilen und dann auf Link kopieren.", "Komm zurück und tippe auf Einfügen."],
      fLink: "Airbnb-Link", paste: "Einfügen", linkOk: "Inserat erkannt", eLink: "Das ist kein Airbnb-Link. Kopier ihn aus der App über Teilen.",
      ePaste: "Einfügen hat nicht geklappt. Halte das Feld gedrückt und wähle Einfügen.", skip: "Habe gerade keins zur Hand",
      chans: [["whatsapp","WhatsApp"],["email","E-Mail"]],
      fName: "Name", fWa: "WhatsApp-Nummer", fEmail: "E-Mail",
      cTerms: "Ich akzeptiere die <a href=\"{t}\" target=\"_blank\" rel=\"noopener\">Teilnahmebedingungen</a>.",
      cMarketing: "Elev8 darf mich kontaktieren und mir Werbung zeigen (freiwillig, widerrufbar).",
      closedH: "Das Gewinnspiel ist beendet.", closedP: "Danke fürs Vorbeischauen. Elev8 zeigen wir dir trotzdem gern.",
      cookie: "Wir nutzen Cookies von Meta, Google und LinkedIn, um dir später passende Elev8-Werbung zu zeigen. Das Gewinnspiel funktioniert auch ohne.",
      cookieYes: "Einverstanden", cookieNo: "Nur notwendige",
      submit: "Teilnehmen", sending: "Einen Moment …",
      eName: "Trag deinen Namen ein.", eEmail: "Diese E-Mail-Adresse stimmt nicht. Prüf sie bitte.",
      eWa: "Trag deine Nummer mit Ländervorwahl ein, z. B. +62 812 …", eTerms: "Bestätige die Teilnahmebedingungen, um teilzunehmen.",
      okH: "Danke, {n}. Du bist dabei.", okLbl: "Deine Losnummer", okDraw: "Ziehung {d} · {b}",
      okNote: "Die Bestätigung kommt per {c}.",
      demo: "Demo-Termin buchen", again: "Nächste Person", reset: "Neuer Start in {s} s",
      drawn: "Gezogen", days: "T", terms: "Teilnahmebedingungen", privacy: "Datenschutz",
      noahTitle: "Noch Fragen? Noah hilft dir gern",
      noahText: "Unser AI Customer Success Manager ist auf WhatsApp für dich da, auch per Sprachnachricht.",
      noahBtn: "WhatsApp an Noah", noahMeta: "WhatsApp +41 58 590 99 71",
      noahShort: "Fragen? Noah hilft dir gern", altDemo: "oder Termin selbst im Kalender buchen"
    },
    en: {
      win: "Win", leadSub: "One question, a few details, about 30 seconds.",
      qQ: "What is the Elev8-Suite?", hQ: "Tap an answer.",
      quiz: [["cleaning","A cleaning app"],["guide","A guest guide"],["communication","A communication tool"],["channel","A channel manager"],["all","All of the above"]],
      fCompany: "Company", optional: "optional", qPms: "Which PMS do you use?", pmsOther: "Which one?",
      pms: [["Guesty","Guesty"],["Hostaway","Hostaway"],["Lodgify","Lodgify"],["Smoobu","Smoobu"],["Cloudbeds","Cloudbeds"],["none","None"],["other","Other"]],
      eUnits: "Choose how many units you manage.",
      drawLbl: "Draw", leftLbl: "Time left",
      step: "Step {n} of {t}", back: "Back", next: "Next", finish: "Done",
      q1: "Who’s taking part?",
      inPot: "You’re in the draw.",
      q2: "{n}, how many units do you manage?", h2: "Units = rooms, villas, apartments, etc.",
      units: [["1-4","1–4"],["5-19","5–19"],["20-49","20–49"],["50+","50+"],["none","I don’t rent out","Investor, agency, service provider"]],
      qL: "Show us a listing, {n}", hL: "Then we can talk about your business right at the booth.",
      howto: ["Open your listing in the Airbnb app.", "Tap Share, then Copy link.", "Come back and tap Paste."],
      fLink: "Airbnb link", paste: "Paste", linkOk: "Listing recognised", eLink: "That’s not an Airbnb link. Copy it from the app via Share.",
      ePaste: "Pasting didn’t work. Long-press the field and choose Paste.", skip: "I don’t have one at hand",
      chans: [["whatsapp","WhatsApp"],["email","Email"]],
      fName: "Name", fWa: "WhatsApp number", fEmail: "Email",
      cTerms: "I accept the <a href=\"{t}\" target=\"_blank\" rel=\"noopener\">terms of participation</a>.",
      cMarketing: "Elev8 may contact me and show me ads (optional, withdraw anytime).",
      closedH: "The draw is closed.", closedP: "Thanks for stopping by. We’re still happy to show you Elev8.",
      cookie: "We use cookies from Meta, Google and LinkedIn to show you relevant Elev8 ads later. The draw works without them.",
      cookieYes: "Accept", cookieNo: "Necessary only",
      submit: "Enter the draw", sending: "One moment …",
      eName: "Enter your name.", eEmail: "That email address doesn’t look right. Please check it.",
      eWa: "Enter your number with country code, e.g. +62 812 …", eTerms: "Accept the terms to enter.",
      okH: "Thanks, {n}. You’re in.", okLbl: "Your ticket number", okDraw: "Draw {d} · {b}",
      okNote: "Your confirmation is on its way by {c}.",
      demo: "Book a demo", again: "Next person", reset: "Restarting in {s}s",
      drawn: "Drawn", days: "d", terms: "Terms of participation", privacy: "Privacy",
      noahTitle: "Questions? Noah is happy to help",
      noahText: "Our AI Customer Success Manager is there for you on WhatsApp, voice messages welcome.",
      noahBtn: "WhatsApp Noah", noahMeta: "WhatsApp +41 58 590 99 71",
      noahShort: "Questions? Noah is happy to help", altDemo: "or book a slot in the calendar yourself"
    }
  };
  const L = T[EV.lang] || T.de;
  document.documentElement.lang = EV.lang;
  const fmt = (s, o) => s.replace(/\{(\w)\}/g, (_, k) => o[k] ?? "");
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  /* ---- Static content ---- */
  document.querySelectorAll("[data-t]").forEach(el => el.textContent = L[el.dataset.t]);
  $("#evName").textContent = EV.name;
  $("#evMeta").textContent = EV.dates + " · " + EV.booth;
  $("#prizeTitle").textContent = EV.prize.title;
  $("#prizeDetail").textContent = EV.prize.detail;
  $("#terms").href = EV.termsUrl; $("#privacy").href = EV.privacyUrl;
  /* Noah: WhatsApp an den AI Customer Success Manager. Bewusst ohne vorausgefüllten Text, der Kunde schreibt frei. */
  const noahUrl = () => "https://wa.me/41585909971";
  const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';
  $("#noahFoot").href = noahUrl(); $("#noahFoot").textContent = L.noahShort;
  const noahBlock = () => '<div class="noah"><div class="noah-head"><span class="noah-avatar" aria-hidden="true">N</span><div>' +
    '<p class="noah-title">' + esc(L.noahTitle) + '</p><p class="noah-sub">' + esc(L.noahText) + '</p></div></div>' +
    '<a class="btn yellow" href="' + esc(noahUrl()) + '" target="_blank" rel="noopener">' + WA_ICON + esc(L.noahBtn) + '</a>' +
    '<p class="noah-meta">' + esc(L.noahMeta) + '</p></div>';
  if (!EV.termsUrl) $("#terms").parentNode.remove();
  if (!EV.privacyUrl) $("#privacy").parentNode.remove();

  const drawDate = EV.drawAt ? new Date(EV.drawAt) : null;
  if (!drawDate) $(".draw").remove();
  const locale = EV.lang === "en" ? "en-GB" : "de-DE";
  const drawText = drawDate ? drawDate.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: EV.timeZone || undefined }) : EV.dates;
  if (drawDate) $("#drawWhen").textContent = drawText;
  function tick() {
    if (!drawDate) return;
    const ms = drawDate - Date.now();
    if (ms <= 0) { $("#countdown").textContent = L.drawn; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    const p = n => String(n).padStart(2, "0");
    $("#countdown").textContent = (d ? d + L.days + " " : "") + p(h) + ":" + p(m) + ":" + p(s);
  }
  tick(); setInterval(tick, 1000);

  /* ---- Local backup (fair Wi-Fi fails) ---- */
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; } };
  const save = list => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {} };

  /* true = angekommen oder endgültig abgelehnt (nicht erneut senden), false = später nochmal */
  async function send(lead) {
    try {
      const body = Object.assign({}, lead); delete body._sent;
      const r = await fetch(EV.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
      return r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429);
    } catch (e) { return false; }
  }
  async function flush() {
    const list = load(); if (!list.length) return;
    const rest = [];
    for (const l of list) if (!(await send(l))) rest.push(l);
    save(rest);
  }
  window.addEventListener("online", flush);

  function ticketNo() {
    const n = (crypto.getRandomValues(new Uint32Array(1))[0] % 900000) + 100000;
    return "E8-" + String(n).replace(/(\d{3})(\d{3})/, "$1 $2");
  }
  function newToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
  }

  /* ---- Flow: 1 Quiz · 2 Kontakt (danach gespeichert) · 3 Betrieb (Units, Firma, PMS) · 4 Airbnb-Link ---- */
  const BLANK = () => ({ quiz: "", name: "", chan: "whatsapp", wa: "", email: "", mkt: false, units: "", company: "", pms: "", pmsOther: "", link: "", ticket: "", token: "", at: "" });
  const pmsValue = () => A.pms === "other" ? A.pmsOther.trim() : A.pms;
  let A, stepIdx;
  const SS = "elev8_progress2_" + slug;
  function persist() { try { sessionStorage.setItem(SS, JSON.stringify({ A, stepIdx })); } catch (e) {} }
  function reset() { document.body.classList.remove("done"); A = BLANK(); stepIdx = 0; try { sessionStorage.removeItem(SS); } catch (e) {} render(); }
  function restore() {
    try { const o = JSON.parse(sessionStorage.getItem(SS)); if (o && o.A) { A = Object.assign(BLANK(), o.A); stepIdx = o.stepIdx || 0; render(); return true; } } catch (e) {}
    return false;
  }
  function parseAirbnb(text) {
    const m = String(text).match(/https?:\/\/[^\s]+/i); if (!m) return null;
    let u; try { u = new URL(m[0]); } catch (e) { return null; }
    if (!/(^|\.)airbnb\.[a-z.]+$|(^|\.)abnb\.me$/i.test(u.hostname)) return null;
    const room = u.pathname.match(/\/rooms\/(?:plus\/)?(\d+)/), user = u.pathname.match(/\/users\/(?:show|profile)\/(\d+)/);
    return { url: u.origin + u.pathname, listing_id: room ? room[1] : "", host_id: user ? user[1] : "" };
  }
  const first = () => esc(A.name.trim().split(/\s+/)[0] || "");
  const noHost = () => A.units === "none";
  const entry = $("#entry");

  /* Der Lead wird nach Schritt 1 angelegt und danach ergänzt. Der Server erkennt ihn an Losnummer und Token. */
  function payload(completed) {
    const p = parseAirbnb(A.link) || {};
    return {
      ticket: A.ticket, edit_token: A.token, completed: completed,
      slug: slug, website: ($("#fWeb") || {}).value || "",
      name: A.name, preferred_channel: A.chan,
      whatsapp: A.chan === "whatsapp" ? A.wa : "", email: A.chan === "email" ? A.email : "",
      quiz_answer: A.quiz, company: A.company, pms: pmsValue(),
      units: A.units, airbnb_url: A.link, airbnb_listing_id: p.listing_id || "", airbnb_host_id: p.host_id || "",
      consent_terms: true, consent_marketing: A.mkt,
      source: KIOSK ? "booth_tablet" : "qr_mobile",
      utm_source: params.get("utm_source") || "", utm_medium: params.get("utm_medium") || "", utm_campaign: params.get("utm_campaign") || "",
      lang: EV.lang, submitted_at: A.at
    };
  }
  async function push(completed) {
    const body = payload(completed);
    if (!(await send(body))) { const list = load().filter(l => l.ticket !== body.ticket); list.push(body); save(list); }
  }

  function header() {
    const t = noHost() ? 3 : 4, n = Math.min(stepIdx + 1, t);
    const canBack = (stepIdx === 1 && !A.ticket) || stepIdx === 3;
    return '<div class="progress" style="grid-template-columns:repeat(' + t + ',1fr)" aria-hidden="true">' +
      Array.from({ length: t }, (_, i) => '<i class="' + (i < n ? "on" : "") + '"></i>').join("") + '</div>' +
      '<div class="step-meta"><span>' + fmt(L.step, { n, t }) + '</span><button type="button" class="back" ' + (canBack ? "" : "hidden") + '>' + L.back + '</button></div>';
  }
  function optsHTML(list, key, cls) {
    return '<div class="opts ' + (cls || "") + '" role="group">' + list.map(o =>
      '<button type="button" class="opt" data-k="' + key + '" data-v="' + o[0] + '" aria-pressed="' + (A[key] === o[0]) + '"' +
      (o[2] ? ' style="grid-column:1/-1"' : "") + '>' + esc(o[1]) + (o[2] ? "<small>" + esc(o[2]) + "</small>" : "") + "</button>").join("") + "</div>";
  }

  const steps = [
    () => '<div class="quiz"><h2 class="q">' + L.qQ + '</h2><p class="hint">' + L.hQ + '</p>' + optsHTML(L.quiz, "quiz", "") + '</div>',
    () => '<h2 class="q q1">' + L.q1 + '</h2>' +
      '<div class="field"><label for="fName">' + L.fName + '</label><input id="fName" autocomplete="name" value="' + esc(A.name) + '"></div>' +
      '<div class="field"><label for="fCompany">' + L.fCompany + ' <span>(' + L.optional + ')</span></label><input id="fCompany" autocomplete="organization" value="' + esc(A.company) + '"></div>' +
      optsHTML(L.chans, "chan", "two").replace('class="opts two"', 'class="opts two" style="margin-bottom:.85rem"') +
      '<div class="field" id="waField"' + (A.chan === "whatsapp" ? "" : " hidden") + '><label for="fWa">' + L.fWa + '</label><input id="fWa" type="tel" inputmode="tel" autocomplete="tel" placeholder="+62 812 …" value="' + esc(A.wa) + '"></div>' +
      '<div class="field" id="mailField"' + (A.chan === "email" ? "" : " hidden") + '><label for="fEmail">' + L.fEmail + '</label><input id="fEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" value="' + esc(A.email) + '"></div>' +
      '<label class="check"><input type="checkbox" id="cTerms"><span>' + fmt(L.cTerms, { t: esc(EV.termsUrl) }) + '</span></label>' +
      '<label class="check"><input type="checkbox" id="cMkt"' + (A.mkt ? " checked" : "") + '><span>' + L.cMarketing + '</span></label>' +
      '<input id="fWeb" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="err" id="err" role="alert"></p>' +
      '<button type="button" class="btn yellow" id="submitBtn">' + L.submit + '</button>',
    () => '<p class="ok-link in-pot">' + esc(L.inPot) + '</p>' +
      '<h2 class="q">' + fmt(L.q2, { n: first() }) + '</h2><p class="hint">' + L.h2 + '</p>' +
      optsHTML(L.units.slice(0, 4), "units", "four") +
      optsHTML(L.units.slice(4), "units", "").replace('class="opts "', 'class="opts" style="margin-top:.4rem"').replace('class="opt"', 'class="opt wide"') +
      '<p class="sub-q">' + L.qPms + ' <span>(' + L.optional + ')</span></p>' + optsHTML(L.pms, "pms", "").replace('class="opts "', 'class="chips"') +
      '<div class="field" id="pmsOtherField" style="margin:.45rem 0 0"' + (A.pms === "other" ? "" : " hidden") + '><input id="fPmsOther" aria-label="' + L.pmsOther + '" placeholder="' + L.pmsOther + '" value="' + esc(A.pmsOther) + '"></div>' +
      '<p class="err" id="uErr" role="alert"></p>' +
      '<button type="button" class="btn" id="bizNext">' + L.next + '</button>',
    () => '<h2 class="q">' + fmt(L.qL, { n: first() }) + '</h2><p class="hint">' + L.hL + '</p>' +
      '<ol class="howto">' + L.howto.map(h => "<li><span>" + esc(h) + "</span></li>").join("") + '</ol>' +
      '<div class="field"><label for="fLink">' + L.fLink + '</label><div class="paste">' +
      '<input id="fLink" type="text" inputmode="url" autocapitalize="off" spellcheck="false" autocomplete="off" placeholder="airbnb.com/rooms/…" value="' + esc(A.link) + '">' +
      '<button type="button" class="btn ghost" id="pasteBtn" style="width:auto;margin:0;padding:.75rem 1rem">' + L.paste + '</button></div>' +
      '<p class="ok-link" id="linkOk"' + (parseAirbnb(A.link) ? "" : " hidden") + '>' + L.linkOk + '</p><p class="err" id="lErr" role="alert"></p></div>' +
      '<button type="button" class="btn" id="linkNext"' + (parseAirbnb(A.link) ? "" : " disabled") + '>' + L.finish + '</button>' +
      '<button type="button" class="skip" id="linkSkip">' + L.skip + '</button>'
  ];

  async function finish() {
    await push(true);
    try { sessionStorage.removeItem(SS); } catch (e) {}
    tell("complete", { units: A.units, airbnb: Boolean(A.link) });
    success();
  }

  function render() {
    entry.innerHTML = '<div class="step">' + header() + steps[stepIdx]() + '</div>';
    persist();
    document.body.classList.toggle("started", stepIdx > 0);
    tell("step", { step: stepIdx + 1 });
    $(".back", entry).onclick = () => { stepIdx = stepIdx === 1 ? 0 : 2; render(); };
    const bn = $("#bizNext"); if (bn) bn.onclick = submitBusiness;
    ["fCompany", "fPmsOther"].forEach(id => { const el = $("#" + id); if (el) el.oninput = () => { A[id === "fCompany" ? "company" : "pmsOther"] = el.value; persist(); }; });
    entry.querySelectorAll(".opt").forEach(b => b.onclick = () => choose(b));
    const sb = $("#submitBtn"); if (sb) sb.onclick = submitContact;
    const li = $("#fLink");
    if (li) {
      const check = showErr => {
        const v = li.value.trim(), p = parseAirbnb(v);
        A.link = p ? p.url : ""; persist();
        $("#linkOk").hidden = !p; $("#linkNext").disabled = !p;
        li.setAttribute("aria-invalid", v && !p ? "true" : "false");
        $("#lErr").textContent = v && !p && showErr ? L.eLink : "";
        return p;
      };
      li.oninput = () => check(false);
      li.onchange = () => check(true);
      li.addEventListener("paste", () => setTimeout(() => { if (check(true)) setTimeout(finish, 450); }, 0));
      $("#pasteBtn").onclick = async () => {
        let txt = "";
        try { if (navigator.clipboard && navigator.clipboard.readText) txt = await navigator.clipboard.readText(); } catch (e) {}
        if (txt) { li.value = txt; if (check(true)) { setTimeout(finish, 450); return; } }
        else { $("#lErr").textContent = L.ePaste; }
        li.focus(); li.select();
      };
      $("#linkNext").onclick = finish;
      $("#linkSkip").onclick = () => { A.link = ""; finish(); };
    }
  }

  function choose(b) {
    const k = b.dataset.k, v = b.dataset.v;
    A[k] = v;
    entry.querySelectorAll('.opt[data-k="' + k + '"]').forEach(x => x.setAttribute("aria-pressed", x.dataset.v === v));
    if (k === "chan") {
      $("#waField").hidden = v !== "whatsapp"; $("#mailField").hidden = v !== "email";
      $("#err").textContent = ""; persist();
      (v === "whatsapp" ? $("#fWa") : $("#fEmail")).focus();
      return;
    }
    if (k === "quiz") { persist(); setTimeout(() => { stepIdx = 1; render(); }, 180); return; }
    if (k === "pms") { $("#pmsOtherField").hidden = v !== "other"; if (v === "other") $("#fPmsOther").focus(); persist(); return; }
    if (k === "units") { $("#uErr").textContent = ""; persist(); }
  }

  // Betrieb fertig: Lead ergänzen, damit die Angaben auch ohne letzten Schritt ankommen
  function submitBusiness() {
    if (!A.units) { $("#uErr").textContent = L.eUnits; return; }
    if ($("#fPmsOther")) A.pmsOther = $("#fPmsOther").value;
    if (noHost()) { A.link = ""; finish(); return; }
    push(false);
    stepIdx = 3; render();
  }

  async function submitContact() {
    const name = $("#fName"), wa = $("#fWa"), email = $("#fEmail"), err = $("#err");
    [name, wa, email].forEach(i => i.removeAttribute("aria-invalid"));
    const waNum = wa.value.replace(/[^\d+]/g, "");
    let msg = "";
    if (!name.value.trim()) { msg = L.eName; name.setAttribute("aria-invalid", "true"); name.focus(); }
    else if (A.chan === "whatsapp" && !/^\+?\d{8,15}$/.test(waNum)) { msg = L.eWa; wa.setAttribute("aria-invalid", "true"); wa.focus(); }
    else if (A.chan === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { msg = L.eEmail; email.setAttribute("aria-invalid", "true"); email.focus(); }
    else if (!$("#cTerms").checked) msg = L.eTerms;
    err.textContent = msg;
    if (msg) return;

    const btn = $("#submitBtn"); btn.disabled = true; btn.textContent = L.sending;
    A.name = name.value.trim(); A.company = $("#fCompany").value.trim(); A.wa = waNum; A.email = email.value.trim().toLowerCase(); A.mkt = $("#cMkt").checked;
    if (!A.ticket) { A.ticket = ticketNo(); A.token = newToken(); A.at = new Date().toISOString(); }
    await push(false);
    trackLead();
    tell("lead", { channel: A.chan, consent_marketing: A.mkt });
    stepIdx = 2; render();
  }

  function success() {
    document.body.classList.add("started", "done");
    const chanName = (L.chans.find(c => c[0] === A.chan) || [, ""])[1];
    // Alle sind im Lostopf; ob die Quizantwort stimmt, zeigt die Seite bewusst nicht
    const head = '<div class="stub"><p class="lbl">' + L.okLbl + '</p><p class="no">' + esc(A.ticket) + '</p>' +
      '<p>' + esc(fmt(L.okDraw, { d: drawText, b: EV.booth })) + '</p></div>' +
      '<h3>' + fmt(L.okH, { n: first() }) + '</h3><p class="note">' + esc(fmt(L.okNote, { c: chanName })) + '</p>';
    entry.innerHTML = '<div class="step ticket">' + head +
      noahBlock() +
      (KIOSK ? '<button type="button" class="btn ghost" id="againBtn">' + L.again + '</button><p class="kiosk-reset" id="kr"></p>'
             : '<a class="alt-demo" href="' + esc(EV.demoUrl) + '" target="_blank" rel="noopener">' + L.altDemo + '</a>') +
      '</div>';
    if (EMBED) tell("scroll");
    else entry.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (KIOSK) {
      let sLeft = 12; const kr = $("#kr");
      const t = setInterval(() => { kr.textContent = fmt(L.reset, { s: sLeft }); if (--sLeft < 0) { clearInterval(t); reset(); } }, 1000);
      $("#againBtn").onclick = () => { clearInterval(t); reset(); };
    }
  }

  /* ---- Retargeting: Pixel laden erst nach Zustimmung ---- */
  const TR = EV.tracking || {};
  // Eingebettet laden die Pixel der Website, nicht die eigenen
  const hasTracking = !EMBED && Boolean(TR.meta || TR.google || TR.linkedin);
  const CK = "elev8_consent";
  let tracking = false;
  function addScript(src) { const s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); }
  function loadTrackers() {
    if (tracking) return; tracking = true;
    if (TR.meta) {
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[]}(window,document);
      addScript("https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", TR.meta); fbq("track", "PageView");
    }
    if (TR.google) {
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
      addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(TR.google));
      gtag("js", new Date()); gtag("config", TR.google);
    }
    if (TR.linkedin) {
      window._linkedin_partner_id = TR.linkedin; window._linkedin_data_partner_ids = [TR.linkedin];
      window.lintrk = window.lintrk || function (a, b) { window.lintrk.q.push([a, b]); }; window.lintrk.q = window.lintrk.q || [];
      addScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
    }
  }
  function trackLead() {
    if (!tracking) return;
    try { if (window.fbq) fbq("track", "Lead", { content_name: EV.name }); } catch (e) {}
    try { if (window.gtag) gtag("event", "generate_lead", { event_category: "messe", event_label: slug }); } catch (e) {}
  }
  if (hasTracking) {
    let choice = null; try { choice = localStorage.getItem(CK); } catch (e) {}
    if (choice === "yes") loadTrackers();
    else if (choice !== "no" && !KIOSK) {
      $("#consentText").textContent = L.cookie; $("#consentYes").textContent = L.cookieYes; $("#consentNo").textContent = L.cookieNo;
      $("#consent").hidden = false;
      const pick = v => { try { localStorage.setItem(CK, v); } catch (e) {} $("#consent").hidden = true; if (v === "yes") loadTrackers(); };
      $("#consentYes").onclick = () => pick("yes"); $("#consentNo").onclick = () => pick("no");
    }
  }

  /* ---- Gewinnspiel beendet ---- */
  if (!EV.open || (drawDate && drawDate <= Date.now())) {
    entry.innerHTML = '<div class="closed"><h2>' + L.closedH + '</h2><p>' + L.closedP + '</p>' +
      noahBlock() + '<a class="alt-demo" href="' + esc(EV.demoUrl) + '" target="_blank" rel="noopener">' + L.altDemo + '</a></div>';
    flush();
    return;
  }

  if (!restore()) reset();
  flush();
})();
</script>
</body>
</html>
`;
