"use server";

import { prisma } from "./db";
import { heuteWien, wienerDatum } from "./datum";

/**
 * Persistenz der Trainingslogs. Alles hier sind Server Actions — sie laufen
 * ausschließlich am Server, damit die Datenbank-Zugangsdaten nie im Browser
 * landen.
 */

/**
 * Ortsdatum statt UTC: ein Training um 22:00 gehört zum heutigen Tag.
 *
 * Ausdrücklich Wiener Zeit, nicht die Zeitzone des Prozesses. Vorher standen
 * hier getFullYear/getMonth/getDate — die lesen die Serverzeit. Lokal ist das
 * Wien und stimmt; auf Vercel ist es UTC, und zwischen Mitternacht und 02:00
 * Wiener Zeit lieferte diese Funktion den Vortag. Ein Satz, der um 00:30
 * abgehakt wird, landete damit im Training von gestern.
 */
function heuteIso(): string {
  return heuteWien();
}

// ─────────────────────────────────────────────────────────────
// Eingaben prüfen
// ─────────────────────────────────────────────────────────────
//
// Server Actions sind öffentliche Endpunkte: TypeScript sagt nur, was der
// eigene Logger schickt, nicht was ankommt. Ein kind "x" oder kg -5 landete
// vorher ungeprüft in der Datenbank — und ein falscher Satz verdirbt nicht
// nur sich selbst, sondern Progression, Bestwerte und Kraftverlauf danach.

class Ungueltig extends Error {}

function art(kind: unknown): "push" | "pull" {
  if (kind !== "push" && kind !== "pull") throw new Ungueltig(`Unbekannte Einheit: ${String(kind)}`);
  return kind;
}

function zahl(wert: unknown, name: string, von: number, bis: number, ganz = false): number {
  if (typeof wert !== "number" || !Number.isFinite(wert) || wert < von || wert > bis) {
    throw new Ungueltig(`${name} muss zwischen ${von} und ${bis} liegen.`);
  }
  if (ganz && !Number.isInteger(wert)) throw new Ungueltig(`${name} muss eine ganze Zahl sein.`);
  return wert;
}

function text(wert: unknown, name: string, maxLaenge: number): string {
  if (typeof wert !== "string" || wert.trim() === "" || wert.length > maxLaenge) {
    throw new Ungueltig(`${name} fehlt oder ist zu lang.`);
  }
  return wert;
}

function fehler(e: unknown): { ok: false; fehler: string } {
  return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
}

/**
 * Holt das Training des Tages oder legt es an. Idempotent, damit mehrfaches
 * Abhaken nicht mehrere Sitzungen erzeugt.
 */
async function workoutHeute(kind: "push" | "pull", tagIso: string = heuteIso()) {
  const date = new Date(`${tagIso}T00:00:00Z`);

  /* Ein einziger atomarer Aufruf statt findFirst-dann-create. Bei zwei
     gleichzeitigen Aufrufen — zweiter Tab, PWA neben Safari, MCP-Server
     parallel zur App — lasen vorher beide "nichts da" und legten beide eine
     Zeile an. Die Sätze eines Tages verteilten sich dann auf zwei Einheiten,
     und letzteSaetze() liest nur eine davon.

     Möglich wird das durch @@unique([date, kind]) im Schema: die Datenbank
     entscheidet, wer zuerst da war, statt dass die Anwendung es errät. */
  return prisma.workout.upsert({
    where: { date_kind: { date, kind } },
    update: {},
    create: { date, kind },
  });
}

/**
 * Speichert einen Satz. Das @@unique([workoutId, exercise, setIndex]) im
 * Schema macht daraus ein Upsert — ein zweites Abhaken korrigiert den Wert,
 * statt eine Dublette anzulegen.
 */
