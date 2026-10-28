/**
 * Kadenz — Bank-Coach
 *
 * Rein und ohne Datenbank, wie kraft.ts und bankziel.ts: hier steht die
 * Rechnung, die Zahlen holen bankuebersicht.ts und der MCP-Server.
 *
 * Zwei Fragen, die der Bank-Tab bisher offenließ:
 *
 *   - Läuft das Bankdrücken, steht es oder geht es zurück — und wenn es
 *     steht, was ist im Rahmen des 5/3/1 der nächste Schritt?
 *   - Wann wären 140 kg erreicht, wenn es so weitergeht wie zuletzt, und wie
 *     schnell müsste es gehen, damit es Ende 2027 klappt?
 *
 * Die Treppe in bankziel.ts beantwortet etwas anderes: den Bestfall des
 * Programms, wenn jeder Zyklus gelingt. Hier wird gemessen, nicht geplant.
 */

import {
  BANK_UEBUNG,
  aufZweiKommaFuenf,
  bankPlan,
  e1rm,
  e1rmReihe,
  kraftTrend,
  schaetzungAus,
  SINGLE_PROZENT,
  TM_ANTEIL,
  TM_SCHRITT_KG,
  type GeloggterSatz,
  type KraftUrteil,
} from "./kraft";
import { ZIEL_DATUM, ZIEL_KG } from "./bankziel";

/**
 * Wie weit der Coach zurückschaut: acht Wochen.
 *
 * Gut zwei Zyklen à 21 bis 28 Tage. Kürzer, und es stehen kaum vier schwere
 * Tage im Fenster (kraftTrend() verlangt vier); länger, und ein Stillstand
 * der letzten Wochen verschwindet hinter einem guten Sommer. Dieselbe Spanne
 * wie SCHAETZUNG_TAGE für den Testtag.
 */
export const COACH_FENSTER_TAGE = 56;

/**
 * Unter diesem Anteil am Trainingsmax ist ein Tag kein schwerer Tag.
 *
 * Deload (60 % × 5) und ein leichter Tag ohne Single (72,5 % × 5) landen
 * rechnerisch bei 70 bzw. knapp 85 % vom Trainingsmax. Die Sätze der Welle
 * liegen bei 95 bis 99 % — auch ein AMRAP-Satz, der sein Soll um zwei
 * Wiederholungen verfehlt (85 % × 3), steht noch bei 93 %.
 */
const MIN_ANTEIL_SCHWERER_TAG = 0.9;

/**
 * Ein Single unter diesem Anteil ist der Single vom leichten Tag.
 *
 * Der liegt bei SINGLE_PROZENT (90 %). Der AMRAP-Satz der Woche 3 steht bei
 * 95 % — erst ab dort ist ein einzelner Wiederholungssatz eine Aussage über
 * das Maximum.
 */
const SINGLE_GRENZE = (SINGLE_PROZENT + 5) / 100;

export type TmEintrag = { tmKg: number; gueltigAb: string };

function tmAm(datum: string, historie: readonly TmEintrag[]): number | null {
  let best: TmEintrag | null = null;
  for (const h of historie) {
    if (h.gueltigAb <= datum && (best === null || h.gueltigAb > best.gueltigAb)) best = h;
  }
  return best?.tmKg ?? null;
}

/**
 * Nur die schweren Bank-Tage.
 *
 * Bankdrücken steht an jeder Push-Einheit, aber nur jede zweite trägt die
 * Welle mit dem Satz auf Maximalwiederholungen. Die dazwischen läuft 3 × 5
 * bei 72,5 % plus ein Single bei 90 % — und dieser Single ist der beste Satz
 * des Tages, rund 88 kg gegen 99 bis 102 kg an den schweren Tagen. Beide
 * Sorten Tage in einer Reihe ergeben eine Säge, deren Mittelwert flach ist:
 * bis Oktober 2026 stand deshalb "steht, −0,7 %" da, während der schwere Satz
 * von 96 auf 102 kg gestiegen war.
 *
 * Erkannt wird am besten Satz des Tages gegen den Trainingsmax, der an dem
 * Tag galt — nicht am Kalender. Den Kalender kennt bankPosition() zwar, aber
 * nur ab dem Anker des laufenden Zyklus; die Wochen davor rückwirkend
 * nachzurechnen hieße, jede Verschiebung der Wochenschalter mitzuführen. Die
 * Sätze selbst sagen es eindeutiger:
 *
 *   - schwerster Satz ein Single unter 95 % vom Trainingsmax → leichter Tag.
 *     Der schwerste nach Gewicht, nicht nach Schätzung: bei niedrigem
 *     Trainingsmax rechnen sich die Fünfer des leichten Tags höher als der
 *     Single, und der Tag sähe sonst schwer aus.
 *   - bestes geschätztes Maximum unter 90 % vom Trainingsmax → Deload oder
 *     leichter Tag ohne Single
 *
 * Tage vor dem ersten Trainingsmax bleiben drin: ohne Bezugsgröße lässt sich
 * nichts unterscheiden, und weglassen hieße, Daten zu verwerfen.
 */
