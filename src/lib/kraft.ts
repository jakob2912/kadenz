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
 * Tage dazwischen tragen einen submaximalen Zusatz-Slot (siehe
 * bankZusatzPlan()). Das ist ausdrücklich kein zweiter Programmtag — er rechnet
 * mit demselben Trainingsmax, verändert ihn aber nicht. Die Frequenz steigt von
 * gut einer auf gut zwei Bankeinheiten je Woche, der Zyklus bleibt 24 Tage.
 */

export const BANK_UEBUNG = "Bankdrücken";

/**
 * Die drei Bankdrück-Varianten, unter denen geloggt wird.
 *
 * Im Code und nicht im Katalog, aus demselben Grund wie BANK_UEBUNG darüber:
 * das 5/3/1 und der Bank-Tab rechnen mit genau diesen dreien, und ein
 * Tippfehler in einem Namen führt lautlos zu "keine Historie" statt zu einem
 * Fehler. Der Katalog bleibt trotzdem die Stelle, die entscheidet, ob und wann
 * eine davon im Plan steht — hier steht nur, wie sie zu lesen sind.
 *
 * "schwer" trennt die eine Variante, die den Trainingsmax bewegt, von den
 * beiden, die es ausdrücklich nicht tun. Der Bank-Tab beschriftet danach, und
 * naechsterTm() bekommt seinen AMRAP-Satz ohnehin nur aus BANK_UEBUNG.
 */
export const PRESSVARIANTEN = {
  [BANK_UEBUNG]: {
    kurz: "5/3/1",
    lang: "Schweres Bankdrücken",
    schwer: true,
    wann: "Push am TM-Tag, alle sechs Tage",
    ausfuehrung:
      "Wettkampfnah: Schulterblätter zusammen und unten, Füße fest am Boden, " +
      "Gesäß bleibt auf der Bank. Die Hantel berührt die Brust und geht ohne " +
      "Abfedern wieder hoch.",
    steuerung:
      "Gewicht aus dem Trainingsmax — 3 Sätze nach der Welle, der letzte auf " +
      "Maximalwiederholungen. Nur dieser Satz bewegt den Trainingsmax.",
  },
  "Paused Bench Press": {
    kurz: "Paused",
    lang: "Paused Bench Press",
    schwer: false,
    wann: "Push an der Einheit dazwischen",
    ausfuehrung:
      "Wie das schwere Bankdrücken, aber mit einer Sekunde Pause auf der " +
      "Brust — Hantel liegt still, Spannung bleibt, kein Abfedern. Danach " +
      "aus dem Stand heraus drücken.",
    steuerung:
      "Submaximal, mit Reserve. Das Gewicht kommt aus der eigenen Historie, " +
      "nicht aus dem Trainingsmax: acht Wiederholungen im ersten Satz heben " +
      "es um 2,5 kg, ein Satz unter fünf senkt es.",
  },
  "Spoto Press": {
    kurz: "Spoto",
    lang: "Spoto Press",
    schwer: false,
    wann: "Pull nach der leichten Push-Einheit",
    ausfuehrung:
      "Zwei bis drei Zentimeter über der Brust anhalten, kurz halten, ohne " +
      "abzusetzen wieder hochdrücken. Die Hantel berührt nie die Brust — " +
      "genau das ist der Zweck: kein Abfedern, keine Entlastung im " +
      "schwersten Punkt.",
    steuerung:
      "Zwei Sätze, submaximal, aus der eigenen Historie gesteuert. Kein " +
      "Auswertungssatz — der Tag soll Frequenz an der Hantel bringen, keine " +
      "Messung.",
  },
} as const;

export type Pressvariante = keyof typeof PRESSVARIANTEN;

export const PRESS_NAMEN = Object.keys(PRESSVARIANTEN) as Pressvariante[];

export function istPressvariante(name: string): name is Pressvariante {
  return name in PRESSVARIANTEN;
}

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
 * Der submaximale Zusatz-Slot an den Push-Einheiten zwischen zwei TM-Tagen.
 *
 * Feste Prozente statt einer eigenen Wellenrechnung: der Tag soll Übung und
 * Volumen bringen, nicht eine zweite Meinung darüber, wie schwer diese Woche
 * ist. 72,5 % liegen unter jedem AMRAP-Satz des Programms (85, 90, 95 %) und
 * damit im Bereich, in dem fünf Wiederholungen mit Reserve stehen — drei Tage
 * nach einer schweren Einheit und drei Tage vor der nächsten ist das der Zweck.
 * Der zweite Satz der Woche liegt je nach Welle bei 75 bis 85 %; die
 * Zusatz-Einheit bleibt darunter.
 *
 * Bewusst ohne AMRAP-Zeile: der AMRAP-Satz ist das Messinstrument des
 * Programms, und ein zweites Instrument an einem Tag, der den Trainingsmax
 * nicht bewegen darf, wäre nur eine Zahl, die niemand verwendet.
 */
