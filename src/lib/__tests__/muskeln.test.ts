import { describe, expect, it } from "vitest";
import { muskelnVon, wochenvolumen } from "../muskeln";

describe("muskelnVon", () => {
  it("ordnet Jakobs Übungen zu, auch alte Namen aus der Historie", () => {
    const faelle: [string, string][] = [
      ["Bankdrücken", "Brust"],
      ["Incline Chest Press", "Brust"],
      ["Butterfly", "Brust"],
      ["Shoulder Press", "Schulter"],
      ["Seitheben", "Schulter"],
      ["Trizeps-Pushdown", "Trizeps"],
      ["Hex Squat", "Quads"],
      ["Hack Squat", "Quads"],
      ["Leg Extension", "Quads"],
      ["Calf Raise", "Waden"],
      ["Iso-Lateral Row", "Rücken"],
      ["Lat Pulldown", "Rücken"],
      ["Latzug", "Rücken"],
      ["T Bar Row", "Rücken"],
      ["T-Bar Row", "Rücken"],
      ["Machine Reverse Fly", "Schulter"],
      ["Preacher Curl", "Bizeps"],
      ["Leg Curl", "Hamstrings"],
      ["Stiff-Leg-Deadlift", "Hamstrings"],
      ["Stiff-Leg Deadlift", "Hamstrings"],
      ["Crunch (Maschine)", "Bauch"],
      ["Adduktoren (Maschine)", "Adduktoren"],
    ];
    for (const [uebung, haupt] of faelle) {
      expect(muskelnVon(uebung)[0], uebung).toBe(haupt);
    }
  });

  it("lässt Unbekanntes leer statt zu raten", () => {
    expect(muskelnVon("Farmer's Walk")).toEqual([]);
  });

  it("verwechselt nichts über Wortteile oder Bindestriche", () => {
    const faelle: [string, string | undefined][] = [
      ["Leg-Curl", "Hamstrings"],
      ["Chest-Press", "Brust"],
      ["Shoulder-Press", "Schulter"],
      ["Leg-Press", "Quads"],
      ["Leg-Extension", "Quads"],
      ["Slab Press", "Waden"],
      ["Abduktoren (Maschine)", "Gesäß"],
      ["Hip Thrust (Maschine)", "Gesäß"],
      ["Overhead Triceps Extension", "Trizeps"],
      ["Rear Delt Fly", "Schulter"],
      ["Upright Row", "Schulter"],
      ["Nordic Curl", "Hamstrings"],
      ["Pec Deck", "Brust"],
      ["Spoto Press", "Brust"],
      ["Back Extension", "Rücken"],
      ["Ausfallschritte", "Quads"],
      ["Chin-Up", "Rücken"],
      ["Machine Shrug", undefined],
    ];
    for (const [uebung, haupt] of faelle) {
      expect(muskelnVon(uebung)[0], uebung).toBe(haupt);
    }
  });
});

describe("wochenvolumen", () => {
  it("zählt Hauptmuskeln ganz und Nebenmuskeln halb, je Woche", () => {
    const w = wochenvolumen(
      [
        { exercise: "Bankdrücken", datum: "2026-10-20" },
        { exercise: "Bankdrücken", datum: "2026-10-20" },
        { exercise: "Latzug", datum: "2026-10-14" },
      ],
      "2026-10-22",
      2
    );
    expect(w.map((x) => x.montag)).toEqual(["2026-10-12", "2026-10-19"]);
    expect(w[1].jeGruppe).toEqual({ Brust: 2, Trizeps: 1, Schulter: 1 });
    expect(w[1].saetze).toBe(2);
    expect(w[1].ohneZuordnung).toBe(0);
    expect(w[0].jeGruppe).toEqual({ Rücken: 1, Bizeps: 0.5 });
  });

  it("Wochen ohne Training stehen mit null drin, Älteres fällt raus", () => {
    const w = wochenvolumen([{ exercise: "Butterfly", datum: "2026-09-01" }], "2026-10-22", 3);
    expect(w).toHaveLength(3);
    expect(w.every((x) => x.saetze === 0)).toBe(true);
  });
});