export async function satzSpeichern(input: {
  kind: "push" | "pull";
  exercise: string;
  setIndex: number;
  kg: number;
  reps: number;
  /**
   * Wann der Satz im Browser abgehakt wurde, in Millisekunden.
   *
   * Ohne Netz hält der Logger einen Satz zurück und schickt ihn nach — unter
   * Umständen erst nach dem Training, schlimmstenfalls nach Mitternacht.
   * Ohne diese Angabe stand dann die Ankunftszeit als loggedAt da, und ein
   * Satz von 23:40 landete im Training des nächsten Tages.
   */
  erfasstAm?: number;
}): Promise<{ ok: true } | { ok: false; fehler: string }> {
  try {
    input = {
      kind: art(input.kind),
      exercise: text(input.exercise, "Übung", 100),
      setIndex: zahl(input.setIndex, "Satznummer", 0, 30, true),
      // 0 kg ist erlaubt — Körpergewichtsübungen wie Crunch werden so geloggt.
      kg: zahl(input.kg, "Gewicht", 0, 500),
      reps: zahl(input.reps, "Wiederholungen", 1, 100, true),
      erfasstAm: input.erfasstAm,
    };
    const zeitpunkt = erfassungszeit(input.erfasstAm);
    const workout = await workoutHeute(input.kind, wienerDatum(zeitpunkt));
    await prisma.setLog.upsert({
      where: {
        workoutId_exercise_setIndex: {
          workoutId: workout.id,
          exercise: input.exercise,
          setIndex: input.setIndex,
        },
      },
      /* Die Spalte `sauber` wird nicht mehr geschrieben: eine unsaubere
         letzte Wiederholung zählt Jakob seit dem 11.09.2026 einfach nicht
         mit. Ältere Markierungen bleiben stehen und wirken weiter. */
      update: {
        kg: input.kg,
        reps: input.reps,
        loggedAt: zeitpunkt,
      },
      create: {
        workoutId: workout.id,
        exercise: input.exercise,
        setIndex: input.setIndex,
        kg: input.kg,
        reps: input.reps,
        loggedAt: zeitpunkt,
      },
    });
    return { ok: true };
  } catch (e) {
    // Der Satz darf im Gym nicht verloren gehen, nur weil das WLAN kurz weg
    // war — die Oberfläche behält ihn und zeigt den Fehler an.
    return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

/**
 * Der Zeitpunkt, den ein Satz bekommt — die Angabe des Browsers, wenn sie
 * glaubhaft ist, sonst jetzt.
 *
 * Glaubhaft heißt: höchstens 18 Stunden alt und nicht in der Zukunft (eine
 * Minute Spielraum für eine falsch gehende Handyuhr). Länger hält kein
 * Funkloch einen Satz zurück; was älter ist, ist eine verstellte Uhr, und die
 * soll keinen Satz in eine fremde Woche schreiben.
 */
function erfassungszeit(erfasstAm: number | undefined): Date {
  const jetzt = Date.now();
  if (
    typeof erfasstAm === "number" &&
    Number.isFinite(erfasstAm) &&
    erfasstAm <= jetzt + 60_000 &&
    erfasstAm >= jetzt - 18 * 3600_000
  ) {
    return new Date(Math.min(erfasstAm, jetzt));
  }
  return new Date(jetzt);
}

/** Einheit beginnen. Idempotent — ein zweiter Aufruf setzt die Uhr nicht zurück. */
export async function trainingStarten(
  kind: "push" | "pull"
): Promise<{ ok: true; startedAtMs: number } | { ok: false; fehler: string }> {
  try {
    const workout = await workoutHeute(art(kind));
    return { ok: true, startedAtMs: workout.startedAt.getTime() };
  } catch (e) {
    return fehler(e);
  }
}

/**
 * Trainingseinheit abschließen.
 *
 * Diese Funktion gab es seit dem ersten Tag und wurde von keiner Oberfläche
 * aufgerufen — `finishedAt` stand auf jeder Zeile der Tabelle auf NULL. Der
 * Logger merkte sich den Abschluss allein im React-State, und der ist beim
 * nächsten Seitenaufruf weg. Für Jakob sah das so aus, als hörten seine
 * Trainings nie auf: die Laufzeit zählte stundenlang weiter, weil nichts
 * festhielt, dass die Einheit vorbei war.
 *
 * Idempotent, und zwar ausdrücklich ohne den Zeitstempel zu verschieben: wer
 * einen Satz nachträglich korrigiert, hakt danach wieder alles ab, und ein
 * zweiter Aufruf würde das Ende sonst auf jetzt setzen. Die Einheit wäre dann
 * je nach Korrekturzeitpunkt Stunden länger gewesen, als sie war.
 */
export async function trainingBeenden(
  kind: "push" | "pull",
  note?: string,
  /** Wann im Browser beendet wurde — aus demselben Grund wie bei satzSpeichern. */
  erfasstAm?: number
): Promise<{ ok: true; finishedAtMs: number } | { ok: false; fehler: string }> {
  try {
    if (note !== undefined) note = text(note, "Notiz", 1000);
    const zeitpunkt = erfassungszeit(erfasstAm);
    const workout = await workoutHeute(art(kind), wienerDatum(zeitpunkt));
    if (workout.finishedAt !== null) {
      return { ok: true, finishedAtMs: workout.finishedAt.getTime() };
    }

    const beendet = await prisma.workout.update({
      where: { id: workout.id },
      data: { finishedAt: zeitpunkt, note },
    });

    return { ok: true, finishedAtMs: beendet.finishedAt!.getTime() };
  } catch (e) {
    return fehler(e);
  }
}

/**
 * Notiz zu einer Einheit — "Schulter zwickt", "Bank war belegt".
 *
 * Workout.note gab es seit dem ersten Tag, nur keine Stelle, an der man sie
 * schreiben konnte. Im Verlauf je Einheit steht sie über den Sätzen; genau
 * dort sucht man drei Wochen später, warum eine Einheit schwächer war.
 *
 * Der Tag kommt vom Logger, nicht von der Uhr: wer um 23:30 trainiert und
 * die Notiz um 00:05 schreibt, meint die Einheit von gestern. Und es wird nur
 * aktualisiert, nie angelegt — eine Notiz soll keine leere Einheit erzeugen,
 * deren Laufzeit dann ab Mitternacht zählt.
 */
export async function notizSpeichern(
  kind: "push" | "pull",
  tagIso: string,
  notiz: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tagIso))) throw new Ungueltig("Ungültiger Tag.");
    if (typeof notiz !== "string") throw new Ungueltig("Notiz fehlt.");
    const inhalt = notiz.trim().slice(0, 1000);
    const r = await prisma.workout.updateMany({
      where: { date: new Date(`${tagIso}T00:00:00Z`), kind: art(kind) },
      data: { note: inhalt === "" ? null : inhalt },
    });
    if (r.count === 0) throw new Ungueltig("Zu diesem Tag gibt es keine Einheit.");
    return { ok: true };
  } catch (e) {
    return fehler(e);
  }
}
