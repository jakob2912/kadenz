/**
 * Kadenz — die zwei Schalter einer Woche
 *
 * Die Rechnung steht rein in plan.ts (wocheAm()). Hier liegt der Teil mit
 * Datenbank: die Wochenwahlen lesen und einen Schalter umlegen.
 *
 * Kein "use server": das Modul wird auch vom MCP-Server geladen.
 */

import { prisma } from "./db";
import { heuteWien, wienerDatum } from "./datum";
import { datenbankKonfiguriert } from "./konfiguration";
import {
  FRUEH_NAMEN,
  montagVon,
  rotationFor,
  schalterSperren,
  SPAET_NAMEN,
  wocheAm,
  type Frueh,
  type Rotation,
  type Spaet,
  type Eintrag,
  type Woche,
  type Wochenstand,
  type Wochenwahl,
} from "./plan";

const TAG_MS = 864e5;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function plusTage(isoTag: string, tage: number): string {
  return iso(new Date(Date.parse(`${isoTag}T00:00:00Z`) + tage * TAG_MS));
}

function alsDatum(isoTag: string): Date {
  return new Date(`${isoTag}T00:00:00Z`);
}

export function istFrueh(wert: string): wert is Frueh {
  return wert === "mo" || wert === "di";
}

export function istSpaet(wert: string): wert is Spaet {
  return wert === "frsa" || wert === "saso";
}

/**
 * Alle Wochenwahlen, aufsteigend.
 *
 * Ist die Datenbank nicht erreichbar, gilt der Standard: im Gym zählt, dass
 * ein Plan dasteht — dieselbe Haltung wie historieLaden() in uebungen.ts.
 */
export async function wochenwahlenLesen(): Promise<Wochenwahl[]> {
  if (!datenbankKonfiguriert()) return [];
  try {
    const zeilen = await prisma.wochenwahl.findMany({ orderBy: { woche: "asc" } });
    return zeilen.map((z) => ({
      woche: iso(z.woche),
      frueh: z.frueh !== null && istFrueh(z.frueh) ? z.frueh : null,
      spaet: z.spaet !== null && istSpaet(z.spaet) ? z.spaet : null,
    }));
  } catch (e) {
    console.error("Wochenwahl nicht lesbar, nutze Standard:", e);
    return [];
  }
}

/**
 * Die geloggten Einheiten zwischen zwei Tagen (ISO, beide eingeschlossen).
 *
 * Grundlage dafür, dass der Plan sich nach dem richtet, was trainiert wurde
 * (zuordnung() in plan.ts). Ist die Datenbank nicht erreichbar, ist die Liste
 * leer — dann gilt der Plan, als wäre noch nichts gelaufen.
 */
export async function eintraegeLesen(von: string, bis: string): Promise<Eintrag[]> {
  if (!datenbankKonfiguriert()) return [];
  try {
    const zeilen = await prisma.workout.findMany({
      where: { date: { gte: alsDatum(von), lte: alsDatum(bis) } },
      select: { date: true, kind: true },
      orderBy: { date: "asc" },
    });
    return zeilen.flatMap((z) =>
      z.kind === "push" || z.kind === "pull" ? [{ datum: iso(z.date), einheit: z.kind }] : []
    );
  } catch (e) {
    console.error("Trainingseinheiten nicht lesbar, Plan ohne sie:", e);
    return [];
  }
}

/** Was der Plan für einen Tag braucht: die Wochenwahlen und die geloggten Einheiten. */
export type Kalender = { wahlen: Wochenwahl[]; eintraege: Eintrag[] };

/**
 * Wochenwahlen und Einträge rund um einen Tag: ab dem Montag der Vorwoche
 * (die Zwei-Tage-Pause reicht über den Montag zurück) bis zum Sonntag der
 * Folgewoche (Vorschau auf den nächsten Trainingstag).
 */
export async function kalenderLesen(date: Date = new Date()): Promise<Kalender> {
  const montag = montagVon(wienerDatum(date));
  const [wahlen, eintraege] = await Promise.all([
    wochenwahlenLesen(),
    eintraegeLesen(plusTage(montag, -7), plusTage(montag, 13)),
  ]);
  return { wahlen, eintraege };
}

