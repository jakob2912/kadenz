import { describe, expect, it } from "vitest";
import { briefing, readiness, type ReadinessBaseline, type ReadinessInput } from "../coach";

const baseline: ReadinessBaseline = { sleepMin: 425, deepMin: 72, restingHr: 52, hrv: 68 };

function bau(heute: Partial<ReadinessInput>, extra: Partial<Parameters<typeof briefing>[0]> = {}) {
  const werte: ReadinessInput = { ...baseline, ...heute };
  return briefing({
    heute: werte,
    baseline,
    urteil: readiness(werte, baseline),
    nachtDatum: "2026-08-20",
    heuteIso: "2026-08-20",
    // Trainingstag ist der Normalfall dieser Tests; die Rest-Day-Fassung der
    // Texte steht weiter unten in eigenen Fällen.
    trainingHeute: true,
    stunde: 9,
    ...extra,
  });
}

describe("briefing", () => {
  it("schlägt nichts vor, wenn kein Wert weit genug daneben liegt", () => {
    /* Der Kern der Sache: eine Liste, die immer drei Punkte hat, wird nach
       einer Woche überblättert, weil sie an guten Tagen dasselbe sagt wie an
       schlechten. */
    const b = bau({});
    expect(b.vorschlaege).toEqual([]);
    expect(b.befund).toContain("Volle Freigabe");
  });

  it("nennt die Schlafdauer gegen die persönliche Referenz", () => {
    const b = bau({ sleepMin: 370 });
    expect(b.schlaf).toContain("6 h 10");
    expect(b.schlaf).toContain("7 h 05");
    expect(b.schlaf).toContain("55 Minuten weniger");
  });

  it("beziffert, wie viel früher ins Bett — statt 'schlaf mehr'", () => {
    const b = bau({ sleepMin: 370 });
    const schlafRat = b.vorschlaege.find((v) => v.text.includes("ins Bett"));
    expect(schlafRat?.text).toContain("55 Minuten früher");
  });

  it("sagt beim Tiefschlaf dazu, dass die Uhr die Ursache nicht misst", () => {
    const b = bau({ deepMin: 40 });
    const tief = b.vorschlaege.find((v) => v.grund.includes("Tiefschlaf"));
    expect(tief?.grund).toContain("misst die Uhr nicht");
  });

  it("spricht am Rest Day keine Freigabe fürs Krafttraining aus", () => {
    /* "Krafttraining ja" an einem Tag, an dem keins ansteht, beantwortet eine
       Frage, die niemand gestellt hat — und liest sich wie eine Aufforderung,
       den Rest Day zu überspringen. */
    for (const werte of [{}, { restingHr: 56 }, { hrv: 40, restingHr: 60, sleepMin: 300 }]) {
      const b = bau(werte, { trainingHeute: false });
      expect(b.befund).toContain("Rest Day");
      expect(b.befund).not.toContain("Krafttraining");
      expect(b.befund).not.toContain("Freigabe");
    }
  });

  it("schiebt den Volumen-Rat am Rest Day auf die nächste Einheit", () => {
    // Heute gibt es kein Volumen, aus dem sich etwas herausnehmen ließe.
    const b = bau({ hrv: 54 }, { trainingHeute: false });
    const hrvRat = b.vorschlaege.find((v) => v.grund.includes("HRV"));
    expect(hrvRat?.text).toContain("nächste Einheit");
    expect(hrvRat?.text).not.toContain("Heute");
  });

  it("rät bei erhöhtem Ruhepuls von Cardio ab, nicht vom Krafttraining", () => {
    const b = bau({ restingHr: 56 });
    const puls = b.vorschlaege.find((v) => v.grund.includes("Ruhepuls"));
    expect(puls?.text).toContain("keine zusätzliche Ausdauerbelastung");
  });

  it("nimmt bei gedrückter HRV Volumen raus, nicht Gewicht", () => {
    const b = bau({ hrv: 54 });
    const hrvRat = b.vorschlaege.find((v) => v.grund.includes("HRV"));
    expect(hrvRat?.text).toContain("Volumen raus statt Gewicht");
  });

  it("meldet den Koffein-Cutoff nur an Trainingstagen nach 15 Uhr", () => {
    const ohne = bau({}, { trainingHeute: true, stunde: 14 });
    expect(ohne.vorschlaege.some((v) => v.text.includes("Koffein"))).toBe(false);

    const ruhetag = bau({}, { trainingHeute: false, stunde: 17 });
    expect(ruhetag.vorschlaege.some((v) => v.text.includes("Koffein"))).toBe(false);

    const faellig = bau({}, { trainingHeute: true, stunde: 16 });
    expect(faellig.vorschlaege.some((v) => v.text.includes("Koffein"))).toBe(true);
  });

  it("stellt veralteten Nächten das Datum voran, statt sie als heute auszugeben", () => {
    const b = bau({ sleepMin: 370 }, { nachtDatum: "2026-08-17", heuteIso: "2026-08-20" });
    expect(b.schlaf).toContain("2026-08-17");
    expect(b.schlaf).toContain("nicht heute Nacht");
  });
});
