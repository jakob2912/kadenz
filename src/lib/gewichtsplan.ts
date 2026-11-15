/**
 * Kadenz — Gewichtsplanung über Phasen
 *
 * Bis hierher kannte die App eine einzige Zahl: ZIEL_KG = 97, an drei Stellen
 * getrennt hingeschrieben (Verlaufsseite und MCP-Server). Sie beschrieb einen
 * Plan, den es so nicht mehr gibt. Seit dem 14.11.2026 gilt: ein langer
 * Aufbau auf 95 kg, ein Cut auf 87 kg vor den Maturaball-Fotos, Gewicht halten bis
 * nach dem Ball, dann ein zweiter Aufbau auf 100 kg.
 *
 * Warum das nicht als drei Konstanten geht: die Zielkurve muss sagen, wo er
 * an einem beliebigen Tag stehen sollte, und das hängt davon ab, in welcher
 * Phase dieser Tag liegt. Erst recht gilt das für den Kalorien-Coach: sein
 * Zielkorridor ist im Aufbau positiv, im Cut negativ und beim Halten um null.
 * Ohne diese Unterscheidung schlüge er mitten im Cut Erhöhungen vor und beim
 * Halten jede Woche ein Plus, weil das Gewicht nicht steigt.
 *
 * Der Plan ist bewusst als Liste geschrieben und nicht ausgerechnet. Wer ihn
 * ändern will — andere Zielmarke, längerer Cut, längeres Halten —, ändert die
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
  /**
   * Aufbau läuft bis zu einer Marke, Cut und Halten über eine feste Dauer —
   * beide hängen an Terminen (Fotos, Ball), nicht an einer Zahl auf der Waage.
   */
  art: "aufbau" | "cut" | "halten";
  label: string;
  /** Angepeiltes Tempo. Positiv im Aufbau, negativ im Cut, null beim Halten. */
  rateProWoche: number;
  korridor: Korridor;
  /** Nur beim Aufbau: bis zu welchem Gewicht die Phase läuft. */
  bisKg?: number;
  /** Nur bei Cut und Halten: wie lange die Phase läuft. */
  wochen?: number;
  /**
   * Bis zu welchem Tag die Phase läuft, als ISO-Datum. Geht vor `wochen`.
   *
   * Für Phasen, die an einem Termin enden statt nach einer Dauer: das Halten
   * endet am Tag nach dem Ball, egal wann der Cut davor fertig wird. Mit
   * `wochen` müsste man jede Verschiebung davor von Hand nachrechnen.
   */
  bisDatum?: string;
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
 * Bulk — Cut — Halten — Bulk 2.
 *
 * Jakobs Entscheidung vom 14.11.2026, am 15.11.2026 nachgeschärft; sie
 * ersetzt den Plan aus dem Vault vom 19.08.2026 (Aufbau auf 92,5 kg, sechs
 * Wochen Mini-Cut, Aufbau auf 100 kg).
 *
 * Warum kein Mini-Cut mehr: ein Einschnitt mitten im Aufbau kostet Wochen, in
 * denen die Bank nicht vorankommt, und am Ende stünde trotzdem ein Cut an —
 * die Maturaball-Fotos (11.08.–11.10.2027) und der Ball (11.12.2027) verlangen,
 * dass er dann schlank ist. Also ein langer Aufbau auf 95 kg und genau ein
 * Cut, der so liegt, dass er vor den Fotos fertig ist.
 *
 * Warum 95 und ein langer Cut auf 87 statt 96 auf 90: Jakob hat sich bei 86 kg
 * auf rund 17 % Körperfett gemessen. Mit 90 kg nach dem Cut wäre er also
 * nicht schlank genug für die Fotos; 87 kg nach einem Aufbau auf 95 kommen
 * dem Stand von 86 kg mit mehr Muskulatur nahe.
 *
 * Warum danach Halten statt sofort wieder Aufbau: zwischen den letzten Fotos
 * und dem Ball liegen zwei Monate, und vor den Fotos braucht es Luft, falls der Cut länger
 * dauert. Das Halten deckt beides ab und endet erst nach dem Ball; dann
 * beginnt der zweite Aufbau auf 100 kg.
 *
 * 0,375 kg/Woche ist die Mitte des Aufbau-Korridors, nicht seine Obergrenze.
 * Wer auf 0,5 zielt, liegt bei der Hälfte der Messungen darüber, und darüber
 * geht der Überschuss vor allem ins Fett.
 */
