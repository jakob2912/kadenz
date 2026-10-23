import webpush, { WebPushError } from "web-push";
import { prisma } from "./db";

/**
 * Kadenz — Push-Nachrichten
 *
 * Web-Push nach RFC 8030, verschlüsselt mit den VAPID-Schlüsseln der App.
 * Auf dem iPhone kommt eine Nachricht nur an, wenn Kadenz über "Zum
 * Home-Bildschirm" installiert ist (iOS 16.4 und neuer) und in den
 * Einstellungen der App erlaubt wurde.
 *
 * Kein "use server": diese Datei exportiert Hilfen für Server Actions und
 * Cron-Routen, sie selbst ist keine Aktion, die der Browser aufrufen darf.
 */

export type Nachricht = {
  title: string;
  body: string;
  /** Wohin der Tipp auf die Nachricht führt. */
  url?: string;
  /** Gleiches tag ersetzt eine ältere Nachricht statt sie zu stapeln. */
  tag?: string;
};

// ─────────────────────────────────────────────────────────────
// Schlüssel
// ─────────────────────────────────────────────────────────────

const VAPID_SCHLUESSEL = "vapid_schluessel";

type Vapid = { publicKey: string; privateKey: string };

/**
 * Die VAPID-Schlüssel — aus der Umgebung, sonst aus der Datenbank, sonst neu.
 *
 * Warum sie sich selbst anlegen: ein Schlüsselpaar zu erzeugen und als zwei
 * Variablen bei Vercel einzutragen ist genau der Einrichtungsschritt, an dem
 * so etwas liegen bleibt. Das Paar ist kein Geheimnis von außen, sondern
 * eines dieser App — es gehört an dieselbe Stelle wie der Google-Token.
 *
 * Wer sie trotzdem von außen setzen will (VAPID_PUBLIC_KEY und
 * VAPID_PRIVATE_KEY), hat Vorrang. Ein Wechsel des Paars macht alle
 * bestehenden Abos ungültig; jedes Gerät meldet sich beim nächsten Öffnen der
 * Einstellungen mit dem neuen Schlüssel neu an (aboAbgleichen in
 * components/einstellungen.tsx).
 *
 * Das Anlegen ist gegen zwei gleichzeitige Aufrufe gesichert: createMany mit
 * skipDuplicates schreibt nur, wenn noch nichts da ist, und gelesen wird
 * danach in jedem Fall der Eintrag, der gewonnen hat.
 */
export async function vapidSchluessel(): Promise<Vapid> {
  const ausUmgebung = {
    publicKey: process.env.VAPID_PUBLIC_KEY?.trim(),
    privateKey: process.env.VAPID_PRIVATE_KEY?.trim(),
  };
  if (ausUmgebung.publicKey && ausUmgebung.privateKey) return ausUmgebung as Vapid;
  if (ausUmgebung.publicKey || ausUmgebung.privateKey) {
    // Nur eine von beiden gesetzt — still auf die Datenbank auszuweichen hieße,
    // dass die gesetzte Variable scheinbar wirkt und es nicht tut.
    console.error("Nur eine der Variablen VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ist gesetzt — beide oder keine.");
  }

  const vorhanden = await prisma.einstellung.findUnique({ where: { schluessel: VAPID_SCHLUESSEL } });
  if (vorhanden) return JSON.parse(vorhanden.wert) as Vapid;

  const neu = webpush.generateVAPIDKeys();
  await prisma.einstellung.createMany({
    data: [{ schluessel: VAPID_SCHLUESSEL, wert: JSON.stringify(neu), aktualisiert: new Date() }],
    skipDuplicates: true,
  });
  const gewonnen = await prisma.einstellung.findUniqueOrThrow({
    where: { schluessel: VAPID_SCHLUESSEL },
  });
  return JSON.parse(gewonnen.wert) as Vapid;
}

/**
 * Wer die Nachrichten schickt — Pflichtangabe von VAPID.
 *
 * Apple lehnt Absender auf "localhost" oder ohne gültige Form mit
 * BadJwtToken ab, und zwar ohne weiteren Hinweis. Deshalb die
 * Produktionsadresse von Vercel, die dort immer gesetzt ist.
 */
function absender(): string {
  const gesetzt = process.env.VAPID_SUBJECT?.trim();
  if (gesetzt) return gesetzt;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "mailto:kadenz@example.com";
}

