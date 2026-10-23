/**
 * Kadenz — Trainingsdaten lesen
 *
 * Bis zum 22.10.2026 standen diese Funktionen in workouts.ts, und die Datei
 * beginnt mit "use server". Damit war jede von ihnen eine Server Action —
 * vom Browser aus aufrufbar, mit beliebigen Argumenten, und zwar auch über
 * Seiten, die gar nichts mit Training zu tun haben. Lesefunktionen brauchen
 * das nicht: sie laufen ausschließlich beim Rendern am Server. Hier ohne
 * "use server" sind sie gewöhnliche Funktionen, die der Browser nicht
 * erreicht. In workouts.ts bleibt nur, was der Logger wirklich aufruft.
 */

import { prisma } from "./db";
import { heuteWien } from "./datum";
import type { SetLog } from "./coach";
import { neustartsLesen } from "./kraftverlauf";
import { bestwertAus, type Bestwert } from "./bestwerte";

function heuteIso(): string {
  return heuteWien();
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
  return (await letzteSaetzeFuer([exercise])).get(exercise) ?? [];
}

/**
 * Dasselbe für eine ganze Einheit — in EINER Abfrage.
 *
 * Der Grund ist der Verbindungspool. Vorher rief mitHistorie() letzteSaetze()
 * je Übung auf, und jeder Aufruf brauchte zwei Abfragen: erst die jüngste
 * Einheit finden, dann deren Sätze holen. Bei zehn Push-Übungen sind das
 * zwanzig. Das Promise.all darum sah nach Nebenläufigkeit aus, war aber
 * keine: der Pool in db.ts steht bewusst auf max 1, also liefen alle zwanzig
 * nacheinander gegen Supabase. Zusammen mit Katalog, Bankstand und
 * laufendesTraining wurde daraus die Wartezeit, die man beim Tippen auf
 * "Training" gesehen hat.
 *
 * Statt zwei Abfragen je Übung eine für alle: der Index
 * @@index([exercise, loggedAt]) trägt sie, und die Zuordnung "welche Einheit
 * war die letzte" fällt beim Durchgehen der nach loggedAt absteigend
 * sortierten Zeilen von selbst ab — die erste Zeile je Übung gehört
 * definitionsgemäß zur jüngsten Einheit.
 *
 * Das heutige Training bleibt ausgeschlossen, aus demselben Grund wie oben.
 */
export async function letzteSaetzeFuer(
  uebungen: string[]
): Promise<Map<string, SetLog[]>> {
  /* Der setIndex wird zum Sortieren gebraucht, gehört aber nicht ins
     Ergebnis: SetLog ist der Typ, mit dem progression() und die
     ZULETZT-Spalte rechnen, und der kennt nur Gewicht und Wiederholungen. */
  type Zeile = SetLog & { setIndex: number };
  const gesammelt = new Map<string, Zeile[]>();

  const ergebnis = new Map<string, SetLog[]>();
  if (uebungen.length === 0) return ergebnis;

  const heute = new Date(`${heuteIso()}T00:00:00Z`);

  const zeilen = await prisma.setLog.findMany({
    where: { exercise: { in: uebungen }, workout: { date: { lt: heute } } },
    orderBy: [{ loggedAt: "desc" }, { setIndex: "asc" }],
    select: {
      exercise: true,
      workoutId: true,
      kg: true,
      reps: true,
      setIndex: true,
      sauber: true,
      rir: true,
    },
  });

  /* Je Übung zählt ausschließlich die jüngste Einheit. Welche das ist, sagt
     die erste Zeile, die für diese Übung auftaucht — danach werden nur noch
     Zeilen mit derselben workoutId angenommen. Ohne diese Klammer stünden in
     der ZULETZT-Spalte Sätze aus mehreren Trainings untereinander. */
  const jüngsteEinheit = new Map<string, string>();

  for (const zeile of zeilen) {
    const bekannt = jüngsteEinheit.get(zeile.exercise);
    if (bekannt === undefined) {
      jüngsteEinheit.set(zeile.exercise, zeile.workoutId);
    } else if (bekannt !== zeile.workoutId) {
      continue;
    }

    const satz: Zeile = {
      kg: zeile.kg,
      reps: zeile.reps,
      setIndex: zeile.setIndex,
      sauber: zeile.sauber,
      rir: zeile.rir,
    };
    const liste = gesammelt.get(zeile.exercise);
    if (liste) liste.push(satz);
    else gesammelt.set(zeile.exercise, [satz]);
  }

  /* Die Sätze innerhalb einer Einheit gehören in ihrer Reihenfolge sortiert.
     Das orderBy oben sortiert primär nach loggedAt — bei nachgetragenen
     Sätzen (satz_eintragen aus Claude Desktop) läuft das auseinander. */
  for (const [uebung, liste] of gesammelt) {
    liste.sort((a, b) => a.setIndex - b.setIndex);
    /* Die Markierung kommt ausdrücklich mit. progression() rechnet zwar nur
       mit Gewicht und Wiederholungen, aber dieselben Sätze stehen als ZULETZT
       auf dem Schirm — und ein unsauberer Satz, gegen den man sich heute
       vergleicht, soll als solcher erkennbar bleiben. */
    ergebnis.set(
      uebung,
      liste.map(({ kg, reps, sauber, rir }) => ({ kg, reps, sauber, rir }))
    );
  }

  return ergebnis;
}

