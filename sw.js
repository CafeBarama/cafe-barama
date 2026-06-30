/* Service worker — چت تیم باراما (PWA) */
const CACHE = "barama-app-v5";
const CORE = [
  "index.html", "index.js", "auth.js", "config.js",
  "orders.html", "app.js",
  "accounting.html", "accounting.js",
  "attendance.html", "attendance.js",
  "chat.html", "chat.js",
  "app.webmanifest", "chat.webmanifest", "attendance.webmanifest",
  "icon-192.png", "icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // CDN/API → مرورگر خودش
  // شبکه اول، اگر نشد از کش (برای کار آفلاین و باز شدن سریع)
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// کلیک روی نوتیفیکیشن → باز کردن/فوکوس چت
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url.includes("chat.html") && "focus" in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow("chat.html");
    })
  );
});
