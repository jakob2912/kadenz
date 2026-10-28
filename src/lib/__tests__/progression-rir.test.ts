import { describe, expect, it } from "vitest";
import { progression } from "../coach";

describe("progression mit Wiederholungen in Reserve", () => {
  it("ohne Angabe gilt die alte Regel unverändert", () => {
    expect(progression([{ kg: 50, reps: 6 }, { kg: 50, reps: 5 }]).delta).toBe(0);
  });

  it("sechs Wiederholungen mit drei in Reserve sind die Obergrenze", () => {
    const r = progression([{ kg: 50, reps: 6, rir: 3 }, { kg: 50, reps: 5 }]);
    expect(r.delta).toBe(2.5);
    expect(r.reason).toContain("in reserve");
  });

  it("zu wenig Reserve hält das Gewicht", () => {
    expect(progression([{ kg: 50, reps: 6, rir: 1 }]).delta).toBe(0);
  });

  it("knapp an der Untergrenze reicht auch viel Reserve nicht", () => {
    expect(progression([{ kg: 50, reps: 5, rir: 3 }]).delta).toBe(0);
  });

  it("die Untergrenze hat Vorrang vor jeder Reserve", () => {
    const r = progression([{ kg: 50, reps: 7, rir: 3 }, { kg: 50, reps: 4 }]);
    expect(r.delta).toBeLessThan(0);
  });
});