// ─────────────────────────────────────────────────────────────
// Senden
// ─────────────────────────────────────────────────────────────

export type Versand = { zugestellt: number; entfernt: number; fehler: string[] };

/**
 * An alle angemeldeten Geräte.
 *
 * Tote Abos (404/410 vom Push-Dienst) werden dabei gelöscht — sie kommen
 * nicht wieder, und jeder weitere Versuch kostet nur Zeit. Andere Fehler
 * bleiben stehen und werden gemeldet: ein 429 oder 5xx von Apple ist
 * vorübergehend, das Abo ist deshalb nicht kaputt.
 *
 * TTL eine Stunde: ein "Satzpause vorbei", das erst ankommt, wenn das Handy
 * nach dem Training wieder Netz hat, ist schlimmer als keins. Für die
 * Morgen-Nachricht reicht die Stunde ebenso.
 */
export async function anAlleSenden(
  nachricht: Nachricht,
  ttlSekunden = 3600,
  /**
   * Nur an dieses eine Gerät. Für die Satzpause: das iPhone im Gym soll sie
   * bekommen, nicht zusätzlich der Laptop daheim bei jedem Satz.
   */
  nurEndpoint?: string
): Promise<Versand> {
  const abos = await prisma.pushAbo.findMany(
    nurEndpoint ? { where: { endpoint: nurEndpoint } } : undefined
  );
  const ergebnis: Versand = { zugestellt: 0, entfernt: 0, fehler: [] };
  if (abos.length === 0) return ergebnis;

  const { publicKey, privateKey } = await vapidSchluessel();
  const nutzlast = JSON.stringify(nachricht);

  await Promise.all(
    abos.map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          nutzlast,
          {
            TTL: ttlSekunden,
            urgency: "high",
            vapidDetails: { subject: absender(), publicKey, privateKey },
          }
        );
        ergebnis.zugestellt++;
        await prisma.pushAbo.update({
          where: { endpoint: abo.endpoint },
          data: { zuletztZugestellt: new Date() },
        });
      } catch (e) {
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) {
          await prisma.pushAbo.deleteMany({ where: { endpoint: abo.endpoint } });
          ergebnis.entfernt++;
          return;
        }
        ergebnis.fehler.push(
          e instanceof WebPushError ? `${e.statusCode}: ${e.body}` : String(e)
        );
      }
    })
  );

  if (ergebnis.fehler.length > 0) console.error("Push nicht zugestellt:", ergebnis.fehler);
  return ergebnis;
}

// ─────────────────────────────────────────────────────────────
// Welche Nachrichten Jakob haben will
// ─────────────────────────────────────────────────────────────

export type Benachrichtigungen = {
  /** Satzpause vorbei — auch bei gesperrtem Bildschirm. */
  satzpause: boolean;
  /** Morgens: Regeneration, heutige Einheit, Gewicht, Google-Verbindung. */
  morgen: boolean;
  /** Abends: Training steht an und ist noch nicht begonnen, offener Kalorienvorschlag. */
  abend: boolean;
};

export const BENACHRICHTIGUNGEN_STANDARD: Benachrichtigungen = {
  satzpause: true,
  morgen: true,
  abend: true,
};

const BENACHRICHTIGUNGEN_SCHLUESSEL = "benachrichtigungen";

export async function benachrichtigungenLesen(): Promise<Benachrichtigungen> {
  const eintrag = await prisma.einstellung.findUnique({
    where: { schluessel: BENACHRICHTIGUNGEN_SCHLUESSEL },
  });
  if (!eintrag) return BENACHRICHTIGUNGEN_STANDARD;
  try {
    return { ...BENACHRICHTIGUNGEN_STANDARD, ...JSON.parse(eintrag.wert) };
  } catch {
    return BENACHRICHTIGUNGEN_STANDARD;
  }
}

export async function benachrichtigungenSchreiben(b: Benachrichtigungen): Promise<void> {
  const wert = JSON.stringify(b);
  await prisma.einstellung.upsert({
    where: { schluessel: BENACHRICHTIGUNGEN_SCHLUESSEL },
    update: { wert },
    create: { schluessel: BENACHRICHTIGUNGEN_SCHLUESSEL, wert },
  });
}
