/**
 * Kadenz — Kraftverlauf aus der Datenbank
 *
 * Die Auswertung steht in kraft.ts und ist rein. Hier liegt nur, woher die
 * Sätze kommen. Getrennt von workouts.ts, weil das Server Actions sind und
 * dieses Modul auch der MCP-Server lädt — dasselbe Muster wie ernaehrung.ts.
 */

import { prisma } from "./db";
import { heuteWien } from "./datum";
import type { GeloggterSatz } from "./kraft";

/**
 * Wie weit zurück gelesen wird.
 *
 * Vier Monate: kraftTrend() braucht mindestens drei Wochen, und ein Fenster,
 * das gerade so reicht, zeigt nach einer Trainingspause gar nichts mehr. Nach
 * oben begrenzt, weil ein Jahr alte Sätze über den heutigen Fortschritt nichts
 * sagen — und weil die Abfrage sonst mit jedem Monat länger wird.
 */
export const FENSTER_TAGE = 120;

function abDatum(tage: number): Date {
  return new Date(Date.parse(`${heuteWien()}T00:00:00Z`) - tage * 864e5);
}

async function saetzeLaden(tage: number, uebung?: string): Promise<GeloggterSatz[]> {
  const workouts = await prisma.workout.findMany({
    where: { date: { gte: abDatum(tage) } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      sets: {
        where: uebung ? { exercise: uebung } : undefined,
        orderBy: { setIndex: "asc" },
        select: { exercise: true, kg: true, reps: true, sauber: true },
      },
    },
  });

  return workouts.flatMap((w) =>
    w.sets.map((s) => ({
      datum: w.date.toISOString().slice(0, 10),
      uebung: s.exercise,
      kg: s.kg,
      reps: s.reps,
      /* Ohne dieses Feld übergingen e1rmReihe() und besterSatz() nichts:
         beide prüfen auf `sauber === false`, und was nie gelesen wird, ist
         immer undefined. Der Filter säße im Code und wirkte nirgends. */
      sauber: s.sauber,
    }))
  );
}

/** Alle geloggten Sätze einer Übung, aufsteigend nach Tag. */
export async function saetzeFuer(
  uebung: string,
  tage = FENSTER_TAGE
): Promise<GeloggterSatz[]> {
  return saetzeLaden(tage, uebung);
}

/**
 * Alle Sätze nach Übung gruppiert.
 *
 * Gruppiert wird über SetLog.exercise, nicht über den Übungskatalog: eine
 * getauschte Übung ist aus dem Katalog verschwunden, ihre Sätze liegen aber
 * noch da. Sie im Kraftverlauf zu unterschlagen hieße, die Historie
 * umzuschreiben, sobald jemand den Plan ändert.
 */
export async function saetzeProUebung(
  tage = FENSTER_TAGE
): Promise<Record<string, GeloggterSatz[]>> {
  const alle = await saetzeLaden(tage);

  const proUebung: Record<string, GeloggterSatz[]> = {};
  for (const satz of alle) {
    (proUebung[satz.uebung] ??= []).push(satz);
  }
  return proUebung;
}

/**
 * Alle Sätze mehrerer Übungen, aufsteigend nach Tag.
 *
 * Für den Bank-Tab, der die drei Pressvarianten in einer Zeitleiste zeigt.
 * Eine Abfrage statt drei: der Pool in db.ts steht auf max 1, drei Aufrufe
 * von saetzeFuer() liefen nacheinander über die Leitung — derselbe Grund,
 * aus dem letzteSaetzeFuer() in workouts.ts existiert.
 */
export async function saetzeFuerMehrere(
  uebungen: string[],
  tage = FENSTER_TAGE
): Promise<GeloggterSatz[]> {
  if (uebungen.length === 0) return [];

  const workouts = await prisma.workout.findMany({
    where: { date: { gte: abDatum(tage) } },
    orderBy: { date: "asc" },
    select: {
      date: true,
      sets: {
        where: { exercise: { in: uebungen } },
        orderBy: { setIndex: "asc" },
        select: { exercise: true, kg: true, reps: true, sauber: true },
      },
    },
  });

  return workouts.flatMap((w) =>
    w.sets.map((s) => ({
      datum: w.date.toISOString().slice(0, 10),
      uebung: s.exercise,
      kg: s.kg,
      reps: s.reps,
      sauber: s.sauber,
    }))
  );
}
