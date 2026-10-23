import { describe, expect, it } from "vitest";
import { kalender, montagVon, serie } from "../einheiten";

describe("montagVon", () => {
  it("findet den Montag, auch vom Sonntag aus", () => {
    expect(montagVon("2026-10-22")).toBe("2026-10-19"); // Donnerstag
    expect(montagVon("2026-10-25")).toBe("2026-10-19"); // Sonntag
    expect(montagVon("2026-10-19")).toBe("2026-10-19");
  });
});

describe("kalender", () => {
  it("endet mit der laufenden Woche und markiert die Zukunft", () => {
    const k = kalender(["2026-10-20", "2026-10-21"], "2026-10-22", 2);
    expect(k).toHaveLength(2);
    expect(k[1][0].iso).toBe("2026-10-19");
    expect(k[1][1].einheiten).toBe(1);
    expect(k[1][3].zukunft).toBe(false); // heute
    expect(k[1][4].zukunft).toBe(true);
    expect(k[0][0].iso).toBe("2026-10-12");
  });

  it("zählt zwei Einheiten am selben Tag", () => {
    const k = kalender(["2026-10-20", "2026-10-20"], "2026-10-22", 1);
    expect(k[0][1].einheiten).toBe(2);
  });
});

describe("serie", () => {
  const woche = (montag: string, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.parse(`${montag}T00:00:00Z`) + i * 864e5);
      return d.toISOString().slice(0, 10);
    });

  it("zählt volle Wochen rückwärts", () => {
    const tage = [...woche("2026-10-05", 4), ...woche("2026-10-12", 3)];
    expect(serie(tage, "2026-10-20")).toBe(2);
  });

  it("die laufende Woche bricht die Serie nicht, solange sie offen ist", () => {
    const tage = [...woche("2026-10-12", 4), "2026-10-19"];
    expect(serie(tage, "2026-10-20")).toBe(1);
  });

  it("die laufende Woche zählt mit, sobald sie voll ist", () => {
    const tage = [...woche("2026-10-12", 4), ...woche("2026-10-19", 3)];
    expect(serie(tage, "2026-10-22")).toBe(2);
  });

  it("eine dünne Woche beendet die Serie", () => {
    const tage = [...woche("2026-09-28", 4), ...woche("2026-10-05", 2), ...woche("2026-10-12", 4)];
    expect(serie(tage, "2026-10-20")).toBe(1);
  });
});
