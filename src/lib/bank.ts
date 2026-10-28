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
  amrapPushIndex,
  amrapSoll,
  BANK_UEBUNG,
  bankPlan,
  bankPosition,
  bankZusatzPlan,
  naechsterTm,
  SCHAETZUNG_TAGE,
  schaetzungAus,
  testPlan,
  TEST_VERSUCHE,
  TM_ANTEIL,
  pushTageImZyklus,
  SINGLE_PROZENT,
  ZUSATZ_PROZENT,
  vorTest,
  zyklusAnfang,
  type BankPosition,
  type Zyklusanker,
} from "./kraft";

/* Weiterhin von hier lesbar: bank.ts war die Heimat dieses Namens, und der
   MCP-Server sowie mehrere Seiten importieren ihn von hier. */
export { BANK_UEBUNG } from "./kraft";
import { eintraegeLesen } from "./wochenplan";
import {
  datumFuerPushIndex,
  FESTE_TAGE_AB_ISO,
  montagVon,
  pushIndexAbDatum,
  tageFuerPushIndex,
  type Wochenwahl,
  type Programmvorgabe,
} from "./plan";

/**
 * Der Name, unter dem geloggt wird — die Verbindung zwischen Katalog und
 * SetLog.exercise. Steht hier als Konstante, weil drei Stellen ihn brauchen
 * (Vorgabe, AMRAP-Suche, MCP-Werkzeug) und ein Tippfehler in einer davon
 * lautlos zu "keine Historie" führen würde.
 */
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
async function zyklusanker(wahlen: readonly Wochenwahl[]): Promise<Zyklusanker | null> {
  /* Die JÜNGSTE Zeile, nicht mehr die von Zyklus 1.
     
     Jede Zeile trägt in gueltigAb den Tag, ab dem ihr Trainingsmax gilt — und
     das ist derselbe Tag, an dem ihr Zyklus mit Woche 1 beginnt. Von dort aus
     zu zählen macht "einen Zyklus vorziehen" zu einem Datum statt zu einem
     Eingriff: wer die Deload-Woche auslassen will, setzt den nächsten
     Trainingsmax, und die Welle fängt am nächsten Push-Tag von vorne an.
     
     Vorher hing alles am Startdatum von Zyklus 1. Ein übersprungener Deload
     war damit nur zu haben, indem man dieses Datum verschob — was rückwirkend
     jede zurückliegende Woche neu beschriftet hätte. */
  const zeile = await prisma.bankTrainingsmax.findFirst({ orderBy: { zyklus: "desc" } });
  if (!zeile) return null;

  return {
    pushIndex: pushIndexAbDatum(zeile.gueltigAb.toISOString().slice(0, 10), wahlen),
    zyklus: zeile.zyklus,
    tmKg: zeile.tmKg,
  };
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
      fehler: `${tmKg} kg isn't a plausible bench training max (20–300 kg).`,
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
    return { ok: false, fehler: "The training max could not be saved." };
  }
}

/**
 * Der AMRAP-Satz eines bestimmten Bank-Tags.
 *
 * Gesucht wird über den Zeitraum, der zu diesem Push-Tag gehört, und über
 * das Gewicht: der AMRAP-Satz ist der schwerste. Über setIndex zu gehen wäre
 * falsch — wer einen Aufwärmsatz mitloggt, verschiebt die Nummerierung, und
 * dann zählt Kadenz die falsche Zeile.
 *
 * Nicht über das planmäßige Datum, weil Push-Tage vorgezogen und nachgeholt
 * werden: gesucht wird an dem Tag, dessen Einheit den Platz belegt hat
 * (tageFuerPushIndex() in plan.ts). Über das planmäßige Datum fände Kadenz
 * einen verschobenen AMRAP-Satz nicht, und der Trainingsmax bliebe
 * stillschweigend stehen.
 *
 * `mindestKg` ist das vorgegebene Gewicht des AMRAP-Satzes. Ein schwerer
 * Single (1 Wiederholung bei 90 %) sähe ohne diese Schranke wie ein
 * bestandener AMRAP-Satz der Woche 3 aus, wenn der echte fehlt. Gezählt wird
 * deshalb nur, was mindestens mit dem Sollgewicht lief.
 */
