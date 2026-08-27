import { describe, expect, it } from "vitest";
import {
  ENDZIEL_KG,
  GEWICHTSPLAN,
  START,
  aktuellePhase,
  phasenlauf,
  sollGewichtAm,
  sollKurve,
  zielKorridor,
} from "../gewichtsplan";
import { kalorienAnpassung } from "../coach";

describe("phasenlauf", () => {
  it("beginnt am verankerten Startpunkt", () => {
    const [erste] = phasenlauf();
    expect(erste.vonIso).toBe(START.datum);
    expect(erste.vonKg).toBe(START.kg);
  });

  it("hängt die Phasen lückenlos aneinander", () => {
    const laeufe = phasenlauf();
    for (let i = 1; i < laeufe.length; i++) {
      expect(laeufe[i].vonIso).toBe(laeufe[i - 1].bisIso);
      expect(laeufe[i].vonKg).toBeCloseTo(laeufe[i - 1].bisKg, 6);
    }
  });

  it("führt bis zum Endziel", () => {
    expect(phasenlauf().at(-1)!.bisKg).toBeCloseTo(ENDZIEL_KG, 6);
  });

  it("baut auf, schneidet ab, baut wieder auf", () => {
    const [eins, zwei, drei] = phasenlauf();
    expect(eins.bisKg).toBeGreaterThan(eins.vonKg);
    expect(zwei.bisKg).toBeLessThan(zwei.vonKg);
    expect(drei.bisKg).toBeGreaterThan(drei.vonKg);
  });

  /* Der Mini-Cut läuft über eine feste Dauer, nicht bis zu einer Marke — vier
     bis acht Wochen ist Jakobs Rahmen, sechs die Mitte. */
  it("hält den Mini-Cut in Jakobs Rahmen von vier bis acht Wochen", () => {
    const cut = phasenlauf().find((l) => l.phase.art === "cut")!;
    const wochen =
      (Date.parse(`${cut.bisIso}T00:00:00Z`) - Date.parse(`${cut.vonIso}T00:00:00Z`)) /
      (7 * 864e5);
    expect(wochen).toBeGreaterThanOrEqual(4);
    expect(wochen).toBeLessThanOrEqual(8);
  });

  it("überschreitet Jakobs Obergrenze von 0,5 kg pro Woche nie", () => {
    for (const phase of GEWICHTSPLAN) expect(phase.rateProWoche).toBeLessThanOrEqual(0.5);
  });
});

describe("sollKurve", () => {
  it("beginnt beim Startgewicht und endet am Endziel", () => {
    const kurve = sollKurve();
    expect(kurve[0]).toEqual({ datum: START.datum, kg: START.kg });
    expect(kurve.at(-1)!.kg).toBeCloseTo(ENDZIEL_KG, 1);
  });

  it("läuft zeitlich vorwärts", () => {
    const kurve = sollKurve();
    for (let i = 1; i < kurve.length; i++) {
      expect(Date.parse(kurve[i].datum)).toBeGreaterThanOrEqual(Date.parse(kurve[i - 1].datum));
    }
  });

  /* Der Mini-Cut muss als Delle sichtbar sein — eine Kurve, die nur steigt,
     zeigt den Plan nicht, sondern eine Vereinfachung davon. */
  it("hat eine fallende Strecke in der Mitte", () => {
    const kurve = sollKurve();
    const faellt = kurve.some((p, i) => i > 0 && p.kg < kurve[i - 1].kg);
    expect(faellt).toBe(true);
    expect(Math.min(...kurve.map((p) => p.kg))).toBe(kurve[0].kg);
  });
});

describe("sollGewichtAm", () => {
  it("gibt am Startpunkt das Startgewicht", () => {
    expect(sollGewichtAm(START.datum)).toBeCloseTo(START.kg, 1);
  });

  it("gibt an jeder Phasengrenze das dort geplante Gewicht", () => {
    for (const lauf of phasenlauf()) {
      expect(sollGewichtAm(lauf.bisIso)).toBeCloseTo(Math.round(lauf.bisKg * 10) / 10, 1);
    }
  });

  it("kennt keine Zeit vor dem Start", () => {
    expect(sollGewichtAm("2026-01-01")).toBeNull();
  });
});

describe("zielKorridor", () => {
  it("zeigt im Aufbau nach oben", () => {
    const k = zielKorridor(START.datum);
    expect(k.unten).toBeGreaterThan(0);
    expect(k.oben).toBeGreaterThan(0);
  });

  /* Der Kern der Kopplung: ohne diesen Vorzeichenwechsel schlüge der
     Kalorien-Coach mitten im Mini-Cut weiter Erhöhungen vor. */
  it("dreht im Mini-Cut das Vorzeichen um", () => {
    const cut = phasenlauf().find((l) => l.phase.art === "cut")!;
    const mitten = new Date(
      (Date.parse(`${cut.vonIso}T00:00:00Z`) + Date.parse(`${cut.bisIso}T00:00:00Z`)) / 2
    )
      .toISOString()
      .slice(0, 10);

    expect(aktuellePhase(mitten).phase.art).toBe("cut");
    const k = zielKorridor(mitten);
    expect(k.oben).toBeLessThan(0);
    expect(k.unten).toBeLessThan(k.oben);
  });
});

/**
 * Der Coach gegen den Korridor.
 *
 * Die Verbindung zwischen Plan und Kalorienziel — und die Stelle, an der ein
 * Fehler am teuersten wäre: eine Erhöhung mitten im Cut liefe zehn Tage mit,
 * bevor sie überhaupt auffiele.
 */
describe("kalorienAnpassung mit Phasenkorridor", () => {
  const reihe = Array.from({ length: 21 }, (_, i) => ({
    date: new Date(Date.UTC(2027, 2, 1) + i * 864e5).toISOString().slice(0, 10),
    // fällt mit rund 0,6 kg pro Woche — genau das Tempo des Mini-Cuts
    kg: 92.5 - i * (0.6 / 7),
  }));

  const aktuell = { kcal: 3600, kohlenhydrateG: 450, eiweissG: 200, fettG: 100 };
  const gemeinsam = {
    aktuell,
    gewicht: reihe,
    letzteAnpassung: null,
    heute: reihe[reihe.length - 1].date,
    koerpergewichtKg: 90,
  };

  it("lässt eine planmäßige Abnahme im Cut-Korridor in Ruhe", () => {
    const urteil = kalorienAnpassung({ ...gemeinsam, korridor: { unten: -0.75, oben: -0.4 } });
    expect(urteil.art).toBe("kein-vorschlag");
  });

  it("würde dieselbe Abnahme im Aufbau-Korridor hochsetzen wollen", () => {
    const urteil = kalorienAnpassung({ ...gemeinsam, korridor: { unten: 0.25, oben: 0.5 } });
    expect(urteil.art).toBe("vorschlag");
    if (urteil.art === "vorschlag") expect(urteil.anpassung.richtung).toBe("hoch");
  });

  it("sagt bei fallendem Gewicht nicht, der Schnitt steige", () => {
    const urteil = kalorienAnpassung({ ...gemeinsam, korridor: { unten: -0.75, oben: -0.4 } });
    if (urteil.art === "kein-vorschlag") {
      expect(urteil.grund).toContain("fällt");
      expect(urteil.grund).not.toContain("steigt");
    }
  });
});
