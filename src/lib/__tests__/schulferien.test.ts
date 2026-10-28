import { describe, expect, it } from "vitest";
import { ferienAm } from "../schulferien";

describe("ferienAm", () => {
  it("kennt die Herbstferien im Burgenland", () => {
    expect(ferienAm("2026-10-28")).toEqual({ name: "Autumn break", bis: "2026-11-02" });
  });

  it("ist an einem Schultag null", () => {
    expect(ferienAm("2026-11-03")).toBeNull();
    expect(ferienAm("2026-10-23")).toBeNull();
  });

  it("schließt Rand-Tage ein", () => {
    expect(ferienAm("2027-01-06")?.name).toBe("Christmas break");
    expect(ferienAm("2027-01-07")).toBeNull();
  });
});
