import { describe, expect, it } from "vitest";
import {
  offenePlaetze,
  rotationFor,
  tageFuerPushIndex,
  trainingAls,
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
});
