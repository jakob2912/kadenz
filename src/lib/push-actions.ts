"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { prisma } from "./db";
import {
  anAlleSenden,
  benachrichtigungenLesen,
  benachrichtigungenSchreiben,
  vapidSchluessel,
  type Benachrichtigungen,
} from "./push";

type Ergebnis = { ok: true } | { ok: false; fehler: string };

function alsFehler(e: unknown): { ok: false; fehler: string } {
  return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
}

/** Der öffentliche Schlüssel, mit dem der Browser sein Abo anlegt. */
export async function pushSchluessel(): Promise<{ ok: true; publicKey: string } | { ok: false; fehler: string }> {
  try {
    return { ok: true, publicKey: (await vapidSchluessel()).publicKey };
  } catch (e) {
    return alsFehler(e);
  }
}

/** Aus dem User-Agent nur so viel, dass man zwei Geräte auseinanderhält. */
function geraetAus(ua: string): string {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Browser";
}

export async function aboSpeichern(abo: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<Ergebnis> {
  // Nur Endpoints der bekannten Push-Dienste: sonst ließe sich über diese
  // Aktion ein beliebiger Server eintragen, an den Kadenz dann Anfragen schickt.
  let host: string;
  try {
    const url = new URL(abo.endpoint);
    if (url.protocol !== "https:") throw new Error();
    host = url.hostname;
  } catch {
    return { ok: false, fehler: "Ungültiger Endpoint." };
  }
  // Die Schlüssel des Geräts: p256dh ist ein unkomprimierter P-256-Punkt
  // (65 Byte, Base64url 87 Zeichen), auth 16 Byte (22 Zeichen). Ein kaputtes
  // Abo bliebe sonst dauerhaft in der Liste und schlüge bei jedem Versand fehl.
  const base64url = /^[A-Za-z0-9_-]+={0,2}$/;
  if (
    !base64url.test(abo.keys?.p256dh ?? "") ||
    !base64url.test(abo.keys?.auth ?? "") ||
    abo.keys.p256dh.length < 80 ||
    abo.keys.p256dh.length > 100 ||
    abo.keys.auth.length < 20 ||
    abo.keys.auth.length > 30
  ) {
    return { ok: false, fehler: "Ungültige Schlüssel im Abo." };
  }

  const bekannt = [
    "web.push.apple.com",
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "wns.windows.com",
    "notify.windows.com",
  ];
  if (!bekannt.some((d) => host === d || host.endsWith(`.${d}`))) {
    return { ok: false, fehler: `Unbekannter Push-Dienst: ${host}` };
  }

  try {
    const geraet = geraetAus((await headers()).get("user-agent") ?? "");
    await prisma.pushAbo.upsert({
      where: { endpoint: abo.endpoint },
      update: { p256dh: abo.keys.p256dh, auth: abo.keys.auth, geraet },
      create: { endpoint: abo.endpoint, p256dh: abo.keys.p256dh, auth: abo.keys.auth, geraet },
    });
    return { ok: true };
  } catch (e) {
    return alsFehler(e);
  }
}

export async function aboEntfernen(endpoint: string): Promise<Ergebnis> {
  try {
    await prisma.pushAbo.deleteMany({ where: { endpoint } });
    return { ok: true };
  } catch (e) {
    return alsFehler(e);
  }
}

export async function testNachricht(): Promise<
  { ok: true; zugestellt: number } | { ok: false; fehler: string }
> {
  try {
    const r = await anAlleSenden({
      title: "Kadenz",
      body: "Testnachricht — so sehen Benachrichtigungen aus.",
      url: "/einstellungen",
      tag: "test",
    });
    if (r.zugestellt === 0) {
      return {
        ok: false,
        fehler: r.fehler[0] ?? "Kein Gerät angemeldet — erst Benachrichtigungen einschalten.",
      };
    }
    return { ok: true, zugestellt: r.zugestellt };
  } catch (e) {
    return alsFehler(e);
  }
}

export async function benachrichtigungenSetzen(b: Benachrichtigungen): Promise<Ergebnis> {
  try {
    await benachrichtigungenSchreiben({
      satzpause: Boolean(b.satzpause),
      morgen: Boolean(b.morgen),
      abend: Boolean(b.abend),
    });
    return { ok: true };
  } catch (e) {
    return alsFehler(e);
  }
}

// ─────────────────────────────────────────────────────────────
// Satzpause
// ─────────────────────────────────────────────────────────────

const PAUSE_SCHLUESSEL = "satzpause_push";

/**
 * Längste Pause, für die noch eine Nachricht geplant wird.
 *
 * Die Nachricht wartet in einer laufenden Funktion auf Vercel (after() unten),
 * und die darf dort mit Fluid Compute höchstens 300 Sekunden laufen. Mit
 * etwas Luft für Datenbank und Versand bleiben 280.
 */
const LAENGSTE_PAUSE_MS = 280_000;

/**
 * Die Satzpause beim Server ankündigen — oder mit `null` abbestellen.
 *
 * Warum der Server: ein iPhone mit gesperrtem Bildschirm führt keine Zeile
 * JavaScript der Seite aus, und Safari kennt keine zeitgesteuerten lokalen
 * Nachrichten. Die einzige Nachricht, die ein gesperrtes iPhone anzeigt, ist
 * eine, die von außen kommt.
 *
 * Wie: jede Ankündigung bekommt eine Kennung und steht in der Tabelle
 * Einstellung. Nach der Antwort wartet after() bis zum Pausenende, liest den
 * Eintrag erneut und schickt nur, wenn er noch derselbe ist. "+30 s" legt
 * eine neue Ankündigung an, "Weiter" löscht sie — die alte wacht dann auf,
 * sieht eine andere Kennung und geht wortlos.
 *
 * Grenze: das funktioniert nur, wenn die Funktion so lange laufen darf. Auf
 * Vercel ist das mit Fluid Compute der Fall (Standard für Projekte seit
 * 2025, auch im Gratis-Tarif); ohne endet die Funktion nach 10 Sekunden, und
 * die Nachricht fällt still aus. Der Timer in der App läuft davon unberührt.
 */
export async function satzpauseAnkuendigen(
  endeMs: number | null,
  /**
   * Das Push-Abo des Geräts, auf dem trainiert wird. Fehlt es (Gerät ohne
   * Push), gibt es keine Nachricht — an alle anderen Geräte soll sie nicht.
   */
  endpoint?: string | null
): Promise<Ergebnis> {
  try {
    const restMs = endeMs === null ? 0 : endeMs - Date.now();

    /* Jede Ankündigung, die nicht geplant wird, räumt die vorige weg. Sonst
       käme nach einem "+30 s" über die Grenze hinaus die alte Nachricht zum
       alten Ende, obwohl die App noch eine halbe Minute Pause zeigt. */
    const abraeumen = async () => {
      await prisma.einstellung.deleteMany({ where: { schluessel: PAUSE_SCHLUESSEL } });
      return { ok: true } as const;
    };

    if (endeMs === null || !endpoint || restMs <= 0 || restMs > LAENGSTE_PAUSE_MS) {
      return await abraeumen();
    }

    const [einstellungen, abo] = await Promise.all([
      benachrichtigungenLesen(),
      prisma.pushAbo.findUnique({ where: { endpoint }, select: { endpoint: true } }),
    ]);
    if (!einstellungen.satzpause || !abo) return await abraeumen();

    const kennung = crypto.randomUUID();
    const wert = JSON.stringify({ kennung, ende: endeMs });
    await prisma.einstellung.upsert({
      where: { schluessel: PAUSE_SCHLUESSEL },
      update: { wert },
      create: { schluessel: PAUSE_SCHLUESSEL, wert },
    });

    after(async () => {
      await new Promise((r) => setTimeout(r, Math.max(0, endeMs - Date.now())));

      /* Lesen und Austragen in EINEM Schritt: gelöscht wird nur die eigene
         Ankündigung (gleicher Wert samt Kennung). Kommt "Weiter" oder
         "+30 s" dazwischen, steht dort ein anderer Wert, count ist 0, und
         die Nachricht entfällt. Getrennt gelesen und gelöscht, ging sie in
         genau diesem Fenster trotzdem raus. */
      const { count } = await prisma.einstellung.deleteMany({
        where: { schluessel: PAUSE_SCHLUESSEL, wert },
      });
      if (count === 0) return;

      await anAlleSenden(
        {
          title: "Satzpause vorbei",
          body: "Nächster Satz.",
          url: "/training",
          tag: "satzpause",
        },
        // Eine Minute: danach ist die Nachricht keine Hilfe mehr, sondern Lärm.
        60,
        endpoint
      );
    });

    return { ok: true };
  } catch (e) {
    return alsFehler(e);
  }
}
