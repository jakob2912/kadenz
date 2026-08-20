/**
 * Kadenz — Bankdrücken 5/3/1
 *
 * Die Rechnung steht in kraft.ts und ist rein. Hier liegt der Teil, der die
 * Datenbank braucht: den Trainingsmax lesen, ihn am Zyklusende fortschreiben
 * und daraus die Vorgabe für den heutigen Bank-Slot bauen.
 *
 * Kein "use server": das Modul wird auch vom MCP-Server geladen, und der
 * kennt Server Actions nicht. Dasselbe Muster wie ernaehrung.ts.
 */

import { prisma } from "./db";
import { heuteWien } from "./datum";
import type { SetLog } from "./coach";
import {
  amrapSoll,
  bankPlan,
  bankPosition,
  naechsterTm,
  TM_ANTEIL,
  type BankPosition,
} from "./kraft";
import { datumFuerPushIndex, pushIndexAbDatum, type Programmvorgabe } from "./plan";

/**
 * Der Name, unter dem geloggt wird — die Verbindung zwischen Katalog und
 * SetLog.exercise. Steht hier als Konstante, weil drei Stellen ihn brauchen
 * (Vorgabe, AMRAP-Suche, MCP-Werkzeug) und ein Tippfehler in einer davon
 * lautlos zu "keine Historie" führen würde.
 */
export const BANK_UEBUNG = "Bankdrücken";

export type Trainingsmax = {
  zyklus: number;
  tmKg: number;
  quelle: string;
  begruendung: string;
  gueltigAb: string;
};

function zuTrainingsmax(zeile: {
  zyklus: number;
  tmKg: number;
  quelle: string;
  begruendung: string;
  gueltigAb: Date;
}): Trainingsmax {
  return {
    zyklus: zeile.zyklus,
    tmKg: zeile.tmKg,
    quelle: zeile.quelle,
    begruendung: zeile.begruendung,
    gueltigAb: zeile.gueltigAb.toISOString().slice(0, 10),
  };
}

/**
 * Der Push-Tag, an dem das Programm angefangen hat.
 *
 * Abgeleitet aus dem Stichtag von Zyklus 1 statt als eigene Spalte: eine
 * gespeicherte Zahl könnte von gueltigAb abweichen, und dann gäbe es zwei
 * Meinungen darüber, wann das Programm begann. Aus einem Datum lässt sie sich
 * jederzeit neu ausrechnen, und der Stichtag steht ohnehin schon da.
 */
async function startPushIndex(): Promise<number | null> {
  const ersteZeile = await prisma.bankTrainingsmax.findUnique({ where: { zyklus: 1 } });
  if (!ersteZeile) return null;
  return pushIndexAbDatum(ersteZeile.gueltigAb.toISOString().slice(0, 10));
}

/** Die jüngste Zeile — der aktuell geltende Trainingsmax. */
export async function aktuellerTrainingsmax(): Promise<Trainingsmax | null> {
  const zeile = await prisma.bankTrainingsmax.findFirst({
    orderBy: { zyklus: "desc" },
  });
  return zeile ? zuTrainingsmax(zeile) : null;
}

export async function trainingsmaxHistorie(anzahl = 10): Promise<Trainingsmax[]> {
  const zeilen = await prisma.bankTrainingsmax.findMany({
    orderBy: { zyklus: "desc" },
    take: anzahl,
  });
  return zeilen.map(zuTrainingsmax);
}

/**
 * Den ersten Trainingsmax setzen oder einen bestehenden korrigieren.
 *
 * Kadenz schätzt hier nichts. Langhantel-Bankdrücken hat in dieser App keine
 * Historie — es stand nie im Split. Ein geratener Startwert wäre die
 * Grundlage sämtlicher Prozente des Programms gewesen, und ein zu hoher
 * Startwert fällt erst auf, wenn man in Woche 3 unter der Hantel liegt.
 */