export function schwereBankTage(
  saetze: readonly GeloggterSatz[],
  historie: readonly TmEintrag[]
): GeloggterSatz[] {
  const proTag = new Map<string, GeloggterSatz[]>();
  for (const s of saetze) {
    const liste = proTag.get(s.datum);
    if (liste) liste.push(s);
    else proTag.set(s.datum, [s]);
  }

  const out: GeloggterSatz[] = [];
  for (const [datum, liste] of proTag) {
    const tm = tmAm(datum, historie);
    if (tm === null) {
      out.push(...liste);
      continue;
    }

    let schwerster: GeloggterSatz | null = null;
    let bestWert = -Infinity;
    for (const s of liste) {
      if (s.sauber === false) continue;
      const wert = e1rm(s);
      if (wert === null) continue;
      if (wert > bestWert) bestWert = wert;
      if (schwerster === null || s.kg > schwerster.kg) schwerster = s;
    }
    if (schwerster === null) continue;

    const leichterSingle = schwerster.reps === 1 && schwerster.kg < tm * SINGLE_GRENZE;
    const zuLeicht = bestWert < tm * MIN_ANTEIL_SCHWERER_TAG;
    if (!leichterSingle && !zuLeicht) out.push(...liste);
  }

  return out.sort((a, b) => a.datum.localeCompare(b.datum));
}

/**
 * Die Sätze, aus denen der Trend einer Übung gerechnet wird.
 *
 * Für jede Übung alle — außer Bankdrücken, dort nur die schweren Tage
 * (schwereBankTage()). Eine Stelle, damit Kraftverlauf, Übungsseite und
 * MCP-Server dasselbe Urteil fällen.
 */
export function trendSaetze(
  uebung: string,
  saetze: GeloggterSatz[],
  bankTmHistorie: readonly TmEintrag[]
): GeloggterSatz[] {
  return uebung === BANK_UEBUNG ? schwereBankTage(saetze, bankTmHistorie) : saetze;
}

