/**
 * Kadenz — Portionsgrößen zum Kalorienziel
 *
 * Wie kraft.ts und coach.ts: rein, kein I/O. Hier steht die Rechnung, die den
 * Ernährungsplan an das gültige Ziel bindet.
 *
 * Warum es dieses Modul überhaupt gibt: der Plan lag als feste Mengen in der
 * Datenbank, das Ziel als eigene Zeile daneben, und die beiden wussten
 * nichts voneinander. Wer einen Kalorienvorschlag annahm, sah danach 3400 kcal
 * über einem Plan, der weiterhin die Mengen für 3600 auflistete. Die Anpassung
 * war eine Zahl, kein Essen.
 *
 * Was hier NICHT passiert: eine Nährwertrechnung je Zutat. Kadenz hat keine
 * Nährwerttabelle, und sich eine auszudenken hieße, Jakobs Plan mit erfundenen
 * Zahlen zu überschreiben — dieselbe Haltung wie beim Trainingsmax, den die
 * App auch nicht schätzt. Skaliert wird stattdessen proportional: die
 * Kohlenhydratquellen des Plans tragen die Änderung gemeinsam, im Verhältnis
 * ihrer Mengen.
 */

/** Wie fein Mengen ausgewiesen werden. Ein Gramm genau wiegt niemand ab. */
const SCHRITT_G = 5;

/** Unter dieser Menge wird nicht mehr abgezogen — sonst verschwindet die Zutat. */
const MIN_G = 5;

/**
 * Wie weit die Skalierung höchstens geht.
 *
 * Ein Ziel, das um mehr als die Hälfte vom Ausgangsplan abweicht, ist kein
 * angepasster Plan mehr, sondern ein anderer. Dann bleibt die Menge an der
 * Grenze stehen und der Hinweis sagt, dass der Plan neu gerechnet gehört —
 * statt lautlos 40 g Reis auszuweisen.
 */
const FAKTOR_MIN = 0.5;
const FAKTOR_MAX = 1.5;

export type ZutatMengen = {
  /** Was im Plan von Fitnessbell steht. */
  mengeLautPlan: number;
  /** Was heute gilt. Gleich mengeLautPlan, wenn nicht skaliert wird. */
  menge: number;
  einheit: string;
  anpassbar: boolean;
};

export type Skalierung = {
  faktor: number;
  basisKhG: number;
  zielKhG: number;
  /** Nur gesetzt, wenn der Faktor an die Grenze gestoßen ist. */
  hinweis: string | null;
};

/**
 * Der Faktor, mit dem die Kohlenhydratquellen des Plans laufen.
 *
 * Gerechnet wird über die Kohlenhydrate, nicht über die Kalorien: der Coach
 * bewegt ausschließlich sie (siehe kalorienAnpassung() in coach.ts, Eiweiß und
 * Fett bleiben stehen). Über die Kalorien zu skalieren würde Reis und Whey
 * gleichermaßen kürzen und damit genau das Eiweiß wegnehmen, das ausdrücklich
 * bleiben soll.
 */
export function skalierung(basisKhG: number, zielKhG: number): Skalierung | null {
  if (!Number.isFinite(basisKhG) || basisKhG <= 0) return null;
  if (!Number.isFinite(zielKhG) || zielKhG <= 0) return null;

  const roh = zielKhG / basisKhG;
  const faktor = Math.min(FAKTOR_MAX, Math.max(FAKTOR_MIN, roh));

  const hinweis =
    faktor === roh
      ? null
      : `The target is ${roh > faktor ? "far above" : "far below"} the base plan ` +
        `(${basisKhG} → ${zielKhG} g carbs). The amounts are at ` +
        `${Math.round(faktor * 100)} %, which is the limit — from here the plan needs ` +
        `recalculating, not further scaling.`;

  return { faktor, basisKhG, zielKhG, hinweis };
}

/**
 * Eine Menge auf den Faktor bringen.
 *
 * Nur Gramm-Mengen. Eine Banane lässt sich nicht auf 0,91 Stück bringen, und
 * "1" auf "1" zu runden wäre eine Skalierung, die keine ist — die Zutat bliebe
 * gleich, hieße aber angepasst. Stückzahlen tragen die Änderung deshalb nicht
 * mit; das ist der Grund, warum die Kürzung bei den Gramm-Quellen etwas größer
 * ausfällt als der Anteil, den sie am Plan haben.
 */
export function mengeSkalieren(zutat: ZutatMengen, s: Skalierung | null): number {
  if (s === null || !zutat.anpassbar || zutat.einheit !== "g") return zutat.mengeLautPlan;

  const skaliert = Math.round((zutat.mengeLautPlan * s.faktor) / SCHRITT_G) * SCHRITT_G;
  return Math.max(MIN_G, skaliert);
}

/** Eine Zeile der Zielhistorie, soweit die Mengenbasis sie braucht. */
export type BasisKandidat = {
  quelle: string;
  /** ISO-Kalendertag. */
  gueltigAb: string;
  kohlenhydrateG: number;
};

/**
 * Zu welchem Ziel die gespeicherten Mengen gehören.
 *
 * Bis zum 15.11.2026 war das immer der Ausgangsplan (quelle "plan", 560 g
 * Kohlenhydrate). Am 10.11.2026 hat Jakob das Ziel aber von Hand auf 3700 kcal
 * mit 565 g gesetzt und die Mengen dazu neu gebaut (Toast, Erdnussbutter und
 * Marmelade im letzten Meal, weniger Haferflocken). Danach rechnete die
 * Anzeige diese neuen Mengen noch einmal mit 565 / 560 = 1,009 hoch — die
 * Mengen trugen die 565 g schon, und der Faktor kam ein zweites Mal dazu. Bei
 * 5-g-Rundung sah man das noch nicht; beim ersten großen Vorschlag (Cut)
 * hätte jede Menge um knapp 1 % falsch gelegen.
 *
 * Deshalb gilt als Basis das jüngste Ziel, das nicht der Coach gesetzt hat:
 * ein Ausgangsplan oder ein von Hand gesetztes Ziel. Von Hand gesetzt wird
 * ein Ziel nur zusammen mit neuen Mengen — der Coach dagegen bewegt nur die
 * Zahl, und genau diese Differenz soll die Skalierung tragen.
 */
export function mengenBasis(historie: readonly BasisKandidat[]): BasisKandidat | null {
  let basis: BasisKandidat | null = null;
  for (const z of historie) {
    if (z.quelle !== "plan" && z.quelle !== "jakob") continue;
    if (basis === null || z.gueltigAb >= basis.gueltigAb) basis = z;
  }
  return basis;
}
