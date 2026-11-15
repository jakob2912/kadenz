import { describe, expect, it } from "vitest";
import {
  ENDZIEL_KG,
  GEWICHTSPLAN,
  START,
  aktuellePhase,
  bulkEndeIso,
  phasenlauf,
  sollGewichtAm,
  sollKurve,
  zielKorridor,
} from "../gewichtsplan";
import { kalorienAnpassung } from "../coach";
import { ZIEL_DATUM } from "../bankziel";

function wochenVon(lauf: { vonIso: string; bisIso: string }): number {
  return (
    (Date.parse(`${lauf.bisIso}T00:00:00Z`) - Date.parse(`${lauf.vonIso}T00:00:00Z`)) /
    (7 * 864e5)
  );
}

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

  it("baut auf, schneidet ab, hält, baut wieder auf", () => {
    const [eins, zwei, drei, vier] = phasenlauf();
    expect(eins.bisKg).toBeGreaterThan(eins.vonKg);
    expect(zwei.bisKg).toBeLessThan(zwei.vonKg);
    expect(drei.bisKg).toBeCloseTo(drei.vonKg, 6);
    expect(vier.bisKg).toBeGreaterThan(vier.vonKg);
  });

  it("baut im ersten Aufbau bis 95 kg auf", () => {
    const [eins] = phasenlauf();
    expect(eins.phase.art).toBe("aufbau");
    expect(eins.bisKg).toBeCloseTo(95, 6);
    expect(eins.bisIso).toBe("2027-04-15");
  });

  /* Der Cut läuft über eine feste Dauer, nicht bis zu einer Marke, und muss
     vor den ersten Maturaball-Fotos am 11.08.2027 fertig sein — bei rund
     87 kg, weil 90 kg nach Jakobs Messung (17 % bei 86 kg) nicht reichen. */
  it("hält den Cut bei zwölf bis sechzehn Wochen und beendet ihn vor den Fotos bei 87 kg", () => {
    const cut = phasenlauf().find((l) => l.phase.art === "cut")!;
    expect(wochenVon(cut)).toBeGreaterThanOrEqual(12);
    expect(wochenVon(cut)).toBeLessThanOrEqual(16);
    expect(cut.bisIso < "2027-08-11").toBe(true);
    expect(cut.bisKg).toBeCloseTo(87, 6);
  });

  /* Das Halten muss den Ball am 11.12.2027 einschließen — sonst begänne der
     zweite Aufbau, solange er noch schlank sein soll. */
  it("hält das Gewicht über den Ball am 11.12.2027", () => {
    const halten = aktuellePhase("2027-12-11");
    expect(halten.phase.art).toBe("halten");
    expect(halten.phase.rateProWoche).toBe(0);
    expect(halten.phase.korridor.unten).toBeLessThan(0);
    expect(halten.phase.korridor.oben).toBeGreaterThan(0);
  });

  it("lässt beim Halten das Gewicht stehen und endet genau am Tag nach dem Ball", () => {
    const halten = phasenlauf().find((l) => l.phase.art === "halten")!;
    expect(halten.bisIso).toBe("2027-12-12");
    expect(halten.bisKg).toBe(halten.vonKg);
    expect(sollGewichtAm(halten.vonIso)).toBe(sollGewichtAm(halten.bisIso));
    expect(sollGewichtAm("2027-10-01")).toBe(sollGewichtAm(halten.bisIso));
  });

  describe("Dauer einer Phase", () => {
    const start = { datum: "2027-01-01", kg: 80 };
    const korridor = { unten: -0.25, oben: 0.25 };

    it("nimmt bisDatum vor wochen", () => {
      const [lauf] = phasenlauf(
        [{ art: "halten", label: "H", rateProWoche: 0, korridor, wochen: 2, bisDatum: "2027-03-01", zweck: "" }],
        start
      );
      expect(lauf.bisIso).toBe("2027-03-01");
      expect(lauf.bisKg).toBe(80);
    });

    it("rechnet ohne bisDatum über wochen, auch beim Halten", () => {
      const [lauf] = phasenlauf(
        [{ art: "halten", label: "H", rateProWoche: 0, korridor, wochen: 2, zweck: "" }],
        start
      );
      expect(lauf.bisIso).toBe("2027-01-15");
      expect(lauf.bisKg).toBe(80);
    });

    it("macht eine Phase, deren Termin schon vorbei ist, null lang statt negativ", () => {
      const [lauf] = phasenlauf(
        [{ art: "halten", label: "H", rateProWoche: 0, korridor, bisDatum: "2026-12-01", zweck: "" }],
        start
      );
      expect(lauf.bisIso).toBe(start.datum);
    });

    it("lässt einen Aufbau ohne Termin bis zur Marke laufen", () => {
      const [lauf] = phasenlauf(
        [{ art: "aufbau", label: "B", rateProWoche: 0.5, korridor, bisKg: 81, zweck: "" }],
        start
      );
      expect(lauf.bisIso).toBe("2027-01-15");
      expect(lauf.bisKg).toBe(81);
    });
  });

  describe("bulkEndeIso", () => {
    it("ist der Anfang des ersten Cuts", () => {
      const cut = phasenlauf().find((l) => l.phase.art === "cut")!;
      expect(bulkEndeIso()).toBe(cut.vonIso);
      expect(bulkEndeIso()).toBe("2027-04-15");
    });
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

  /* Der Cut muss als Delle sichtbar sein — eine Kurve, die nur steigt,
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
     Kalorien-Coach mitten im Cut weiter Erhöhungen vor. */
  it("dreht im Cut das Vorzeichen um", () => {
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
    // fällt mit rund 0,5 kg pro Woche — genau das Tempo des Cuts
    kg: 95 - i * (0.5 / 7),
  }));

  const cutKorridor = phasenlauf().find((l) => l.phase.art === "cut")!.phase.korridor;
  const aktuell = { kcal: 3600, kohlenhydrateG: 450, eiweissG: 200, fettG: 100 };
  const gemeinsam = {
    aktuell,
    gewicht: reihe,
    letzteAnpassung: null,
    heute: reihe[reihe.length - 1].date,
    koerpergewichtKg: 90,
  };

  it("lässt eine planmäßige Abnahme im Cut-Korridor in Ruhe", () => {
    const urteil = kalorienAnpassung({ ...gemeinsam, korridor: cutKorridor });
    expect(urteil.art).toBe("kein-vorschlag");
  });

  it("würde dieselbe Abnahme im Aufbau-Korridor hochsetzen wollen", () => {
    const urteil = kalorienAnpassung({ ...gemeinsam, korridor: { unten: 0.25, oben: 0.5 } });
    expect(urteil.art).toBe("vorschlag");
    if (urteil.art === "vorschlag") expect(urteil.anpassung.richtung).toBe("hoch");
  });

  /* Steigt das Gewicht mitten im Cut, ist die Obergrenze kein Fett-Limit:
     dort geht es um ein Defizit, das fehlt, nicht um einen Überschuss. */
  it("nimmt im Cut bei steigendem Gewicht zurück, ohne vom Überschuss zu reden", () => {
    const steigt = reihe.map((e, i) => ({ ...e, kg: 95 + i * (0.1 / 7) }));
    const urteil = kalorienAnpassung({
      ...gemeinsam,
      gewicht: steigt,
      korridor: cutKorridor,
    });
    expect(urteil.art).toBe("vorschlag");
    if (urteil.art !== "vorschlag") return;
    expect(urteil.anpassung.richtung).toBe("runter");
    expect(urteil.anpassung.begruendung).toContain(
      "above the target corridor of \u22120.65 to \u22120.35"
    );
    expect(urteil.anpassung.begruendung).not.toContain("surplus");
  });

  it("sagt bei fallendem Gewicht nicht, der Schnitt steige", () => {
    const urteil = kalorienAnpassung({ ...gemeinsam, korridor: cutKorridor });
    if (urteil.art === "kein-vorschlag") {
      expect(urteil.grund).toContain("is falling");
      expect(urteil.grund).not.toContain("is rising");
    }
  });
});

