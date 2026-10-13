/*
 * Orbit Service Worker: macht Orbit installierbar und zeigt ohne Verbindung eine eigene Seite.
 * Bewusst zurückhaltend: Seiten und Daten kommen immer frisch vom Server (keine veralteten Inhalte,
 * keine zwischengespeicherten Kundendaten). Nur die Offline-Seite und die Icons werden vorgehalten.
 */
const CACHE = "orbit-shell-v2";
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

// ── Push-Mitteilungen ────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Orbit", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Orbit";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Offenes Orbit-Fenster wiederverwenden, sonst ein neues öffnen
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.focus().then((f) => (f && "navigate" in f ? f.navigate(target.href) : f));
        }
      }
      return self.clients.openWindow(target.href);
    })
  );
});

// Der Browser hat die Anmeldung erneuert: neue Anmeldung bei Orbit hinterlegen
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/push/key", { credentials: "include" })
      .then((r) => r.json())
      .then(({ publicKey }) => {
        const pad = "=".repeat((4 - (publicKey.length % 4)) % 4);
        const raw = atob((publicKey + pad).replace(/-/g, "+").replace(/_/g, "/"));
        const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      })
      .then((sub) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() })
        })
      )
      .catch(() => {})
  );
});
