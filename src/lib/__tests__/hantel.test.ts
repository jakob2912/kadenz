import { describe, expect, it } from "vitest";
import { aufwaermen, beladung, beladungText } from "../hantel";

describe("beladung", () => {
  it("nimmt die schwersten Scheiben zuerst", () => {
    expect(beladung(100)).toEqual({ jeSeite: [25, 15], rest: 0 });
    expect(beladung(77.5)).toEqual({ jeSeite: [25, 2.5, 1.25], rest: 0 });
  });

  it("leere Stange und darunter", () => {
    expect(beladung(20)).toEqual({ jeSeite: [], rest: 0 });
    expect(beladungText(beladung(20)!)).toBe("leere Stange");
    expect(beladung(15)).toBeNull();
  });

  it("meldet, was mit dem Vorrat nicht aufgeht, statt still zu runden", () => {
    // 21 kg: je Seite 0,5 — gibt es nicht.
    expect(beladung(21)).toEqual({ jeSeite: [], rest: 1 });
  });

  it("rechnet 1,25er ohne Fließkomma-Rest", () => {
    expect(beladung(22.5)!.rest).toBe(0);
    expect(beladungText(beladung(22.5)!)).toBe("1,25");
  });

  it("kommt ohne 25er aus", () => {
    expect(beladung(70, 20, [20, 10, 5, 2.5, 1.25])).toEqual({ jeSeite: [20, 5], rest: 0 });
  });
});

describe("aufwaermen", () => {
  it("baut die Treppe Stange, 40, 60, 80 %", () => {
    expect(aufwaermen(100)).toEqual([
      { kg: 20, wdh: 10 },
      { kg: 40, wdh: 5 },
      { kg: 60, wdh: 3 },
      { kg: 80, wdh: 2 },
    ]);
  });

  it("lässt Stufen weg, die auf der Stange oder doppelt landen", () => {
    // 40 kg: 40 % = 16 → unter der Stange; 60 % = 25; 80 % = 32,5.
    expect(aufwaermen(40)).toEqual([
      { kg: 20, wdh: 10 },
      { kg: 25, wdh: 3 },
      { kg: 32.5, wdh: 2 },
    ]);
  });

  it("braucht bei leichtem Arbeitsgewicht nichts", () => {
    expect(aufwaermen(20)).toEqual([]);
    expect(aufwaermen(0)).toEqual([]);
  });
});
