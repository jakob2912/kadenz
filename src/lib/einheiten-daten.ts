import { prisma } from "./db";

/**
 * Die Einheiten der letzten Wochen mit allen Sätzen — für den Verlauf je
 * Einheit. Rechnung (Kalender, Serie) in einheiten.ts.
 */

export type Einheitsbericht = {
  id: string;
  datum: string;
  art: "push" | "pull";
  /** In Minuten — null, wenn die Einheit nie abgeschlossen wurde. */
  dauerMin: number | null;
  volumenKg: number;
  notiz: string | null;
  uebungen: { name: string; saetze: { kg: number; reps: number }[] }[];
};

/**
 * Längste Dauer, die als echt gilt. Einheiten aus der Zeit, bevor
 * trainingBeenden() aufgerufen wurde, haben ein Ende Tage später oder keins —
 * eine "Dauer" von 31 Stunden ist keine Auskunft, sondern ein Messfehler.
 */
const LAENGSTE_DAUER_MIN = 240;

/**
 * Alle Tage mit mindestens einem Satz, zwei Jahre zurück — für Kalender und
 * Serie. Eigene, schlanke Abfrage (nur das Datum): die Serie hing vorher an
 * den zwölf Wochen, deren Einheiten samt Sätzen geladen wurden, und eine
 * Serie von zwanzig Wochen stand dann als zwölf da.
 */
export async function trainingstage(): Promise<string[]> {
  const zeilen = await prisma.workout.findMany({
    where: { date: { gte: new Date(Date.now() - 730 * 864e5) }, sets: { some: {} } },
    select: { date: true },
  });
  return zeilen.map((z) => z.date.toISOString().slice(0, 10));
}

/** Die jüngsten Einheiten mit Sätzen — nur so viele, wie angezeigt werden. */
export async function letzteEinheiten(anzahl = 12): Promise<Einheitsbericht[]> {
  const zeilen = await prisma.workout.findMany({
    where: { sets: { some: {} } },
    orderBy: [{ date: "desc" }, { startedAt: "desc" }],
    take: anzahl,
    select: {
      id: true,
      date: true,
      kind: true,
      startedAt: true,
      finishedAt: true,
      note: true,
      sets: {
        orderBy: [{ loggedAt: "asc" }, { setIndex: "asc" }],
        select: { exercise: true, setIndex: true, kg: true, reps: true },
      },
    },
  });

  return zeilen.map((w) => {
    // Reihenfolge der Übungen: wie sie trainiert wurden (erster Satz zuerst).
    const uebungen = new Map<string, { kg: number; reps: number; setIndex: number }[]>();
    for (const s of w.sets) {
      const liste = uebungen.get(s.exercise) ?? [];
      liste.push(s);
      uebungen.set(s.exercise, liste);
    }

    const dauer =
      w.finishedAt === null
        ? null
        : Math.round((w.finishedAt.getTime() - w.startedAt.getTime()) / 60_000);

    return {
      id: w.id,
      datum: w.date.toISOString().slice(0, 10),
      art: w.kind === "pull" ? "pull" : "push",
      dauerMin: dauer !== null && dauer > 0 && dauer <= LAENGSTE_DAUER_MIN ? dauer : null,
      volumenKg: w.sets.reduce((v, s) => v + s.kg * s.reps, 0),
      notiz: w.note,
      uebungen: [...uebungen].map(([name, saetze]) => ({
        name,
        saetze: saetze
          .sort((a, b) => a.setIndex - b.setIndex)
          .map(({ kg, reps }) => ({ kg, reps })),
      })),
    };
  });
}