async function amrapSatzVon(
  pushIndex: number,
  mindestKg: number,
  wahlen: readonly Wochenwahl[]
): Promise<SetLog | null> {
  const geplant = datumFuerPushIndex(pushIndex, wahlen);

  /* Seit den festen Wochentagen belegt jede Einheit einen Platz der Woche
     (zuordnung() in plan.ts) — ein vorgezogener Push am Do trägt den Index
     des Sa. Gesucht wird deshalb an genau den Tagen, die diesen Platz belegt
     haben. Davor gilt weiter das Zeitfenster bis zum nächsten Push-Tag. */
  let tage: { date: { in: Date[] } } | { date: { gte: Date; lt: Date } };
  if (geplant >= FESTE_TAGE_AB_ISO) {
    const montag = montagVon(geplant);
    const sonntag = new Date(Date.parse(`${montag}T00:00:00Z`) + 6 * 864e5).toISOString().slice(0, 10);
    const belegt = tageFuerPushIndex(pushIndex, wahlen, await eintraegeLesen(montag, sonntag));
    if (belegt.length === 0) return null;
    tage = { date: { in: belegt.map((d) => new Date(`${d}T00:00:00Z`)) } };
  } else {
    tage = {
      date: {
        gte: new Date(`${geplant}T00:00:00Z`),
        lt: new Date(`${datumFuerPushIndex(pushIndex + 1, wahlen)}T00:00:00Z`),
      },
    };
  }

  return prisma.setLog.findFirst({
    where: {
      exercise: BANK_UEBUNG,
      kg: { gte: mindestKg },
      workout: { kind: "push", ...tage },
      /* Markieren lässt sich seit dem 11.09.2026 nicht mehr — eine unsaubere
         letzte Wiederholung zählt Jakob einfach nicht mit. Die alten
         Markierungen gelten aber weiter, deshalb bleibt der Filter.

         Ausgeschlossen wird nur, was ausdrücklich als unsauber markiert ist.
           Die Markierung ist dreiwertig, und "nicht beurteilt" ist der
           Normalfall — sämtliche Sätze vor dieser Spalte stehen auf NULL. Ein
           Filter auf `sauber: true` hätte die gesamte bisherige Historie
           verworfen.

           Ausgeschrieben als OR und NICHT als `{ not: false }`: SQL vergleicht
           dreiwertig, `sauber <> false` ist für eine NULL-Zeile selbst NULL,
           und NULL ist nicht wahr — die Zeile fällt heraus. Gemessen genau
           so: mit `{ not: false }` fand diese Abfrage den AMRAP-Satz vom
           03.09. (85 kg × 4, sauber = NULL) nicht mehr, und
           aufZyklusBringen() schrieb daraufhin "Kein AMRAP-Satz geloggt" und
           ließ den Trainingsmax stehen. Der Fehler wäre nie aufgefallen,
           sondern hätte die Progression stillschweigend eingefroren.

           Fällt der schwerste Satz wegen einer Markierung weg, greift der
           nächstschwerere — die konservative Richtung, und genau die will man,
           wenn aus dieser Zahl das Gewicht des nächsten Zyklus folgt. */
      OR: [{ sauber: null }, { sauber: true }],
    },
    orderBy: [{ kg: "desc" }, { reps: "desc" }],
    select: { kg: true, reps: true, sauber: true },
  });
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
  ankerIndex: number,
  wahlen: readonly Wochenwahl[]
): Promise<Trainingsmax> {
  let aktuell = start;
  let anker = ankerIndex;

  if (zielZyklus - aktuell.zyklus > MAX_NACHGEHOLTE_ZYKLEN) {
    return anlegenOderLesen(zielZyklus, aktuell.tmKg, "zyklus", wahlen, {
      /* Der Anker des Zielzyklus, auch wenn die Zyklen dazwischen leer
         blieben: Zyklus für Zyklus vom bekannten Anker aus. Sonst stünde als
         Anfang des neuen Zyklus der Tag, an dem jemand zufällig die Seite
         aufgerufen hat. */
      abPushIndex: zyklusAnfang(
        { pushIndex: anker, zyklus: aktuell.zyklus, tmKg: aktuell.tmKg },
        zielZyklus
      ),
      begruendung:
        `Between cycle ${aktuell.zyklus} and ${zielZyklus} there are ` +
        `${zielZyklus - aktuell.zyklus} cycles without evaluation. The training max stays ` +
        `at ${aktuell.tmKg.toFixed(1)} kg — after such a long break it's more likely ` +
        `too high than too low. Check it on the first set and correct it if it doesn't fit.`,
    });
  }

  while (aktuell.zyklus < zielZyklus) {
    // Woche 3 dieses Zyklus trägt den AMRAP-Satz, der über den nächsten
    // Trainingsmax entscheidet — vier Push-Tage nach seinem Anfang.
    const soll = amrapSoll(3)!;
    const sollKg = bankPlan(aktuell.tmKg, 3).find((s) => s.amrap)!.kg;

    let satz: SetLog | null = null;
    try {
      satz = await amrapSatzVon(amrapPushIndex(anker), sollKg, wahlen);
    } catch (e) {
      console.error("AMRAP-Satz nicht lesbar:", e);
    }

    const entscheidung = naechsterTm(aktuell.tmKg, satz, soll.wdh);

    /* Der nächste Zyklus beginnt sechs oder acht Push-Tage nach diesem
       (mit oder ohne Deload, siehe wochenImZyklus()) — ausgerechnet
       und nicht "heute". Wird die Fortschreibung ein paar Tage zu früh oder
       zu spät angestoßen, stünde sonst ein Anfangsdatum in der Zeile, das mit
       der Welle nichts zu tun hat, und die Wochen liefen ab da schief. */
    anker += pushTageImZyklus(aktuell.zyklus, aktuell.tmKg);

    aktuell = await anlegenOderLesen(aktuell.zyklus + 1, entscheidung.tmNeu, "zyklus", wahlen, {
      abPushIndex: anker,
      begruendung: entscheidung.begruendung,
    });
  }

  return aktuell;
}

