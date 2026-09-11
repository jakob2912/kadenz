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
      /* Die Spalte `sauber` wird nicht mehr geschrieben: eine unsaubere
         letzte Wiederholung zählt Jakob seit dem 11.09.2026 einfach nicht
         mit. Ältere Markierungen bleiben stehen und wirken weiter. */
      update: {
        kg: input.kg,
        reps: input.reps,
        loggedAt: new Date(),
      },
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
      liste.map(({ kg, reps, sauber }) => ({ kg, reps, sauber }))
    );
  }

  return ergebnis;
}

export type LaufendesTraining = {
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
};

export type GeloggterSatz = {
  exercise: string;
  setIndex: number;
  kg: number;
  reps: number;
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
        select: { exercise: true, setIndex: true, kg: true, reps: true },
      },
    },
  });
  if (!workout) return null;

  return {
    startedAtMs: workout.startedAt.getTime(),
    finishedAtMs: workout.finishedAt?.getTime() ?? null,
    beendet: workout.finishedAt !== null,
    geloggt: workout.sets,
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
  note?: string
): Promise<{ ok: true; finishedAtMs: number } | { ok: false; fehler: string }> {
  try {
    const workout = await workoutHeute(kind);
    if (workout.finishedAt !== null) {
      return { ok: true, finishedAtMs: workout.finishedAt.getTime() };
    }

    const beendet = await prisma.workout.update({
      where: { id: workout.id },
      data: { finishedAt: new Date(), note },
    });

    return { ok: true, finishedAtMs: beendet.finishedAt!.getTime() };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}
