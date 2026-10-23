/**
 * Kadenz — welche Übung welche Muskeln trifft, und was das je Woche ergibt
 *
 * Rein und ohne Datenbank. Liftoff und Hevy zeigen genau das: wie viele
 * Sätze jede Muskelgruppe in der Woche bekommen hat. Der Kraftverlauf
 * beantwortet "wird die Übung stärker", aber nicht "kommt der Rücken neben
 * der Brust zu kurz".
 *
 * Zugeordnet über Schlüsselwörter im Namen, nicht über eine Spalte im
 * Katalog. Der Grund ist die Historie: SetLog.exercise ist Freitext, und
 * darin stehen auch Übungen, die längst getauscht oder umbenannt sind
 * ("Latzug" neben "Lat Pulldown", "Hack Squat" neben "Hex Squat"). Eine
 * Katalogspalte kennte nur die heutigen. Die Regeln laufen von oben nach
 * unten, die erste passende gewinnt — spezielle vor allgemeinen ("Reverse
 * Fly" vor "Fly").
 *
 * Die erste Gruppe einer Regel ist die Hauptmuskulatur und zählt einen
 * ganzen Satz, jede weitere einen halben. Ein Satz Bankdrücken ist also ein
 * Satz Brust und je ein halber Trizeps und Schulter — die übliche Zählweise,
 * damit Mehrgelenksübungen die kleinen Muskeln nicht doppelt aufblähen.
 */

export const MUSKELGRUPPEN = [
  "Brust",
  "Rücken",
  "Schulter",
  "Bizeps",
  "Trizeps",
  "Quads",
  "Hamstrings",
  "Gesäß",
  "Waden",
  "Bauch",
  "Adduktoren",
] as const;

export type Muskelgruppe = (typeof MUSKELGRUPPEN)[number];

const REGELN: [RegExp, Muskelgruppe[]][] = [
  [/reverse\s*fly|face\s*pull|hintere\s*schulter/i, ["Schulter", "Rücken"]],
  [/bankdr|bench|chest\s*press|brustpresse|dips/i, ["Brust", "Trizeps", "Schulter"]],
  [/butterfly|fly\b|flys|cable\s*cross|kabelzug.*brust/i, ["Brust"]],
  [/shoulder\s*press|schulterdr|overhead|military/i, ["Schulter", "Trizeps"]],
  [/seitheben|lateral\s*raise/i, ["Schulter"]],
  [/trizeps|triceps|pushdown|french|skull/i, ["Trizeps"]],
  [/curl/i, ["Bizeps"]],
  [/stiff|rum[aä]n|rdl|deadlift|kreuzheben/i, ["Hamstrings", "Gesäß", "Rücken"]],
  [/squat|kniebeuge|beinpresse|leg\s*press/i, ["Quads", "Gesäß"]],
  [/leg\s*extension|beinstrecker/i, ["Quads"]],
  [/calf|wade/i, ["Waden"]],
  [/adduk|adductor/i, ["Adduktoren"]],
  [/crunch|bauch|ab\s|plank/i, ["Bauch"]],
  [/row|rudern|pulldown|latzug|klimmz|pull[\s-]?up|chin/i, ["Rücken", "Bizeps"]],
];

/**
 * Die Muskelgruppen einer Übung, Hauptmuskel zuerst. Leer, wenn keine Regel
 * passt — dann zählt die Übung nirgends, statt irgendwo falsch.
 */
export function muskelnVon(uebung: string): Muskelgruppe[] {
  // Beinbeuger vor allen anderen Curls — "Leg Curl" enthält "Curl".
  if (/leg\s*curl|beinbeuger/i.test(uebung)) return ["Hamstrings"];
  for (const [muster, gruppen] of REGELN) {
    if (muster.test(uebung)) return gruppen;
  }
  return [];
}

export type WochenSatz = { exercise: string; datum: string };

export type Wochenwert = {
  montag: string;
  /** Sätze je Muskelgruppe, Nebenmuskeln halb gezählt. */
  jeGruppe: Partial<Record<Muskelgruppe, number>>;
  saetze: number;
};

function montagVon(tagIso: string): string {
  const t = Date.parse(`${tagIso}T00:00:00Z`);
  const wochentag = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - wochentag * 864e5).toISOString().slice(0, 10);
}

/**
 * Die letzten `wochen` Wochen, älteste zuerst, die laufende als letzte.
 * Wochen ohne Training stehen mit null Sätzen drin — eine Lücke ist auch
 * eine Auskunft.
 */
export function wochenvolumen(
  saetze: readonly WochenSatz[],
  heuteIso: string,
  wochen = 5
): Wochenwert[] {
  const dieseWoche = Date.parse(`${montagVon(heuteIso)}T00:00:00Z`);
  const ergebnis: Wochenwert[] = Array.from({ length: wochen }, (_, i) => ({
    montag: new Date(dieseWoche - (wochen - 1 - i) * 7 * 864e5).toISOString().slice(0, 10),
    jeGruppe: {},
    saetze: 0,
  }));
  const index = new Map(ergebnis.map((w, i) => [w.montag, i]));

  for (const s of saetze) {
    const i = index.get(montagVon(s.datum));
    if (i === undefined) continue;
    const woche = ergebnis[i];
    woche.saetze++;
    muskelnVon(s.exercise).forEach((gruppe, rang) => {
      woche.jeGruppe[gruppe] = (woche.jeGruppe[gruppe] ?? 0) + (rang === 0 ? 1 : 0.5);
    });
  }
  return ergebnis;
}