async function anlegenOderLesen(
  zyklus: number,
  tmKg: number,
  quelle: string,
  wahlen: readonly Wochenwahl[],
  opts: { begruendung: string; abPushIndex: number }
): Promise<Trainingsmax> {
  try {
    const zeile = await prisma.bankTrainingsmax.create({
      data: {
        zyklus,
        gueltigAb: new Date(`${datumFuerPushIndex(opts.abPushIndex, wahlen)}T00:00:00Z`),
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
  /**
   * Kalendertag des nächsten TM-Tags. Nur gesetzt, wenn heute keiner ist.
   *
   * Meint ausdrücklich den Programmtag, nicht die nächste Einheit mit
   * Bankdrücken — die ist seit dem Zusatz-Slot ohnehin die nächste
   * Push-Einheit. Wissenswert ist, wann wieder schwer gebankt wird.
   */
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
export async function bankstandFuer(
  pushIndex: number,
  wahlen: readonly Wochenwahl[],
  /* Wann ein Push-Index trainiert wird. Ohne Angabe der planmäßige Tag; wer
     die geloggten Einheiten kennt, reicht den tatsächlichen herein
     (pushTageAb() in plan.ts) — sonst nennt die Seite für einen vorgezogenen
     TM-Tag den alten Wochentag. Null: dieser Platz verfällt. */
  tagVon: (pushIndex: number) => string | null = (i) => datumFuerPushIndex(i, wahlen)
): Promise<Bankstand> {
  let tm = await aktuellerTrainingsmax();

  if (tm === null) {
    /* Noch kein Trainingsmax, also läuft das Programm noch nicht. Der heutige
       Push-Tag gilt als sein möglicher Anfang: was hier steht, ist Woche 1 —
       sobald die Zahl da ist. Ihn als "kein Bank-Tag" zu zeigen wäre irre-
       führend, denn worauf sollte man dann warten. */
    return {
      position: bankPosition(pushIndex, { pushIndex, zyklus: 1, tmKg: null }),
      tm: null,
      naechsterBankTag: null,
      vorgabe: {
        saetze: [],
        hinweis:
          "Training max missing. Barbell bench press has no history here for " +
          "Kadenz to estimate it from — enter it once. It's about 90 % of " +
          "what you can safely do for one rep.",
      },
    };
  }

  const anker = (await zyklusanker(wahlen)) ?? { pushIndex, zyklus: tm.zyklus, tmKg: tm.tmKg };
  const position = bankPosition(pushIndex, anker);

  /* Der nächste TM-Tag: die nächste Push-Einheit, deren Position einer ist
     und deren Platz nicht verfällt. Meist die gleich folgende — nach dem
     leichten Tag und nach der Deload-Zusatzeinheit liegt er eine Push-Einheit
     weiter. Ist heute selbst einer, gibt es nichts anzukündigen. */
  let naechsterBankTag: string | null = null;
  if (position.art !== "tm" && position.art !== "test") {
    for (let k = 1; k <= 8 && naechsterBankTag === null; k++) {
      const art = bankPosition(pushIndex + k, anker).art;
      if (art === "tm" || art === "test") naechsterBankTag = tagVon(pushIndex + k);
    }
  }

  if (tm.zyklus < position.zyklus) {
    tm = await aufZyklusBringen(position.zyklus, tm, anker.pushIndex, wahlen);
  }

  const schaetzung =
    position.art === "test"
      ? await geschaetztesMaximum(datumFuerPushIndex(pushIndex, wahlen))
      : null;

  return {
    position,
    tm,
    naechsterBankTag,
    vorgabe: vorgabeFuer(position, tm.tmKg, schaetzung),
  };
}

/**
 * Das beste geschätzte Maximum der letzten Wochen vor einem Tag — die
 * Grundlage für den ersten Versuch am Testtag.
 */
export async function geschaetztesMaximum(vorIso: string): Promise<number | null> {
  const bis = new Date(`${vorIso}T00:00:00Z`);
  const ab = new Date(bis.getTime() - SCHAETZUNG_TAGE * 864e5);
  const saetze = await prisma.setLog.findMany({
    where: { exercise: BANK_UEBUNG, workout: { date: { gte: ab, lt: bis } } },
    select: { kg: true, reps: true, sauber: true },
  });
  return schaetzungAus(saetze);
}

/**
 * Die Sätze des Tages — aus der Welle oder vom leichten Tag.
 *
 * Beide rechnen mit demselben Trainingsmax, und nur der TM-Tag schreibt ihn
 * fort. Dass der leichte Tag dabei außen vor bleibt, steht nicht hier, sondern
 * folgt aus aufZyklusBringen(): das sucht den AMRAP-Satz nur im Zeitraum des
 * TM-Tags der Woche 3 und nur ab dessen Sollgewicht (amrapSatzVon()). Der
 * Single des leichten Tags liegt darunter, auch wenn er sich verschiebt.
 */
function vorgabeFuer(
  position: BankPosition,
  tmKg: number,
  schaetzung: number | null
): Programmvorgabe {
  if (position.art === "tm") {
    return { saetze: bankPlan(tmKg, position.woche), hinweis: null };
  }

  if (position.art === "test") {
    return {
      saetze: testPlan(tmKg, schaetzung),
      hinweis:
        `Test day: four warm-up sets, then up to ${TEST_VERSUCHE} singles. Only take the next ` +
        `attempt if the previous one moved cleanly — stop at the first grinder. Hips ` +
        `stay on the bench, otherwise the attempt doesn't count. 3–5 minutes rest. Simply ` +
        `don't check attempts you missed.` +
        (schaetzung === null
          ? " No estimate from recent weeks — the first attempt is at the training max."
          : ""),
    };
  }

  if (vorTest(position)) {
    return {
      saetze: bankZusatzPlan(tmKg, false),
      hinweis:
        `Light day before the test: only three sets of five at ` +
        `${String(ZUSATZ_PROZENT)} %, no single — go into the test fresh.`,
    };
  }

  if (position.art === "zusatz") {
    return {
      saetze: bankZusatzPlan(tmKg),
      hinweis:
        `Light day: three sets of five at ${String(ZUSATZ_PROZENT)} %, then ` +
        `one heavy single at ${SINGLE_PROZENT} % of the training max. One rep, ` +
        `clean and fast — no grinder, no second one. Doesn't count toward the ` +
        `training max progression; that's what the AMRAP set on TM day is for.`,
    };
  }

  return {
    saetze: [],
    hinweis:
      "No bench today. The extra session is skipped in deload week — " +
      "the week is for backing off.",
  };
}

/** Was der Trainingsmax über das Maximum behauptet — für die Anzeige. */
export function behauptetesMaximum(tmKg: number): number {
  return tmKg / TM_ANTEIL;
}
