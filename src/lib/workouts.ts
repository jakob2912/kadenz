"use server";

import { prisma } from "./db";
import type { SetLog } from "./coach";

/**
 * Persistenz der Trainingslogs. Alles hier sind Server Actions — sie laufen
 * ausschließlich am Server, damit die Datenbank-Zugangsdaten nie im Browser
 * landen.
 */

/** Ortsdatum statt UTC: ein Training um 22:00 gehört zum heutigen Tag. */
function heuteIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Holt das Training des Tages oder legt es an. Idempotent, damit mehrfaches
 * Abhaken nicht mehrere Sitzungen erzeugt.
 */
async function workoutHeute(kind: "push" | "pull") {
  const date = new Date(`${heuteIso()}T00:00:00Z`);

  const vorhanden = await prisma.workout.findFirst({ where: { date, kind } });
  if (vorhanden) return vorhanden;

  return prisma.workout.create({ data: { date, kind } });
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

/** Letzte Ausführung je Übung — Grundlage für PREV-Spalte und Progression. */
export async function letzteSaetze(exercise: string): Promise<SetLog[]> {
  const letzter = await prisma.setLog.findFirst({
    where: { exercise },
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

/** Trainingseinheit abschließen. */
export async function trainingBeenden(kind: "push" | "pull", note?: string) {
  const workout = await workoutHeute(kind);
  await prisma.workout.update({
    where: { id: workout.id },
    data: { finishedAt: new Date(), note },
  });
}
