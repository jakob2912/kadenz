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
export async function satzpauseAnkuendigen(endeMs: number | null): Promise<Ergebnis> {
  try {
    if (endeMs === null) {
      await prisma.einstellung.deleteMany({ where: { schluessel: PAUSE_SCHLUESSEL } });
      return { ok: true };
    }

    const restMs = endeMs - Date.now();
    if (restMs <= 0 || restMs > LAENGSTE_PAUSE_MS) return { ok: true };

    const [einstellungen, abos] = await Promise.all([
      benachrichtigungenLesen(),
      prisma.pushAbo.count(),
    ]);
    if (!einstellungen.satzpause || abos === 0) return { ok: true };

    const kennung = crypto.randomUUID();
    const wert = JSON.stringify({ kennung, ende: endeMs });
    await prisma.einstellung.upsert({
      where: { schluessel: PAUSE_SCHLUESSEL },
      update: { wert },
      create: { schluessel: PAUSE_SCHLUESSEL, wert },
    });

    after(async () => {
      await new Promise((r) => setTimeout(r, Math.max(0, endeMs - Date.now())));

      const aktuell = await prisma.einstellung.findUnique({
        where: { schluessel: PAUSE_SCHLUESSEL },
      });
      if (!aktuell || JSON.parse(aktuell.wert).kennung !== kennung) return;

      await prisma.einstellung.deleteMany({
        where: { schluessel: PAUSE_SCHLUESSEL, wert: aktuell.wert },
      });
      await anAlleSenden(
        {
          title: "Satzpause vorbei",
          body: "Nächster Satz.",
          url: "/training",
          tag: "satzpause",
        },
        // Eine Minute: danach ist die Nachricht keine Hilfe mehr, sondern Lärm.
        60
      );
    });

    return { ok: true };
  } catch (e) {
    return alsFehler(e);
  }
}
