/*
 * Orbit Service Worker: macht Orbit installierbar und zeigt ohne Verbindung eine eigene Seite.
 * Bewusst zurückhaltend: Seiten und Daten kommen immer frisch vom Server (keine veralteten Inhalte,
 * keine zwischengespeicherten Kundendaten). Nur die Offline-Seite und die Icons werden vorgehalten.
 */
const CACHE = "orbit-shell-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/pwa/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});
