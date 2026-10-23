/**
 * Kadenz — Bestwerte
 *
 * Rein und ohne Datenbank. Drei Arten, wie Strong und Hevy sie auch
 * unterscheiden, weil jede eine andere Frage beantwortet:
 *
 *   - Gewicht: so schwer wie noch nie, egal wie oft.
 *   - Wiederholungen: bei diesem Gewicht (oder schwerer) noch nie so oft —
 *     aber nur jenseits von zehn Wiederholungen, wo das geschätzte Maximum
 *     nicht mehr rechnet. Das ist der lange AMRAP-Satz beim 5/3/1. Darunter
 *     wäre bei Jakobs Doppelprogression (5–8 Wiederholungen, dann +2,5 kg)
 *     fast jede gute Einheit ein "Bestwert", und das Abzeichen sagte nichts
 *     mehr.
 *   - Geschätztes Maximum (Epley): rechnet Gewicht und Wiederholungen
 *     zusammen. Fängt den Fall, dass mehr Gewicht mit weniger
 *     Wiederholungen insgesamt stärker war.
 *
 * Vorher gab es nur die dritte Art — und e1rm() schätzt oberhalb von zehn
 * Wiederholungen bewusst nicht mehr. Ausgerechnet ein starker AMRAP mit zwölf
 * Wiederholungen war damit nie ein Bestwert.
 */

import { e1rm } from "./kraft";

export type Bestwert = {
  /** Bestes geschätztes Maximum, null wenn kein Satz eines hergibt. */
  e1rm: number | null;
  schwersterKg: number;
  /** Je Gewicht die meisten Wiederholungen, schwerstes Gewicht zuerst. */
  wdhJeKg: [kg: number, wdh: number][];
};

export type BestwertArt = "gewicht" | "wdh" | "e1rm";

export const BESTWERT_TEXT: Record<BestwertArt, string> = {
  gewicht: "schwerstes Gewicht",
  wdh: "meiste Wiederholungen",
  e1rm: "geschätztes Maximum",
};

/** Aus den bisherigen Sätzen einer Übung. Null, wenn es keine gibt. */
export function bestwertAus(saetze: readonly { kg: number; reps: number }[]): Bestwert | null {
  const gueltig = saetze.filter((s) => s.kg > 0 && s.reps >= 1);
  if (gueltig.length === 0) return null;

  let bestE1rm: number | null = null;
  const jeKg = new Map<number, number>();
  for (const s of gueltig) {
    const wert = e1rm(s);
    if (wert !== null && (bestE1rm === null || wert > bestE1rm)) bestE1rm = wert;
    jeKg.set(s.kg, Math.max(jeKg.get(s.kg) ?? 0, s.reps));
  }

  return {
    e1rm: bestE1rm,
    schwersterKg: Math.max(...gueltig.map((s) => s.kg)),
    wdhJeKg: [...jeKg].sort((a, b) => b[0] - a[0]),
  };
}

/** Kleiner Abstand, damit 0,1 kg Rundungsrauschen kein Rekord ist. */
const EPS = 0.01;

/**
 * Ist dieser Satz ein Bestwert, und wenn ja welcher Art?
 *
 * Ohne bisherige Sätze nie: der erste Satz einer neuen Übung ist kein
 * Rekord, sondern der Anfang.
 */
export function bestwertArt(
  satz: { kg: number; reps: number },
  bisher: Bestwert | null | undefined
): BestwertArt | null {
  if (!bisher || satz.kg <= 0 || satz.reps < 1) return null;

  if (satz.kg > bisher.schwersterKg + EPS) return "gewicht";

  // Die meisten Wiederholungen, die je bei mindestens diesem Gewicht standen.
  // Mehr Wiederholungen bei leichterem Gewicht zählen nicht dagegen.
  const wert = e1rm(satz);
  if (wert !== null && bisher.e1rm !== null && wert > bisher.e1rm + EPS) return "e1rm";

  // Oberhalb der Schätzgrenze gibt es kein Maximum zu vergleichen — dort
  // zählen die Wiederholungen selbst.
  if (wert === null) {
    const vergleich = bisher.wdhJeKg.filter(([kg]) => kg >= satz.kg - EPS).map(([, wdh]) => wdh);
    if (vergleich.length > 0 && satz.reps > Math.max(...vergleich)) return "wdh";
  }

  return null;
}

/** Zum Vergleichen zweier Rekord-Sätze derselben Übung: welcher ist stärker? */
export function staerke(satz: { kg: number; reps: number }): number {
  return e1rm(satz) ?? satz.kg * (1 + satz.reps / 30);
}

/**
 * Wie viele Wiederholungen bei diesem Gewicht ein Bestwert wären — für den
 * AMRAP-Satz, bevor er gehoben ist. Null, wenn es keine Historie gibt oder
 * selbst dreißig Wiederholungen nicht reichten (dann ist das Gewicht für
 * diese Frage zu leicht).
 */
export function wdhFuerBestwert(kg: number, bisher: Bestwert | null | undefined): number | null {
  if (!bisher || kg <= 0) return null;
  for (let wdh = 1; wdh <= 30; wdh++) {
    if (bestwertArt({ kg, reps: wdh }, bisher) !== null) return wdh;
  }
  return null;
}