export const ZUSATZ_PROZENT = 72.5;
export const ZUSATZ_SAETZE = 3;
export const ZUSATZ_WDH = 5;

export function bankZusatzPlan(tmKg: number): BankSatz[] {
  const satz = {
    prozent: ZUSATZ_PROZENT,
    wdh: ZUSATZ_WDH,
    amrap: false,
    kg: aufZweiKommaFuenf((tmKg * ZUSATZ_PROZENT) / 100),
  };
  return Array.from({ length: ZUSATZ_SAETZE }, () => ({ ...satz }));
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
 * "zusatz"  — die Push-Einheit dazwischen: submaximal, ohne Wirkung auf den
 *             Trainingsmax.
 * "keiner"  — vor dem Programmstart, und die Zusatz-Einheit der Deload-Woche.
 *
 * Ein Aufzählungstyp statt zweier Wahrheitswerte: mit istBankTag und
 * istZusatzTag nebeneinander gäbe es den Zustand "beides zugleich", den es
 * nicht gibt, und jede Stelle müsste selbst wissen, welcher der beiden
 * Vorrang hat.
 */
export type BankTagArt = "tm" | "zusatz" | "keiner";

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
  const art: BankTagArt =
    versatz % 2 === 0
      ? "tm"
      : /* In der Deload-Woche fällt die Zusatz-Einheit aus. 72,5 % lägen über
           jedem ihrer Sätze (40/50/60 %), und eine Woche, deren ganzer Sinn
           das Zurücknehmen ist, wäre damit die schwerere von beiden. */
        woche === 4
        ? "keiner"
        : "zusatz";

  return { art, zyklus: anker.zyklus + Math.floor(bankIndex / 4), woche };
}

/** Wie viele Push-Tage ein voller Zyklus dauert: vier Wochen à zwei. */
export const PUSH_TAGE_JE_ZYKLUS = 8;

/** Der Push-Tag, an dem der AMRAP-Satz eines Zyklus liegt — Woche 3. */
export function amrapPushIndex(ankerPushIndex: number): number {
  return ankerPushIndex + 4;
}

/**
 * Welche Ausprägung eine Einheit an einem Tag hat.
 *
 * Der Wunsch war "Push und Pull sollen an verschiedenen Wochentagen
 * unterschiedlich aussehen" — mit Montag, Mittwoch, Freitag, Samstag als
 * Beispiel. Der Wochentag taugt dafür nicht: Jakobs Rotation läuft alle drei
 * Tage (rotationFor()), also wandert jede Einheit durch die Woche. Über vier
 * Wochen bekommt jeder Wochentag jede Einheit einmal; ein Montagsfeld hätte
 * die Übung mal am richtigen, mal am falschen Tag gezeigt.
 *
 * Was tatsächlich abwechselt — und was Jakob mit "Montag" und "Freitag"
 * gemeint hat —, ist die Position in der 5/3/1-Welle. Seine eigenen Logs
 * zeigen es: Fr, 28.08. war Woche 2 mit 62,5/72,5/80 kg, Mo, 31.08. lief bei
 * dreimal 65 kg, Do, 03.09. war Woche 3. Schwer und leicht wechseln sich seit
 * dem 27.08.2026 ab, nur hießen beide bisher "Bankdrücken".
 *
 * Die fünf Werte:
 *   "schwer" — Push am TM-Tag. Langhantel-Bankdrücken nach der Welle.
 *   "leicht" — Push dazwischen. Paused Bench Press, submaximal.
 *   "ohne"   — Push ohne Presse: die Zusatz-Einheit der Deload-Woche. Die
 *              Woche ist zum Zurücknehmen da, siehe bankPosition().
 *   "presse" — Pull nach einem leichten Push-Tag. Spoto Press, zwei Sätze.
 *   "rein"   — Pull ohne Presse.
 *
 * Warum die Spoto Press ausgerechnet auf das Pull nach dem LEICHTEN Push-Tag
 * fällt: so hat Jakob es beschrieben (Mittwoch mit, Samstag ohne), und in
 * seinem Kalender lag der Mittwoch, 26.08. hinter einer leichten Einheit, der
 * Samstag, 29.08. hinter dem schweren TM-Tag. Es ist außerdem die Anordnung,
 * die trainingsseitig aufgeht — am Tag nach der schwersten Bankeinheit kommt
 * nichts Zusätzliches auf die Brust.
 *
 * Dass die Deload-Woche dabei von selbst leer ausgeht, ist kein Zufall,
 * sondern folgt aus bankPosition(): dort ist die Zusatz-Einheit der vierten
 * Woche "keiner", und ein Pull ohne vorangegangenen Zusatz-Tag ist "rein".
 */
export type Variante = "schwer" | "leicht" | "ohne" | "presse" | "rein";

export function varianteFuer(einheit: "push" | "pull", position: BankPosition): Variante {
  if (einheit === "push") {
    if (position.art === "tm") return "schwer";
    if (position.art === "zusatz") return "leicht";
    return "ohne";
  }

  return position.art === "zusatz" ? "presse" : "rein";
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
