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
      : `Das Ziel liegt ${roh > faktor ? "weit über" : "weit unter"} dem Ausgangsplan ` +
        `(${basisKhG} → ${zielKhG} g Kohlenhydrate). Die Mengen stehen bei ` +
        `${Math.round(faktor * 100)} % und damit an der Grenze — ab hier gehört der Plan ` +
        `neu gerechnet, nicht weiter skaliert.`;

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