export async function trainingsmaxSetzen(
  tmKg: number,
  begruendung: string
): Promise<{ ok: true; tm: Trainingsmax } | { ok: false; fehler: string }> {
  if (!Number.isFinite(tmKg) || tmKg < 20 || tmKg > 300) {
    return {
      ok: false,
      fehler: `${tmKg} kg ist als Trainingsmax fürs Bankdrücken nicht plausibel (20–300 kg).`,
    };
  }

  try {
    const aktuell = await aktuellerTrainingsmax();

    /* Ein bestehender Zyklus wird korrigiert, nicht ergänzt: zwei
       Trainingsmaxe für denselben Zyklus wären zwei verschiedene Meinungen
       darüber, mit welchen Prozenten heute gerechnet wird. Die Historie
       bleibt trotzdem lesbar — jeder abgeschlossene Zyklus hat seine eigene
       Zeile mit seiner eigenen Begründung. */
    const zyklus = aktuell?.zyklus ?? 1;

    const zeile = await prisma.bankTrainingsmax.upsert({
      where: { zyklus },
      update: { tmKg, quelle: "jakob", begruendung },
      create: {
        zyklus,
        gueltigAb: new Date(`${heuteWien()}T00:00:00Z`),
        tmKg,
        quelle: aktuell === null ? "start" : "jakob",
        begruendung,
      },
    });

    return { ok: true, tm: zuTrainingsmax(zeile) };
  } catch (e) {
    console.error("Trainingsmax nicht speicherbar:", e);
    return { ok: false, fehler: "Der Trainingsmax konnte nicht gespeichert werden." };
  }
}

/**
 * Der AMRAP-Satz eines bestimmten Bank-Tags.
 *
 * Gesucht wird über das Datum, das sich aus dem Push-Index ergibt, und über
 * das Gewicht: der AMRAP-Satz ist der schwerste des Tages. Über setIndex zu
 * gehen wäre falsch — wer einen Aufwärmsatz mitloggt, verschiebt die
 * Nummerierung, und dann zählt Kadenz die falsche Zeile.
 */
async function amrapSatzVon(pushIndex: number): Promise<SetLog | null> {
  const datum = new Date(`${datumFuerPushIndex(pushIndex)}T00:00:00Z`);

  const workout = await prisma.workout.findUnique({
    where: { date_kind: { date: datum, kind: "push" } },
    select: {
      sets: {
        where: { exercise: BANK_UEBUNG },
        orderBy: [{ kg: "desc" }, { reps: "desc" }],
        take: 1,
        select: { kg: true, reps: true },
      },
    },
  });

  return workout?.sets[0] ?? null;
}

/**
 * Höchstens so viele Zyklen werden auf einmal nachgeholt.
 *
 * Wer zwei Monate nicht trainiert hat, soll nicht mit einem Trainingsmax
 * zurückkommen, den zwanzig Zyklen ohne einen einzigen geloggten Satz
 * hochgerechnet haben. Ab dieser Grenze bleibt der Wert stehen und die
 * Begründung sagt, dass die Zyklen dazwischen leer waren.
 */
const MAX_NACHGEHOLTE_ZYKLEN = 6;

/**
 * Trainingsmax auf den laufenden Zyklus bringen.
 *
 * Geschrieben wird beiläufig beim Aufrufen des Plans — dasselbe Muster wie
 * vorschlagLage() bei den Kalorienvorschlägen. Gegen zwei gleichzeitige
 * Aufrufe schützt @unique auf zyklus: der zweite läuft in den Konflikt und
 * liest dann die Zeile, die der erste angelegt hat, statt eine zweite
 * anzulegen.
 */
