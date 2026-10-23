/*
 * Kadenz — Service Worker
 *
 * Bewusst klein. Er cacht KEINE Seiten: Kadenz lebt von Zahlen, die sich nach
 * jedem Satz ändern, und eine aus dem Cache gelieferte Trainingsseite zeigte
 * Gewichte von gestern, ohne dass man es ihr ansieht. Was er tut:
 *
 *   1. Push-Nachrichten anzeigen (Satzpause vorbei, Morgen-Briefing, …).
 *      Auf dem iPhone geht das nur, wenn Kadenz über "Zum Home-Bildschirm"
 *      installiert ist — iOS gibt Web-Push ausschließlich installierten Apps.
 *   2. Beim Tipp auf eine Nachricht die App öffnen, und zwar auf der Seite,
 *      um die es geht, statt immer auf der Startseite.
 *   3. Ohne Netz statt der weißen Safari-Fehlerseite eine eigene Seite
 *      zeigen, die sagt, was los ist. Sätze, die in einer schon offenen
 *      Trainingsseite abgehakt werden, hält Next selbst zurück und schickt sie
 *      nach (experimental.useOffline in next.config.ts).
 */

const OFFLINE_HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Kadenz · offline</title>
<style>
  html,body{margin:0;background:#090b0d;color:#e9eef2;font-family:-apple-system,system-ui,sans-serif}
  main{max-width:520px;margin:0 auto;padding:calc(64px + env(safe-area-inset-top)) 20px 40px}
  p{color:#94a3ae;line-height:1.55;font-size:15px}
  small{color:#808e9b;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600}
  button{margin-top:24px;width:100%;min-height:52px;border:0;border-radius:16px;background:#a9c9ff;color:#0a1220;font-weight:600;font-size:16px}
</style></head><body><main>
<small>Kadenz</small>
<h1 style="font-size:27px;letter-spacing:-.025em;margin:8px 0 0">Kein Netz</h1>
<p>Die Seite braucht eine Verbindung — Startgewichte und Historie kommen frisch aus der Datenbank.
War die Trainingsseite schon offen, bevor das Netz weg war: dort weiterloggen, die Sätze gehen raus, sobald wieder Empfang da ist.</p>
<button onclick="location.reload()">Nochmal versuchen</button>
</main></body></html>`;

self.addEventListener("install", () => {
  // Eine neue Version soll nicht erst warten, bis jeder Tab zu ist — es gibt
  // keinen Cache, den eine alte Version noch brauchen könnte.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Navigation Preload: der Browser startet die Seitenanfrage, während
      // der Worker noch hochfährt. Ohne das wartet auf iOS jeder Kaltstart der
      // App erst auf den Worker und dann auf das Netz.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const vorab = await event.preloadResponse;
        if (vorab) return vorab;
        return await fetch(req);
      } catch {
        return new Response(OFFLINE_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    })()
  );
});

self.addEventListener("push", (event) => {
  let daten = {};
  try {
    daten = event.data ? event.data.json() : {};
  } catch {
    daten = { body: event.data ? event.data.text() : "" };
  }

  const titel = daten.title || "Kadenz";
  event.waitUntil(
    self.registration.showNotification(titel, {
      body: daten.body || "",
      icon: "/icons/icon-192.png",
      // tag ersetzt eine ältere Nachricht derselben Art, statt sie zu stapeln:
      // drei "Satzpause vorbei" untereinander sagen nichts Neues.
      tag: daten.tag || undefined,
      renotify: Boolean(daten.tag),
      data: { url: daten.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ziel = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const fenster = await self.clients.matchAll({ type: "window" });
      // Ein offenes Kadenz-Fenster nach vorne holen statt ein zweites zu öffnen —
      // sonst liefe die Satzpause in einem Fenster weiter, das man nicht sieht.
      // Steht es schon auf der Zielseite (Satzpause → Training), bleibt es dort:
      // ein Neuladen würde die laufende Einheit nur unnötig neu aufbauen.
      const f = fenster.find((c) => new URL(c.url).origin === self.location.origin);
      if (!f) {
        await self.clients.openWindow(ziel);
        return;
      }
      await f.focus();
      if (new URL(f.url).pathname !== new URL(ziel).pathname) {
        try {
          await f.navigate(ziel);
        } catch {
          // Nicht von diesem Worker kontrolliert — dann reicht das Fokussieren.
        }
      }
    })()
  );
});