/** rotationFor() mit den gespeicherten Wochenwahlen und den geloggten Einheiten. */
export async function rotationMitPlan(date: Date): Promise<Rotation> {
  const { wahlen, eintraege } = await kalenderLesen(date);
  return rotationFor(date, wahlen, eintraege);
}

/**
 * Die Woche, deren Schalter gerade gelten: die laufende — am Sonntag schon
 * die nächste, denn an der laufenden gibt es dann nichts mehr umzulegen.
 */
export function zielwoche(heute: string): string {
  const montag = montagVon(heute);
  return new Date(`${heute}T00:00:00Z`).getUTCDay() === 0 ? plusTage(montag, 7) : montag;
}

export type { Wochenstand } from "./plan";

/** An welchen Tagen der Woche schon eine Einheit geloggt ist. */
async function geloggteTage(montag: string): Promise<Set<string>> {
  const workouts = await prisma.workout.findMany({
    where: { date: { gte: alsDatum(montag), lt: alsDatum(plusTage(montag, 7)) } },
    select: { date: true },
  });
  return new Set(workouts.map((w) => iso(w.date)));
}

/** Die Woche, die der Schalter zeigt, samt dem, was sich noch umlegen lässt. */
export async function wochenstand(): Promise<Wochenstand> {
  const heute = heuteWien();
  const montag = zielwoche(heute);
  const woche = wocheAm(montag, await wochenwahlenLesen());

  let geloggt = new Set<string>();
  if (datenbankKonfiguriert()) {
    try {
      geloggt = await geloggteTage(montag);
    } catch (e) {
      console.error("Trainingstage der Woche nicht lesbar:", e);
    }
  }

  return { ...woche, ...schalterSperren(woche, heute, geloggt) };
}

/**
 * Einen Schalter der laufenden Woche umlegen.
 *
 * Geprüft wird hier und nicht erst in der Oberfläche: dasselbe gilt für den
 * MCP-Server. Nicht umlegbar ist ein Schalter, dessen Tage vorbei oder schon
 * trainiert sind — sonst verlöre eine geloggte Einheit ihren Platz im Plan,
 * und ihr Push-Index wanderte auf den nächsten Tag. Mo ist zusätzlich nach
 * einer Sa + So-Woche gesperrt.
 *
 * Fr ist beim Wechsel auf Sa + So ausdrücklich erlaubt, auch wenn Fr heute
 * oder schon vorbei ist: genau dafür ist der Schalter da — Fr fällt aus, Sa
 * wird Push.
 */
export async function wochenwahlSetzen(
  aenderung: { frueh: Frueh } | { spaet: Spaet }
): Promise<{ ok: true; stand: Wochenstand } | { ok: false; fehler: string }> {
  try {
    const heute = heuteWien();
    const montag = zielwoche(heute);
    const woche = wocheAm(montag, await wochenwahlenLesen());
    const gesperrt = schalterSperren(woche, heute, await geloggteTage(montag));

    if ("frueh" in aenderung) {
      if (aenderung.frueh !== woche.frueh) {
        if (gesperrt.fruehGesperrt) return { ok: false, fehler: gesperrt.fruehGesperrt };
        if (aenderung.frueh === "mo" && heute > montag) {
          return { ok: false, fehler: "Monday is over." };
        }
      }
    } else if (aenderung.spaet !== woche.spaet) {
      if (gesperrt.spaetGesperrt) return { ok: false, fehler: gesperrt.spaetGesperrt };
      if (aenderung.spaet === "frsa" && heute > plusTage(montag, 4)) {
        return { ok: false, fehler: "Friday is over — Fri + Sat is no longer possible this week." };
      }
    }

    await prisma.wochenwahl.upsert({
      where: { woche: alsDatum(montag) },
      update: aenderung,
      create: { woche: alsDatum(montag), ...aenderung },
    });

    return { ok: true, stand: await wochenstand() };
  } catch (e) {
    console.error("Wochenwahl nicht speicherbar:", e);
    return { ok: false, fehler: "The switch could not be saved." };
  }
}

/** Für Texte: "Push Di und Sa, Pull Mi und So". */
export function wahlBeschreibung(woche: Woche): string {
  return `${FRUEH_NAMEN[woche.frueh]} · ${SPAET_NAMEN[woche.spaet]}`;
}