async function aufZyklusBringen(
  zielZyklus: number,
  start: Trainingsmax,
  startIndex: number
): Promise<Trainingsmax> {
  let aktuell = start;

  if (zielZyklus - aktuell.zyklus > MAX_NACHGEHOLTE_ZYKLEN) {
    return anlegenOderLesen(zielZyklus, aktuell.tmKg, "zyklus", {
      begruendung:
        `Zwischen Zyklus ${aktuell.zyklus} und ${zielZyklus} liegen ` +
        `${zielZyklus - aktuell.zyklus} Zyklen ohne Auswertung. Der Trainingsmax bleibt ` +
        `bei ${aktuell.tmKg.toFixed(1).replace(".", ",")} kg — nach so langer Pause ist er ` +
        `eher zu hoch als zu niedrig. Prüf ihn im ersten Satz und korrigier ihn, wenn er nicht passt.`,
    });
  }

  while (aktuell.zyklus < zielZyklus) {
    // Woche 3 des laufenden Zyklus trägt den AMRAP-Satz, der über den
    // nächsten Trainingsmax entscheidet: Bank-Index (zyklus-1)*4 + 2.
    const bankIndex = (aktuell.zyklus - 1) * 4 + 2;
    const soll = amrapSoll(3)!;

    let satz: SetLog | null = null;
    try {
      satz = await amrapSatzVon(startIndex + bankIndex * 2);
    } catch (e) {
      console.error("AMRAP-Satz nicht lesbar:", e);
    }

    const entscheidung = naechsterTm(aktuell.tmKg, satz, soll.wdh);

    aktuell = await anlegenOderLesen(aktuell.zyklus + 1, entscheidung.tmNeu, "zyklus", {
      begruendung: entscheidung.begruendung,
    });
  }

  return aktuell;
}

async function anlegenOderLesen(
  zyklus: number,
  tmKg: number,
  quelle: string,
  opts: { begruendung: string }
): Promise<Trainingsmax> {
  try {
    const zeile = await prisma.bankTrainingsmax.create({
      data: {
        zyklus,
        gueltigAb: new Date(`${heuteWien()}T00:00:00Z`),
        tmKg,
        quelle,
        begruendung: opts.begruendung,
      },
    });
    return zuTrainingsmax(zeile);
  } catch {
    // Jemand war schneller. Dessen Zeile gilt.
    const zeile = await prisma.bankTrainingsmax.findUnique({ where: { zyklus } });
    if (zeile) return zuTrainingsmax(zeile);
    throw new Error(`Trainingsmax für Zyklus ${zyklus} weder anlegbar noch lesbar.`);
  }
}

export type Bankstand = {
  position: BankPosition;
  tm: Trainingsmax | null;
  vorgabe: Programmvorgabe;
  /** Nur gesetzt, wenn heute kein Bank-Tag ist — Kalendertag des nächsten. */
  naechsterBankTag: string | null;
};

/**
 * Alles, was der Bank-Slot für einen Push-Tag braucht.
 *
 * Gibt auch dann eine Vorgabe zurück, wenn kein Trainingsmax existiert — dann
 * mit leeren Sätzen und einem Hinweis. Die Übung verschwindet nicht: sie steht
 * im Plan, und dass sie noch keine Zahlen hat, ist eine Information, kein
 * Grund, sie zu verstecken.
 */
export async function bankstandFuer(pushIndex: number): Promise<Bankstand> {
  let tm = await aktuellerTrainingsmax();

  if (tm === null) {
    /* Noch kein Trainingsmax, also läuft das Programm noch nicht. Der heutige
       Push-Tag gilt als sein möglicher Anfang: was hier steht, ist Woche 1 —
       sobald die Zahl da ist. Ihn als "kein Bank-Tag" zu zeigen wäre irre-
       führend, denn worauf sollte man dann warten. */
    return {
      position: bankPosition(pushIndex, pushIndex),
      tm: null,
      naechsterBankTag: null,
      vorgabe: {
        saetze: [],
        hinweis:
          "Trainingsmax fehlt. Langhantel-Bankdrücken hat hier keine Historie, aus der " +
          "Kadenz ihn schätzen könnte — trag ihn einmalig ein. Er liegt bei rund 90 % von " +
          "dem, was du sicher einmal schaffst.",
      },
    };
  }

  const start = (await startPushIndex()) ?? pushIndex;
  const position = bankPosition(pushIndex, start);
  const naechsterBankTag = position.istBankTag ? null : datumFuerPushIndex(pushIndex + 1);

  if (tm.zyklus < position.zyklus) {
    tm = await aufZyklusBringen(position.zyklus, tm, start);
  }

  return {
    position,
    tm,
    naechsterBankTag,
    vorgabe: { saetze: bankPlan(tm.tmKg, position.woche), hinweis: null },
  };
}

/** Was der Trainingsmax über das Maximum behauptet — für die Anzeige. */
export function behauptetesMaximum(tmKg: number): number {
  return tmKg / TM_ANTEIL;
}
