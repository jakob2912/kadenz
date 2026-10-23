import { describe, expect, it } from "vitest";
import { bestwertArt, bestwertAus, wdhFuerBestwert } from "../bestwerte";

const bisher = bestwertAus([
  { kg: 80, reps: 5 },
  { kg: 70, reps: 8 },
  { kg: 60, reps: 10 },
])!;

describe("bestwertArt", () => {
  it("schwerer als je zuvor", () => {
    expect(bestwertArt({ kg: 82.5, reps: 1 }, bisher)).toBe("gewicht");
  });

  it("ein Wiederholung mehr im gewohnten Bereich ist kein Bestwert", () => {
    // Doppelprogression: 70 × 9 nach 70 × 8 ist Fortschritt, aber das
    // geschätzte Maximum (91) liegt unter 80 × 5 (93,3).
    expect(bestwertArt({ kg: 70, reps: 9 }, bisher)).toBeNull();
  });

  it("steigt das geschätzte Maximum, ist es einer", () => {
    expect(bestwertArt({ kg: 80, reps: 6 }, bisher)).toBe("e1rm");
  });

  it("jenseits von zehn Wiederholungen zählen sie gegen das schwerere Gewicht", () => {
    // Bei 65 kg gab es nie einen Satz; der Maßstab ist 70 × 8.
    expect(bestwertArt({ kg: 65, reps: 11 }, bisher)).toBe("wdh");
  });

  it("ein langer AMRAP über zehn Wiederholungen ist ein Wiederholungs-Bestwert", () => {
    expect(bestwertArt({ kg: 60, reps: 12 }, bisher)).toBe("wdh");
  });

  it("nichts, wenn der Satz unter allem bleibt", () => {
    expect(bestwertArt({ kg: 70, reps: 8 }, bisher)).toBeNull();
    expect(bestwertArt({ kg: 50, reps: 10 }, bisher)).toBeNull();
  });

  it("ohne Historie nie", () => {
    expect(bestwertArt({ kg: 100, reps: 10 }, null)).toBeNull();
  });
});

describe("bestwertAus", () => {
  it("sortiert die Gewichte absteigend und ignoriert leere Sätze", () => {
    const b = bestwertAus([
      { kg: 0, reps: 10 },
      { kg: 50, reps: 8 },
      { kg: 60, reps: 5 },
      { kg: 50, reps: 9 },
    ]);
    expect(b?.schwersterKg).toBe(60);
    expect(b?.wdhJeKg).toEqual([
      [60, 5],
      [50, 9],
    ]);
  });

  it("null ohne Sätze", () => {
    expect(bestwertAus([])).toBeNull();
  });
});

describe("wdhFuerBestwert", () => {
  it("nennt die kleinste Wiederholungszahl, die das Maximum übertrifft", () => {
    // Bisher bestes Maximum 80 × 5 = 93,3. Bei 75 kg: 75 × (1 + 7/30) = 92,5,
    // 75 × (1 + 8/30) = 95 — also 8.
    expect(wdhFuerBestwert(75, bisher)).toBe(8);
  });

  it("reichen zehn nicht, zählen die Wiederholungen jenseits der Schätzung", () => {
    // 70 × 10 = 93,3 — gleich dem bisherigen Maximum, nicht darüber. Ab 11
    // wird nicht mehr geschätzt; Maßstab sind dann 70 × 8 und 80 × 5.
    expect(wdhFuerBestwert(70, bisher)).toBe(11);
  });

  it("schwerer als je zuvor: schon eine Wiederholung", () => {
    expect(wdhFuerBestwert(85, bisher)).toBe(1);
  });

  it("ohne Historie keine Zahl", () => {
    expect(wdhFuerBestwert(75, null)).toBeNull();
  });
});
