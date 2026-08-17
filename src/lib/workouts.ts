"use server";

import { prisma } from "./db";
import { heuteWien } from "./datum";
import type { SetLog } from "./coach";

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

/**
 * Holt das Training des Tages oder legt es an. Idempotent, damit mehrfaches
 * Abhaken nicht mehrere Sitzungen erzeugt.
 */
async function workoutHeute(kind: "push" | "pull") {
  const date = new Date(`${heuteIso()}T00:00:00Z`);

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
}): Promise<{ ok: true } | { ok: false; fehler: string }> {
  try {
    const workout = await workoutHeute(input.kind);
    await prisma.setLog.upsert({
      where: {
        workoutId_exercise_setIndex: {
          workoutId: workout.id,
          exercise: input.exercise,
          setIndex: input.setIndex,
        },
      },
      update: { kg: input.kg, reps: input.reps, loggedAt: new Date() },
      create: {
        workoutId: workout.id,
        exercise: input.exercise,
        setIndex: input.setIndex,
        kg: input.kg,
        reps: input.reps,
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
 * Letzte Ausführung je Übung — Grundlage für die ZULETZT-Spalte und die
 * Progression.
 *
 * Das heutige Training wird ausdrücklich ausgeschlossen. Ohne diesen Filter
 * gewinnt die gerade laufende Einheit das `orderBy: loggedAt desc`, und dann
 * frisst sich die Seite selbst auf: nach dem Abhaken von Satz 1 einer Übung
 * mit zwei Sätzen liefert die Historie nur noch diesen einen Satz, beim
 * nächsten Server-Rendern verschwindet die zweite Satzzeile, und der Zähler
 * fällt von 16 auf 15. Im Gym wäre nach einem Tabwechsel die Hälfte weg.
 *
 * "Zuletzt" meint die letzte ABGESCHLOSSENE Einheit — genau das, wogegen man
 * sich heute vergleicht.
 */
export async function letzteSaetze(exercise: string): Promise<SetLog[]> {
  const heute = new Date(`${heuteIso()}T00:00:00Z`);

  const letzter = await prisma.setLog.findFirst({
    where: { exercise, workout: { date: { lt: heute } } },
    orderBy: { loggedAt: "desc" },
    select: { workoutId: true },
  });
  if (!letzter) return [];

  return prisma.setLog.findMany({
    where: { exercise, workoutId: letzter.workoutId },
    orderBy: { setIndex: "asc" },
    select: { kg: true, reps: true },
  });
}

export type LaufendesTraining = {
  startedAtMs: number;
  beendet: boolean;
};

/**
 * Läuft heute schon eine Einheit?
 *
 * Davon hängt ab, ob die Trainingsseite den Startbildschirm oder den Logger
 * zeigt — und vor allem, ab wann die Laufzeit zählt. Vorher begann sie beim
 * Laden der Seite: wer mittags kurz nachsieht, was ansteht, und abends
 * trainiert, bekam mehrere Stunden Laufzeit angezeigt, die nichts gemessen
 * haben.
 */
export async function laufendesTraining(
  kind: "push" | "pull"
): Promise<LaufendesTraining | null> {
  const date = new Date(`${heuteIso()}T00:00:00Z`);
  const workout = await prisma.workout.findFirst({ where: { date, kind } });
  if (!workout) return null;

  return {
    startedAtMs: workout.startedAt.getTime(),
    beendet: workout.finishedAt !== null,
  };
}

/** Einheit beginnen. Idempotent — ein zweiter Aufruf setzt die Uhr nicht zurück. */
export async function trainingStarten(
  kind: "push" | "pull"
): Promise<{ ok: true; startedAtMs: number } | { ok: false; fehler: string }> {
  try {
    const workout = await workoutHeute(kind);
    return { ok: true, startedAtMs: workout.startedAt.getTime() };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

/** Trainingseinheit abschließen. */
export async function trainingBeenden(
  kind: "push" | "pull",
  note?: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  try {
    const workout = await workoutHeute(kind);
    await prisma.workout.update({
      where: { id: workout.id },
      data: { finishedAt: new Date(), note },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}
