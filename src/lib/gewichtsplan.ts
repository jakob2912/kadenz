/**
 * Kadenz — Gewichtsplanung über Phasen
 *
 * Bis hierher kannte die App eine einzige Zahl: ZIEL_KG = 97, an drei Stellen
 * getrennt hingeschrieben (Verlaufsseite und MCP-Server). Sie beschrieb einen
 * Plan, den es so nicht mehr gibt — seit dem 19.08.2026 steht in Jakobs Vault
 * ein Aufbau in zwei Etappen mit einem Mini-Cut dazwischen.
 *
 * Warum das nicht als drei Konstanten geht: die Zielkurve muss sagen, wo er
 * an einem beliebigen Tag stehen sollte, und das hängt davon ab, in welcher
 * Phase dieser Tag liegt. Erst recht gilt das für den Kalorien-Coach: sein
 * Zielkorridor ist im Aufbau positiv und im Cut negativ. Ohne diese
 * Unterscheidung schlüge er mitten im Mini-Cut Erhöhungen vor.
 *
 * Der Plan ist bewusst als Liste geschrieben und nicht ausgerechnet. Wer ihn
 * ändern will — andere Zielmarke, längerer Cut, zweiter Cut —, ändert die
 * Liste unten und sonst nichts.
 */

/** Ein Messpunkt oder ein Sollpunkt der Kurve. */
export type Gewichtspunkt = { datum: string; kg: number };

/**
 * Der Zielkorridor der Gewichtsänderung in kg pro Woche.
 *
 * Ein Korridor und keine Linie, weil eine Gewichtsreihe mit ±0,4 kg
 * Tagesschwankung keine Punktlandung hergibt. Der Coach greift erst ein, wenn
 * der gemessene Schnitt außerhalb liegt.
 */
export type Korridor = { unten: number; oben: number };

export type Phase = {
  /** Aufbau läuft bis zu einer Marke, ein Cut über eine feste Dauer. */
  art: "aufbau" | "cut";
  label: string;
  /** Angepeiltes Tempo. Positiv im Aufbau, negativ im Cut. */
  rateProWoche: number;
  korridor: Korridor;
  /** Nur beim Aufbau: bis zu welchem Gewicht die Phase läuft. */
  bisKg?: number;
  /** Nur beim Cut: wie lange die Phase läuft. */
  wochen?: number;
  /** Wofür die Phase da ist — steht so auch auf der Verlaufsseite. */
  zweck: string;
};

/**
 * Der Anfangspunkt der Kurve.
 *
 * Ein fester Punkt und nicht "das aktuelle Gewicht": nur so bleibt die
 * Sollkurve stehen, während die Ist-Kurve daneben läuft. Ein mitwandernder
 * Anfang hieße, dass man nie vom Plan abweichen kann — und genau die
 * Abweichung ist das, was man sehen will.
 *
 * 82,5 kg am 25.08.2026 ist die Messung dieses Tages; der 7-Tage-Schnitt lag
 * mit 82,5 auf demselben Wert, der Punkt ist also kein Ausreißer.
 */
export const START: Gewichtspunkt = { datum: "2026-08-25", kg: 82.5 };

/**
 * Aufbau — Mini-Cut — Aufbau.
 *
 * Die Struktur stammt aus Jakobs Vault (01 Fitness & Training, korrigiert am
 * 19.08.2026) und ersetzt den früheren Ein-Phasen-Plan auf 97 kg.
 *
 * Warum ein Mini-Cut in der Mitte und nicht durchgehend aufbauen: die zweite
 * Hälfte eines langen Aufbaus setzt anteilig mehr Fett an als die erste. Ein
 * kurzer Einschnitt bringt den Körperfettanteil zurück in den Bereich, in dem
 * ein Überschuss wieder überwiegend in Muskulatur geht — er kostet ein paar
 * Wochen und erspart eine lange Diät am Ende.
 *
 * 0,375 kg/Woche ist die Mitte des Aufbau-Korridors, nicht seine Obergrenze.
 * Wer auf 0,5 zielt, liegt bei der Hälfte der Messungen darüber, und darüber
 * geht der Überschuss vor allem ins Fett.
 */
export const GEWICHTSPLAN: readonly Phase[] = [
  {
    art: "aufbau",
    label: "Aufbau 1",
    bisKg: 92.5,
    rateProWoche: 0.375,
    korridor: { unten: 0.25, oben: 0.5 },
    zweck: "Masse aufbauen bis in den Bereich, ab dem sich ein Einschnitt lohnt.",
  },
  {
    art: "cut",
    label: "Mini-Cut",
    wochen: 6,
    rateProWoche: -0.6,
    /* Nach unten offener als nach oben: schneller als 0,75 kg pro Woche geht
       im Defizit an die Muskulatur, langsamer als 0,4 ist die Zeit nicht
       wert. Sechs Wochen sind die Mitte von Jakobs 4–8. */
    korridor: { unten: -0.75, oben: -0.4 },
    zweck: "Angesetztes Fett zurückholen, bevor der zweite Aufbau beginnt.",
  },
  {
    art: "aufbau",
    label: "Aufbau 2",
    bisKg: 100,
    rateProWoche: 0.375,
    korridor: { unten: 0.25, oben: 0.5 },
    zweck: "Der Weg auf die 100 kg aus der Vision für Dezember 2027.",
  },
];

/** Die letzte Marke, die der Plan ansteuert. */
export const ENDZIEL_KG = 100;

