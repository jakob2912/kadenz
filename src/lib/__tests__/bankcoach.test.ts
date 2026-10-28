import { describe, expect, it } from "vitest";
import {
  bankcoach,
  prognose140,
  schwereBankTage,
  trendSaetze,
  type TmEintrag,
} from "../bankcoach";
import {
  BANK_UEBUNG,
  e1rmReihe,
  kraftTrend,
  neustartVorschlaege,
  rangliste,
  type GeloggterSatz,
} from "../kraft";

function bank(datum: string, saetze: [kg: number, reps: number][]): GeloggterSatz[] {
  return saetze.map(([kg, reps]) => ({ uebung: BANK_UEBUNG, datum, kg, reps }));
}

/** Ein leichter Tag: 3 × 5 bei 72,5 %, dann der Single bei 90 % vom Trainingsmax. */
function leicht(datum: string, fuenfer: number, single: number): GeloggterSatz[] {
  return bank(datum, [
    [fuenfer, 5],
    [fuenfer, 5],
    [fuenfer, 5],
    [single, 1],
  ]);
}

/** Trainingsmax wie bei Jakob: 90 → 95 → 97,5. */
const TM: TmEintrag[] = [
  { tmKg: 90, gueltigAb: "2026-09-01" },
  { tmKg: 95, gueltigAb: "2026-09-21" },
  { tmKg: 97.5, gueltigAb: "2026-10-02" },
];

/**
 * Nachgebaut aus den echten Einheiten bis 14.10.2026: an den schweren Tagen
 * steigt das geschätzte Maximum von 96 auf 102 kg, dazwischen liegen leichte
 * Tage, deren bester Satz der Single bei 90 % ist.
 */
const ECHT: GeloggterSatz[] = [
  ...bank("2026-09-10", [[60, 5], [70, 5], [82.5, 5]]),
  ...leicht("2026-09-13", 65, 80),
  ...bank("2026-09-16", [[60, 5], [70, 5], [85, 5]]),
  ...bank("2026-09-19", [[65, 3], [75, 3], [90, 3]]),
  ...leicht("2026-09-22", 70, 85),
  ...bank("2026-09-25", [[60, 5], [70, 5], [85, 5]]),
  ...leicht("2026-09-28", 70, 85),
  ...bank("2026-10-02", [[65, 5], [75, 5], [85, 5]]),
  ...leicht("2026-10-05", 70, 87.5),
  ...bank("2026-10-09", [[70, 3], [80, 3], [90, 4]]),
  ...leicht("2026-10-12", 70, 87.5),
];

describe("schwereBankTage", () => {
  it("lässt die leichten Tage mit dem 90-%-Single weg", () => {
    const tage = new Set(schwereBankTage(ECHT, TM).map((s) => s.datum));
    expect([...tage]).toEqual([
      "2026-09-10",
      "2026-09-16",
      "2026-09-19",
      "2026-09-25",
      "2026-10-02",
      "2026-10-09",
    ]);
  });

  it("erkennt den leichten Tag am Single, auch wenn die Fünfer sich höher rechnen", () => {
    // 70 × 5 ergibt 81,7 kg, mehr als der Single mit 80 kg.
    const tag = leicht("2026-09-13", 70, 80);
    expect(schwereBankTage(tag, TM)).toEqual([]);
  });

  it("lässt einen leichten Tag ohne Single weg", () => {
    const tag = bank("2026-10-20", [[70, 5], [70, 5], [70, 5]]);
    expect(schwereBankTage(tag, TM)).toEqual([]);
  });

  it("lässt einen Deload-Tag weg", () => {
    const deload = bank("2026-10-20", [[40, 5], [50, 5], [60, 5]]);
    expect(schwereBankTage(deload, [{ tmKg: 100, gueltigAb: "2026-10-01" }])).toEqual([]);
  });

  it("behält einen schweren Single, etwa am Testtag", () => {
    const test = bank("2026-10-20", [[90, 1], [100, 1]]);
    expect(schwereBankTage(test, TM)).toHaveLength(2);
  });

  it("behält Tage vor dem ersten Trainingsmax", () => {
    const frueh = leicht("2026-08-20", 65, 80);
    expect(schwereBankTage(frueh, TM)).toHaveLength(frueh.length);
  });

  it("gilt in trendSaetze nur fürs Bankdrücken", () => {
    const andere = leicht("2026-09-13", 65, 80).map((s) => ({ ...s, uebung: "Dips" }));
    expect(trendSaetze("Dips", andere, TM)).toHaveLength(andere.length);
    expect(trendSaetze(BANK_UEBUNG, leicht("2026-09-13", 65, 80), TM)).toEqual([]);
  });
});

