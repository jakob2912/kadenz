/**
 * Kadenz — Kraftverlauf aus der Datenbank
 *
 * Die Auswertung steht in kraft.ts und ist rein. Hier liegt nur, woher die
 * Sätze kommen. Getrennt von workouts.ts, weil das Server Actions sind und
 * dieses Modul auch der MCP-Server lädt — dasselbe Muster wie ernaehrung.ts.
 */

import { prisma } from "./db";
import { heuteWien } from "./datum";
import type { GeloggterSatz, Neustarts } from "./kraft";

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
 * Eine Abfrage statt einer je Übung: der Pool in db.ts steht auf max 1, mehrere
 * Aufrufe von saetzeFuer() liefen nacheinander über die Leitung — derselbe Grund,
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

// ─────────────────────────────────────────────────────────────
// Neustart nach Technik- oder Gerätewechsel
// ─────────────────────────────────────────────────────────────

/**
 * Die Neustarts liegen als ein JSON-Eintrag in Einstellung, nicht als Spalte
 * an Uebung.
 *
 * Eine Spalte hätte eine Migration gebraucht, und solange die nicht
 * eingespielt ist, scheitert jede Katalogabfrage (findMany ohne select liest
 * alle Spalten) — die Trainingsseite stünde leer. Dazu gilt ein Neustart für
 * den Namen, unter dem geloggt wird (SetLog.exercise), nicht für eine
 * Katalogzeile: getauschte Übungen verschwinden aus dem Katalog, ihre Sätze
 * und damit ihr Trend bleiben.
 */
export const NEUSTART_SCHLUESSEL = "kraft_neustart";

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Liest die Ablage nachsichtig: ein kaputter Eintrag kostet nur die Neustarts. */
export function neustartsAusText(wert: string | null | undefined): Neustarts {
  if (!wert) return {};
  try {
    const roh: unknown = JSON.parse(wert);
    if (typeof roh !== "object" || roh === null || Array.isArray(roh)) return {};
    const out: Neustarts = {};
    for (const [uebung, datum] of Object.entries(roh)) {
      if (typeof datum === "string" && ISO_TAG.test(datum)) out[uebung] = datum;
    }
    return out;
  } catch {
    return {};
  }
}

export async function neustartsLesen(): Promise<Neustarts> {
  const eintrag = await prisma.einstellung.findUnique({
    where: { schluessel: NEUSTART_SCHLUESSEL },
  });
  return neustartsAusText(eintrag?.wert);
}

/**
 * Den Neustart einer Übung setzen oder mit null entfernen.
 *
 * Geprüft wird, dass es unter dem Namen Sätze oder einen Katalogeintrag gibt:
 * ein Tippfehler im Namen legte sonst einen Neustart an, der nie greift, und
 * das Urteil der gemeinten Übung bliebe stumm beim alten "fällt".
 */
export async function neustartSetzen(
  uebung: string,
  datum: string | null
): Promise<{ ok: true; neustarts: Neustarts } | { ok: false; fehler: string }> {
  const name = uebung.trim();
  if (!name) return { ok: false, fehler: "Der Übungsname darf nicht leer sein." };

  if (datum !== null) {
    if (!ISO_TAG.test(datum) || Number.isNaN(Date.parse(`${datum}T00:00:00Z`))) {
      return { ok: false, fehler: `"${datum}" ist kein Datum im Format JJJJ-MM-TT.` };
    }
    if (datum > heuteWien()) {
      return { ok: false, fehler: "Ein Neustart in der Zukunft wertet noch nichts — Datum prüfen." };
    }
  }

  return prisma.$transaction(async (tx) => {
    const [satz, katalog] = await Promise.all([
      tx.setLog.findFirst({ where: { exercise: name }, select: { id: true } }),
      tx.uebung.findFirst({ where: { name }, select: { id: true } }),
    ]);
    if (!satz && !katalog) {
      return {
        ok: false as const,
        fehler: `Unter "${name}" ist weder etwas geloggt noch steht es im Katalog. Schreibweise prüfen.`,
      };
    }

    const eintrag = await tx.einstellung.findUnique({
      where: { schluessel: NEUSTART_SCHLUESSEL },
    });
    const neustarts = neustartsAusText(eintrag?.wert);
    if (datum === null) delete neustarts[name];
    else neustarts[name] = datum;

    const wert = JSON.stringify(neustarts);
    await tx.einstellung.upsert({
      where: { schluessel: NEUSTART_SCHLUESSEL },
      update: { wert },
      create: { schluessel: NEUSTART_SCHLUESSEL, wert },
    });
    return { ok: true as const, neustarts };
  });
}

/**
 * Was ein Trendurteil außer den Sätzen braucht: die Neustarts und, fürs
 * Bankdrücken, die Trainingsmax-Historie (siehe trendSaetze() in
 * bankcoach.ts). Direkt gelesen statt über bank.ts — das Modul schreibt
 * beim Lesen Zyklen fort, und ein Kraftverlauf soll nichts schreiben.
 */
export async function trendGrundlage(): Promise<{
  neustarts: Neustarts;
  bankTmHistorie: { tmKg: number; gueltigAb: string }[];
}> {
  const neustarts = await neustartsLesen();
  const zeilen = await prisma.bankTrainingsmax.findMany({
    orderBy: { zyklus: "asc" },
    select: { tmKg: true, gueltigAb: true },
  });
  return {
    neustarts,
    bankTmHistorie: zeilen.map((z) => ({
      tmKg: z.tmKg,
      gueltigAb: z.gueltigAb.toISOString().slice(0, 10),
    })),
  };
}