/**
 * Jakobs Obergrenze der Zunahme, in kg pro Woche.
 *
 * Steht hier statt im MCP-Server, damit App und Claude Desktop dieselbe Zahl
 * nennen. Die Zahl ist eine Grenze, kein Wunsch — angepeilt wird die Mitte
 * des jeweiligen Korridors.
 */
export const MAX_RATE_PRO_WOCHE = 0.5;

const TAG_MS = 864e5;

function alsMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function alsIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Ein Abschnitt der Kurve mit seinen berechneten Eckdaten. */
export type Phasenlauf = {
  phase: Phase;
  /** Platz im Plan, 1-basiert — für "Phase 2 von 3". */
  nummer: number;
  vonIso: string;
  bisIso: string;
  vonKg: number;
  bisKg: number;
};

/**
 * Den Plan durchrechnen: wann welche Phase läuft und mit welchen Gewichten.
 *
 * Einmal berechnet und dann von allen anderen Funktionen benutzt, damit die
 * Kurve, die Phasenauskunft und der Korridor nicht getrennt voneinander
 * rechnen und auseinanderlaufen können.
 */
export function phasenlauf(): Phasenlauf[] {
  const laeufe: Phasenlauf[] = [];
  let kg = START.kg;
  let ms = alsMs(START.datum);

  for (const [i, phase] of GEWICHTSPLAN.entries()) {
    const wochen =
      phase.art === "cut"
        ? (phase.wochen ?? 0)
        : /* Wie lange der Aufbau bis zur Marke braucht. Steht das Gewicht
             schon darüber, ist die Phase null Wochen lang statt negativ —
             sonst liefe die Kurve rückwärts. */
          Math.max(0, ((phase.bisKg ?? kg) - kg) / phase.rateProWoche);

    const bisKg = kg + wochen * phase.rateProWoche;
    const bisMs = ms + wochen * 7 * TAG_MS;

    laeufe.push({
      phase,
      nummer: i + 1,
      vonIso: alsIso(ms),
      bisIso: alsIso(bisMs),
      vonKg: kg,
      bisKg,
    });

    kg = bisKg;
    ms = bisMs;
  }

  return laeufe;
}

/**
 * Die Sollkurve als Punktfolge, wöchentlich.
 *
 * Wöchentlich und nicht täglich: die Linie sieht gleich aus, und die
 * Phasenknicke liegen ohnehin nicht auf Tagesgrenzen. Jede Phasengrenze
 * bekommt zusätzlich ihren eigenen Punkt, damit der Knick beim Mini-Cut
 * scharf bleibt und nicht über eine Woche verschliffen wird.
 */
export function sollKurve(): Gewichtspunkt[] {
  const punkte: Gewichtspunkt[] = [];
  const laeufe = phasenlauf();

  for (const lauf of laeufe) {
    const vonMs = alsMs(lauf.vonIso);
    const bisMs = alsMs(lauf.bisIso);
    const dauer = bisMs - vonMs;
    if (dauer <= 0) continue;

    for (let ms = vonMs; ms < bisMs; ms += 7 * TAG_MS) {
      const anteil = (ms - vonMs) / dauer;
      punkte.push({
        datum: alsIso(ms),
        kg: runde(lauf.vonKg + anteil * (lauf.bisKg - lauf.vonKg)),
      });
    }
    // Der Endpunkt der Phase, ausdrücklich — er ist der Knick.
    punkte.push({ datum: lauf.bisIso, kg: runde(lauf.bisKg) });
  }

  return punkte;
}

function runde(kg: number): number {
  return Math.round(kg * 10) / 10;
}

/** Wo der Plan an einem Tag steht. Null vor dem Start oder nach dem Ende. */
export function sollGewichtAm(iso: string): number | null {
  const ms = alsMs(iso);

  for (const lauf of phasenlauf()) {
    const vonMs = alsMs(lauf.vonIso);
    const bisMs = alsMs(lauf.bisIso);
    if (ms < vonMs) return ms === vonMs ? lauf.vonKg : null;
    if (ms <= bisMs) {
      const dauer = bisMs - vonMs;
      if (dauer <= 0) return runde(lauf.bisKg);
      return runde(lauf.vonKg + ((ms - vonMs) / dauer) * (lauf.bisKg - lauf.vonKg));
    }
  }

  return null;
}

/**
 * Welche Phase an einem Tag läuft.
 *
 * Nach dem Ende des Plans die letzte Phase, nicht null: "der Plan ist aus"
 * wäre keine brauchbare Auskunft, und bis dahin ist er ohnehin längst
 * fortgeschrieben.
 */
export function aktuellePhase(iso: string): Phasenlauf {
  const laeufe = phasenlauf();
  const ms = alsMs(iso);

  for (const lauf of laeufe) {
    if (ms <= alsMs(lauf.bisIso)) return lauf;
  }

  return laeufe[laeufe.length - 1];
}

/**
 * Der Zielkorridor, der an diesem Tag gilt.
 *
 * Das ist die Stelle, an der die Phasenplanung auf den Kalorien-Coach trifft:
 * anpassung() in coach.ts verglich bis hierher gegen fest verdrahtete 0,25
 * bis 0,50 und hätte im Mini-Cut jede Woche eine Erhöhung vorgeschlagen.
 */
export function zielKorridor(iso: string): Korridor {
  return aktuellePhase(iso).phase.korridor;
}
