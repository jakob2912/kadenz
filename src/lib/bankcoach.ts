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
  return s.endsWith(".0") ? s.slice(0, -2) : s;
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
          `Too few heavy days for a verdict: ${urteil.grund} Until then keep following the plan ` +
          `— only the days with the wave count, not the light days in between.`,
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
          `The heavy days are improving — ${zahl(urteil.prozentPro4Wochen)} % over four weeks, ` +
          `from ${zahl(urteil.von)} to ${zahl(urteil.auf)} kg estimated max. ` +
          `Change nothing, the program is doing its job.`,
      },
    };
  }

  const wie =
    lage === "steht"
      ? `The heavy days have stalled for ${urteil.spanneTage} days (${zahl(urteil.prozentPro4Wochen)} % over four weeks).`
      : `The heavy days are going down — ${zahl(Math.abs(urteil.prozentPro4Wochen))} % over four weeks across ${urteil.spanneTage} days.`;

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
            `${wie} The training max of ${zahl(tmKg)} kg implies a max of ` +
            `${zahl(tmKg / TM_ANTEIL)} kg; the heavy sets of recent weeks support ` +
            `${zahl(schaetzungKg)} kg. 5/3/1 works with 90 % of that, i.e. ${zahl(tmNeuKg)} kg. ` +
            `Wendler's answer to a stall is the reset: start again at ${zahl(tmNeuKg)} kg, ` +
            `and the AMRAP sets carry reps above target again. ` +
            `Only set after your yes.`,
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
            `${wie} The training max fits the sets (${Math.round((tmAnteil ?? 0) * 100)} % ` +
            `of the estimated max), so it's missing stimulus, not recovery. Keep the training max and ` +
            `on TM day add 5 × 5 with the first set's weight after the AMRAP set ` +
            `(First Set Last): ${zahl(fslKg[1])} kg in week 1, ${zahl(fslKg[2])} kg in week 2, ` +
            `${zahl(fslKg[3])} kg in week 3. No joker sets — Kadenz reads the heaviest ` +
            `set of the TM day as the AMRAP set.`,
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
            text: `${wie} Without a training max there's no telling whether it's too high — enter it first.`,
          }
        : {
            art: "erholung",
            text:
              `${wie} The training max isn't too high, so it's recovery rather than the program: ` +
              `keep the training max, no extra sets, skip the single on the light day ` +
              `until the heavy days hold again. Check sleep and calories — in a bulk ` +
              `strength shouldn't drop.`,
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
      grund: `No projection: ${urteil.grund}`,
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

  const tempo = `Measured: ${zahl(kgPro4Wochen)} kg over four weeks (${zahl(urteil.prozentPro4Wochen)} %), estimated max currently ${zahl(aktuellKg)} kg.`;
  const noetig = `${ZIEL_KG} kg by the end of 2027 needs ${zahl(noetigKgProMonat)} kg per month, i.e. ${zahl(noetigProzentPro4Wochen)} % over four weeks.`;
  const wann =
    fehlt === 0
      ? `The estimated max is already at ${ZIEL_KG} kg — only the clean single is missing.`
      : erreichtAm === null
        ? kgPro4Wochen <= 0
          ? `At this pace ${ZIEL_KG} kg never comes — the heavy days aren't rising right now.`
          : `At this pace ${ZIEL_KG} kg is more than ten years away.`
        : imPlan
          ? `At this pace ${ZIEL_KG} kg would come around ${erreichtAm.slice(8, 10)}/${erreichtAm.slice(5, 7)}/${erreichtAm.slice(0, 4)} — before the target date. Strength grows more slowly over time though; the straight line is rather optimistic.`
          : `At this pace ${ZIEL_KG} kg would only come around ${erreichtAm.slice(8, 10)}/${erreichtAm.slice(5, 7)}/${erreichtAm.slice(0, 4)} — after the target date.`;
  const vorsicht = belastbar
    ? ""
    : ` Careful: calculated from only ${urteil.spanneTage} days — projected over ${Math.round(restTage / 30.44)} months that's a rough direction, not a prediction.`;

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