describe("bankcoach", () => {
  it("erkennt den Anstieg, den die gemischte Reihe flach rechnet", () => {
    // Alle Tage zusammen: die Säge aus schweren und leichten Tagen steht.
    expect(kraftTrend(e1rmReihe(ECHT))).toMatchObject({ verwertbar: true });
    const gemischt = kraftTrend(e1rmReihe(ECHT));
    if (gemischt.verwertbar) expect(gemischt.richtung).not.toBe("steigt");

    const coach = bankcoach({ saetze: ECHT, tmHistorie: TM, tmKg: 97.5, heuteIso: "2026-10-14" });
    expect(coach.lage).toBe("laeuft");
    expect(coach.schwereTage).toBe(6);
    expect(coach.vorschlag.art).toBe("weiter");
    expect(coach.schaetzungKg).toBeCloseTo(102, 1);
  });

  const flach = [
    ...bank("2026-09-02", [[85, 5]]),
    ...bank("2026-09-09", [[85, 5]]),
    ...bank("2026-09-16", [[85, 5]]),
    ...bank("2026-09-23", [[85, 5]]),
    ...bank("2026-09-30", [[85, 5]]),
    ...bank("2026-10-07", [[85, 5]]),
  ];

  it("setzt bei Stillstand einen zu hohen Trainingsmax zurück auf 90 %", () => {
    const coach = bankcoach({
      saetze: flach,
      tmHistorie: [{ tmKg: 97.5, gueltigAb: "2026-09-01" }],
      tmKg: 97.5,
      heuteIso: "2026-10-14",
    });
    expect(coach.lage).toBe("steht");
    expect(coach.vorschlag).toMatchObject({ art: "tm_zurueck", tmNeuKg: 90 });
    expect(coach.vorschlag.text).toContain("reset");
  });

  it("schlägt bei Stillstand mit passendem Trainingsmax First Set Last vor", () => {
    const coach = bankcoach({
      saetze: flach,
      tmHistorie: [{ tmKg: 87.5, gueltigAb: "2026-09-01" }],
      tmKg: 87.5,
      heuteIso: "2026-10-14",
    });
    expect(coach.lage).toBe("steht");
    expect(coach.vorschlag).toMatchObject({
      art: "volumen",
      fslKg: { 1: 57.5, 2: 62.5, 3: 65 },
    });
    expect(coach.vorschlag.text).toContain("No joker sets");
  });

  it("rät bei Rückschritt mit passendem Trainingsmax zur Erholung", () => {
    const fallend = [
      ...bank("2026-09-02", [[85, 5]]),
      ...bank("2026-09-09", [[85, 4]]),
      ...bank("2026-09-16", [[85, 3]]),
      ...bank("2026-09-23", [[82.5, 3]]),
      ...bank("2026-09-30", [[80, 3]]),
      ...bank("2026-10-07", [[80, 2]]),
    ];
    const coach = bankcoach({
      saetze: fallend,
      tmHistorie: [{ tmKg: 75, gueltigAb: "2026-09-01" }],
      tmKg: 75,
      heuteIso: "2026-10-14",
    });
    expect(coach.lage).toBe("faellt");
    expect(coach.vorschlag.art).toBe("erholung");
  });

  it("sagt ehrlich, wenn die schweren Tage nicht reichen", () => {
    const coach = bankcoach({
      saetze: bank("2026-10-09", [[90, 4]]),
      tmHistorie: TM,
      tmKg: 97.5,
      heuteIso: "2026-10-14",
    });
    expect(coach.lage).toBe("unklar");
    expect(coach.vorschlag.art).toBe("abwarten");
    expect(coach.vorschlag.text).toContain("1 of 4");
  });

  it("schaut nur acht Wochen zurück", () => {
    const alt = bank("2026-07-01", [[100, 5]]);
    const coach = bankcoach({
      saetze: [...alt, ...ECHT],
      tmHistorie: TM,
      tmKg: 97.5,
      heuteIso: "2026-10-14",
    });
    expect(coach.abIso).toBe("2026-08-19");
    expect(coach.schaetzungKg).toBeCloseTo(102, 1);
  });
});

