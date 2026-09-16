/**
 * Kadenz — Kraftauswertung
 *
 * Wie coach.ts: rein, kein I/O, keine Komponentenimporte. Hier liegt alles,
 * was aus geloggten Sätzen eine Aussage macht — geschätztes Maximum,
 * Fortschrittsurteil, Vergleich zwischen Übungen und die 5/3/1-Rechnung.
 *
 * Bewusst getrennt von coach.ts: dort geht es um den Körper (Regeneration,
 * Gewicht, Kalorien), hier um die Hantel. Die beiden teilen nur den Satz-Typ.
 */

import type { SetLog } from "./coach";

const TAG_MS = 86_400_000;

function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / TAG_MS);
}

/** Deutsches Dezimalkomma — eigene Fassung, damit das Modul rein bleibt. */
function komma(n: number, stellen: number): string {
  return n.toFixed(stellen).replace(".", ",");
}

export function aufZweiKommaFuenf(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

// ─────────────────────────────────────────────────────────────
// Geschätztes Maximum
// ─────────────────────────────────────────────────────────────

/**
 * Oberhalb dieser Wiederholungszahl wird nicht mehr geschätzt.
 *
 * Epley ist eine Gerade durch einen Zusammenhang, der keine ist. Bis etwa
 * zehn Wiederholungen liegt sie nah genug; darüber wächst der Fehler schnell
 * und die Zahl sagt mehr über die Ausdauer als über die Maximalkraft. Jakobs
 * Korridor sind ohnehin 5 bis 8 Wiederholungen (siehe progression()).
 */
const MAX_WDH_FUER_SCHAETZUNG = 10;

/**
 * Geschätztes Einer-Maximum nach Epley: kg × (1 + Wdh / 30).
 *
 * Gibt null zurück statt einer geratenen Zahl, wenn der Satz nichts hergibt —
 * dieselbe Haltung wie assessTrend(): lieber "weiß ich nicht" als eine Zahl,
 * die niemand nachrechnen kann.
 *
 * Sonderfall eine Wiederholung: da wird nichts geschätzt. Epley rechnete
 * kg × 1,033 und machte aus einem tatsächlich gehobenen Maximum ein um drei
 * Prozent höheres, das nie jemand gehoben hat.
 */
export function e1rm(satz: SetLog): number | null {
  if (!Number.isFinite(satz.kg) || satz.kg <= 0) return null;
  if (!Number.isFinite(satz.reps) || satz.reps < 1) return null;
  if (satz.reps === 1) return satz.kg;
  if (satz.reps > MAX_WDH_FUER_SCHAETZUNG) return null;

  return satz.kg * (1 + satz.reps / 30);
}

/**
 * Der tatsächliche Bestwert — schwerster je geloggter Satz, ohne Formel.
 *
 * Steht neben dem geschätzten Maximum, nicht an seiner Stelle: das eine ist
 * gemessen, das andere gerechnet. Bei gleichem Gewicht gewinnt der Satz mit
 * mehr Wiederholungen.
 */
export function besterSatz(saetze: SetLog[]): SetLog | null {
  let best: SetLog | null = null;
  for (const s of saetze) {
    if (s.kg <= 0 || s.reps < 1) continue;
    /* Ein ausdrücklich als unsauber markierter Satz ist kein Bestwert. Genau
       dafür gibt es die Markierung: Jakobs 100 kg standen mit abgehobener
       Hüfte, und ein Bestwert, den die Technik nicht getragen hat, ist als
       Bezugsgröße schlechter als gar keiner. Nicht beurteilte Sätze (null oder
       undefined) zählen weiter mit — sonst wäre die gesamte Historie vor
       dieser Spalte auf einen Schlag wertlos. */
    if (s.sauber === false) continue;
    if (best === null || s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps)) {
      best = s;
    }
  }
  return best;
}

