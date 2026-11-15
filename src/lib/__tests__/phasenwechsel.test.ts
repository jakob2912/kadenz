import { describe, expect, it } from "vitest";
import { phasenwechselAnpassung } from "../coach";
import { phasenlauf, phasenwechselSeit } from "../gewichtsplan";
import { mengenBasis, skalierung } from "../portionen";

const [bulk, cut, halten, bulk2] = phasenlauf();
const aktuell = { kcal: 3700, kohlenhydrateG: 565, eiweissG: 180, fettG: 80 };

function reihe(kgProWoche: number) {
  return Array.from({ length: 21 }, (_, i) => ({
    date: new Date(Date.UTC(2027, 2, 20) + i * 864e5).toISOString().slice(0, 10),
    kg: 94 + i * (kgProWoche / 7),
  }));
}

function wechsel(von: typeof bulk, nach: typeof bulk, gewicht = reihe(0.375)) {
  return phasenwechselAnpassung({
    aktuell,
    von: { label: von.phase.label, korridor: von.phase.korridor },
    nach: { label: nach.phase.label, korridor: nach.phase.korridor },
    gewicht,
    koerpergewichtKg: 95,
  });
}

describe("phasenwechselSeit", () => {
  it("meldet nichts, solange das Ziel in der laufenden Phase gesetzt wurde", () => {
    expect(phasenwechselSeit("2026-11-10", "2027-03-01")).toBeNull();
  });

  it("erkennt den Wechsel vom Bulk in den Cut", () => {
    const w = phasenwechselSeit("2026-11-10", "2027-04-20")!;
    expect(w.von.phase.art).toBe("aufbau");
    expect(w.nach.phase.art).toBe("cut");
  });

  it("zählt ein Ziel aus der Zeit vor dem Planstart zur ersten Phase", () => {
    expect(phasenwechselSeit("2026-08-18", "2026-11-15")).toBeNull();
  });
});

/**
 * Bulk → Cut ist der Fall, für den das gebaut ist: rund 870 kcal auf einmal
 * statt sechs Wochen 200er-Schritte. 0,375 kg/Woche Zunahme sind
 * 0,375 × 6000 / 7 = 321 kcal Überschuss, 0,5 kg/Woche Abnahme sind
 * 0,5 × 7700 / 7 = 550 kcal Defizit — zusammen 871, gerundet 870.
 */
describe("phasenwechselAnpassung", () => {
  it("rechnet Bulk → Cut ungedeckelt auf einen Schlag", () => {
    const a = wechsel(bulk, cut)!;
    expect(a.richtung).toBe("runter");
    expect(a.deltaKcal).toBe(-870);
    expect(a.neu.kcal).toBe(2830);
    expect(a.neu.kohlenhydrateG).toBe(348);
    expect(a.neu.eiweissG).toBe(180);
    expect(a.neu.fettG).toBe(80);
    expect(a.zielRate).toBeCloseTo(-0.5, 6);
    expect(a.begruendung).toContain("from Bulk to Cut");
    expect(a.begruendung).toContain("870 kcal less at once");
    expect(a.begruendung).toContain("−0.50 kg per week");
  });

  it("rechnet von der gemessenen Rate, wenn die Reihe verwertbar ist", () => {
    // 0,5 kg/Woche gemessen: 0,5 × 6000 / 7 = 429 Überschuss, + 550 = 979 → 980.
    const a = wechsel(bulk, cut, reihe(0.5))!;
    expect(a.deltaKcal).toBe(-980);
    expect(a.gemesseneRate).toBeCloseTo(0.5, 2);
  });

  it("nimmt ohne verwertbare Reihe die Mitte des alten Korridors", () => {
    const a = wechsel(bulk, cut, [])!;
    expect(a.gemesseneRate).toBeCloseTo(0.375, 6);
    expect(a.deltaKcal).toBe(-870);
    expect(a.begruendung).toContain("no usable trend");
  });

  it("hebt vom Cut aufs Halten das Defizit auf", () => {
    const a = wechsel(cut, halten, [])!;
    expect(a.richtung).toBe("hoch");
    expect(a.deltaKcal).toBe(550);
  });

  it("geht vom Halten in den zweiten Bulk mit dem Aufbau-Überschuss", () => {
    const a = wechsel(halten, bulk2, [])!;
    expect(a.deltaKcal).toBe(320);
  });

  it("schlägt nichts vor, wenn sich die Bilanz kaum ändert", () => {
    expect(wechsel(bulk, bulk2, [])).toBeNull();
  });
});

/**
 * Die Mengen in der Datenbank gehören seit dem 10.11.2026 zum von Hand
 * gesetzten Ziel mit 565 g, nicht mehr zum Ausgangsplan mit 560 g.
 */
describe("mengenBasis", () => {
  const historie = [
    { quelle: "plan", gueltigAb: "2026-08-18", kohlenhydrateG: 560 },
    { quelle: "coach", gueltigAb: "2026-08-27", kohlenhydrateG: 510 },
    { quelle: "jakob", gueltigAb: "2026-11-10", kohlenhydrateG: 565 },
    { quelle: "coach", gueltigAb: "2027-04-20", kohlenhydrateG: 348 },
  ];

  it("nimmt das jüngste von Hand gesetzte Ziel, nicht den Ausgangsplan", () => {
    expect(mengenBasis(historie)?.kohlenhydrateG).toBe(565);
  });

  it("skaliert das 3700er-Ziel nicht ein zweites Mal", () => {
    expect(skalierung(mengenBasis(historie.slice(0, 3))!.kohlenhydrateG, 565)!.faktor).toBe(1);
  });

  it("skaliert einen späteren Coach-Vorschlag gegen die 565 g", () => {
    expect(skalierung(mengenBasis(historie)!.kohlenhydrateG, 348)!.faktor).toBeCloseTo(348 / 565, 6);
  });

  it("fällt ohne Handziel auf den Ausgangsplan zurück", () => {
    expect(mengenBasis(historie.slice(0, 2))?.kohlenhydrateG).toBe(560);
    expect(mengenBasis([])).toBeNull();
  });
});