export const GEWICHTSPLAN: readonly Phase[] = [
  {
    art: "aufbau",
    label: "Bulk",
    bisKg: 95,
    rateProWoche: 0.375,
    korridor: { unten: 0.25, oben: 0.5 },
    zweck: "Build as much mass as possible before the cut for the Maturaball.",
  },
  {
    art: "cut",
    label: "Cut",
    wochen: 16,
    rateProWoche: -0.5,
    /* Sechzehn Wochen bei 0,5 sind 8 kg — von 95 auf 87 — und enden Anfang
       August, knapp eine Woche vor den ersten Fotos am 11.08. Langsamer als
       die 0,6 eines kurzen Cuts, weil ein langes Defizit sonst an die
       Muskulatur und an die Bank geht. Der Korridor liegt symmetrisch um die
       0,5: schneller als 0,65 kostet Kraft, langsamer als 0,35 reicht die
       Zeit bis zu den Fotos nicht. */
    korridor: { unten: -0.65, oben: -0.35 },
    zweck: "Get lean for the Maturaball photos.",
  },
  {
    art: "halten",
    label: "Hold",
    /* Ein Termin statt einer Dauer: der Tag nach dem Ball. Wird der Cut
       länger oder kürzer, verschiebt sich nur der Anfang des Haltens. */
    bisDatum: "2027-12-12",
    rateProWoche: 0,
    /* Symmetrisch um null: ±0,25 kg pro Woche ist im Rauschen der Waage,
       alles darüber ist ein Trend, den man nach dem Cut nicht laufen lassen
       will — nach oben nicht wegen der Fotos, nach unten nicht wegen der
       Kraft. */
    korridor: { unten: -0.25, oben: 0.25 },
    zweck: "Stay lean through the photos and the ball on 11 Dec 2027.",
  },
  {
    art: "aufbau",
    label: "Bulk 2",
    bisKg: 100,
    rateProWoche: 0.375,
    korridor: { unten: 0.25, oben: 0.5 },
    zweck: "The road to 100 kg once the ball is behind you.",
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
export function phasenlauf(
  /* Nur für Tests austauschbar — die App rechnet immer mit dem einen Plan. */
  plan: readonly Phase[] = GEWICHTSPLAN,
  start: Gewichtspunkt = START
): Phasenlauf[] {
  const laeufe: Phasenlauf[] = [];
  let kg = start.kg;
  let ms = alsMs(start.datum);

  for (const [i, phase] of plan.entries()) {
    const wochen =
      phase.bisDatum !== undefined
        ? /* Ein Termin geht vor: die Dauer vom Phasenanfang bis zu diesem
             Tag. Liegt er schon dahinter, null statt negativ. */
          Math.max(0, (alsMs(phase.bisDatum) - ms) / (7 * TAG_MS))
        : phase.art !== "aufbau"
          ? /* Aufbau läuft bis zu einem Gewicht, jede andere Phase über ihre
               Wochen — beim Halten bleibt das Gewicht dabei, wo es ist. */
            (phase.wochen ?? 0)
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
 * Das Ende des ersten Aufbaus: der Tag, an dem der erste Cut beginnt.
 *
 * Das Bankziel hängt daran (bankziel.ts) — im Defizit wächst keine Bank, also
 * muss die Zahl bis hierhin stehen. Kennt der Plan keinen Cut, gilt sein Ende.
 */
export function bulkEndeIso(): string {
  const laeufe = phasenlauf();
  const cut = laeufe.find((l) => l.phase.art === "cut");
  return cut ? cut.vonIso : laeufe[laeufe.length - 1].bisIso;
}

/**
 * Die Sollkurve als Punktfolge, wöchentlich.
 *
 * Wöchentlich und nicht täglich: die Linie sieht gleich aus, und die
 * Phasenknicke liegen ohnehin nicht auf Tagesgrenzen. Jede Phasengrenze
 * bekommt zusätzlich ihren eigenen Punkt, damit die Knicke am Anfang und Ende
 * des Cuts scharf bleiben und nicht über eine Woche verschliffen wird.
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
 * Hat seit dem Tag, ab dem das Kalorienziel gilt, eine neue Phase begonnen?
 *
 * Dann passt das Ziel nicht mehr zum Plan — nicht, weil die Messung
 * abweicht, sondern weil der Plan jetzt etwas anderes will. Null, solange das
 * Ziel in der laufenden Phase gesetzt wurde.
 */
export function phasenwechselSeit(
  zielAbIso: string,
  heuteIso: string
): { von: Phasenlauf; nach: Phasenlauf } | null {
  const von = aktuellePhase(zielAbIso);
  const nach = aktuellePhase(heuteIso);
  return nach.nummer > von.nummer ? { von, nach } : null;
}

/**
 * Der Zielkorridor, der an diesem Tag gilt.
 *
 * Das ist die Stelle, an der die Phasenplanung auf den Kalorien-Coach trifft:
 * anpassung() in coach.ts verglich bis hierher gegen fest verdrahtete 0,25
 * bis 0,50 und hätte im Cut jede Woche eine Erhöhung vorgeschlagen — und beim
 * Halten ebenso, weil ein stehendes Gewicht unter 0,25 liegt.
 */
export function zielKorridor(iso: string): Korridor {
  return aktuellePhase(iso).phase.korridor;
}
