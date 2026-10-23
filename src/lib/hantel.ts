/**
 * Kadenz — Langhantel: Aufwärmen
 *
 * Rein und ohne Datenbank. Die Aufwärmtreppe vor dem ersten Arbeitssatz,
 * wie Strong, Hevy und Liftoff sie anbieten. Einen Scheibenrechner gab es
 * hier kurz auch — Jakob braucht ihn nicht, er ist am 23.10.2026 wieder
 * rausgeflogen.
 */

/** Olympische Stange — das, was im Gym auf der Bank liegt. */
export const STANGE_KG = 20;

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