describe("prognose140", () => {
  const steigend = kraftTrend([
    { datum: "2026-09-01", e1rm: 100 },
    { datum: "2026-09-08", e1rm: 100 },
    { datum: "2026-09-29", e1rm: 104 },
    { datum: "2026-10-06", e1rm: 104 },
  ]);

  it("rechnet Datum und nötiges Tempo aus dem gemessenen Trend", () => {
    const p = prognose140(steigend, "2026-10-14");
    expect(p.verwertbar).toBe(true);
    if (!p.verwertbar) return;
    // 4 % auf vier Wochen von 100 kg: 4 kg je 28 Tage, 36 kg fehlen → 252 Tage.
    expect(p.kgPro4Wochen).toBeCloseTo(4, 5);
    expect(p.erreichtAm).toBe("2027-06-23");
    expect(p.imPlan).toBe(true);
    // 443 Tage bis 31.12.2027.
    expect(p.noetigKgProMonat).toBeCloseTo(36 / (443 / 30.44), 5);
    expect(p.noetigProzentPro4Wochen).toBeCloseTo(((36 / 443) * 28 * 100) / 104, 5);
  });

  it("warnt bei kurzer Spanne", () => {
    const p = prognose140(steigend, "2026-10-14");
    expect(p.verwertbar && p.belastbar).toBe(false);
    if (p.verwertbar) expect(p.text).toContain("Careful");
  });

  it("nennt kein Datum, wenn es nicht steigt", () => {
    const flach = kraftTrend([
      { datum: "2026-09-01", e1rm: 100 },
      { datum: "2026-09-15", e1rm: 100 },
      { datum: "2026-09-29", e1rm: 100 },
      { datum: "2026-10-13", e1rm: 99.5 },
    ]);
    const p = prognose140(flach, "2026-10-14");
    expect(p.verwertbar).toBe(true);
    if (!p.verwertbar) return;
    expect(p.erreichtAm).toBeNull();
    expect(p.imPlan).toBe(false);
    expect(p.text).toContain("never");
  });

  it("rechnet nicht, wenn der Trend nicht verwertbar ist", () => {
    const p = prognose140(kraftTrend([{ datum: "2026-10-01", e1rm: 100 }]), "2026-10-14");
    expect(p).toMatchObject({ verwertbar: false });
    if (!p.verwertbar) expect(p.grund).toContain("No projection");
  });
});

// ─────────────────────────────────────────────────────────────
// Neustart nach Technikwechsel
// ─────────────────────────────────────────────────────────────

function uebung(name: string, tage: [datum: string, kg: number, reps: number][]): GeloggterSatz[] {
  return tage.map(([datum, kg, reps]) => ({ uebung: name, datum, kg, reps }));
}

/** Leg Extension: beidbeinig bis Ende September, ab 02.10.2026 einbeinig. */
const LEG_EXTENSION = uebung("Leg Extension", [
  ["2026-09-01", 80, 8],
  ["2026-09-08", 80, 8],
  ["2026-09-15", 82.5, 8],
  ["2026-09-22", 82.5, 8],
  ["2026-10-02", 40, 8],
  ["2026-10-06", 40, 8],
  ["2026-10-09", 42.5, 8],
  ["2026-10-13", 42.5, 8],
]);

describe("Neustart", () => {
  it("ohne Neustart liest der Trend den Technikwechsel als Einbruch", () => {
    const urteil = kraftTrend(e1rmReihe(LEG_EXTENSION));
    expect(urteil.verwertbar && urteil.richtung).toBe("faellt");
  });

  it("wertet erst ab dem Neustart und sagt es dazu", () => {
    const urteil = kraftTrend(e1rmReihe(LEG_EXTENSION), "2026-10-02");
    expect(urteil.neustartAb).toBe("2026-10-02");
    // Vier Tage, aber nur elf Tage Spanne: noch kein Urteil statt "fällt".
    expect(urteil.verwertbar).toBe(false);
    if (!urteil.verwertbar) {
      expect(urteil.grund).toContain("10 days to go");
      expect(urteil.grund).toContain("Counted from 02/10/2026");
    }
  });

  it("schreibt den Hinweis auch in ein verwertbares Urteil", () => {
    const urteil = kraftTrend(e1rmReihe(LEG_EXTENSION), "2026-09-01");
    expect(urteil.verwertbar).toBe(true);
    if (urteil.verwertbar) expect(urteil.text).toContain("Counted from 01/09/2026");
  });

  it("greift in der Rangliste je Übung", () => {
    const [rang] = rangliste({ "Leg Extension": LEG_EXTENSION }, { "Leg Extension": "2026-10-02" });
    expect(rang.urteil.verwertbar).toBe(false);
    expect(rang.urteil.neustartAb).toBe("2026-10-02");
  });

  it("schlägt den ersten Tag auf dem neuen Niveau als Neustart vor", () => {
    const [v] = neustartVorschlaege({ "Leg Extension": LEG_EXTENSION });
    expect(v.uebung).toBe("Leg Extension");
    // 06.10. und 09.10. liegen gegen ein Fenster, das noch den 22.09. enthält,
    // ebenfalls tief — vorgeschlagen wird trotzdem der erste Tag.
    expect(v.datum).toBe("2026-10-02");
    expect(v.prozent).toBeLessThanOrEqual(-8);
  });

  it("schlägt nach gesetztem Neustart nichts mehr vor", () => {
    expect(neustartVorschlaege({ "Leg Extension": LEG_EXTENSION }, { "Leg Extension": "2026-10-02" })).toEqual([]);
  });

  it("lässt kleine Schwankungen und das Bankdrücken in Ruhe", () => {
    const ruhig = uebung("Latzug", [
      ["2026-09-01", 70, 8],
      ["2026-09-08", 70, 7],
      ["2026-09-15", 72.5, 7],
      ["2026-09-22", 70, 7],
    ]);
    expect(neustartVorschlaege({ Latzug: ruhig, [BANK_UEBUNG]: ECHT })).toEqual([]);
  });
});
