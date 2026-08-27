import { describe, expect, it } from "vitest";
import { mengeSkalieren, skalierung, type ZutatMengen } from "../portionen";

/** Eine Zutat, wie sie aus dem Katalog kommt. */
function zutat(felder: Partial<ZutatMengen> = {}): ZutatMengen {
  return { mengeLautPlan: 150, menge: 150, einheit: "g", anpassbar: true, ...felder };
}

describe("skalierung", () => {
  /* Der Fall, für den das Ganze gebaut ist: am 27.08.2026 nahm Jakob den
     Vorschlag 3600 → 3400 kcal an, die Kohlenhydrate gingen von 560 auf 510 —
     und der Plan zeigte weiter die Mengen für 3600. */
  it("rechnet das Verhältnis der Kohlenhydratziele", () => {
    const s = skalierung(560, 510)!;
    expect(s.faktor).toBeCloseTo(0.9107, 4);
    expect(s.hinweis).toBeNull();
  });

  it("steht auf 1, solange der Ausgangsplan gilt", () => {
    expect(skalierung(560, 560)!.faktor).toBe(1);
  });

  /* Ein Ziel, das um mehr als die Hälfte abweicht, ist kein angepasster Plan
     mehr. Dann lieber die Grenze und ein Satz dazu als lautlos 40 g Reis. */
  it("begrenzt den Faktor und sagt es", () => {
    const runter = skalierung(560, 100)!;
    expect(runter.faktor).toBe(0.5);
    expect(runter.hinweis).toContain("weit unter");

    const hoch = skalierung(560, 1200)!;
    expect(hoch.faktor).toBe(1.5);
    expect(hoch.hinweis).toContain("weit über");
  });

  it("gibt ohne brauchbare Zahlen nichts zurück", () => {
    expect(skalierung(0, 510)).toBeNull();
    expect(skalierung(560, 0)).toBeNull();
    expect(skalierung(Number.NaN, 510)).toBeNull();
  });
});

describe("mengeSkalieren", () => {
  const s = skalierung(560, 510);

  it("kürzt die Kohlenhydratquellen auf 5 g genau", () => {
    expect(mengeSkalieren(zutat({ mengeLautPlan: 150 }), s)).toBe(135); // Reis
    expect(mengeSkalieren(zutat({ mengeLautPlan: 100 }), s)).toBe(90); // Haferflocken
    expect(mengeSkalieren(zutat({ mengeLautPlan: 40 }), s)).toBe(35); // Maltodextrin
  });

  /* Eiweiß und Fett bleiben — der Coach nimmt die Kalorien ausdrücklich aus
     den Kohlenhydraten, und eine Kürzung quer über den Plan nähme genau das
     weg, was stehen bleiben soll. */
  it("rührt Eiweiß- und Fettquellen nicht an", () => {
    expect(mengeSkalieren(zutat({ mengeLautPlan: 100, anpassbar: false }), s)).toBe(100);
    expect(mengeSkalieren(zutat({ mengeLautPlan: 10, anpassbar: false }), s)).toBe(10);
  });

  /* 0,91 Bananen gibt es nicht, und "1" auf "1" zu runden wäre eine
     Skalierung, die keine ist. */
  it("lässt Stückzahlen stehen", () => {
    expect(mengeSkalieren(zutat({ mengeLautPlan: 1, einheit: "Stk" }), s)).toBe(1);
  });

  it("gibt ohne Skalierung die Planmenge zurück", () => {
    expect(mengeSkalieren(zutat({ mengeLautPlan: 150 }), null)).toBe(150);
  });

  /* Sonst verschwände eine kleine Zutat bei starker Kürzung ganz aus dem
     Plan — 0 g Maltodextrin ist keine Menge, das ist ein Weglassen. */
  it("fällt nie unter 5 g", () => {
    expect(mengeSkalieren(zutat({ mengeLautPlan: 5 }), skalierung(560, 300))).toBe(5);
  });
});
