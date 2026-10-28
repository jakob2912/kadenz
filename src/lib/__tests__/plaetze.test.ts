import { describe, expect, it } from "vitest";
import {
  belegtePlaetze,
  offenePlaetze,
  planVorschau,
  pushTageAb,
  rotationFor,
  tageFuerPushIndex,
  trainingAls,
  wochenbilanz,
  type Eintrag,
  type Wochenwahl,
} from "../plan";

const tag = (iso: string) => new Date(`${iso}T12:00:00Z`);

/* Woche ab 26.10.2026 mit Fr + Sa: Push Mo, Pull Mi, Push Fr, Pull Sa. */
const wahlen: Wochenwahl[] = [{ woche: "2026-10-26", frueh: "mo", spaet: "frsa" }];
const push = (datum: string): Eintrag => ({ datum, einheit: "push" });
const pull = (datum: string): Eintrag => ({ datum, einheit: "pull" });

describe("Plätze statt fester Wochentage", () => {
  it("planmäßig trainiert, ist alles wie im Wochenplan", () => {
    const log = [push("2026-10-26")];
    expect(rotationFor(tag("2026-10-28"), wahlen, log)).toEqual(rotationFor(tag("2026-10-28"), wahlen));
    expect(rotationFor(tag("2026-10-29"), wahlen, [...log, pull("2026-10-28")])).toMatchObject({ art: "pause" });
    expect(rotationFor(tag("2026-10-30"), wahlen, [...log, pull("2026-10-28")])).toEqual(
      rotationFor(tag("2026-10-30"), wahlen)
    );
  });

  it("Mo Push, Di trotzdem Pull: Mi ist Rest Day", () => {
    const log = [push("2026-10-26"), pull("2026-10-27")];
    expect(rotationFor(tag("2026-10-28"), wahlen, log)).toEqual({ art: "pause", naechste: "push" });
    expect(offenePlaetze("2026-10-28", wahlen, log)).toEqual([push("2026-10-30"), pull("2026-10-31")]);
  });

  it("Do trotzdem Push nimmt das Bankprogramm vom Fr, und Fr wird frei", () => {
    const log = [push("2026-10-26"), pull("2026-10-27")];
    const fr = rotationFor(tag("2026-10-30"), wahlen);
    const doPush = trainingAls(tag("2026-10-29"), "push", wahlen, log);
    expect(fr.art === "training" && fr.pushIndex).not.toBe(false);
    expect(doPush.pushIndex).toBe(fr.art === "training" ? fr.pushIndex : -1);

    const danach = [...log, push("2026-10-29")];
    expect(rotationFor(tag("2026-10-30"), wahlen, danach)).toEqual({ art: "pause", naechste: "pull" });
    expect(rotationFor(tag("2026-10-31"), wahlen, danach)).toMatchObject({ art: "training", einheit: "pull" });
    expect(tageFuerPushIndex(doPush.pushIndex!, wahlen, danach)).toEqual(["2026-10-29"]);
  });

  it("nach zwei Tagen am Stück ist immer Rest Day", () => {
    const log = [push("2026-10-26"), pull("2026-10-27"), push("2026-10-29"), pull("2026-10-30")];
    expect(rotationFor(tag("2026-10-31"), wahlen, log)).toMatchObject({ art: "pause" });
  });

  it("ein ausgefallener Tag wird nachgeholt, mit seiner Vorgabe", () => {
    const mo = rotationFor(tag("2026-10-26"), wahlen);
    const di = rotationFor(tag("2026-10-27"), wahlen, []);
    expect(di).toMatchObject({ art: "training", einheit: "push" });
    expect(di.art === "training" && di.pushIndex).toBe(mo.art === "training" && mo.pushIndex);
  });

  it("Push und Pull wechseln sich beim Nachholen ab", () => {
    // Mo und Mi fallen aus, Do Push nachgeholt — Fr ist Pull dran, nicht noch ein Push.
    const log = [push("2026-10-29")];
    expect(rotationFor(tag("2026-10-30"), wahlen, log)).toMatchObject({ art: "training", einheit: "pull" });
  });

  it("ohne freien Platz ist es eine Extra-Einheit, die nichts verschiebt", () => {
    const log = [push("2026-10-26"), push("2026-10-28")];
    const extra = trainingAls(tag("2026-10-29"), "push", wahlen, log);
    expect(extra.pushIndex).not.toBeNull();
    expect(rotationFor(tag("2026-10-31"), wahlen, log)).toMatchObject({ art: "training", einheit: "pull" });
  });

  it("an einem Tag mit Eintrag steht genau dieser", () => {
    const log = [pull("2026-10-26")];
    expect(rotationFor(tag("2026-10-26"), wahlen, log)).toEqual({
      art: "training",
      einheit: "pull",
      pushIndex: null,
    });
  });

  it("die Zwei-Tage-Pause gilt auch über den Sonntag hinweg", () => {
    // Woche davor Sa + So trainiert: Mo ist Rest Day.
    const log = [push("2026-10-24"), pull("2026-10-25")];
    expect(rotationFor(tag("2026-10-26"), wahlen, log)).toMatchObject({ art: "pause" });
  });

  it("ein nachgeholter Push trägt den AMRAP-Satz des ausgefallenen Tags", () => {
    const mo = rotationFor(tag("2026-10-26"), wahlen);
    const log = [push("2026-10-27")];
    expect(tageFuerPushIndex(mo.art === "training" ? mo.pushIndex! : -1, wahlen, log)).toEqual([
      "2026-10-27",
    ]);
  });

  it("zählt die Woche: geplant und gelaufen", () => {
    const log = [push("2026-10-26"), pull("2026-10-27"), push("2026-10-31")];
    expect(wochenbilanz("2026-10-28", wahlen, log)).toEqual({ geplant: 4, erledigt: 3 });
  });

  it("an einem Tag mit Push und Pull zählt der Push", () => {
    const log = [pull("2026-10-26"), push("2026-10-26")];
    expect(rotationFor(tag("2026-10-26"), wahlen, log)).toMatchObject({ einheit: "push" });
  });

  it("ein Extra-Push am planmäßigen Push-Tag nimmt dessen Vorgabe", () => {
    // Fr-Platz schon am Di vorgezogen: der Fr-Push ist extra, mit dem Index des Fr.
    const fr = rotationFor(tag("2026-10-30"), wahlen);
    const log = [push("2026-10-26"), push("2026-10-27")];
    expect(trainingAls(tag("2026-10-30"), "push", wahlen, log).pushIndex).toBe(
      fr.art === "training" ? fr.pushIndex : -1
    );
  });

  it("Einheiten vor den festen Tagen belegen keinen Platz", () => {
    const w0: Wochenwahl[] = [];
    expect(belegtePlaetze("2026-09-14", w0, [push("2026-09-14"), pull("2026-09-15")]).size).toBe(0);
  });

  it("die Schaltersperre folgt den belegten Plätzen, nicht den Wochentagen", () => {
    // Di trotzdem Pull belegt den Mi-Platz; Mo/Di bleiben frei.
    expect([...belegtePlaetze("2026-10-26", wahlen, [pull("2026-10-27")])]).toEqual(["2026-10-28"]);
    // Do Push belegt den Fr-Platz — der Wochenend-Schalter ist damit fest.
    expect(belegtePlaetze("2026-10-26", wahlen, [push("2026-10-26"), push("2026-10-29")]).has("2026-10-30")).toBe(true);
  });

  it("die Vorschau rechnet mit den vorgeschlagenen Einheiten weiter", () => {
    // Mo fällt aus: Di holt ihn nach, Mi Pull, Fr Push, Sa Pull.
    const v = planVorschau("2026-10-27", wahlen, [], 5).map((t) => `${t.datum.slice(8)} ${t.einheit}`);
    expect(v).toEqual(["27 push", "28 pull", "30 push", "31 pull"]);
  });

  it("der Tag eines Push-Index folgt dem vorgezogenen Training", () => {
    const fr = rotationFor(tag("2026-10-30"), wahlen);
    const index = fr.art === "training" ? fr.pushIndex! : -1;
    const log = [push("2026-10-26"), pull("2026-10-27")];
    // Noch nicht trainiert: Fr laut Vorschau. Am Do vorgezogen: der Do.
    expect(pushTageAb("2026-10-28", wahlen, log)(index)).toBe("2026-10-30");
    expect(pushTageAb("2026-10-29", wahlen, [...log, push("2026-10-29")])(index)).toBe("2026-10-29");
  });
});