export type GeloggterSatz = SetLog & {
  /** Trainingstag als ISO, YYYY-MM-DD. */
  datum: string;
  /** Der Name aus SetLog.exercise — für die Gruppierung im Vergleich. */
  uebung: string;
};

export type E1rmPunkt = { datum: string; e1rm: number };

/**
 * Bestes geschätztes Maximum je Trainingstag, aufsteigend nach Datum.
 *
 * Je Tag nur der beste Satz: die Folgesätze sind bei Jakob systematisch
 * schwächer (siehe progression()), und eine Reihe aus allen Sätzen würde
 * die Ermüdung innerhalb einer Einheit als Kraftverlust über Wochen lesen.
 */
export function e1rmReihe(saetze: GeloggterSatz[]): E1rmPunkt[] {
  const proTag = new Map<string, number>();

  for (const s of saetze) {
    // Siehe besterSatz(): eine Schätzung des Maximums aus einem Satz, dessen
    // Form nicht gestanden hat, schätzt das Maximum von etwas anderem.
    if (s.sauber === false) continue;
    const wert = e1rm(s);
    if (wert === null) continue;
    const bisher = proTag.get(s.datum);
    if (bisher === undefined || wert > bisher) proTag.set(s.datum, wert);
  }

  return [...proTag.entries()]
    .map(([datum, wert]) => ({ datum, e1rm: wert }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

// ─────────────────────────────────────────────────────────────
// Fortschritt
// ─────────────────────────────────────────────────────────────

/**
 * Tore vor jedem Urteil — dieselbe Begründung wie MIN_SPAN_DAYS in coach.ts.
 *
 * Das geschätzte Maximum springt von Einheit zu Einheit um mehrere Prozent:
 * eine Wiederholung mehr sind bei Epley schon gut drei Prozent. Aus zwei oder
 * drei Trainingstagen lässt sich daraus kein Trend lesen, sondern nur das
 * Rauschen. Vier Punkte über drei Wochen sind das Minimum, bei einer Übung
 * alle drei Tage also gut zwei Wochen Vorlauf.
 */
const MIN_PUNKTE = 4;
const MIN_SPANNE_TAGE = 21;

/**
 * Ab wann etwas "steigt" statt "steht".
 *
 * Ein Prozent auf vier Wochen ist bei einem Fortgeschrittenen im Aufbau nicht
 * von der Tagesform zu unterscheiden. Anderthalb Prozent sind der kleinste
 * Schritt, der über eine Übung mit 100 kg auch als Hantelscheibe existiert.
 */
export const SCHWELLE_PROZENT_4W = 1.5;

export type KraftUrteil =
  | {
      verwertbar: true;
      /** Relative Änderung, hochgerechnet auf vier Wochen. */
      prozentPro4Wochen: number;
      richtung: "steigt" | "steht" | "faellt";
      von: number;
      auf: number;
      punkte: number;
      spanneTage: number;
      text: string;
    }
  | { verwertbar: false; grund: string };

/**
 * Läuft der Fortschritt bei dieser Übung?
 *
 * Verglichen wird erste gegen zweite Hälfte der Reihe, nicht letzter gegen
 * ersten Punkt — aus demselben Grund wie in rate(): ein einzelner guter oder
 * schlechter Trainingstag am Rand der Reihe würde das ganze Urteil kippen.
 */
export function kraftTrend(reihe: E1rmPunkt[]): KraftUrteil {
  if (reihe.length < MIN_PUNKTE) {
    return {
      verwertbar: false,
      grund:
        `${reihe.length} von ${MIN_PUNKTE} Trainingstagen mit verwertbaren Sätzen. ` +
        `Für einen Trend zu wenig.`,
    };
  }

  const sortiert = [...reihe].sort((a, b) => a.datum.localeCompare(b.datum));
  const spanneTage = tageZwischen(sortiert[0].datum, sortiert[sortiert.length - 1].datum);

  if (spanneTage < MIN_SPANNE_TAGE) {
    return {
      verwertbar: false,
      grund:
        `Erst ${spanneTage} Tage Historie. Unter ${MIN_SPANNE_TAGE} Tagen ist die ` +
        `Schwankung von Einheit zu Einheit größer als der Trend — ` +
        `noch ${MIN_SPANNE_TAGE - spanneTage} Tage.`,
    };
  }

  const haelfte = Math.floor(sortiert.length / 2);
  const aelter = sortiert.slice(0, haelfte);
  const neuer = sortiert.slice(-haelfte);

  const mittel = (xs: E1rmPunkt[]) => xs.reduce((s, p) => s + p.e1rm, 0) / xs.length;
  const von = mittel(aelter);
  const auf = mittel(neuer);

  const mitteAlt = aelter[Math.floor(aelter.length / 2)].datum;
  const mitteNeu = neuer[Math.floor(neuer.length / 2)].datum;
  const abstand = Math.max(1, tageZwischen(mitteAlt, mitteNeu));

  const prozentPro4Wochen = ((auf - von) / von) * (28 / abstand) * 100;

  const richtung =
    prozentPro4Wochen >= SCHWELLE_PROZENT_4W
      ? "steigt"
      : prozentPro4Wochen <= -SCHWELLE_PROZENT_4W
        ? "faellt"
        : "steht";

  return {
    verwertbar: true,
    prozentPro4Wochen,
    richtung,
    von,
    auf,
    punkte: sortiert.length,
    spanneTage,
    text: urteilsText(richtung, prozentPro4Wochen),
  };
}

function urteilsText(
  richtung: "steigt" | "steht" | "faellt",
  prozent: number
): string {
  const betrag = komma(Math.abs(prozent), 1);

  if (richtung === "steigt") {
    return `Läuft. ${betrag} % mehr geschätztes Maximum auf vier Wochen gerechnet.`;
  }
  if (richtung === "faellt") {
    return (
      `Geht zurück — ${betrag} % auf vier Wochen. Entweder ist das Gewicht zu ` +
      `früh gestiegen, oder die Erholung trägt es gerade nicht.`
    );
  }
  return (
    `Steht. ${betrag} % auf vier Wochen, das ist innerhalb der Schwankung. ` +
    `Hier passiert im Moment nichts.`
  );
}

export type Rang = {
  uebung: string;
  urteil: KraftUrteil;
};

/**
 * Alle Übungen nebeneinander.
 *
 * Sortiert aufsteigend nach relativer Änderung: oben steht, was hängt. Wer
 * die Liste öffnet, will wissen, wo er nachsehen muss — nicht, was ohnehin
 * läuft. Übungen ohne verwertbares Urteil hängen hinten, damit sie den
 * Vergleich nicht unterbrechen.
 *
 * Verglichen wird ausdrücklich in Prozent, nicht in Kilogramm: 2,5 kg auf
 * Preacher Curl (20 kg) sind ein Achtel mehr, dieselben 2,5 kg auf Leg Curl
 * (125 kg) ein Fünfzigstel. In Kilogramm sortiert wäre die Liste nur eine
 * Rangfolge der schweren Übungen.
 */
export function rangliste(proUebung: Record<string, GeloggterSatz[]>): Rang[] {
  const raenge: Rang[] = Object.entries(proUebung).map(([uebung, saetze]) => ({
    uebung,
    urteil: kraftTrend(e1rmReihe(saetze)),
  }));

  return raenge.sort((a, b) => {
    if (a.urteil.verwertbar && b.urteil.verwertbar) {
      return a.urteil.prozentPro4Wochen - b.urteil.prozentPro4Wochen;
    }
    if (a.urteil.verwertbar) return -1;
    if (b.urteil.verwertbar) return 1;
    return a.uebung.localeCompare(b.uebung);
  });
}

// ─────────────────────────────────────────────────────────────
// Bankdrücken 5/3/1
// ─────────────────────────────────────────────────────────────

/**
 * Wendlers 5/3/1, angepasst an Jakobs Rotation.
 *
 * Das Programm ist als Wochenplan gedacht. Jakobs Push kommt aber alle drei
 * Tage, ohne Bezug zu Wochentagen. Übersetzt heißt eine "Woche" hier: ein
 * TM-Tag, und TM-Tag ist jede zweite Push-Einheit. Damit liegen sechs Tage
 * zwischen zwei Einheiten, die den Trainingsmax bewegen, und ein Zyklus dauert
 * 24 Tage.
 *
 * Warum das Programm nicht auf jede Push-Einheit gelegt wird: dann wäre der
 * Zyklus in zwölf Tagen durch und der Trainingsmax stiege rechnerisch um sieben
 * Kilogramm im Monat. Das hält niemand, und der AMRAP-Reset müsste ihn dauernd
 * wieder einfangen.
 *
 * Seit dem 27.08.2026 steht Bankdrücken trotzdem an jeder Push-Einheit: die
 * Tage dazwischen tragen einen leichten Tag mit schwerem Single (siehe
 * bankZusatzPlan()). Seit dem 16.09.2026 ist das wieder dieselbe Übung — die
 * Paused Bench Press und die Spoto Press am Pull-Tag sind raus. Der leichte Tag
 * ist ausdrücklich kein zweiter Programmtag — er rechnet mit demselben
 * Trainingsmax, verändert ihn aber nicht. Die Frequenz steigt von
 * gut einer auf gut zwei Bankeinheiten je Woche, der Zyklus bleibt 24 Tage.
 */

export const BANK_UEBUNG = "Bankdrücken";

export type BankWoche = 1 | 2 | 3 | 4;

export type BankSatz = {
  prozent: number;
  /** Sollwiederholungen. Beim AMRAP-Satz die Untergrenze, nicht das Ziel. */
  wdh: number;
  amrap: boolean;
  kg: number;
};

const WOCHEN: Record<BankWoche, { prozent: number; wdh: number; amrap: boolean }[]> = {
  1: [
    { prozent: 65, wdh: 5, amrap: false },
    { prozent: 75, wdh: 5, amrap: false },
    { prozent: 85, wdh: 5, amrap: true },
  ],
  2: [
    { prozent: 70, wdh: 3, amrap: false },
    { prozent: 80, wdh: 3, amrap: false },
    { prozent: 90, wdh: 3, amrap: true },
  ],
  3: [
    { prozent: 75, wdh: 5, amrap: false },
    { prozent: 85, wdh: 3, amrap: false },
    { prozent: 95, wdh: 1, amrap: true },
  ],
  // Deload: keine AMRAP-Zeile. Der Sinn der Woche ist, nicht auszureizen.
  4: [
    { prozent: 40, wdh: 5, amrap: false },
    { prozent: 50, wdh: 5, amrap: false },
    { prozent: 60, wdh: 5, amrap: false },
  ],
};

/** Der Trainingsmax ist bewusst 90 % des Maximums — man rechnet mit dem, was sicher steht. */
export const TM_ANTEIL = 0.9;

/** Zuwachs pro abgeschlossenem Zyklus, wenn der AMRAP-Satz ihn gedeckt hat. */
export const TM_SCHRITT_KG = 2.5;

export function bankPlan(tmKg: number, woche: BankWoche): BankSatz[] {
  return WOCHEN[woche].map((s) => ({
    ...s,
    kg: aufZweiKommaFuenf((tmKg * s.prozent) / 100),
  }));
}

/**
 * Der leichte Tag an den Push-Einheiten zwischen zwei TM-Tagen.
 *
 * Feste Prozente statt einer eigenen Wellenrechnung: der Tag soll Übung und
 * Volumen bringen, nicht eine zweite Meinung darüber, wie schwer diese Woche
 * ist. 72,5 % liegen unter jedem AMRAP-Satz des Programms (85, 90, 95 %) und
 * damit im Bereich, in dem fünf Wiederholungen mit Reserve stehen.
 *
 * Danach ein schwerer Single bei 90 %. Jakob hat an den leichten Tagen ohnehin
 * schwer weitergemacht (13.09.2026: 70 × 5, dann 75 × 3 und 85 × 4) — die
 * leichte Einheit allein war ihm zu wenig. Ein fest vorgegebener Single
 * fängt das ein, ohne den Tag zum zweiten Testtag zu machen: eine
 * Wiederholung, sauber und schnell, kein Satz bis zum Versagen. 90 % liegen
 * unter dem AMRAP-Satz der Woche 3, und ein Single kostet kaum Erholung.
 *
 * Bewusst ohne AMRAP-Zeile: der AMRAP-Satz ist das Messinstrument des
 * Programms, und ein zweites Instrument an einem Tag, der den Trainingsmax
 * nicht bewegen darf, wäre nur eine Zahl, die niemand verwendet.
 */
export const ZUSATZ_PROZENT = 72.5;
export const ZUSATZ_SAETZE = 3;
export const ZUSATZ_WDH = 5;
export const SINGLE_PROZENT = 90;

export function bankZusatzPlan(tmKg: number, mitSingle = true): BankSatz[] {
  const satz = {
    prozent: ZUSATZ_PROZENT,
    wdh: ZUSATZ_WDH,
    amrap: false,
    kg: aufZweiKommaFuenf((tmKg * ZUSATZ_PROZENT) / 100),
  };
  const single = {
    prozent: SINGLE_PROZENT,
    wdh: 1,
    amrap: false,
    kg: aufZweiKommaFuenf((tmKg * SINGLE_PROZENT) / 100),
  };
  const fuenfer = Array.from({ length: ZUSATZ_SAETZE }, () => ({ ...satz }));
  return mitSingle ? [...fuenfer, single] : fuenfer;
}

// ─────────────────────────────────────────────────────────────
// Testtag
// ─────────────────────────────────────────────────────────────

/**
 * Ein echter Maximalversuch, einmal im Quartal.
 *
 * 5/3/1 testet von sich aus nie — die AMRAP-Sätze sind Wiederholungsrekorde.
 * Jakobs Ziel heißt aber "140 kg sauber", und das ist ein Single. Deshalb
 * ersetzt in jedem dritten Zyklus (4, 7, 10, …) der Freitag der Deload-Woche
 * die Deload-Welle durch einen Test: gut drei Monate Abstand, und die
 * Deload-Woche davor ist ohnehin die frischeste Stelle im Zyklus.
 *
 * Der Test bewegt den Trainingsmax nicht. Der folgt weiter dem AMRAP-Satz der
 * Woche 3; liegt ein Test deutlich unter dem, was der Trainingsmax behauptet,
 * setzt Jakob ihn von Hand zurück.
 */
export const TEST_ALLE_ZYKLEN = 3;

export function istTestZyklus(zyklus: number): boolean {
  return zyklus > 1 && (zyklus - 1) % TEST_ALLE_ZYKLEN === 0;
}

/** Aufwärmen am Testtag, in Prozent vom Trainingsmax. */
const TEST_AUFWAERMEN: readonly { prozent: number; wdh: number }[] = [
  { prozent: 50, wdh: 5 },
  { prozent: 70, wdh: 3 },
  { prozent: 80, wdh: 1 },
  { prozent: 90, wdh: 1 },
];

export const TEST_VERSUCHE = 3;

/**
 * Wie weit zurück die Schätzung für den ersten Versuch schaut: gut ein
 * Zyklus. Ältere Sätze sagen über die Kraft von heute wenig.
 */
export const SCHAETZUNG_TAGE = 56;

/**
 * Das beste geschätzte Maximum aus einer Satzliste. Unsaubere Sätze zählen
 * nicht, siehe besterSatz().
 */
export function schaetzungAus(saetze: SetLog[]): number | null {
  let best: number | null = null;
  for (const s of saetze) {
    if (s.sauber === false) continue;
    const wert = e1rm(s);
    if (wert !== null && (best === null || wert > best)) best = wert;
  }
  return best;
}

/**
 * Die Sätze des Testtags: Aufwärmen, dann bis zu drei Singles.
 *
 * Der erste Versuch liegt beim geschätzten Maximum, abgerundet auf 2,5 kg —
 * die Schätzung kommt aus AMRAP-Sätzen mit Reserve und liegt eher unter dem
 * echten Wert. Danach je 2,5 kg mehr, aber nur, solange der vorige glatt
 * ging. Ohne Schätzung beginnt der Test beim Trainingsmax.
 */
export function testPlan(tmKg: number, schaetzungKg: number | null): BankSatz[] {
  const aufwaermen = TEST_AUFWAERMEN.map((s) => ({
    ...s,
    amrap: false,
    kg: aufZweiKommaFuenf((tmKg * s.prozent) / 100),
  }));

  const letzterAufwaermsatz = aufwaermen[aufwaermen.length - 1].kg;
  const erster = Math.max(
    Math.floor((schaetzungKg ?? tmKg) / 2.5) * 2.5,
    letzterAufwaermsatz + 2.5
  );

  const versuche = Array.from({ length: TEST_VERSUCHE }, (_, i) => {
    const kg = erster + i * 2.5;
    return { prozent: Math.round((kg / tmKg) * 100), wdh: 1, amrap: false, kg };
  });

  return [...aufwaermen, ...versuche];
}


/** Der AMRAP-Satz der Woche, falls es einen gibt. */
export function amrapSoll(woche: BankWoche): { prozent: number; wdh: number } | null {
  const satz = WOCHEN[woche].find((s) => s.amrap);
  return satz ? { prozent: satz.prozent, wdh: satz.wdh } : null;
}

/**
 * Was für ein Bank-Tag eine Push-Einheit ist.
 *
 * "tm"      — der Programmtag: drei Sätze nach der Welle, AMRAP obendrauf,
 *             und der einzige Tag, aus dem der Trainingsmax fortgeschrieben
 *             wird.
 * "zusatz"  — die Push-Einheit dazwischen: leicht plus ein schwerer Single,
 *             ohne Wirkung auf den Trainingsmax.
 * "test"    — der TM-Tag der Deload-Woche in jedem dritten Zyklus: statt der
 *             Deload-Welle ein echter Maximalversuch (testPlan()).
 * "keiner"  — vor dem Programmstart, und die Zusatz-Einheit der Deload-Woche.
 *
 * Ein Aufzählungstyp statt zweier Wahrheitswerte: mit istBankTag und
 * istZusatzTag nebeneinander gäbe es den Zustand "beides zugleich", den es
 * nicht gibt, und jede Stelle müsste selbst wissen, welcher der beiden
 * Vorrang hat.
 */
export type BankTagArt = "tm" | "test" | "zusatz" | "keiner";

export type BankPosition = {
  art: BankTagArt;
  /** Fortlaufend ab 1. Bei art "keiner" vor dem Start nicht aussagekräftig. */
  zyklus: number;
  woche: BankWoche;
};

/**
 * Wo im Programm steht ein Push-Tag?
 *
 * Rechnet ausdrücklich aus dem Kalender, nicht aus geloggten Einheiten.
 *
 * Ursprünglich, weil es gar nicht anders ging: trainingBeenden() wurde von
 * keiner Oberfläche aufgerufen, Workout.finishedAt stand auf jeder Zeile auf
 * NULL. Seit dem 25.08.2026 wird der Abschluss festgehalten, die Wahl bleibt
 * aber dieselbe — ein Zyklus, der an abgeschlossenen Einheiten hinge, bliebe
 * nach einer ausgefallenen Woche stehen, und das Programm liefe dem Kalender
 * hinterher. Nachteil, bewusst in Kauf genommen: wer eine Einheit ausfallen
 * lässt, überspringt die Programmwoche mit.
 *
 * Gezählt wird ab dem Anker des laufenden Zyklus, nicht ab dem Rotationsanker:
 * die Push-Pull-Rotation läuft seit dem 15.08.2026, das Bankprogramm fängt
 * später an. Ohne diesen Versatz wäre die allererste Bankeinheit je nach
 * Startdatum mitten im Zyklus gelandet, und der erste Satz Bankdrücken
 * überhaupt liefe mit 90 oder 95 Prozent.
 */
/**
 * Ab wo gezählt wird: der Push-Tag, an dem ein bekannter Zyklus mit Woche 1
 * beginnt, und dessen Nummer.
 *
 * Vorher war das fest der allererste Push-Tag des Programms, und alles danach
 * folgte stur im Vierwochentakt. Damit ließ sich ein Zyklus nicht vorziehen:
 * wer eine Deload-Woche auslassen wollte, konnte das nur, indem er das
 * Startdatum von Zyklus 1 fälschte — und damit rückwirkend jede zurückliegende
 * Woche neu beschriftete.
 *
 * Jetzt trägt jede Zyklus-Zeile ihren eigenen Anfang: BankTrainingsmax.
 * gueltigAb heißt "ab hier gilt dieser Trainingsmax", und das ist genau der
 * Tag, an dem der Zyklus mit Woche 1 anfängt. Einen Zyklus vorzuziehen ist
 * damit keine Umgehung mehr, sondern ein Datum.
 */
export type Zyklusanker = { pushIndex: number; zyklus: number };

export function bankPosition(pushIndex: number, anker: Zyklusanker): BankPosition {
  const versatz = pushIndex - anker.pushIndex;

  // Vor dem Anfang dieses Zyklus: kein Bank-Tag, und die Woche steht auf 1.
  // So zeigt die Oberfläche einen Anfang statt einer negativen Woche.
  if (versatz < 0) return { art: "keiner", zyklus: anker.zyklus, woche: 1 };

  const bankIndex = Math.floor(versatz / 2);
  const woche = ((bankIndex % 4) + 1) as BankWoche;

  /* Die Zusatz-Einheit teilt sich Zyklus und Woche mit dem TM-Tag davor —
     Math.floor() rundet den ungeraden Versatz auf denselben Bank-Index ab.
     Das ist die Absicht: solange die Welle läuft, soll nicht mitten zwischen
     zwei Programmtagen die Woche umspringen. */
  const zyklus = anker.zyklus + Math.floor(bankIndex / 4);

  const art: BankTagArt =
    versatz % 2 === 0
      ? woche === 4 && istTestZyklus(zyklus)
        ? "test"
        : "tm"
      : /* In der Deload-Woche fällt die Zusatz-Einheit aus. 72,5 % lägen über
           jedem ihrer Sätze (40/50/60 %), und eine Woche, deren ganzer Sinn
           das Zurücknehmen ist, wäre damit die schwerere von beiden. */
        woche === 4
        ? "keiner"
        : "zusatz";

  return { art, zyklus, woche };
}

/** Ist das der leichte Tag direkt vor einem Testtag? Dann ohne Single. */
export function vorTest(position: BankPosition): boolean {
  return position.art === "zusatz" && position.woche === 3 && istTestZyklus(position.zyklus);
}

/** Wie viele Push-Tage ein voller Zyklus dauert: vier Wochen à zwei. */
export const PUSH_TAGE_JE_ZYKLUS = 8;

/** Der Push-Tag, an dem der AMRAP-Satz eines Zyklus liegt — Woche 3. */
export function amrapPushIndex(ankerPushIndex: number): number {
  return ankerPushIndex + 4;
}

export type TmEntscheidung = {
  tmNeu: number;
  richtung: "hoch" | "bleibt" | "zurueck";
  begruendung: string;
};

/**
 * Wie geht es nach einem Zyklus mit dem Trainingsmax weiter?
 *
 * Wendlers Regel ist: erreicht der AMRAP-Satz die Sollwiederholungen, steigt
 * der Trainingsmax; sonst nicht. Dazu kommt hier ein zweiter Abgleich, der
 * bei Wendler nur als Erfahrungsregel steht — Kadenz misst ihn.
 *
 * Verglichen wird gegen den Trainingsmax selbst, nicht gegen das Maximum, das
 * er behauptet (tm / 0,9). Der Unterschied ist der ganze Sinn der Sache: der
 * Trainingsmax soll mit Abstand UNTER dem liegen, was einmal geht. Gegen
 * tm / 0,9 zu prüfen hieße zu verlangen, dass jeder AMRAP-Satz das volle
 * Maximum bestätigt — drei saubere Wiederholungen bei 95 % ergäben rechnerisch
 * gut 94 kg gegen einen Anspruch von 100 kg und lösten einen Reset aus,
 * obwohl der Satz gut lief.
 *
 * Fällt das geschätzte Maximum dagegen unter den Trainingsmax, ist der zu
 * hoch angesetzt: dann steht im Plan ein Gewicht, das gar nicht mehr einmal
 * geht, und sämtliche Prozente darunter sind zu schwer.
 */
export function naechsterTm(
  tmAlt: number,
  amrapSatz: SetLog | null,
  sollWdh: number
): TmEntscheidung {
  if (amrapSatz === null) {
    return {
      tmNeu: tmAlt,
      richtung: "bleibt",
      begruendung:
        "Kein AMRAP-Satz geloggt. Ohne den fehlt die Grundlage, den Trainingsmax zu " +
        "bewegen — er bleibt, bis wieder einer dasteht.",
    };
  }

  if (amrapSatz.reps < sollWdh) {
    return {
      tmNeu: tmAlt,
      richtung: "bleibt",
      begruendung:
        `Der AMRAP-Satz lief mit ${amrapSatz.reps} statt ${sollWdh} Wiederholungen. ` +
        `Der Trainingsmax bleibt bei ${komma(tmAlt, 1)} kg — noch ein Zyklus auf demselben Stand.`,
    };
  }

  const gemessen = e1rm(amrapSatz);

  if (gemessen === null) {
    return {
      tmNeu: tmAlt,
      richtung: "bleibt",
      begruendung:
        `${amrapSatz.reps} Wiederholungen sind zu viele, um daraus ein Maximum zu schätzen. ` +
        `Der Trainingsmax bleibt stehen — wenn das öfter vorkommt, ist er zu niedrig angesetzt.`,
    };
  }

  if (gemessen < tmAlt) {
    const tmNeu = aufZweiKommaFuenf(gemessen * TM_ANTEIL);
    return {
      tmNeu,
      richtung: "zurueck",
      begruendung:
        `Aus ${komma(amrapSatz.kg, 1)} kg × ${amrapSatz.reps} rechnet sich ein Maximum von ` +
        `${komma(gemessen, 1)} kg — weniger als der Trainingsmax von ${komma(tmAlt, 1)} kg. ` +
        `Der soll deutlich unter dem liegen, was einmal geht, nicht darüber. Zurück auf ` +
        `${komma(tmNeu, 1)} kg, damit die Prozente wieder stimmen.`,
    };
  }

  const tmNeu = tmAlt + TM_SCHRITT_KG;
  return {
    tmNeu,
    richtung: "hoch",
    begruendung:
      `${amrapSatz.reps} Wiederholungen bei ${komma(amrapSatz.kg, 1)} kg — Soll waren ` +
      `${sollWdh}. Trainingsmax ${komma(tmAlt, 1)} → ${komma(tmNeu, 1)} kg.`,
  };
}
