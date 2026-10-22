import { describe, expect, it } from "vitest";
import { bestwertArt, bestwertAus } from "../bestwerte";

const bisher = bestwertAus([
  { kg: 80, reps: 5 },
  { kg: 70, reps: 8 },
  { kg: 60, reps: 10 },
])!;

describe("bestwertArt", () => {
  it("schwerer als je zuvor", () => {
    expect(bestwertArt({ kg: 82.5, reps: 1 }, bisher)).toBe("gewicht");
  });

  it("mehr Wiederholungen bei gleichem Gewicht", () => {
    expect(bestwertArt({ kg: 70, reps: 9 }, bisher)).toBe("wdh");
  });

  it("mehr Wiederholungen bei einem Gewicht dazwischen zählen gegen das schwerere", () => {
    // Bei 75 kg gab es nie einen Satz; der Maßstab ist 80 × 5.
    expect(bestwertArt({ kg: 75, reps: 6 }, bisher)).toBe("wdh");
    expect(bestwertArt({ kg: 75, reps: 5 }, bisher)).toBeNull();
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
