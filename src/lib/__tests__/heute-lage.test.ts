import { describe, expect, it } from "vitest";
import { lageHeute } from "../heute-lage";

const bankGut = { lage: "laeuft" as const, vorschlag: "Keep going.", zielImPlan: true };

describe("lageHeute", () => {
  it("meldet auf Kurs, wenn Gewicht und Bank passen", () => {
    expect(lageHeute({ gewichtKg: 84.2, sollKg: 84.0, bank: bankGut })).toEqual({
      aufKurs: true,
      titel: "Bench and weight on track.",
      schritte: [],
    });
  });

  it("sagt bei zu wenig Gewicht, wie viel mehr zu essen ist", () => {
    const l = lageHeute({ gewichtKg: 83.0, sollKg: 84.0, bank: bankGut });
    expect(l.aufKurs).toBe(false);
    expect(l.schritte[0]).toContain("1.0 kg under plan");
    expect(l.schritte[0]).toContain("450 kcal more");
  });

  it("deckelt den Kalorienrat bei 500", () => {
    expect(lageHeute({ gewichtKg: 90, sollKg: 84, bank: null }).schritte[0]).toContain("500 kcal less");
  });

  it("gibt den Rat des Bank-Coachs weiter, wenn die Bank steht", () => {
    const l = lageHeute({
      gewichtKg: 84,
      sollKg: 84,
      bank: { lage: "steht", vorschlag: "Add First Set Last.", zielImPlan: true },
    });
    expect(l.schritte).toEqual(["Bench is stalling: Add First Set Last."]);
  });
});