/**
 * Der Coach gegen den Halte-Korridor.
 *
 * Beim Halten liegt null mitten im Korridor. Die Texte, die für Aufbau und
 * Cut geschrieben sind, dürfen dort weder "steigt um 0,00" sagen noch vom
 * Überschuss reden, der ins Fett geht — geplant ist ja gar keiner.
 */
describe("kalorienAnpassung mit Halte-Korridor", () => {
  const halten = phasenlauf().find((l) => l.phase.art === "halten")!.phase.korridor;
  const aktuell = { kcal: 3200, kohlenhydrateG: 380, eiweissG: 200, fettG: 90 };

  function reiheMit(kgProWoche: number) {
    return Array.from({ length: 21 }, (_, i) => ({
      date: new Date(Date.UTC(2027, 8, 1) + i * 864e5).toISOString().slice(0, 10),
      kg: 90 + i * (kgProWoche / 7),
    }));
  }

  function urteilBei(kgProWoche: number) {
    const reihe = reiheMit(kgProWoche);
    return kalorienAnpassung({
      aktuell,
      gewicht: reihe,
      letzteAnpassung: null,
      heute: reihe[reihe.length - 1].date,
      koerpergewichtKg: 90,
      korridor: halten,
    });
  }

  it("lässt ein stehendes Gewicht in Ruhe und sagt es auch so", () => {
    const urteil = urteilBei(0);
    expect(urteil.art).toBe("kein-vorschlag");
    if (urteil.art !== "kein-vorschlag") return;
    expect(urteil.grund).toContain("is holding steady");
    expect(urteil.grund).not.toContain("0.00");
    expect(urteil.grund).toContain("\u22120.25 to 0.25");
  });

  it("nimmt bei steigendem Gewicht zurück, ohne vom Fett-Überschuss zu reden", () => {
    const urteil = urteilBei(0.4);
    expect(urteil.art).toBe("vorschlag");
    if (urteil.art !== "vorschlag") return;
    expect(urteil.anpassung.richtung).toBe("runter");
    expect(urteil.anpassung.zielRate).toBe(0);
    expect(urteil.anpassung.begruendung).toContain("above the target corridor of \u22120.25 to 0.25");
    expect(urteil.anpassung.begruendung).not.toContain("surplus");
  });

  it("legt bei fallendem Gewicht nach", () => {
    const urteil = urteilBei(-0.5);
    expect(urteil.art).toBe("vorschlag");
    if (urteil.art !== "vorschlag") return;
    expect(urteil.anpassung.richtung).toBe("hoch");
    expect(urteil.anpassung.begruendung).toContain("is falling by 0.50 kg per week");
  });

  it("behält im Aufbau den Satz zum Fett-Überschuss", () => {
    const reihe = reiheMit(0.8);
    const urteil = kalorienAnpassung({
      aktuell,
      gewicht: reihe,
      letzteAnpassung: null,
      heute: reihe[reihe.length - 1].date,
      koerpergewichtKg: 90,
    });
    expect(urteil.art).toBe("vorschlag");
    if (urteil.art !== "vorschlag") return;
    expect(urteil.anpassung.begruendung).toContain(
      "above your upper limit of 0.50. From here the surplus mostly goes to fat."
    );
  });
});

describe("Bankziel aus dem Plan", () => {
  it("ZIEL_DATUM ist der Beginn des Cuts", () => {
    const cut = phasenlauf().find((l) => l.phase.art === "cut")!;
    expect(ZIEL_DATUM).toBe(cut.vonIso);
  });
});
