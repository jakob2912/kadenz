import { describe, expect, it } from "vitest";
import { aufwaermen } from "../hantel";

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
