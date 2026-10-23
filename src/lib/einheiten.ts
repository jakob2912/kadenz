/**
 * Kadenz — Trainingskalender und Serie
 *
 * Rein und ohne Datenbank. Die Abfrage steht in einheiten-daten.ts, hier nur
 * die Rechnung, damit sie testbar ist.
 *
 * Warum überhaupt: Strong und Hevy haben beide einen Verlauf je Einheit und
 * einen Kalender — und genau das fehlte. Der Kraftverlauf beantwortet "wird
 * die Übung stärker", aber nicht "wie regelmäßig war ich da" und nicht "was
 * habe ich am Dienstag eigentlich gemacht".
 */

const TAG_MS = 864e5;

function tagMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Montag der Woche, in der ein Tag liegt. */
export function montagVon(tagIso: string): string {
  const t = tagMs(tagIso);
  const wochentag = (new Date(t).getUTCDay() + 6) % 7; // Mo = 0
  return iso(t - wochentag * TAG_MS);
}

export type Kalendertag = { iso: string; einheiten: number; zukunft: boolean };

/**
 * Die letzten `wochen` Wochen als Raster, Montag zuerst, älteste Woche oben.
 * Die laufende Woche ist die letzte Zeile; ihre kommenden Tage sind als
 * Zukunft markiert, damit sie nicht wie verpasste Tage aussehen.
 */
export function kalender(
  trainingstage: readonly string[],
  heuteIso: string,
  wochen = 12
): Kalendertag[][] {
  const zaehler = new Map<string, number>();
  for (const t of trainingstage) zaehler.set(t, (zaehler.get(t) ?? 0) + 1);

  const ersterMontag = tagMs(montagVon(heuteIso)) - (wochen - 1) * 7 * TAG_MS;
  const heute = tagMs(heuteIso);

  return Array.from({ length: wochen }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const t = ersterMontag + (w * 7 + d) * TAG_MS;
      return { iso: iso(t), einheiten: zaehler.get(iso(t)) ?? 0, zukunft: t > heute };
    })
  );
}

/**
 * Ab wie vielen Einheiten eine Woche zählt.
 *
 * Der Plan sieht vier vor (zwei Push, zwei Pull). Drei, damit ein einzelner
 * ausgefallener Tag — krank, Schularbeit — nicht die ganze Serie löscht.
 * Eine Serie, die beim ersten Ausrutscher auf null fällt, motiviert nicht,
 * sie bestraft.
 */
export const EINHEITEN_PRO_WOCHE = 3;

/**
 * Wie viele Wochen in Folge mindestens EINHEITEN_PRO_WOCHE Einheiten hatten.
 *
 * Gezählt wird rückwärts ab der letzten abgeschlossenen Woche. Die laufende
 * Woche zählt mit, sobald sie die Schwelle erreicht hat — vorher bricht sie
 * die Serie nicht, sie ist ja noch nicht vorbei.
 */
export function serie(trainingstage: readonly string[], heuteIso: string): number {
  const proWoche = new Map<string, number>();
  for (const t of trainingstage) {
    const m = montagVon(t);
    proWoche.set(m, (proWoche.get(m) ?? 0) + 1);
  }

  const dieseWoche = montagVon(heuteIso);
  let n = (proWoche.get(dieseWoche) ?? 0) >= EINHEITEN_PRO_WOCHE ? 1 : 0;

  for (let m = tagMs(dieseWoche) - 7 * TAG_MS; ; m -= 7 * TAG_MS) {
    if ((proWoche.get(iso(m)) ?? 0) < EINHEITEN_PRO_WOCHE) break;
    n++;
  }
  return n;
}
