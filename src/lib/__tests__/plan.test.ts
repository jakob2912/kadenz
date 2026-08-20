import { describe, expect, it } from "vitest";
import {
  EINGESCHOBENE_PAUSEN,
  datumFuerPushIndex,
  pushIndexAbDatum,
  rotationFor,
} from "../plan";

/** Mittag UTC liegt in beiden Zeitzonenlagen sicher im gemeinten Wiener Tag. */
const tag = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("rotationFor", () => {
  it("läuft Push – Pull – Rest Day ab dem Anker", () => {
    expect(rotationFor(tag("2026-08-15"))).toMatchObject({ art: "training", einheit: "push" });
    expect(rotationFor(tag("2026-08-16"))).toMatchObject({ art: "training", einheit: "pull" });
    expect(rotationFor(tag("2026-08-17"))).toMatchObject({ art: "pause" });
    expect(rotationFor(tag("2026-08-18"))).toMatchObject({ art: "training", einheit: "push" });
  });

  it("zählt die Push-Tage fortlaufend", () => {
    expect(rotationFor(tag("2026-08-15"))).toMatchObject({ pushIndex: 0 });
    expect(rotationFor(tag("2026-08-18"))).toMatchObject({ pushIndex: 1 });
    // Der 21.08. ist ein eingeschobener Rest Day, Index 2 rutscht auf den 22.
    expect(rotationFor(tag("2026-08-22"))).toMatchObject({ pushIndex: 2 });
  });

  it("hat nur an Push-Tagen einen Index", () => {
    expect(rotationFor(tag("2026-08-16"))).toMatchObject({ pushIndex: null });
  });

  it("rechnet in Wiener Zeit, nicht in Serverzeit", () => {
    /* Auf Vercel läuft der Server in UTC. Zwischen Mitternacht und 02:00
       Wiener Zeit zeigte die Trainingsseite dort die Einheit von gestern —
       Rest Day statt Push. 00:30 Wien ist am 22.08. 22:30 UTC am 21.08. */
    expect(rotationFor(new Date("2026-08-21T22:30:00Z"))).toMatchObject({
      art: "training",
      einheit: "push",
    });
  });

  it("schiebt ab einem eingeschobenen Rest Day alles um einen Tag", () => {
    // 21.08. war laut Rotation Push, ist aber als Erholungstag eingeschoben.
    expect(EINGESCHOBENE_PAUSEN).toContain("2026-08-21");
    expect(rotationFor(tag("2026-08-21"))).toMatchObject({ art: "pause" });
    expect(rotationFor(tag("2026-08-22"))).toMatchObject({ art: "training", einheit: "push" });
    expect(rotationFor(tag("2026-08-23"))).toMatchObject({ art: "training", einheit: "pull" });
    expect(rotationFor(tag("2026-08-24"))).toMatchObject({ art: "pause" });
    expect(rotationFor(tag("2026-08-25"))).toMatchObject({ art: "training", einheit: "push" });
  });

  it("lässt die Tage vor dem Einschub, wo sie waren", () => {
    /* Ein verschobener Anker hätte auch die Vergangenheit neu beschriftet.
       Die geloggten Einheiten liegen aber unter ihrem damaligen Datum. */
    expect(rotationFor(tag("2026-08-15"))).toMatchObject({ einheit: "push" });
    expect(rotationFor(tag("2026-08-18"))).toMatchObject({ einheit: "push" });
    expect(rotationFor(tag("2026-08-19"))).toMatchObject({ einheit: "pull" });
    expect(rotationFor(tag("2026-08-20"))).toMatchObject({ art: "pause" });
  });

  it("gilt auch vor dem Anker", () => {
    expect(rotationFor(tag("2026-08-12"))).toMatchObject({ art: "training", einheit: "push" });
  });
});

describe("Push-Index und Datum", () => {
  it("sind Umkehrungen voneinander", () => {
    for (const index of [0, 1, 5, 23]) {
      expect(pushIndexAbDatum(datumFuerPushIndex(index))).toBe(index);
    }
  });

  it("liefert den nächsten Push-Tag AB einem Zwischentag", () => {
    // 15.08. ist Push (Index 0), 18.08. der nächste (Index 1).
    expect(pushIndexAbDatum("2026-08-16")).toBe(1);
    expect(pushIndexAbDatum("2026-08-17")).toBe(1);
    expect(pushIndexAbDatum("2026-08-18")).toBe(1);
  });

  it("führt über einen Einschub hinweg auf den verschobenen Tag", () => {
    expect(datumFuerPushIndex(1)).toBe("2026-08-18");
    expect(datumFuerPushIndex(2)).toBe("2026-08-22");
    expect(datumFuerPushIndex(3)).toBe("2026-08-25");

    // Der eingeschobene Rest Day selbst zeigt auf den Push-Tag danach.
    expect(pushIndexAbDatum("2026-08-21")).toBe(2);
    expect(pushIndexAbDatum("2026-08-22")).toBe(2);
  });
});
