/**
 * Kadenz — Langhantel: Scheiben und Aufwärmen
 *
 * Rein und ohne Datenbank. Zwei Rechnungen, die jede Tracker-App im Gym
 * abnimmt (Strong, Hevy, Liftoff haben beide), und die beim Bankdrücken nach
 * 5/3/1 bei jedem Satz anfallen: das Programm gibt 77,5 kg vor, und welche
 * Scheiben das sind, rechnet man sonst zwischen zwei Sätzen im Kopf.
 */

/** Olympische Stange — das, was im Gym auf der Bank liegt. */
export const STANGE_KG = 20;

/**
 * Was üblicherweise an Scheiben im Ständer hängt, schwerste zuerst.
 *
 * 25er stehen nicht in jedem Gym; ohne sie wird aus 25 eben 20 + 5. Der
 * Rechner nimmt die schwersten zuerst, also immer so wenige Scheiben wie
 * möglich — weniger zum Aufstecken, und die Stange bleibt kurz.
 */
export const SCHEIBEN_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export type Beladung = {
  /** Scheiben je Seite, schwerste zuerst. */
  jeSeite: number[];
  /** Was mit dem Vorrat nicht genau aufgeht — 0 im Normalfall. */
  rest: number;
};

/**
 * Welche Scheiben für ein Gesamtgewicht auf jede Seite gehören.
 *
 * Null, wenn das Gewicht unter der leeren Stange liegt — dann ist es keine
 * Langhantel-Zahl, und ein "−2,5 je Seite" hilft niemandem.
 */
export function beladung(
  gesamtKg: number,
  stangeKg: number = STANGE_KG,
  vorrat: readonly number[] = SCHEIBEN_KG
): Beladung | null {
  if (!Number.isFinite(gesamtKg) || gesamtKg < stangeKg) return null;

  // In Hundertsteln rechnen: 1,25 ist binär nicht exakt, und nach ein paar
  // Subtraktionen bliebe sonst ein Rest von 0,0000001 kg stehen.
  let seite = Math.round(((gesamtKg - stangeKg) / 2) * 100);
  const jeSeite: number[] = [];
  for (const kg of vorrat) {
    const h = Math.round(kg * 100);
    while (seite >= h) {
      jeSeite.push(kg);
      seite -= h;
    }
  }
  return { jeSeite, rest: (seite * 2) / 100 };
}

/** "20 + 10 + 2,5" — oder "leere Stange". */
export function beladungText(b: Beladung): string {
  if (b.jeSeite.length === 0) return "leere Stange";
  return b.jeSeite.map((kg) => String(kg).replace(".", ",")).join(" + ");
}

export type Aufwaermsatz = { kg: number; wdh: number };

function aufZweiKommaFuenf(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

/**
 * Aufwärmsätze vor dem ersten Arbeitssatz.
 *
 * Die übliche Treppe: leere Stange × 10, dann 40 / 60 / 80 % des ersten
 * Arbeitsgewichts mit 5 / 3 / 2 Wiederholungen — nach oben immer weniger,
 * damit das Aufwärmen nicht schon ermüdet. Gerundet auf 2,5 kg, weil es
 * kleinere Sprünge im Ständer kaum gibt.
 *
 * Stufen, die nach dem Runden auf der Stange oder auf der vorigen Stufe
 * landen, fallen weg: bei 40 kg Arbeitsgewicht wären 40 % genau die Stange.
 * Und keine Stufe erreicht das Arbeitsgewicht selbst — das wäre schon ein
 * Arbeitssatz.
 */
export function aufwaermen(arbeitsKg: number, stangeKg: number = STANGE_KG): Aufwaermsatz[] {
  if (!Number.isFinite(arbeitsKg) || arbeitsKg <= stangeKg) return [];

  const saetze: Aufwaermsatz[] = [{ kg: stangeKg, wdh: 10 }];
  for (const [anteil, wdh] of [
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ] as const) {
    const kg = aufZweiKommaFuenf(arbeitsKg * anteil);
    if (kg <= saetze[saetze.length - 1].kg || kg >= arbeitsKg) continue;
    saetze.push({ kg, wdh });
  }
  return saetze;
}
