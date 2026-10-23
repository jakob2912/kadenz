import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ prisma: {} }));

const { gewichteVereinen, rueckfuellungFaellig, sicherAb, vorTagen } = await import(
  "../gesundheit-ablage"
);

describe("gewichteVereinen", () => {
  it("Google gewinnt bei gleichem Tag, eigene Tage kommen dazu, sortiert", () => {
    const google = [
      { date: "2026-10-20", kg: 84.1 },
      { date: "2026-10-22", kg: 84.3 },
    ];
    const eigen = [
      { date: "2026-10-22", kg: 99 },
      { date: "2026-10-23", kg: 84.5 },
      { date: "2026-10-01", kg: 83.0 },
    ];
    expect(gewichteVereinen(google, eigen)).toEqual([
      { date: "2026-10-01", kg: 83.0 },
      { date: "2026-10-20", kg: 84.1 },
      { date: "2026-10-22", kg: 84.3 },
      { date: "2026-10-23", kg: 84.5 },
    ]);
  });
});

describe("vorTagen", () => {
  it("rechnet Kalendertage zurück, auch über den Monatswechsel", () => {
    expect(vorTagen(30, "2026-10-23")).toBe("2026-09-23");
    expect(vorTagen(365, "2026-10-23")).toBe("2025-10-23");
  });
});

describe("sicherAb", () => {
  it("lässt den Tag nach dem Fensterbeginn mit draußen (angeschnittene Nacht)", () => {
    expect(sicherAb("2026-09-30")).toBe("2026-10-01");
  });
});

describe("rueckfuellungFaellig", () => {
  it("ist fällig, solange nichts versucht wurde", () => {
    expect(rueckfuellungFaellig(null, "2026-10-23")).toBe(true);
    expect(rueckfuellungFaellig("kaputt", "2026-10-23")).toBe(true);
  });

  it("versucht es nach einem Fehlschlag erst am nächsten Tag wieder", () => {
    const merker = JSON.stringify({ versuch: "2026-10-23" });
    expect(rueckfuellungFaellig(merker, "2026-10-23")).toBe(false);
    expect(rueckfuellungFaellig(merker, "2026-10-24")).toBe(true);
  });

  it("ist nach Erfolg nie wieder fällig", () => {
    const merker = JSON.stringify({ versuch: "2026-10-01", erledigt: "2026-10-01" });
    expect(rueckfuellungFaellig(merker, "2026-10-23")).toBe(false);
  });
});
