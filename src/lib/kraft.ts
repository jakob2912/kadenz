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
 * Bank-Tag, und Bank-Tag ist jede zweite Push-Einheit. Damit liegen sechs Tage
 * zwischen zwei schweren Bankeinheiten und ein Zyklus dauert 24 Tage.
 *
 * Warum nicht jede Push-Einheit: dann wäre der Zyklus in zwölf Tagen durch und
 * der Trainingsmax stiege rechnerisch um sieben Kilogramm im Monat. Das hält
 * niemand, und der AMRAP-Reset müsste ihn dauernd wieder einfangen.
 */

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

/** Der AMRAP-Satz der Woche, falls es einen gibt. */
export function amrapSoll(woche: BankWoche): { prozent: number; wdh: number } | null {
  const satz = WOCHEN[woche].find((s) => s.amrap);
  return satz ? { prozent: satz.prozent, wdh: satz.wdh } : null;
}

export type BankPosition = {
  istBankTag: boolean;
  /** Fortlaufend ab 1. Nur bei istBankTag aussagekräftig. */
  zyklus: number;
  woche: BankWoche;
};

/**
 * Wo im Programm steht ein Push-Tag?
 *
 * Rechnet ausdrücklich aus dem Kalender, nicht aus geloggten Einheiten:
 * trainingBeenden() wird von keiner Oberfläche aufgerufen, Workout.finishedAt
 * ist auf jeder Zeile NULL. Ein Zyklus, der an abgeschlossenen Einheiten
 * hinge, käme nie voran. Nachteil dieser Wahl, bewusst in Kauf genommen: wer
 * eine Einheit ausfallen lässt, überspringt die Programmwoche mit.
 *
 * Gezählt wird ab `startPushIndex` — dem ersten Push-Tag, an dem das Programm
 * lief. Nicht ab dem Rotationsanker: die Push-Pull-Rotation läuft seit dem
 * 15.08.2026, das Bankprogramm fängt später an. Ohne diesen Versatz wäre die
 * allererste Bankeinheit je nach Startdatum mitten im Zyklus gelandet, und
 * der erste Satz Bankdrücken überhaupt liefe mit 90 oder 95 Prozent.
 */
export function bankPosition(pushIndex: number, startPushIndex: number): BankPosition {
  const versatz = pushIndex - startPushIndex;

  // Vor dem Programmstart: kein Bank-Tag, und der Zyklus steht auf seinem
  // Anfang. So zeigt die Oberfläche "Zyklus 1, Woche 1" statt einer
  // negativen Woche.
  if (versatz < 0) return { istBankTag: false, zyklus: 1, woche: 1 };

  const bankIndex = Math.floor(versatz / 2);

  return {
    istBankTag: versatz % 2 === 0,
    zyklus: Math.floor(bankIndex / 4) + 1,
    woche: ((bankIndex % 4) + 1) as BankWoche,
  };
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