export function trendSaetzeProUebung(
  proUebung: Record<string, GeloggterSatz[]>,
  bankTmHistorie: readonly TmEintrag[]
): Record<string, GeloggterSatz[]> {
  const out: Record<string, GeloggterSatz[]> = {};
  for (const [uebung, saetze] of Object.entries(proUebung)) {
    out[uebung] = trendSaetze(uebung, saetze, bankTmHistorie);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Stillstand
// ─────────────────────────────────────────────────────────────

export type CoachLage = "laeuft" | "steht" | "faellt" | "unklar";

export type CoachVorschlag =
  | { art: "weiter"; text: string }
  | { art: "abwarten"; text: string }
  /** Der Trainingsmax liegt über dem, was die Sätze tragen — 5/3/1-Reset. */
  | { art: "tm_zurueck"; tmNeuKg: number; text: string }
  /** Trainingsmax passt, es fehlt Reiz: First Set Last. */
  | { art: "volumen"; fslKg: Record<1 | 2 | 3, number>; text: string }
  /** Trainingsmax passt, die Kraft geht trotzdem zurück: Erholung. */
  | { art: "erholung"; text: string };

export type Bankcoach = {
  lage: CoachLage;
  /** Erster Tag des ausgewerteten Fensters. */
  abIso: string;
  /** Wie viele schwere Tage im Fenster lagen — die leichten zählen nicht. */
  schwereTage: number;
  urteil: KraftUrteil;
  /** Bestes geschätztes Maximum der schweren Tage im Fenster. */
  schaetzungKg: number | null;
  tmKg: number | null;
  /** Trainingsmax ÷ geschätztes Maximum. 5/3/1 will 0,85 bis 0,90. */
  tmAnteil: number | null;
  vorschlag: CoachVorschlag;
};

function plusTage(iso: string, tage: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + tage * 864e5).toISOString().slice(0, 10);
}

function tageZwischen(vonIso: string, bisIso: string): number {
  return Math.round(
    (Date.parse(`${bisIso}T00:00:00Z`) - Date.parse(`${vonIso}T00:00:00Z`)) / 864e5
  );
}

function zahl(n: number, stellen = 1): string {
  const s = n.toFixed(stellen);
  return s.endsWith(",0") ? s.slice(0, -2) : s;
}

/**
 * Läuft das Bankdrücken — und was tun, wenn nicht?
 *
 * Die Regeln, in dieser Reihenfolge:
 *
 *   1. Kein verwertbarer Trend → abwarten, nach Plan weiter.
 *   2. Steigt → nichts ändern. Das Programm tut, wofür es da ist.
 *   3. Steht oder fällt, und der Trainingsmax liegt mehr als eine Stufe
 *      (2,5 kg) über 90 % des geschätzten Maximums → zurücksetzen auf 90 %
 *      davon. Das ist Wendlers Antwort auf einen Stillstand, und dieselbe
 *      Rechnung, die naechsterTm() nach einem verfehlten AMRAP-Satz macht:
 *      ein zu hoher Trainingsmax macht jeden Prozentsatz darunter zu schwer,
 *      und dann trägt kein AMRAP-Satz mehr Wiederholungen über dem Soll.
 *   4. Steht, Trainingsmax passt → First Set Last: nach dem AMRAP-Satz 5 × 5
 *      mit dem Gewicht des ersten Satzes. Mehr Volumen unter der Welle,
 *      ohne den Trainingsmax anzufassen.
 *   5. Fällt, Trainingsmax passt → Erholung vor Volumen: Trainingsmax
 *      halten, keine Zusatzsätze, den Single am leichten Tag weglassen.
 *
 * Joker-Sätze (schwerere Singles oder Triples nach dem AMRAP-Satz) schlägt
 * der Coach bewusst nicht vor: Kadenz liest als AMRAP-Satz den schwersten
 * Satz des TM-Tags (amrapSatzVon() in bank.ts). Ein Joker wäre damit der
 * Satz, aus dem der nächste Trainingsmax entsteht — mit weniger
 * Wiederholungen als das Soll, und der Trainingsmax bliebe stehen.
 *
 * Ein Vorschlag, keine Änderung: gesetzt wird der Trainingsmax weiter nur
 * über bank_tm_setzen bzw. den Bank-Tab.
 */
export function bankcoach(eingabe: {
  saetze: readonly GeloggterSatz[];
  tmHistorie: readonly TmEintrag[];
  tmKg: number | null;
  heuteIso: string;
  /** Neustart fürs Bankdrücken, falls gesetzt. */
  neustartAb?: string;
}): Bankcoach {
  const fensterAb = plusTage(eingabe.heuteIso, -COACH_FENSTER_TAGE);
  const abIso =
    eingabe.neustartAb && eingabe.neustartAb > fensterAb ? eingabe.neustartAb : fensterAb;

  const imFenster = eingabe.saetze.filter((s) => s.datum >= abIso && s.datum <= eingabe.heuteIso);
  const schwer = schwereBankTage(imFenster, eingabe.tmHistorie);
  const reihe = e1rmReihe(schwer);
  const urteil = kraftTrend(reihe, abIso === eingabe.neustartAb ? abIso : undefined);

  const schaetzungKg = schaetzungAus(schwer);
  const tmKg = eingabe.tmKg;
  const tmAnteil = tmKg !== null && schaetzungKg !== null ? tmKg / schaetzungKg : null;

  const basis = {
    abIso,
    schwereTage: reihe.length,
    urteil,
    schaetzungKg,
    tmKg,
    tmAnteil,
  };

  if (!urteil.verwertbar) {
    return {
      ...basis,
      lage: "unklar",
      vorschlag: {
        art: "abwarten",
        text:
          `Für ein Urteil zu wenig schwere Tage: ${urteil.grund} Bis dahin nach Plan ` +
          `weiter — gezählt werden nur die Tage mit der Welle, nicht die leichten dazwischen.`,
      },
    };
  }

  const lage: CoachLage =
    urteil.richtung === "steigt" ? "laeuft" : urteil.richtung === "faellt" ? "faellt" : "steht";

  if (lage === "laeuft") {
    return {
      ...basis,
      lage,
      vorschlag: {
        art: "weiter",
        text:
          `Die schweren Tage legen zu — ${zahl(urteil.prozentPro4Wochen)} % auf vier Wochen, ` +
          `von ${zahl(urteil.von)} auf ${zahl(urteil.auf)} kg geschätztes Maximum. ` +
          `Nichts ändern, das Programm tut, wofür es da ist.`,
      },
    };
  }

  const wie =
    lage === "steht"
      ? `Die schweren Tage stehen seit ${urteil.spanneTage} Tagen (${zahl(urteil.prozentPro4Wochen)} % auf vier Wochen).`
      : `Die schweren Tage gehen zurück — ${zahl(Math.abs(urteil.prozentPro4Wochen))} % auf vier Wochen über ${urteil.spanneTage} Tage.`;

  if (tmKg !== null && schaetzungKg !== null) {
    const passend = schaetzungKg * TM_ANTEIL;
    if (tmKg - passend > TM_SCHRITT_KG) {
      const tmNeuKg = aufZweiKommaFuenf(passend);
      return {
        ...basis,
        lage,
        vorschlag: {
          art: "tm_zurueck",
          tmNeuKg,
          text:
            `${wie} Der Trainingsmax von ${zahl(tmKg)} kg behauptet ein Maximum von ` +
            `${zahl(tmKg / TM_ANTEIL)} kg, die schweren Sätze der letzten Wochen tragen ` +
            `${zahl(schaetzungKg)} kg. 5/3/1 rechnet mit 90 % davon, also ${zahl(tmNeuKg)} kg. ` +
            `Wendlers Antwort auf einen Stillstand ist der Reset: mit ${zahl(tmNeuKg)} kg neu ` +
            `ansetzen, dann tragen die AMRAP-Sätze wieder Wiederholungen über dem Soll. ` +
            `Gesetzt wird erst nach deinem Ja.`,
        },
      };
    }

    if (lage === "steht") {
      const fslKg = {
        1: bankPlan(tmKg, 1)[0].kg,
        2: bankPlan(tmKg, 2)[0].kg,
        3: bankPlan(tmKg, 3)[0].kg,
      };
      return {
        ...basis,
        lage,
        vorschlag: {
          art: "volumen",
          fslKg,
          text:
            `${wie} Der Trainingsmax passt zu den Sätzen (${Math.round((tmAnteil ?? 0) * 100)} % ` +
            `vom geschätzten Maximum), also fehlt Reiz, nicht Erholung. Trainingsmax halten und ` +
            `am TM-Tag nach dem AMRAP-Satz 5 × 5 mit dem Gewicht des ersten Satzes anhängen ` +
            `(First Set Last): ${zahl(fslKg[1])} kg in Woche 1, ${zahl(fslKg[2])} kg in Woche 2, ` +
            `${zahl(fslKg[3])} kg in Woche 3. Keine Joker-Sätze — Kadenz liest den schwersten ` +
            `Satz des TM-Tags als AMRAP-Satz.`,
        },
      };
    }
  }

  return {
    ...basis,
    lage,
    vorschlag:
      lage === "steht"
        ? {
            art: "abwarten",
            text: `${wie} Ohne Trainingsmax lässt sich nicht sagen, ob er zu hoch liegt — erst eintragen.`,
          }
        : {
            art: "erholung",
            text:
              `${wie} Der Trainingsmax liegt nicht zu hoch, also eher Erholung als Programm: ` +
              `Trainingsmax halten, keine Zusatzsätze, den Single am leichten Tag weglassen, ` +
              `bis die schweren Tage wieder stehen. Schlaf und Kalorien prüfen — im Aufbau ` +
              `sollte die Kraft nicht fallen.`,
          },
  };
}

// ─────────────────────────────────────────────────────────────
// Hochrechnung auf 140 kg
// ─────────────────────────────────────────────────────────────

/**
 * Unter dieser Spanne ist die Hochrechnung ausdrücklich wackelig.
 *
 * Gerechnet wird trotzdem, sobald kraftTrend() verwertbar ist — aber aus
 * sieben Wochen auf vierzehn Monate hochzurechnen verzehnfacht jeden Fehler,
 * und das soll dastehen.
 */
const BELASTBAR_AB_TAGE = 56;

/** Weiter als zehn Jahre ist kein Datum, sondern "so nicht". */
const MAX_PROGNOSE_TAGE = 3650;

export type Prognose =
  | {
      verwertbar: true;
      /** Geschätztes Maximum jetzt — Mittel der jüngeren Hälfte der Reihe. */
      aktuellKg: number;
      /** Gemessenes Tempo. */
      kgPro4Wochen: number;
      prozentPro4Wochen: number;
      /** Wann 140 kg bei diesem Tempo stünden. Null: so nie oder nicht absehbar. */
      erreichtAm: string | null;
      imPlan: boolean;
      /** Was es bis zum Zieldatum bräuchte. */
      noetigKgProMonat: number;
      noetigProzentPro4Wochen: number;
      belastbar: boolean;
      text: string;
    }
  | { verwertbar: false; grund: string };

/**
 * Wann stünden 140 kg, wenn es so weitergeht?
 *
 * Eine Gerade durch das gemessene Tempo — anders als die Treppe in
 * bankziel.ts, die den Bestfall des Programms zeichnet. Die Gerade ist hier
 * richtig, weil sie nichts über das Programm behauptet, sondern nur
 * fortschreibt, was die schweren Tage zuletzt gezeigt haben. Kraftzuwachs
 * wird mit der Zeit langsamer; die Gerade ist deshalb eher zu optimistisch,
 * und auch das steht im Text.
 */
export function prognose140(urteil: KraftUrteil, heuteIso: string): Prognose {
  if (!urteil.verwertbar) {
    return {
      verwertbar: false,
      grund: `Keine Hochrechnung: ${urteil.grund}`,
    };
  }

  const aktuellKg = urteil.auf;
  const kgPro4Wochen = (urteil.von * urteil.prozentPro4Wochen) / 100;
  const restTage = Math.max(1, tageZwischen(heuteIso, ZIEL_DATUM));
  const fehlt = Math.max(0, ZIEL_KG - aktuellKg);
  const noetigKgProMonat = fehlt / (restTage / 30.44);
  const noetigProzentPro4Wochen = aktuellKg > 0 ? ((fehlt / restTage) * 28 * 100) / aktuellKg : 0;
  const belastbar = urteil.spanneTage >= BELASTBAR_AB_TAGE;

  let erreichtAm: string | null = null;
  if (fehlt === 0) {
    erreichtAm = heuteIso;
  } else if (kgPro4Wochen > 0) {
    const tage = Math.ceil(fehlt / (kgPro4Wochen / 28));
    if (tage <= MAX_PROGNOSE_TAGE) erreichtAm = plusTage(heuteIso, tage);
  }
  const imPlan = erreichtAm !== null && erreichtAm <= ZIEL_DATUM;

  const tempo = `Gemessen: ${zahl(kgPro4Wochen)} kg auf vier Wochen (${zahl(urteil.prozentPro4Wochen)} %), geschätztes Maximum derzeit ${zahl(aktuellKg)} kg.`;
  const noetig = `Für ${ZIEL_KG} kg bis Ende 2027 braucht es ${zahl(noetigKgProMonat)} kg im Monat, also ${zahl(noetigProzentPro4Wochen)} % auf vier Wochen.`;
  const wann =
    fehlt === 0
      ? `Das geschätzte Maximum liegt schon bei ${ZIEL_KG} kg — fehlt nur noch der saubere Single.`
      : erreichtAm === null
        ? kgPro4Wochen <= 0
          ? `Bei diesem Tempo kommen ${ZIEL_KG} kg nie — die schweren Tage steigen gerade nicht.`
          : `Bei diesem Tempo liegen ${ZIEL_KG} kg mehr als zehn Jahre entfernt.`
        : imPlan
          ? `Bei diesem Tempo stünden ${ZIEL_KG} kg um den ${erreichtAm.slice(8, 10)}.${erreichtAm.slice(5, 7)}.${erreichtAm.slice(0, 4)} — vor dem Zieldatum. Kraft wächst aber mit der Zeit langsamer; die Gerade ist eher zu optimistisch.`
          : `Bei diesem Tempo stünden ${ZIEL_KG} kg erst um den ${erreichtAm.slice(8, 10)}.${erreichtAm.slice(5, 7)}.${erreichtAm.slice(0, 4)} — nach dem Zieldatum.`;
  const vorsicht = belastbar
    ? ""
    : ` Vorsicht: gerechnet aus nur ${urteil.spanneTage} Tagen — auf ${Math.round(restTage / 30.44)} Monate hochgerechnet ist das eine grobe Richtung, keine Vorhersage.`;

  return {
    verwertbar: true,
    aktuellKg,
    kgPro4Wochen,
    prozentPro4Wochen: urteil.prozentPro4Wochen,
    erreichtAm,
    imPlan,
    noetigKgProMonat,
    noetigProzentPro4Wochen,
    belastbar,
    text: `${wann} ${tempo} ${noetig}${vorsicht}`,
  };
}