export type LaufendesTraining = {
  /** Kalendertag der Einheit, ISO — daran hängt die Notiz, nicht an der Uhr. */
  tag: string;
  startedAtMs: number;
  /** Zeitpunkt des Abschlusses, oder null solange die Einheit läuft. */
  finishedAtMs: number | null;
  beendet: boolean;
  /**
   * Was heute schon abgehakt ist, je Übungsname und Satznummer.
   *
   * Der Logger hielt das bis zum 25.08.2026 ausschließlich im React-State.
   * Beim Neuladen oder nach einem Tabwechsel stand die Einheit damit wieder
   * bei "0 von 17", obwohl sämtliche Sätze längst in der Datenbank lagen —
   * und weil daran auch der Abschluss hing, war eine fertige Einheit nie
   * fertig.
   */
  geloggt: GeloggterSatz[];
  notiz: string | null;
};

export type GeloggterSatz = {
  exercise: string;
  setIndex: number;
  kg: number;
  reps: number;
  rir: number | null;
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
  const workout = await prisma.workout.findFirst({
    where: { date, kind },
    include: {
      sets: {
        orderBy: [{ exercise: "asc" }, { setIndex: "asc" }],
        select: { exercise: true, setIndex: true, kg: true, reps: true, rir: true },
      },
    },
  });
  if (!workout) return null;

  return {
    tag: workout.date.toISOString().slice(0, 10),
    startedAtMs: workout.startedAt.getTime(),
    finishedAtMs: workout.finishedAt?.getTime() ?? null,
    beendet: workout.finishedAt !== null,
    geloggt: workout.sets,
    notiz: workout.note,
  };
}

/**
 * Welche Einheit heute schon läuft oder gelaufen ist — bei zweien die zuletzt
 * begonnene.
 *
 * Seit sich jede Einheit an jedem Tag wählen lässt, sagt der Kalender nicht
 * mehr sicher, was heute trainiert wird. Wer "trotzdem Pull" gestartet hat
 * und die Seite später über die Navigation öffnet, soll seinen Logger sehen
 * und nicht den Push-Plan.
 */
export async function heutigeEinheit(): Promise<"push" | "pull" | null> {
  const workout = await prisma.workout.findFirst({
    where: { date: new Date(`${heuteIso()}T00:00:00Z`) },
    orderBy: { startedAt: "desc" },
    select: { kind: true },
  });
  return workout?.kind === "push" || workout?.kind === "pull" ? workout.kind : null;
}

/**
 * Bisherige Bestwerte je Übung — für die Markierung im Logger.
 *
 * Hebt ein Satz heute mehr als je zuvor, sieht man es im Moment des
 * Abhakens, nicht erst Tage später im Kraftverlauf. Das heutige Training
 * zählt nicht mit — sonst wäre der eben gehobene Satz sein eigener Maßstab.
 *
 * Nicht mit: ausdrücklich unsaubere Sätze (sauber = false; gleiche Regel wie
 * besterSatz() in kraft.ts) und alles vor einem gesetzten Neustart der Übung.
 * Nach einem Technikwechsel bliebe sonst der alte Wert der Maßstab, und es gäbe
 * wochenlang keinen Bestwert, obwohl die neue Technik jede Woche besser wird.
 */
export async function bestwerteFuer(uebungen: string[]): Promise<Record<string, Bestwert>> {
  if (uebungen.length === 0) return {};

  const [zeilen, neustarts] = await Promise.all([
    prisma.setLog.findMany({
      where: {
        exercise: { in: uebungen },
        workout: { date: { lt: new Date(`${heuteIso()}T00:00:00Z`) } },
        // Nicht NOT { sauber: false }: in SQL ergibt NOT (NULL = false) wieder
        // NULL, und damit fielen ausgerechnet die nicht beurteilten Sätze — der
        // Normalfall — aus der Abfrage.
        OR: [{ sauber: null }, { sauber: true }],
      },
      select: { exercise: true, kg: true, reps: true, workout: { select: { date: true } } },
    }),
    neustartsLesen().catch(() => ({}) as Record<string, string>),
  ]);

  const jeUebung = new Map<string, { kg: number; reps: number }[]>();
  for (const z of zeilen) {
    const ab = neustarts[z.exercise];
    if (ab && z.workout.date.toISOString().slice(0, 10) < ab) continue;
    const liste = jeUebung.get(z.exercise) ?? [];
    liste.push({ kg: z.kg, reps: z.reps });
    jeUebung.set(z.exercise, liste);
  }

  const ergebnis: Record<string, Bestwert> = {};
  for (const [uebung, saetze] of jeUebung) {
    const b = bestwertAus(saetze);
    if (b) ergebnis[uebung] = b;
  }
  return ergebnis;
}

/**
 * Übungsnamen für die Vorschläge beim Tauschen: alles aus dem Katalog und
 * alles, was im letzten Jahr geloggt wurde — alphabetisch, ohne Doppelte.
 * Wer schon einmal "Kurzhantel-Bankdrücken" gemacht hat, soll es nicht
 * wieder tippen müssen, und unter demselben Namen landet es dann auch im
 * selben Kraftverlauf.
 */
export async function bekannteUebungen(): Promise<string[]> {
  const [katalog, geloggt] = await Promise.all([
    prisma.uebung.findMany({ select: { name: true } }),
    prisma.setLog.findMany({
      where: { loggedAt: { gte: new Date(Date.now() - 365 * 864e5) } },
      distinct: ["exercise"],
      select: { exercise: true },
    }),
  ]);
  const namen = new Set([...katalog.map((k) => k.name), ...geloggt.map((g) => g.exercise)]);
  return [...namen].sort((a, b) => a.localeCompare(b, "de"));
}
