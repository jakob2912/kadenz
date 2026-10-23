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

/*
 * Die Namen werden vorher vereinheitlicht (klein, Bindestriche und
 * Unterstriche zu Leerzeichen — "Leg-Curl" wie "Leg Curl"). Die Muster
 * prüfen deshalb nur Leerzeichen und ganze Wörter: "chin" darf nicht in
 * "Maschine" treffen, "ab" nicht in "Slab Press".
 */
const REGELN: [RegExp, Muskelgruppe[]][] = [
  // Speziell vor allgemein: diese Namen enthalten Wörter späterer Regeln.
  [/\bleg curl|hamstring|beinbeuger|nordic|glute ham/, ["Hamstrings"]],
  [/reverse fl|rear delt|face ?pull|hintere schulter/, ["Schulter", "Rücken"]],
  [/overhead (triceps|trizeps)|trizeps|triceps|pushdown|french|skull/, ["Trizeps"]],
  [/upright row|aufrechtes rudern|shrug/, ["Schulter"]],
  // Rudern vor Bankdrücken: "Incline Bench Dumbbell Row" ist ein Rudern.
  [/\brows?\b|rudern|pulldown|latzug|latziehen|klimmz|pull up|\bchin ups?\b|\bchins?\b/, ["Rücken", "Bizeps"]],
  [/hip thrust|glute|abdukt|abductor/, ["Gesäß"]],
  [/back extension|hyperextension|rückenstrecker/, ["Rücken", "Gesäß"]],
  [/bankdr|bench|spoto|chest press|brustpresse|\bdips?\b/, ["Brust", "Trizeps", "Schulter"]],
  [/butterfly|pec deck|\bfl(y|ys|ies|yes)\b|cable cross/, ["Brust"]],
  [/shoulder press|schulterdr|overhead press|military|arnold/, ["Schulter", "Trizeps"]],
  [/seitheben|lateral raise/, ["Schulter"]],
  [/curl/, ["Bizeps"]],
  [/stiff|rum[aä]n|\brdl\b|deadlift|kreuzheben/, ["Hamstrings", "Gesäß", "Rücken"]],
  [/squat|kniebeuge|beinpresse|leg press|ausfallschritt|lunge|split/, ["Quads", "Gesäß"]],
  [/leg extension|beinstrecker/, ["Quads"]],
  [/calf|wade|slab press/, ["Waden"]],
  [/adduk|adductor/, ["Adduktoren"]],
  [/crunch|bauch|\babs?\b|plank|ab wheel|leg raise|beinheben/, ["Bauch"]],
];

/**
 * Die Muskelgruppen einer Übung, Hauptmuskel zuerst. Leer, wenn keine Regel
 * passt — dann zählt die Übung nirgends, statt irgendwo falsch.
 */
export function muskelnVon(uebung: string): Muskelgruppe[] {
  const name = uebung.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  for (const [muster, gruppen] of REGELN) {
    if (muster.test(name)) return gruppen;
  }
  return [];
}

export type WochenSatz = { exercise: string; datum: string };

export type Wochenwert = {
  montag: string;
  /** Sätze je Muskelgruppe, Nebenmuskeln halb gezählt. */
  jeGruppe: Partial<Record<Muskelgruppe, number>>;
  saetze: number;
  /** Sätze, die keiner Gruppe zugeordnet werden konnten — zeigt Lücken in den Regeln. */
  ohneZuordnung: number;
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
    ohneZuordnung: 0,
  }));
  const index = new Map(ergebnis.map((w, i) => [w.montag, i]));

  for (const s of saetze) {
    const i = index.get(montagVon(s.datum));
    if (i === undefined) continue;
    const woche = ergebnis[i];
    woche.saetze++;
    const gruppen = muskelnVon(s.exercise);
    if (gruppen.length === 0) woche.ohneZuordnung++;
    gruppen.forEach((gruppe, rang) => {
      woche.jeGruppe[gruppe] = (woche.jeGruppe[gruppe] ?? 0) + (rang === 0 ? 1 : 0.5);
    });
  }
  return ergebnis;
}
